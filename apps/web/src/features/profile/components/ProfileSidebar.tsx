import type { Account } from '@sports-center/shared';
import { Card, Tag } from 'antd';
import { BadgeCheck, CalendarDays, Mail, ShieldCheck } from 'lucide-react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { WalletCard } from '~/components/ui/WalletCard';
import { ROLE_LABEL } from '~/constants/roles';
import { formatDate } from '~/lib/format';
import { getMemberProfile } from '../utils/profile';

export function ProfileSidebar({ user }: { user: Account }) {
  const member = getMemberProfile(user);

  return (
    <div className="flex flex-col gap-4">
      {member && <WalletCard balance={member.walletBalance} />}

      <Card>
        <SectionTitle>Tài khoản</SectionTitle>
        <InfoGrid
          single
          items={[
            { label: 'Email đăng nhập', value: user.email, icon: Mail },
            {
              label: 'Xác thực email',
              value: user.emailVerifiedAt ? (
                <Tag color="success" className="!m-0">
                  Đã xác thực
                </Tag>
              ) : (
                <Tag className="!m-0">Chưa xác thực</Tag>
              ),
              icon: BadgeCheck,
            },
            { label: 'Vai trò', value: ROLE_LABEL[user.role], icon: ShieldCheck },
            { label: 'Ngày tham gia', value: formatDate(user.createdAt), icon: CalendarDays },
          ]}
        />
      </Card>
    </div>
  );
}
