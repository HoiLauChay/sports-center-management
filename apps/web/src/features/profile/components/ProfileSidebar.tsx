import type { Account } from '@sports-center/shared';
import { Card, Tag } from 'antd';
import { BadgeCheck, CalendarDays, Mail, ShieldCheck } from 'lucide-react';
import { ROLE_LABEL } from '~/constants/roles';
import { formatDate, formatVND } from '~/lib/format';
import { getMemberProfile } from '../utils/profile';
import { InfoGrid } from './InfoGrid';

export function ProfileSidebar({ user }: { user: Account }) {
  const member = getMemberProfile(user);

  return (
    <div className="flex flex-col gap-4">
      {member && (
        <div className="sc-wallet-card">
          <small>Số dư ví</small>
          <div className="amount">{formatVND(member.walletBalance)}</div>
        </div>
      )}

      <Card>
        <h3 className="sc-section-title">Tài khoản</h3>
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
