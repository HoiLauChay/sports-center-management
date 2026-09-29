import { FACILITY_TYPES, type Facility, type FacilityType } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Popconfirm, Segmented, Space, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ScheduleConflictList } from '~/components/data/ScheduleConflictList';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { FACILITY_TYPE_LABEL } from '~/constants/facility';
import { formatVND } from '~/lib/format';
import { scheduleConflictsOf, toApiError } from '~/lib/http-errors';
import { facilitiesQueryOptions, sportsQueryOptions } from '../hooks/useCatalog';
import { facilitiesService } from '../services/facilities.service';
import { FacilityFormModal } from './FacilityFormModal';

type TypeFilter = 'ALL' | FacilityType;

const TYPE_FILTERS = [
  { value: 'ALL', label: 'Tất cả' },
  ...FACILITY_TYPES.map((value) => ({ value, label: FACILITY_TYPE_LABEL[value] })),
];

export function FacilitiesPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const [type, setType] = useState<TypeFilter>('ALL');
  const [editing, setEditing] = useState<Facility | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: facilitiesQueryOptions.queryKey });

  const refused = (title: string) => (err: unknown) => {
    const conflicts = scheduleConflictsOf(err);
    modal.error({
      title,
      content: (
        <div className="flex flex-col gap-3">
          <span>{toApiError(err).message}</span>
          {conflicts && <ScheduleConflictList {...conflicts} />}
        </div>
      ),
      okText: 'Đã hiểu',
      width: conflicts ? 520 : undefined,
    });
  };

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => facilitiesService.update(id, { isActive }),
    onSuccess: (facility) => {
      refresh();
      message.success(facility.isActive ? `${facility.name} đã nhận đặt` : `${facility.name} đã ngừng nhận đặt`);
    },
    onError: refused('Không thể ngừng nhận đặt'),
  });

  const remove = useMutation({
    mutationFn: (facility: Facility) => facilitiesService.remove(facility.id),
    onSuccess: (_, facility) => {
      refresh();
      message.success(`Đã xóa ${facility.name}`);
    },
    onError: refused('Không thể xóa sân & phòng'),
  });

  const openForm = (facility: Facility | null) => {
    setEditing(facility);
    setFormOpen(true);
  };

  const rows = facilities.data?.filter((facility) => type === 'ALL' || facility.type === type);

  const columns: TableColumnsType<Facility> = [
    {
      title: 'Tên',
      key: 'name',
      render: (_, facility) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{facility.name}</span>
          {facility.description && (
            <span className="max-w-xs text-xs text-sc-muted [overflow-wrap:anywhere]">{facility.description}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      render: (value: FacilityType) => <Tag className="!m-0">{FACILITY_TYPE_LABEL[value]}</Tag>,
    },
    {
      title: 'Bộ môn',
      key: 'sports',
      render: (_, facility) =>
        facility.sports.length ? (
          <Space wrap size={[4, 4]}>
            {facility.sports.map((sport) => (
              <Tag key={sport.id} color="green" className="!m-0">
                {sport.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <span className="text-sc-muted-2">Chưa gắn bộ môn</span>
        ),
    },
    {
      title: 'Sức chứa / slot',
      dataIndex: 'capacityPerSlot',
      align: 'center',
      render: (value: number) => <b>{value}</b>,
    },
    {
      title: 'Giá / slot',
      dataIndex: 'pricePerSlot',
      align: 'right',
      render: (value: number) => <b className="whitespace-nowrap">{formatVND(value)}</b>,
    },
    {
      title: 'Nhận đặt',
      key: 'isActive',
      render: (_, facility) => (
        <Switch
          checked={facility.isActive}
          loading={toggle.isPending && toggle.variables.id === facility.id}
          onChange={(isActive) => toggle.mutate({ id: facility.id, isActive })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, facility) => (
        <Space>
          <Button size="small" onClick={() => openForm(facility)}>
            Sửa
          </Button>
          <Popconfirm
            title={`Xóa ${facility.name}?`}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutateAsync(facility).catch(() => undefined)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sân & phòng"
        description={facilities.data && `${facilities.data.length} sân & phòng`}
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Thêm sân & phòng
          </Button>
        }
      />
      <Card>
        <div className="mb-4 overflow-x-auto">
          <Segmented value={type} onChange={(value) => setType(value as TypeFilter)} options={TYPE_FILTERS} />
        </div>
        {facilities.error && !facilities.data ? (
          <ErrorState message={toApiError(facilities.error).message} onRetry={() => void facilities.refetch()} />
        ) : (
          <Table<Facility>
            rowKey="id"
            scroll={{ x: 'max-content' }}
            columns={columns}
            dataSource={rows}
            loading={facilities.isPending}
            pagination={false}
            locale={{ emptyText: facilities.isPending ? ' ' : <EmptyState title="Chưa có sân hoặc phòng nào" /> }}
          />
        )}
      </Card>
      <FacilityFormModal
        open={formOpen}
        facility={editing}
        sports={sports.data ?? []}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}
