import type { AccountSummary } from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Card, type TableColumnsType } from 'antd';
import { DataTable } from '~/components/data/DataTable';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { useRowLink } from '~/hooks/useRowLink';
import { withPaginationDefaults } from '~/lib/search';
import { usersService } from '../services/users.service';
import { userColumns } from './userColumns';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/members/');

export function MembersPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const rowLink = useRowLink((member: AccountSummary) => ({
    to: '/reception/members/$memberId',
    params: { memberId: member.id },
  }));
  const { page, limit } = withPaginationDefaults(search);
  const query = { q: search.q, page, limit };

  const cols = userColumns(search.q);
  const columns: TableColumnsType<AccountSummary> = [
    cols.user,
    cols.phone,
    cols.status,
    { ...cols.createdAt, title: 'Ngày tham gia' },
  ];

  const members = useQuery({
    queryKey: ['users', 'members', query],
    queryFn: () => usersService.list(query),
    placeholderData: keepPreviousData,
  });

  const updateSearch = (patch: typeof search) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <>
      <PageHeader title="Tra cứu hội viên" />
      <Card>
        <SearchInput
          value={search.q ?? ''}
          placeholder="Tìm theo tên, email hoặc SĐT..."
          onChange={(q) => updateSearch({ q: q || undefined, page: undefined })}
          loading={members.isFetching}
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
          onRow={rowLink}
        />
      </Card>
    </>
  );
}
