export type AppPage = 'home' | 'scan' | 'nutrition';

export interface NavItem {
  id: AppPage;
  label: string;
  icon?: string;
  description?: string;
}
