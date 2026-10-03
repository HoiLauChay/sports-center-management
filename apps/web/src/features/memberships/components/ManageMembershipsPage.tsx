import type { MembershipPackage } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Popconfirm,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
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
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const packages = useQuery(membershipsQueryOptions);
  const [filter, setFilter] = useState<SaleFilter>('ALL');
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

  const rows = packages.data?.filter((membership) => filter === 'ALL' || membership.isActive === (filter === 'ACTIVE'));

  const columns: TableColumnsType<MembershipPackage> = [
    {
      title: 'Tên gói',
      key: 'name',
      render: (_, membership) => (
        <div className="flex max-w-xs min-w-40 flex-col gap-0.5 [overflow-wrap:anywhere]">
          <span className="font-semibold">{membership.name}</span>
          {membership.description && <span className="text-[12.5px] text-sc-muted">{membership.description}</span>}
        </div>
      ),
    },
    {
      title: 'Giá',
      key: 'price',
      align: 'right',
      render: (_, membership) => <b className="whitespace-nowrap">{formatVND(membership.price)}</b>,
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: 'Thời hạn',
      key: 'durationDays',
      render: (_, membership) => <span className="whitespace-nowrap">{membership.durationDays} ngày</span>,
      sorter: (a, b) => a.durationDays - b.durationDays,
    },
    {
      title: 'Gym',
      key: 'gymAccess',
      align: 'center',
      render: (_, membership) =>
        membership.gymAccess ? (
          <Tag color="green" className="!m-0">
            Miễn phí
          </Tag>
        ) : (
          <Tag className="!m-0">—</Tag>
        ),
    },
    {
      title: 'Giảm đặt sân',
      key: 'bookingDiscountPct',
      align: 'center',
      render: (_, membership) =>
        membership.bookingDiscountPct ? (
          <Tag color="cyan" className="!m-0">
            −{membership.bookingDiscountPct}%
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Giảm học phí',
      key: 'classDiscountPct',
      align: 'center',
      render: (_, membership) =>
        membership.classDiscountPct ? (
          <Tag color="geekblue" className="!m-0">
            −{membership.classDiscountPct}%
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Slot miễn phí / tháng',
      key: 'freeBookingSlotsPerMonth',
      align: 'center',
      render: (_, membership) => membership.freeBookingSlotsPerMonth || '—',
    },
    {
      title: 'Đang bán',
      key: 'isActive',
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
        <Space>
          <Button size="small" disabled={remove.isPending || toggle.isPending} onClick={() => openForm(membership)}>
            Sửa
          </Button>
          <Popconfirm
            title={`Xóa ${membership.name}?`}
            description="Gói sẽ ngừng bán và bị xóa khỏi danh sách. Các kỳ đã thanh toán vẫn giữ nguyên quyền lợi đến hết hạn."
            okText="Xóa gói"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            styles={{ container: { maxWidth: 340 } }}
            onConfirm={() => remove.mutateAsync(membership).catch(() => undefined)}
          >
            <Button
              size="small"
              danger
              disabled={remove.isPending || toggle.isPending}
              loading={remove.isPending && remove.variables.id === membership.id}
            >
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
        title="Gói thành viên"
        description="Không cần gói vẫn đặt sân / đăng ký lớp được. Gói chỉ thêm quyền lợi: vào gym, giảm giá đặt sân, giảm học phí, slot sân miễn phí mỗi tháng."
        extra={
          <Space wrap>
            <Segmented
              value={filter}
              onChange={(value) => setFilter(value as SaleFilter)}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                { value: 'ACTIVE', label: 'Đang bán' },
                { value: 'INACTIVE', label: 'Ngừng bán' },
              ]}
            />
            <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
              Tạo gói
            </Button>
          </Space>
        }
      />
      <Card>
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
            scroll={{ x: 1000 }}
            columns={columns}
            dataSource={rows}
            loading={packages.isFetching}
            pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
            locale={{
              emptyText: packages.isPending ? (
                ' '
              ) : (
                <EmptyState title={filter !== 'ALL' ? 'Không có gói phù hợp' : 'Chưa có gói thành viên'} />
              ),
            }}
          />
        )}
      </Card>
      <MembershipFormModal open={formOpen} membership={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
