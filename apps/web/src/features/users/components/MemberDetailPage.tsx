import { getRouteApi, useRouter } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { MemberHistoryBlock, MemberMembershipBlock, MemberWalletBlock } from '~/features/reception';
import { UserDetailLoader } from './UserDetailView';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/members/$memberId');

export function MemberDetailPage() {
  const { memberId } = routeApi.useParams();
  const router = useRouter();
  const navigate = routeApi.useNavigate();

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: PATHS.receptionMembers });
  };

  return (
    <UserDetailLoader
      id={memberId}
      backLabel="Tra cứu hội viên"
      onBack={back}
      aside={() => (
        <>
          <MemberWalletBlock memberId={memberId} />
          <MemberMembershipBlock memberId={memberId} />
          <MemberHistoryBlock memberId={memberId} />
        </>
      )}
    />
  );
}
