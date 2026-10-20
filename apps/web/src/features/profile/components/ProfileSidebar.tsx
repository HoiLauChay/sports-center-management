import type { Account } from '@sports-center/shared';
import { Card, Tag } from 'antd';
import { BadgeCheck, Mail } from 'lucide-react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { SectionTitle } from '~/components/ui/SectionTitle';

export function ProfileSidebar({ user }: { user: Account }) {
  return (
    <div className="flex flex-col gap-4">
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
          ]}
        />
      </Card>
    </div>
  );
}
