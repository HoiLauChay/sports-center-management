import { getRouteApi, useRouter } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { UserDetailLoader } from './UserDetailView';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users/$userId');

export function AdminUserDetailPage() {
  const { userId } = routeApi.useParams();
  const router = useRouter();
  const navigate = routeApi.useNavigate();

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: PATHS.adminUsers });
  };

  return <UserDetailLoader id={userId} backLabel="Danh sách người dùng" onBack={back} />;
}
