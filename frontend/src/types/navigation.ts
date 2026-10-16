export type AppPage = 'home' | 'scan' | 'nutrition' | 'login' | 'register' | 'onboarding';

export interface NavItem {
  id: AppPage;
  label: string;
  icon?: string;
  description?: string;
}
