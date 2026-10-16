import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from './api/client';
import { ConnectionState } from './types/api';
import { AppPage } from './types/navigation';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ScanPage } from './pages/ScanPage';
import { NutritionPage } from './pages/NutritionPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [latency, setLatency] = useState<number | null>(null);

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

  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-layout">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        connectionState={connectionState}
        latency={latency}
        onRefreshHealth={probeBackend}
      />

      <main className="main-content">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'scan' && <ScanPage onNavigate={handleNavigate} />}
        {currentPage === 'nutrition' && <NutritionPage onNavigate={handleNavigate} />}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
