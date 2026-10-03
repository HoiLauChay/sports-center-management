import {
  ACCOUNT_STATUSES,
  ROLES,
  type AccountStatus,
  type AccountSummary,
  type ListUsersQuery,
} from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { Button, Card, Dropdown, Input, Select, type TableColumnsType } from 'antd';
import { Ellipsis, Eye, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { PageHeader } from '~/components/ui/PageHeader';
import { ACCOUNT_STATUS_LABEL, ROLE_LABEL } from '~/constants/roles';
import { useCurrentUser } from '~/features/auth';
import { withPaginationDefaults } from '~/lib/search';
import { usersService } from '../services/users.service';
import { STATUS_ACTION } from '../utils/statusActions';
import { CreateUserModal } from './CreateUserModal';
import { USER_COLUMNS } from './userColumns';
import { UserStatusModal } from './UserStatusModal';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users/');

export function UsersPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const navigateTo = useNavigate();
  const viewer = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const [statusChange, setStatusChange] = useState<{ user: AccountSummary; target: AccountStatus } | null>(null);
  const { page, limit } = withPaginationDefaults(search);
  const query: ListUsersQuery = { ...search, page, limit };

  const users = useQuery({
    queryKey: ['users', query],
    queryFn: () => usersService.list(query),
    placeholderData: keepPreviousData,
  });

  const updateSearch = (patch: Partial<ListUsersQuery>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const openDetail = (id: string) => void navigateTo({ to: '/admin/users/$userId', params: { userId: id } });

  const columns: TableColumnsType<AccountSummary> = [
    USER_COLUMNS.user,
    USER_COLUMNS.phone,
    USER_COLUMNS.role,
    USER_COLUMNS.status,
    USER_COLUMNS.createdAt,
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, user) => (
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Button size="small" icon={<Eye size={14} />} onClick={() => openDetail(user.id)}>
            Chi tiết
          </Button>
          {user.id !== viewer.id && user.role !== 'MANAGER' && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: ACCOUNT_STATUSES.filter((status) => status !== user.status).map((status) => ({
                  key: status,
                  label: STATUS_ACTION[status].label,
                  danger: status !== 'ACTIVE',
                })),
                onClick: ({ key }) => setStatusChange({ user, target: key as AccountStatus }),
              }}
            >
              <Button size="small" icon={<Ellipsis size={14} />} aria-label={`Đổi trạng thái ${user.fullName}`} />
            </Dropdown>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tài khoản thành viên, huấn luyện viên và nhân viên."
        extra={
          <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setCreating(true)}>
            Tạo tài khoản
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input.Search
            key={search.q ?? ''}
            defaultValue={search.q}
            placeholder="Tìm theo tên, email, SĐT"
            allowClear
            onSearch={(q) => updateSearch({ q: q.trim() || undefined, page: undefined })}
            className="w-full sm:!w-72"
          />
          <Select
            value={search.role}
            placeholder="Vai trò"
            allowClear
            options={ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
            onChange={(role) => updateSearch({ role, page: undefined })}
            className="w-[calc(50%-6px)] sm:!w-44"
          />
          <Select
            value={search.status}
            placeholder="Trạng thái"
            allowClear
            options={ACCOUNT_STATUSES.map((status) => ({ value: status, label: ACCOUNT_STATUS_LABEL[status] }))}
            onChange={(status) => updateSearch({ status, page: undefined })}
            className="w-[calc(50%-6px)] sm:!w-44"
          />
        </div>
        <DataTable
          columns={columns}
          data={users.data}
          isLoading={users.isFetching}
          error={users.error}
          onRetry={() => void users.refetch()}
          page={page}
          limit={limit}
          onPageChange={(nextPage, nextLimit) =>
            updateSearch({ page: nextLimit === limit ? nextPage : undefined, limit: nextLimit })
          }
          emptyTitle="Không có người dùng phù hợp"
          rowClassName="cursor-pointer"
          onRow={(user) => ({
            onClick: () => openDetail(user.id),
          })}
        />
      </Card>
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      {statusChange && (
        <UserStatusModal
          key={`${statusChange.user.id}:${statusChange.target}`}
          user={statusChange.user}
          target={statusChange.target}
          open
          onClose={() => setStatusChange(null)}
        />
      )}
    </>
  );
}
