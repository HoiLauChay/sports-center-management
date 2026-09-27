import type { AccountStatus, AccountSummary } from '@sports-center/shared';
import { Avatar, type TableColumnsType } from 'antd';
import { RoleTag } from '~/components/ui/RoleTag';
import { formatDate, initialsOf } from '~/lib/format';
import { StatusTag } from './StatusTag';

type Column = TableColumnsType<AccountSummary>[number];

export const USER_COLUMNS = {
  user: {
    title: 'Người dùng',
    key: 'user',
    render: (_, user) => (
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl ?? undefined} className="shrink-0 !bg-sc-primary">
          {initialsOf(user.fullName)}
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{user.fullName}</span>
          <span className="text-xs text-sc-muted">{user.email}</span>
        </div>
      </div>
    ),
  },
  phone: { title: 'Số điện thoại', dataIndex: 'phone', render: (phone: string | null) => phone ?? '—' },
  role: { title: 'Vai trò', dataIndex: 'role', render: (_, user) => <RoleTag role={user.role} /> },
  status: {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: AccountStatus) => <StatusTag status={status} />,
  },
  createdAt: { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
} satisfies Record<string, Column>;
