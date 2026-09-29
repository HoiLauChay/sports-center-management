import { ACCOUNT_STATUSES, type Account, type AccountStatus } from '@sports-center/shared';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Button, Dropdown } from 'antd';
import { ChevronDown, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { PATHS } from '~/constants/paths';
import { useCurrentUser } from '~/features/auth';
import { STATUS_ACTION } from '../utils/statusActions';
import { AdminUserEditForm } from './AdminUserEditForm';
import { UserDetailLoader } from './UserDetailView';
import { UserStatusModal } from './UserStatusModal';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users/$userId');

interface UserActionsProps {
  user: Account;
  editing: boolean;
  canChangeStatus: boolean;
  onEdit: () => void;
}

function UserActions({ user, editing, canChangeStatus, onEdit }: UserActionsProps) {
  const [target, setTarget] = useState<AccountStatus>('ACTIVE');
  const [confirming, setConfirming] = useState(false);

  const items = ACCOUNT_STATUSES.filter((status) => status !== user.status).map((status) => ({
    key: status,
    label: STATUS_ACTION[status].label,
    danger: status !== 'ACTIVE',
  }));

  return (
    <>
      {!editing && (
        <Button icon={<PencilLine size={16} />} onClick={onEdit}>
          Sửa thông tin
        </Button>
      )}
      {canChangeStatus && (
        <Dropdown
          trigger={['click']}
          menu={{
            items,
            onClick: ({ key }) => {
              setTarget(key as AccountStatus);
              setConfirming(true);
            },
          }}
          disabled={editing}
        >
          <Button>
            Đổi trạng thái <ChevronDown size={14} />
          </Button>
        </Dropdown>
      )}
      <UserStatusModal user={user} target={target} open={confirming} onClose={() => setConfirming(false)} />
    </>
  );
}

export function AdminUserDetailPage() {
  const { userId } = routeApi.useParams();
  const router = useRouter();
  const navigate = routeApi.useNavigate();
  const viewer = useCurrentUser();
  const [editing, setEditing] = useState(false);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: PATHS.adminUsers });
  };

  return (
    <UserDetailLoader
      id={userId}
      backLabel="Danh sách người dùng"
      onBack={back}
      actions={(user) => (
        <UserActions
          user={user}
          editing={editing}
          canChangeStatus={user.id !== viewer.id && user.role !== 'MANAGER'}
          onEdit={() => setEditing(true)}
        />
      )}
      editor={(user) => (editing ? <AdminUserEditForm user={user} onDone={() => setEditing(false)} /> : null)}
    />
  );
}
