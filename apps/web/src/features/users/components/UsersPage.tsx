import {
  ACCOUNT_STATUSES,
  ROLES,
  type AccountStatus,
  type AccountSummary,
  type ListUsersQuery,
} from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Avatar, Card, Input, Select, Tag, type TableColumnsType } from 'antd';
import { DataTable } from '~/components/data/DataTable';
import { PageHeader } from '~/components/ui/PageHeader';
import { RoleTag } from '~/components/ui/RoleTag';
import { ACCOUNT_STATUS_LABEL, ROLE_LABEL } from '~/constants/roles';
import { formatDate } from '~/lib/format';
import { withPaginationDefaults } from '~/lib/search';
import { usersService } from '../services/users.service';

const routeApi = getRouteApi('/_authenticated/_manager/admin/users');

const STATUS_COLOR: Record<AccountStatus, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  BANNED: 'error',
};

const columns: TableColumnsType<AccountSummary> = [
  {
    title: 'Người dùng',
    key: 'user',
    render: (_, user) => (
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl ?? undefined} className="!bg-sc-primary">
          {user.fullName.charAt(0).toUpperCase()}
        </Avatar>
        <div className="flex flex-col">
          <span className="font-semibold">{user.fullName}</span>
          <span className="text-xs text-sc-muted">{user.email}</span>
        </div>
      </div>
    ),
  },
  { title: 'Số điện thoại', dataIndex: 'phone', render: (phone: string | null) => phone ?? '—' },
  { title: 'Vai trò', dataIndex: 'role', render: (_, user) => <RoleTag role={user.role} /> },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: AccountStatus) => <Tag color={STATUS_COLOR[status]}>{ACCOUNT_STATUS_LABEL[status]}</Tag>,
  },
  { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
];

export function UsersPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { page, limit } = withPaginationDefaults(search);
  const query: ListUsersQuery = { ...search, page, limit };

  const users = useQuery({
    queryKey: ['users', query],
    queryFn: () => usersService.list(query),
    placeholderData: keepPreviousData,
  });

  const updateSearch = (patch: ListUsersQuery) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <>
      <PageHeader title="Người dùng" description="Tài khoản thành viên, huấn luyện viên và nhân viên." />
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
        />
      </Card>
    </>
  );
}
