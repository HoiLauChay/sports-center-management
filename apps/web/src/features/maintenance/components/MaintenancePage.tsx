import type { Maintenance } from '@sports-center/shared';
import { Button, Card, Segmented, Table, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { MappedTag, type TagMap } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { useConfirm } from '~/hooks/useConfirm';
import { VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useDeleteMaintenance, useMaintenances } from '../hooks/useMaintenance';
import type { MaintenancePhase } from '../types';
import { phaseOf } from '../utils';
import { MaintenanceWizard } from './MaintenanceWizard';

const PHASE_TAG: TagMap<MaintenancePhase> = {
  PLANNED: { label: 'Đã lên lịch', color: 'processing' },
  ONGOING: { label: 'Đang bảo trì', color: 'orange' },
  DONE: { label: 'Đã xong' },
};

const PHASE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PLANNED', label: 'Đã lên lịch' },
  { value: 'ONGOING', label: 'Đang bảo trì' },
  { value: 'DONE', label: 'Đã xong' },
];

const formatAt = (iso: string) => dayjs(iso).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY');

/** `/admin/maintenances`: planned, ongoing and finished maintenance; a new one goes through a preview first. */
export function MaintenancePage() {
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'ALL' | MaintenancePhase>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const maintenances = useMaintenances({});
  const remove = useDeleteMaintenance();

  const filteredMaintenances = useMemo(() => {
    if (!maintenances.data) return [];
    const q = search.trim().toLowerCase();
    return maintenances.data.filter((item) => {
      const phase = phaseOf(item);
      if (phaseFilter !== 'ALL' && phase !== phaseFilter) return false;
      if (q) {
        const matchFacility = item.facility.name.toLowerCase().includes(q);
        const matchReason = item.reason.toLowerCase().includes(q);
        if (!matchFacility && !matchReason) return false;
      }
      return true;
    });
  }, [maintenances.data, phaseFilter, search]);

  const columns: TableColumnsType<Maintenance> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Sân & phòng',
      dataIndex: ['facility', 'name'],
      render: (name: string) => <span className="font-semibold">{name}</span>,
    },
    {
      title: 'Từ',
      dataIndex: 'startAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatAt(value)}</span>,
    },
    {
      title: 'Đến',
      dataIndex: 'endAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatAt(value)}</span>,
    },
    { title: 'Lý do', dataIndex: 'reason' },
    {
      title: 'Trạng thái',
      key: 'phase',
      render: (_, item) => <MappedTag value={phaseOf(item)} map={PHASE_TAG} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, item) => (
        <RowActions
          label={`Thao tác với lịch bảo trì ${item.facility.name}`}
          actions={
            phaseOf(item) === 'PLANNED'
              ? [
                  {
                    key: 'cancel',
                    label: 'Hủy lịch',
                    danger: true,
                    loading: remove.isPending && remove.variables === item.id,
                    onClick: () =>
                      confirm({
                        title: `Hủy lịch bảo trì ${item.facility.name}?`,
                        content: 'Các booking và buổi học đã được xử lý khi đặt lịch không được khôi phục.',
                        okText: 'Hủy lịch',
                        onOk: () => remove.mutateAsync(item.id).catch(() => undefined),
                      }),
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
      <PageHeader
        title="Lịch bảo trì sân & phòng"
        description={maintenances.data && `${maintenances.data.length} lịch bảo trì`}
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Đặt lịch bảo trì
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            placeholder="Tìm theo sân, phòng, lý do..."
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-full sm:!w-72"
          />
          <div className="overflow-x-auto">
            <Segmented
              value={phaseFilter}
              onChange={(val) => {
                setPhaseFilter(val as 'ALL' | MaintenancePhase);
                setPage(1);
              }}
              options={PHASE_OPTIONS}
            />
          </div>
        </div>

        {maintenances.isError && !maintenances.data ? (
          <ErrorState message={toApiError(maintenances.error).message} onRetry={() => void maintenances.refetch()} />
        ) : (
          <Table<Maintenance>
            rowKey="id"
            columns={columns}
            dataSource={filteredMaintenances}
            loading={maintenances.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} lịch bảo trì`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: maintenances.isFetching ? (
                ' '
              ) : (
                <EmptyState
                  title={
                    search || phaseFilter !== 'ALL' ? 'Không tìm thấy lịch bảo trì phù hợp' : 'Chưa có lịch bảo trì nào'
                  }
                  description={
                    search || phaseFilter !== 'ALL' ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : undefined
                  }
                />
              ),
            }}
          />
        )}
      </Card>
      <MaintenanceWizard open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
