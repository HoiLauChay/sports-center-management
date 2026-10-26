import { ACCOUNT_STATUSES, type Account, type AccountStatus } from '@sports-center/shared';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Button, Dropdown } from 'antd';
import { ChevronDown, Mail, PencilLine, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { PATHS } from '~/constants/paths';
import { useCurrentUser } from '~/features/auth';
import { StaffMembershipBlock } from '~/features/memberships';
import { MemberHistoryBlock, MemberWalletBlock } from '~/features/reception';
import { STATUS_ACTION } from '../utils/statusActions';
import { AdminUserEditForm } from './AdminUserEditForm';
import { ChangeEmailModal } from './ChangeEmailModal';
import { UserDetailLoader } from './UserDetailView';
import { UserRolesModal } from './UserRolesModal';
import { UserStatusModal } from './UserStatusModal';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users/$userId');

interface UserActionsProps {
  user: Account;
  editing: boolean;
  canChangeStatus: boolean;
  canChangeEmail: boolean;
  canChangeRoles: boolean;
  onEdit: () => void;
}

function UserActions({ user, editing, canChangeStatus, canChangeEmail, canChangeRoles, onEdit }: UserActionsProps) {
  const [target, setTarget] = useState<AccountStatus>('ACTIVE');
  const [confirming, setConfirming] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [changingRoles, setChangingRoles] = useState(false);

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
      {canChangeRoles && (
        <Button icon={<UsersRound size={16} />} disabled={editing} onClick={() => setChangingRoles(true)}>
          Phân vai trò
        </Button>
      )}
      {canChangeEmail && (
        <Button icon={<Mail size={16} />} disabled={editing} onClick={() => setChangingEmail(true)}>
          Đổi email
        </Button>
      )}
      <UserStatusModal user={user} target={target} open={confirming} onClose={() => setConfirming(false)} />
      {changingEmail && <ChangeEmailModal user={user} onClose={() => setChangingEmail(false)} />}
      {changingRoles && <UserRolesModal user={user} onClose={() => setChangingRoles(false)} />}
    </>
  );
}

export function AdminUserDetailPage() {
  const { userId } = routeApi.useParams();
  const router = useRouter();
  const navigate = routeApi.useNavigate();
  const viewer = useCurrentUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === userId;

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: PATHS.adminUsers });
  };

  return (
    <UserDetailLoader
      id={userId}
      backLabel="Danh sách người dùng"
      onBack={back}
      aside={(user) =>
        user.roles.includes('MEMBER') ? (
          <>
            <MemberWalletBlock memberId={user.id} manager />
            <StaffMembershipBlock memberId={user.id} />
            <MemberHistoryBlock memberId={user.id} manager />
          </>
        ) : null
      }
      actions={(user) => (
        <UserActions
          key={user.id}
          user={user}
          editing={editing}
          canChangeStatus={user.id !== viewer.id && !user.roles.includes('MANAGER')}
          canChangeRoles={!user.roles.includes('MANAGER')}
          canChangeEmail={user.id !== viewer.id}
          onEdit={() => setEditingId(user.id)}
        />
      )}
      editor={(user) =>
        editing ? <AdminUserEditForm key={user.id} user={user} onDone={() => setEditingId(null)} /> : null
      }
    />
  );
}
