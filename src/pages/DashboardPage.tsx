import AppShell from '../components/layout/AppShell';
import { Outlet } from 'react-router-dom';
import { useNoIndex } from '../hooks/useNoIndex';

export default function DashboardPage() {
  useNoIndex();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
