import type { AccountSummary } from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { Card, Input, type TableColumnsType } from 'antd';
import { DataTable } from '~/components/data/DataTable';
import { PageHeader } from '~/components/ui/PageHeader';
import { withPaginationDefaults } from '~/lib/search';
import { usersService } from '../services/users.service';
import { USER_COLUMNS } from './userColumns';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/members/');

const columns: TableColumnsType<AccountSummary> = [
  USER_COLUMNS.user,
  USER_COLUMNS.phone,
  USER_COLUMNS.status,
  { ...USER_COLUMNS.createdAt, title: 'Ngày tham gia' },
];

export function MembersPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const navigateTo = useNavigate();
  const { page, limit } = withPaginationDefaults(search);
  const query = { q: search.q, page, limit };

  const members = useQuery({
    queryKey: ['users', 'members', query],
    queryFn: () => usersService.list(query),
    placeholderData: keepPreviousData,
  });

  const updateSearch = (patch: typeof search) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <>
      <PageHeader title="Tra cứu hội viên" description="Tìm hội viên theo tên, email hoặc số điện thoại." />
      <Card>
        <Input.Search
          key={search.q ?? ''}
          defaultValue={search.q}
          placeholder="Nhập tên, email hoặc SĐT"
          allowClear
          enterButton
          onSearch={(q) => updateSearch({ q: q.trim() || undefined, page: undefined })}
          className="mb-4 w-full sm:!w-96"
        />
        <DataTable
          columns={columns}
          data={members.data}
          isLoading={members.isFetching}
          error={members.error}
          onRetry={() => void members.refetch()}
          page={page}
          limit={limit}
          onPageChange={(nextPage, nextLimit) =>
            updateSearch({ page: nextLimit === limit ? nextPage : undefined, limit: nextLimit })
          }
          emptyTitle={search.q ? 'Không tìm thấy hội viên phù hợp' : 'Chưa có hội viên'}
          rowClassName="cursor-pointer"
          onRow={(member) => ({
            onClick: () => void navigateTo({ to: '/reception/members/$memberId', params: { memberId: member.id } }),
          })}
        />
      </Card>
    </>
  );
}
