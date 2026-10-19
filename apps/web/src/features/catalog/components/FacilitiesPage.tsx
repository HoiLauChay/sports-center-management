import { FACILITY_TYPES, type Facility, type FacilityType } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Segmented, Select, Space, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { ScheduleConflictList } from '~/components/data/ScheduleConflictList';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { FACILITY_TYPE_LABEL } from '~/constants/facility';
import { useConfirm } from '~/hooks/useConfirm';
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
  const confirm = useConfirm();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const [type, setType] = useState<TypeFilter>('ALL');
  const [sportId, setSportId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const filteredFacilities = useMemo(() => {
    if (!facilities.data) return [];
    const q = search.trim().toLowerCase();
    return facilities.data.filter((facility) => {
      if (type !== 'ALL' && facility.type !== type) return false;
      if (sportId && !facility.sports.some((s) => s.id === sportId)) return false;
      if (q) {
        const matchName = facility.name.toLowerCase().includes(q);
        const matchDesc = facility.description?.toLowerCase().includes(q);
        const matchSport = facility.sports.some((s) => s.name.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchSport) return false;
      }
      return true;
    });
  }, [facilities.data, type, sportId, search]);

  const columns: TableColumnsType<Facility> = [
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
      title: 'Tên',
      key: 'name',
      render: (_, facility) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{facility.name}</span>
          {facility.description && (
            <span className="max-w-xs text-[13px] text-sc-muted [overflow-wrap:anywhere]">{facility.description}</span>
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
              <SportTag key={sport.id} name={sport.name} />
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
      render: (value: number) => <span className="tabular-nums">{value}</span>,
    },
    {
      title: 'Giá / slot',
      dataIndex: 'pricePerSlot',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
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
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, facility) => (
        <RowActions
          label={`Thao tác với ${facility.name}`}
          actions={[
            { key: 'edit', label: 'Sửa', onClick: () => openForm(facility) },
            {
              key: 'delete',
              label: 'Xóa',
              danger: true,
              onClick: () =>
                confirm({
                  title: `Xóa ${facility.name}?`,
                  okText: 'Xóa',
                  onOk: () => remove.mutateAsync(facility).catch(() => undefined),
                }),
            },
          ]}
        />
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              placeholder="Tìm theo tên sân, phòng..."
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              className="w-full sm:!w-72"
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả bộ môn"
              value={sportId}
              onChange={(val) => {
                setSportId(val);
                setPage(1);
              }}
              className="w-full sm:!w-52"
              options={(sports.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="overflow-x-auto">
            <Segmented
              value={type}
              onChange={(value) => {
                setType(value as TypeFilter);
                setPage(1);
              }}
              options={TYPE_FILTERS}
            />
          </div>
        </div>
        {facilities.error && !facilities.data ? (
          <ErrorState message={toApiError(facilities.error).message} onRetry={() => void facilities.refetch()} />
        ) : (
          <Table<Facility>
            rowKey="id"
            scroll={{ x: 'max-content' }}
            columns={columns}
            dataSource={filteredFacilities}
            loading={facilities.isPending}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} sân & phòng`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: facilities.isPending ? (
                ' '
              ) : (
                <EmptyState
                  title={
                    search || sportId || type !== 'ALL'
                      ? 'Không tìm thấy sân/phòng phù hợp'
                      : 'Chưa có sân hoặc phòng nào'
                  }
                  description={
                    search || sportId || type !== 'ALL' ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : undefined
                  }
                />
              ),
            }}
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
