import type { Sport } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Avatar, Button, Card, Popconfirm, Space, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { facilitiesQueryOptions, sportsQueryOptions } from '../hooks/useCatalog';
import { sportsService } from '../services/sports.service';
import { SportFormModal } from './SportFormModal';

export function SportsPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const sports = useQuery(sportsQueryOptions);
  const facilities = useQuery(facilitiesQueryOptions);
  const [editing, setEditing] = useState<Sport | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const facilitiesBySport = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const facility of facilities.data ?? []) {
      for (const sport of facility.sports) map.set(sport.id, [...(map.get(sport.id) ?? []), facility.name]);
    }
    return map;
  }, [facilities.data]);

  const filteredSports = useMemo(() => {
    if (!sports.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return sports.data;
    return sports.data.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
  }, [sports.data, search]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: sportsQueryOptions.queryKey });
    void queryClient.invalidateQueries({ queryKey: facilitiesQueryOptions.queryKey });
  };

  const refused = (title: string) => (err: unknown) =>
    modal.error({ title, content: toApiError(err).message, okText: 'Đã hiểu' });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => sportsService.update(id, { isActive }),
    onSuccess: (sport) => {
      refresh();
      message.success(sport.isActive ? `Đã mở lại ${sport.name}` : `Đã ngừng ${sport.name}`);
    },
    onError: refused('Không thể ngừng bộ môn'),
  });

  const remove = useMutation({
    mutationFn: (sport: Sport) => sportsService.remove(sport.id),
    onSuccess: (_, sport) => {
      refresh();
      message.success(`Đã xóa ${sport.name}`);
    },
    onError: refused('Không thể xóa bộ môn'),
  });

  const openForm = (sport: Sport | null) => {
    setEditing(sport);
    setFormOpen(true);
  };

  const columns: TableColumnsType<Sport> = [
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
      title: 'Bộ môn',
      key: 'sport',
      render: (_, sport) => (
        <div className="flex items-center gap-3">
          <Avatar shape="square" src={sport.iconUrl ?? undefined} className="shrink-0 !bg-sc-primary">
            {sport.name.charAt(0).toUpperCase()}
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{sport.name}</span>
            {sport.description && (
              <span className="max-w-md text-xs text-sc-muted [overflow-wrap:anywhere]">{sport.description}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Sân & phòng',
      key: 'facilities',
      render: (_, sport) => {
        const names = facilitiesBySport.get(sport.id) ?? [];
        return names.length ? (
          <Space wrap size={[4, 4]}>
            {names.map((name) => (
              <Tag key={name} className="!m-0">
                {name}
              </Tag>
            ))}
          </Space>
        ) : (
          <span className="text-sc-muted-2">Chưa gắn sân nào</span>
        );
      },
    },
    {
      title: 'Hoạt động',
      key: 'isActive',
      width: 110,
      render: (_, sport) => (
        <Switch
          checked={sport.isActive}
          loading={toggle.isPending && toggle.variables.id === sport.id}
          onChange={(isActive) => toggle.mutate({ id: sport.id, isActive })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, sport) => (
        <Space>
          <Button size="small" onClick={() => openForm(sport)}>
            Sửa
          </Button>
          <Popconfirm
            title={`Xóa bộ môn ${sport.name}?`}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutateAsync(sport).catch(() => undefined)}
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
        title="Bộ môn"
        description={sports.data && `${sports.data.length} bộ môn · ${facilities.data?.length ?? 0} sân & phòng`}
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Thêm bộ môn
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            placeholder="Tìm theo tên bộ môn, mô tả..."
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-full sm:!w-80"
          />
        </div>
        {sports.error && !sports.data ? (
          <ErrorState message={toApiError(sports.error).message} onRetry={() => void sports.refetch()} />
        ) : (
          <Table<Sport>
            rowKey="id"
            scroll={{ x: 'max-content' }}
            columns={columns}
            dataSource={filteredSports}
            loading={sports.isPending}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} bộ môn`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: sports.isPending ? (
                ' '
              ) : (
                <EmptyState
                  title={search ? 'Không tìm thấy bộ môn phù hợp' : 'Chưa có bộ môn nào'}
                  description={search ? 'Thử tìm với từ khóa khác' : undefined}
                />
              ),
            }}
          />
        )}
      </Card>
      <SportFormModal open={formOpen} sport={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
