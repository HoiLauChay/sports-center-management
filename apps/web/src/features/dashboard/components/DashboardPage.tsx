import { useCurrentUser } from '~/features/auth';
import { ManagerDashboard } from './ManagerDashboard';
import { ReceptionistDashboard } from './ReceptionistDashboard';
import { CoachDashboard, MemberDashboard } from './RoleDashboards';

/** `/dashboard`: every role lands on its own overview. */
export function DashboardPage() {
  const user = useCurrentUser();
  switch (user.role) {
    case 'MEMBER':
      return <MemberDashboard />;
    case 'COACH':
      return <CoachDashboard />;
    case 'RECEPTIONIST':
      return <ReceptionistDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
  }
}
