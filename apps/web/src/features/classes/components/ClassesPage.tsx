import { useQuery } from '@tanstack/react-query';
import { Card, Pagination, Select } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useMyMemberships } from '~/features/memberships/hooks/useMyMemberships';
import { toApiError } from '~/lib/http-errors';
import { useClassCoaches, useClasses } from '../hooks/useClasses';
import { ClassCard } from './ClassCard';

const LIMIT = 9;

export function ClassesPage() {
  const sports = useQuery(sportsQueryOptions);
  const coaches = useClassCoaches();
  const [page, setPage] = useState(1);
  const [sportId, setSportId] = useState<string | undefined>();
  const [coachId, setCoachId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const discountPct = useMyMemberships().query.data?.current?.currentBenefits?.classDiscountPct ?? 0;
  const classes = useClasses({ page, limit: LIMIT, sportId, coachId, q: q || undefined });

  return (
    <>
      <PageHeader
        title="Lớp học"
        description={
          classes.data &&
          `${classes.data.total} lớp đang nhận đăng ký${discountPct > 0 ? ` · thành viên được giảm ${discountPct}%` : ''}`
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          placeholder="Tên lớp hoặc huấn luyện viên..."
          maxLength={100}
          className="w-full sm:!w-72"
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          loading={classes.isFetching}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Mọi bộ môn"
          className="w-full sm:!w-56"
          loading={sports.isPending}
          value={sportId}
          onChange={(value: string | undefined) => {
            setSportId(value);
            setPage(1);
          }}
          options={(sports.data ?? [])
            .filter((sport) => sport.isActive)
            .map((sport) => ({ value: sport.id, label: sport.name }))}
        />
        <Select
          allowClear
          placeholder="Mọi huấn luyện viên"
          className="w-full sm:!w-56"
          loading={coaches.isPending}
          value={coachId}
          onChange={(value: string | undefined) => {
            setCoachId(value);
            setPage(1);
          }}
          options={(coaches.data ?? []).map((coach) => ({
            value: coach.id,
            label: coach.fullName,
          }))}
        />
      </div>
      {classes.isPending ? (
        <PageLoading />
      ) : classes.isError ? (
        <Card>
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        </Card>
      ) : classes.data.items.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có lớp nào đang nhận đăng ký" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(270px,320px))]">
            {classes.data.items.map((item) => (
              <ClassCard key={item.id} item={item} keyword={q} discountPct={discountPct} />
            ))}
          </div>
          <Pagination
            className="!mt-4 text-center"
            current={page}
            pageSize={LIMIT}
            total={classes.data.total}
            hideOnSinglePage
            showSizeChanger={false}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
