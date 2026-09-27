import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Card, Tag } from 'antd';
import { BadgeCheck, History, Wallet, type LucideIcon } from 'lucide-react';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { PATHS } from '~/constants/paths';
import { UserDetailLoader } from './UserDetailView';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/members/$memberId');

function ComingSoonCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>{title}</SectionTitle>
        <Tag className="!m-0">Sắp có</Tag>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
          <Icon size={17} />
        </span>
        <p className="m-0 min-w-0 flex-1 text-[13px] text-sc-muted">{description}</p>
      </div>
    </Card>
  );
}

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
          <ComingSoonCard icon={Wallet} title="Ví" description="Số dư và nạp ví tại quầy." />
          <ComingSoonCard icon={BadgeCheck} title="Gói thành viên" description="Gói đang dùng và lịch sử gia hạn." />
          <ComingSoonCard icon={History} title="Lịch sử" description="Check-in, đặt sân và hóa đơn gần đây." />
        </>
      )}
    />
  );
}
