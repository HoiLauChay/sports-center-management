import type { AccountStatus, AccountSummary } from '@sports-center/shared';
import { Avatar, type TableColumnsType } from 'antd';
import { Highlight } from '~/components/ui/Highlight';
import { RoleTag } from '~/components/ui/RoleTag';
import { formatDate, initialsOf } from '~/lib/format';
import { StatusTag } from './StatusTag';

type Column = TableColumnsType<AccountSummary>[number];

export const userColumns = (q?: string) =>
  ({
    user: {
      title: 'Người dùng',
      key: 'user',
      render: (_, user) => (
        <div className="flex items-center gap-3">
          <Avatar src={user.avatarUrl ?? undefined} className="shrink-0 !bg-sc-primary">
            {initialsOf(user.fullName)}
          </Avatar>
          <div className="flex w-56 min-w-0 flex-col">
            <span className="font-semibold">
              <Highlight keyword={q}>{user.fullName}</Highlight>
            </span>
            <span className="text-[14.5px] text-sc-muted [overflow-wrap:anywhere]">
              <Highlight keyword={q}>{user.email}</Highlight>
            </span>
          </div>
        </div>
      ),
    },
    phone: {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      render: (phone: string | null) => (phone ? <Highlight keyword={q}>{phone}</Highlight> : '—'),
    },
    role: {
      title: 'Vai trò',
      dataIndex: 'roles',
      render: (_, user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <RoleTag key={role} role={role} />
          ))}
        </div>
      ),
    },
    status: {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: AccountStatus) => <StatusTag status={status} />,
    },
    createdAt: { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
  }) satisfies Record<string, Column>;
