import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, recordConsumption } from './api/client';
import { getLocalDateString } from './utils/date';
import { ConnectionState } from './types/api';
import { AppPage } from './types/navigation';
import { LabelAnalysisReport } from './types/label';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MandatoryConsumptionModal, NavigationTarget } from './components/MandatoryConsumptionModal';
import { HomePage } from './pages/HomePage';
import { ScanPage } from './pages/ScanPage';
import { NutritionPage } from './pages/NutritionPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';

export interface RouteState {
  page: AppPage;
  sectionId?: string;
  analysisId?: string;
}

function parseRouteHash(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { page: 'home' };

  const [routePart, queryPart] = hash.split('?');
  const validPages: AppPage[] = ['home', 'scan', 'nutrition', 'login', 'register', 'onboarding'];
  const page = validPages.includes(routePart as AppPage) ? (routePart as AppPage) : 'home';

  let sectionId: string | undefined;
  let analysisId: string | undefined;

  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    sectionId = params.get('section') || undefined;
    analysisId = params.get('id') || undefined;
  }

  return { page, sectionId, analysisId };
}

function AppContent() {
  const [routeState, setRouteState] = useState<RouteState>(() => parseRouteHash());
  const currentPage = routeState.page;
  const targetSectionId = routeState.sectionId || null;
  const targetAnalysisId = routeState.analysisId || null;

  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  // Active unrecorded product state
  const [pendingReport, setPendingReport] = useState<LabelAnalysisReport | null>(null);
  const [pendingProductName, setPendingProductName] = useState<string>('');
  const [isConsumptionResolved, setIsConsumptionResolved] = useState<boolean>(false);
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState<boolean>(false);
  const [pendingTargetAction, setPendingTargetAction] = useState<NavigationTarget>(null);

  const { logout, token, isAuthenticated } = useAuth();

  const probeBackend = useCallback(async () => {
    setConnectionState('checking');
    const start = performance.now();
    try {
      await checkBackendHealth();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setConnectionState('connected');
    } catch {
      setLatency(null);
      setConnectionState('error');
    }
  }, []);

  useEffect(() => {
    probeBackend();
  }, [probeBackend]);

  // Sync with browser back/forward and URL hash changes, guarding unrecorded scans
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteHash();
      // Guard against browser back/forward or manual hash change if consumption decision is pending
      if (currentPage === 'scan' && pendingReport && !isConsumptionResolved && parsed.page !== 'scan') {
        // Revert hash so URL bar reflects that we are still on scan
        window.location.hash = '#/scan';
        setPendingTargetAction({
          type: 'page',
          page: parsed.page,
          sectionId: parsed.sectionId,
          analysisId: parsed.analysisId,
        });
        setIsConsumptionModalOpen(true);
        return;
      }
      setRouteState(parsed);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentPage, pendingReport, isConsumptionResolved]);

  const handleNavigate = (page: AppPage, options?: { sectionId?: string; analysisId?: string }) => {
    // If user is currently on the scan page with an active unrecorded product analysis and tries to navigate away:
    if (currentPage === 'scan' && pendingReport && !isConsumptionResolved && page !== 'scan') {
      setPendingTargetAction({
        type: 'page',
        page,
        sectionId: options?.sectionId,
        analysisId: options?.analysisId,
      });
      setIsConsumptionModalOpen(true);
      return;
    }

    setRouteState({
      page,
      sectionId: options?.sectionId,
      analysisId: options?.analysisId,
    });

    let newHash = `#/${page}`;
    const params = new URLSearchParams();
    if (options?.sectionId) params.set('section', options.sectionId);
    if (options?.analysisId) params.set('id', options.analysisId);
    const paramStr = params.toString();
    if (paramStr) newHash += `?${paramStr}`;

    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }

    if (!options?.sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRequestLogout = () => {
    if (pendingReport && !isConsumptionResolved) {
      setPendingTargetAction({ type: 'logout' });
      setIsConsumptionModalOpen(true);
    } else {
      executeLogout();
    }
  };

  const executeLogout = async () => {
    await logout();
    setPendingReport(null);
    setIsConsumptionResolved(true);
    setIsConsumptionModalOpen(false);
    sessionStorage.removeItem('unpack_active_unrecorded_scan');
    handleNavigate('home');
  };

  const handleConfirmConsumed = async (
    servings: number,
    basis: 'per_serving' | 'per_100g',
    productName: string,
    date?: string,
    notes?: string
  ) => {
    if (!pendingReport) return;

    if (!isAuthenticated || !token) {
      throw new Error('You must be logged in to record food consumption to your daily ledger.');
    }

    const submissionNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
      product_name: productName.trim() || pendingReport.file_name || 'Scanned Food Product',
      scan_id: `scan-${pendingReport.file_name || 'food'}-${Date.now()}`,
      servings_consumed: servings,
      basis_used: basis,
      consumption_date: date || getLocalDateString(),
      nutrition_facts: pendingReport.nutrition_facts,
      notes: notes || '',
      idempotency_key: `idemp-${pendingReport.file_name || 'food'}-${submissionNonce}`,
    };

    // Await the backend save. If it fails, error is thrown and caught in modal:
    const result = await recordConsumption(payload, token);

    // Only proceed after backend confirms successful save:
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('unpack:consumption-recorded', {
          detail: { date: payload.consumption_date, record: result.record },
        })
      );
    }

    setIsConsumptionResolved(true);
    sessionStorage.removeItem('unpack_active_unrecorded_scan');
    setIsConsumptionModalOpen(false);

    // Complete interrupted navigation or logout
    if (pendingTargetAction?.type === 'logout') {
      await executeLogout();
    } else if (pendingTargetAction?.type === 'page') {
      const target = pendingTargetAction;
      setPendingTargetAction(null);
      handleNavigate(target.page, { sectionId: target.sectionId, analysisId: target.analysisId });
      return;
    }
    setPendingTargetAction(null);
  };

  const handleConfirmNotConsumed = () => {
    // Record as discarded / preview only: do not add to daily ledger
    setIsConsumptionResolved(true);
    sessionStorage.removeItem('unpack_active_unrecorded_scan');
    setIsConsumptionModalOpen(false);

    // Complete interrupted navigation or logout
    if (pendingTargetAction?.type === 'logout') {
      executeLogout();
    } else if (pendingTargetAction?.type === 'page') {
      const target = pendingTargetAction;
      setPendingTargetAction(null);
      handleNavigate(target.page, { sectionId: target.sectionId, analysisId: target.analysisId });
      return;
    }
    setPendingTargetAction(null);
  };

  const handleCancelConsumption = () => {
    // Cancel navigation/logout: stay on active scan page with pending report preserved
    setIsConsumptionModalOpen(false);
    setPendingTargetAction(null);
  };

  return (
    <div className="app-layout">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        connectionState={connectionState}
        latency={latency}
        onRefreshHealth={probeBackend}
        onRequestLogout={handleRequestLogout}
      />

      <main className="main-content">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'scan' && (
          <ScanPage
            onNavigate={handleNavigate}
            targetSectionId={targetSectionId}
            targetAnalysisId={targetAnalysisId}
            onScanCompleted={(rep, fileName) => {
              setPendingReport(rep);
              setPendingProductName(fileName);
              setIsConsumptionResolved(false);
            }}
            onClearPendingScan={() => {
              setPendingReport(null);
              setIsConsumptionResolved(true);
            }}
            isConsumptionConfirmed={isConsumptionResolved}
            onRequestOpenRecordModal={() => {
              setPendingTargetAction(null);
              setIsConsumptionModalOpen(true);
            }}
          />
        )}
        {currentPage === 'nutrition' && <NutritionPage onNavigate={handleNavigate} />}
        {currentPage === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {currentPage === 'register' && <RegisterPage onNavigate={handleNavigate} />}
        {currentPage === 'onboarding' && <OnboardingPage onNavigate={handleNavigate} />}
      </main>

      <Footer onNavigate={handleNavigate} />

      <MandatoryConsumptionModal
        isOpen={isConsumptionModalOpen}
        pendingReport={pendingReport}
        productName={pendingProductName}
        targetAction={pendingTargetAction}
        onConfirmConsumed={handleConfirmConsumed}
        onConfirmNotConsumed={handleConfirmNotConsumed}
        onCancel={handleCancelConsumption}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
