import type { Maintenance } from '@sports-center/shared';
import { Button, Card, Table, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
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

const formatAt = (iso: string) => dayjs(iso).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY');

/** `/admin/maintenances`: planned, ongoing and finished maintenance; a new one goes through a preview first. */
export function MaintenancePage() {
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const maintenances = useMaintenances({});
  const remove = useDeleteMaintenance();

  const columns: TableColumnsType<Maintenance> = [
    { title: 'Facility', dataIndex: ['facility', 'name'], render: (name: string) => <b>{name}</b> },
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
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, item) =>
        phaseOf(item) === 'PLANNED' ? (
          <Button
            size="small"
            danger
            loading={remove.isPending && remove.variables === item.id}
            onClick={() =>
              confirm({
                title: `Hủy lịch bảo trì ${item.facility.name}?`,
                content: 'Các booking và buổi học đã được xử lý khi đặt lịch không được khôi phục.',
                okText: 'Hủy lịch',
                onOk: () => remove.mutateAsync(item.id).catch(() => undefined),
              })
            }
          >
            Hủy lịch
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Lịch bảo trì facility"
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Đặt lịch bảo trì
          </Button>
        }
      />
      <Card styles={{ body: { padding: '16px 20px 20px' } }}>
        {maintenances.isError && !maintenances.data ? (
          <ErrorState message={toApiError(maintenances.error).message} onRetry={() => void maintenances.refetch()} />
        ) : (
          <Table<Maintenance>
            rowKey="id"
            columns={columns}
            dataSource={maintenances.data}
            loading={maintenances.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            className="overflow-hidden rounded-lg border border-solid border-sc-border-soft"
            locale={{ emptyText: maintenances.isFetching ? ' ' : <EmptyState title="Chưa có lịch bảo trì nào" /> }}
          />
        )}
      </Card>
      <MaintenanceWizard open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
