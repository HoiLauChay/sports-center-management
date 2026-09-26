import { Card, Col, Row, Tabs } from 'antd';
import { useState } from 'react';
import { useCurrentUser } from '~/features/auth';
import '../profile.css';
import { ProfileEditForm } from './ProfileEditForm';
import { ProfileHero } from './ProfileHero';
import { ProfileOverview } from './ProfileOverview';
import { ProfileSidebar } from './ProfileSidebar';
import { SecurityPanel } from './SecurityPanel';

type TabKey = 'info' | 'security';

export function ProfilePage() {
  const user = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('info');

  const startEditing = () => {
    setTab('info');
    setEditing(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <ProfileHero user={user} editing={editing} onEdit={startEditing} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card>
            <Tabs
              activeKey={tab}
              onChange={(key) => setTab(key as TabKey)}
              className="-mt-2"
              items={[
                {
                  key: 'info',
                  label: editing ? 'Chỉnh sửa hồ sơ' : 'Thông tin',
                  children: editing ? (
                    <ProfileEditForm user={user} onDone={() => setEditing(false)} />
                  ) : (
                    <ProfileOverview user={user} />
                  ),
                },
                { key: 'security', label: 'Bảo mật', children: <SecurityPanel /> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <ProfileSidebar user={user} />
        </Col>
      </Row>
    </div>
  );
}
