import type { MembershipPackage } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Popconfirm, Segmented, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { useConfirm } from '~/hooks/useConfirm';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import {
  cacheMembershipPackage,
  membershipsQueryOptions,
  removeCachedMembershipPackage,
} from '../hooks/useMemberships';
import { membershipsService } from '../services/memberships.service';
import { MembershipFormModal } from './MembershipFormModal';

type SaleFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function ManageMembershipsPage() {
  const confirm = useConfirm();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const packages = useQuery(membershipsQueryOptions);
  const [filter, setFilter] = useState<SaleFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<MembershipPackage | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: membershipsQueryOptions.queryKey });

  const refused = (title: string) => (err: unknown) =>
    modal.error({ title, content: toApiError(err).message, okText: 'Đã hiểu' });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => membershipsService.update(id, { isActive }),
    onSuccess: (membership) => {
      cacheMembershipPackage(queryClient, membership);
      refresh();
      message.success(membership.isActive ? `Đã mở bán ${membership.name}` : `Đã ngừng bán ${membership.name}`);
    },
    onError: refused('Không thể thay đổi trạng thái gói'),
  });

  const remove = useMutation({
    mutationFn: (membership: MembershipPackage) => membershipsService.remove(membership.id),
    onSuccess: (_, membership) => {
      removeCachedMembershipPackage(queryClient, membership.id);
      refresh();
      message.success(`Đã xóa ${membership.name}`);
    },
    onError: refused('Không thể xóa gói thành viên'),
  });

  const openForm = (membership: MembershipPackage | null) => {
    setEditing(membership);
    setFormOpen(true);
  };

  const rows = useMemo(() => {
    if (!packages.data) return [];
    const q = search.trim().toLowerCase();
    return packages.data.filter((membership) => {
      if (filter !== 'ALL' && membership.isActive !== (filter === 'ACTIVE')) return false;
      if (q) {
        const matchName = membership.name.toLowerCase().includes(q);
        const matchDesc = membership.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [packages.data, filter, search]);

  const columns: TableColumnsType<MembershipPackage> = [
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
      title: 'Tên gói',
      key: 'name',
      render: (_, membership) => (
        <div className="flex min-w-[150px] flex-col gap-0.5">
          <span className="font-semibold text-sc-ink">{membership.name}</span>
          {membership.description && (
            <span className="text-[12px] text-sc-muted line-clamp-2">{membership.description}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Giá',
      key: 'price',
      width: 110,
      align: 'right',
      render: (_, membership) => <span className="whitespace-nowrap tabular-nums">{formatVND(membership.price)}</span>,
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: 'Thời hạn',
      key: 'durationDays',
      width: 90,
      align: 'center',
      render: (_, membership) => <span className="whitespace-nowrap">{membership.durationDays} ngày</span>,
      sorter: (a, b) => a.durationDays - b.durationDays,
    },
    {
      title: 'Gym',
      key: 'gymAccess',
      width: 80,
      align: 'center',
      render: (_, membership) =>
        membership.gymAccess ? (
          <Tag color="green" className="!m-0">
            Miễn phí
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Giảm sân',
      key: 'bookingDiscountPct',
      width: 90,
      align: 'center',
      render: (_, membership) =>
        membership.bookingDiscountPct ? (
          <Tag color="cyan" className="!m-0">
            −{membership.bookingDiscountPct}%
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Giảm lớp',
      key: 'classDiscountPct',
      width: 90,
      align: 'center',
      render: (_, membership) =>
        membership.classDiscountPct ? (
          <Tag color="geekblue" className="!m-0">
            −{membership.classDiscountPct}%
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Slot free/tháng',
      key: 'freeBookingSlotsPerMonth',
      width: 105,
      align: 'center',
      render: (_, membership) =>
        membership.freeBookingSlotsPerMonth ? (
          <span className="text-sc-ink tabular-nums">{membership.freeBookingSlotsPerMonth}</span>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Đang bán',
      key: 'isActive',
      width: 90,
      align: 'center',
      render: (_, membership) => (
        <Popconfirm
          title={`Ngừng bán ${membership.name}?`}
          description="Gói sẽ không còn nhận đăng ký mới. Thành viên đang bật tự động gia hạn sẽ nhận thông báo."
          okText="Ngừng bán"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          styles={{ container: { maxWidth: 340 } }}
          disabled={!membership.isActive}
          onConfirm={() => toggle.mutateAsync({ id: membership.id, isActive: false }).catch(() => undefined)}
        >
          <Switch
            checked={membership.isActive}
            checkedChildren="Bật"
            unCheckedChildren="Tắt"
            aria-label={`Đang bán ${membership.name}`}
            disabled={toggle.isPending || remove.isPending}
            loading={toggle.isPending && toggle.variables.id === membership.id}
            onChange={(isActive) => {
              if (isActive) toggle.mutate({ id: membership.id, isActive });
            }}
          />
        </Popconfirm>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, membership) => (
        <RowActions
          label={`Thao tác với ${membership.name}`}
          actions={[
            {
              key: 'edit',
              label: 'Sửa',
              disabled: remove.isPending || toggle.isPending,
              onClick: () => openForm(membership),
            },
            {
              key: 'delete',
              label: 'Xóa',
              danger: true,
              disabled: remove.isPending || toggle.isPending,
              loading: remove.isPending && remove.variables.id === membership.id,
              onClick: () =>
                confirm({
                  title: `Xóa ${membership.name}?`,
                  content:
                    'Gói sẽ ngừng bán và bị xóa khỏi danh sách. Các kỳ đã thanh toán vẫn giữ nguyên quyền lợi đến hết hạn.',
                  okText: 'Xóa gói',
                  onOk: () => remove.mutateAsync(membership).catch(() => undefined),
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
        title="Gói thành viên"
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Tạo gói
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            placeholder="Tìm theo tên gói, mô tả..."
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-full sm:!w-72"
          />
          <div className="overflow-x-auto">
            <Segmented
              value={filter}
              onChange={(value) => {
                setFilter(value as SaleFilter);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                { value: 'ACTIVE', label: 'Đang bán' },
                { value: 'INACTIVE', label: 'Ngừng bán' },
              ]}
            />
          </div>
        </div>

        {packages.error && packages.data && (
          <Alert
            type="error"
            showIcon
            title={toApiError(packages.error).message}
            action={
              <Button size="small" onClick={() => void packages.refetch()}>
                Thử lại
              </Button>
            }
            className="!mb-4"
          />
        )}
        {packages.error && !packages.data ? (
          <ErrorState message={toApiError(packages.error).message} onRetry={() => void packages.refetch()} />
        ) : (
          <Table<MembershipPackage>
            rowKey="id"
            scroll={{ x: 960 }}
            columns={columns}
            dataSource={rows}
            loading={packages.isFetching}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} gói thành viên`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: packages.isPending ? (
                ' '
              ) : (
                <EmptyState
                  title={search || filter !== 'ALL' ? 'Không có gói phù hợp' : 'Chưa có gói thành viên'}
                  description={search || filter !== 'ALL' ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : undefined}
                />
              ),
            }}
          />
        )}
      </Card>
      <MembershipFormModal open={formOpen} membership={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
