import { useQuery } from '@tanstack/react-query';
import { Card, Input, Pagination, Select } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { toApiError } from '~/lib/http-errors';
import { useClasses, useCoaches } from '../hooks/useClasses';
import { ClassCard } from './ClassCard';

const LIMIT = 9;

/** `/classes`: classes open for enrollment, filterable by sport and coach. */
export function ClassesPage() {
  const sports = useQuery(sportsQueryOptions);
  const coaches = useCoaches();
  const [page, setPage] = useState(1);
  const [sportId, setSportId] = useState<string | undefined>();
  const [coachId, setCoachId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const classes = useClasses({ page, limit: LIMIT, sportId, coachId, q: q || undefined });

  return (
    <>
      <PageHeader title="Lớp học" description="Các lớp đang nhận đăng ký. Bấm vào lớp để xem lịch và thêm vào đơn." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input.Search
          allowClear
          placeholder="Tên lớp hoặc huấn luyện viên"
          className="w-full sm:!w-72"
          onSearch={(value) => {
            setQ(value.trim());
            setPage(1);
          }}
        />
        <Select
          allowClear
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
          <EmptyState title="Chưa có lớp nào đang nhận đăng ký" description="Vui lòng quay lại sau hoặc đổi bộ lọc." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[601px]:grid-cols-2 min-[1001px]:grid-cols-3">
            {classes.data.items.map((item) => (
              <ClassCard key={item.id} item={item} />
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
