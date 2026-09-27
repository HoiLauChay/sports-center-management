import { getRouteApi, useRouter } from '@tanstack/react-router';
import { UserDetailLoader } from './UserDetailView';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users/$userId');

export function AdminUserDetailPage() {
  const { userId } = routeApi.useParams();
  const router = useRouter();
  const navigate = routeApi.useNavigate();

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/admin/users' });
  };

  return <UserDetailLoader id={userId} backLabel="Danh sách người dùng" onBack={back} />;
}
