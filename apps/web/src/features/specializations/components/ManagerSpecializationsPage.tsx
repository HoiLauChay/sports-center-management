import { useQuery } from '@tanstack/react-query';
import { Card, Input, Modal, Segmented, Select, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { RowActions } from '~/components/data/RowActions';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatDateTime } from '~/lib/format';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useReviewSpecialization, useSpecializations } from '../hooks/useSpecializations';
import {
  SPECIALIZATION_STATUSES,
  SPECIALIZATION_STATUS_TAG,
  type Specialization,
  type SpecializationStatus,
} from '../types';

interface Review {
  entry: Specialization;
  approve: boolean;
}

function ReviewModal({ review, onClose }: { review: Review; onClose: () => void }) {
  const [note, setNote] = useState('');
  const mutation = useReviewSpecialization();
  const { entry, approve } = review;

  return (
    <Modal
      open
      centered
      title={`${approve ? 'Duyệt' : 'Từ chối'} ${entry.sport.name} cho ${entry.coach.fullName}?`}
      okText={approve ? 'Duyệt' : 'Từ chối'}
      cancelText="Đóng"
      okButtonProps={{ danger: !approve }}
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => mutation.mutate({ id: entry.id, approve, reviewNote: note }, { onSuccess: onClose })}
    >
      <p className="mt-0 text-sc-muted">
        {approve
          ? 'HLV sẽ được đăng ký dạy và được phân công các lớp thuộc bộ môn này.'
          : 'HLV không dạy được bộ môn này cho tới khi gửi lại và được duyệt.'}
      </p>
      <Input.TextArea
        value={note}
        maxLength={500}
        showCount
        autoSize={{ minRows: 3, maxRows: 6 }}
        placeholder="Ghi chú cho HLV (không bắt buộc)"
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}

/** `/admin/specializations` (UC_1.13, BR_1.12): coaches' sport requests, reviewed one by one with an optional note. */
export function ManagerSpecializationsPage() {
  const sports = useQuery(sportsQueryOptions);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<SpecializationStatus | undefined>('PENDING');
  const [sportId, setSportId] = useState<string>();
  const [review, setReview] = useState<Review | null>(null);
  const specializations = useSpecializations({ page, limit, status, sportId });
  const pending = useSpecializations({ page: 1, limit: 1, status: 'PENDING' });

  const columns: TableColumnsType<Specialization> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String((page - 1) * limit + index + 1).padStart(2, '0')}
        </span>
      ),
    },
    { title: 'HLV', key: 'coach', render: (_, entry) => <span className="font-semibold">{entry.coach.fullName}</span> },
    {
      title: 'Bộ môn',
      key: 'sport',
      render: (_, entry) => <SportTag name={entry.sport.name} />,
    },
    {
      title: 'Gửi lúc',
      dataIndex: 'createdAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: SpecializationStatus) => <MappedTag value={value} map={SPECIALIZATION_STATUS_TAG} />,
    },
    {
      title: 'Xét duyệt',
      key: 'review',
      render: (_, entry) =>
        entry.reviewedAt ? (
          <div className="flex max-w-64 flex-col gap-0.5 text-[14.5px]">
            <span className="whitespace-nowrap text-sc-muted">{formatDateTime(entry.reviewedAt)}</span>
            {entry.reviewNote && <span className="[overflow-wrap:anywhere]">{entry.reviewNote}</span>}
          </div>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, entry) => (
        <RowActions
          label={`Thao tác với chuyên môn ${entry.sport.name} của ${entry.coach.fullName}`}
          actions={
            entry.status === 'PENDING'
              ? [
                  { key: 'approve', label: 'Duyệt', primary: true, onClick: () => setReview({ entry, approve: true }) },
                  {
                    key: 'reject',
                    label: 'Từ chối',
                    danger: true,
                    onClick: () => setReview({ entry, approve: false }),
                  },
                ]
              : []
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Duyệt chuyên môn" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={status ?? 'ALL'}
            onChange={(value) => {
              setStatus(value === 'ALL' ? undefined : (value as SpecializationStatus));
              setPage(1);
            }}
            options={[
              ...SPECIALIZATION_STATUSES.map((value) => ({
                value,
                label:
                  value === 'PENDING'
                    ? `${SPECIALIZATION_STATUS_TAG[value].label} (${pending.data?.total ?? 0})`
                    : SPECIALIZATION_STATUS_TAG[value].label,
              })),
              { value: 'ALL', label: 'Tất cả' },
            ]}
          />
          <Select
            allowClear
            placeholder="Mọi bộ môn"
            className="w-full sm:!w-48"
            loading={sports.isPending}
            value={sportId}
            onChange={(value: string | undefined) => {
              setSportId(value);
              setPage(1);
            }}
            options={(sports.data ?? []).map((sport) => ({ value: sport.id, label: sport.name }))}
          />
        </div>
        <DataTable<Specialization>
          columns={columns}
          data={specializations.data}
          isLoading={specializations.isFetching && !specializations.data}
          error={specializations.error}
          onRetry={() => void specializations.refetch()}
          page={page}
          limit={limit}
          onPageChange={(nextPage, nextLimit) => {
            setPage(nextLimit === limit ? nextPage : 1);
            setLimit(nextLimit);
          }}
          emptyTitle={status === 'PENDING' ? 'Không có yêu cầu nào đang chờ' : 'Không có yêu cầu nào'}
        />
      </Card>
      {review && <ReviewModal key={review.entry.id} review={review} onClose={() => setReview(null)} />}
    </>
  );
}
