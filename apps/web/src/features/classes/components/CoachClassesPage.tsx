import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Input, Progress, Select, Table, Tag, type TableColumnsType } from 'antd';
import { CalendarDays, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { coachClassesService } from '../services/coachClasses.service';
import type { ClassDerivedStatus, GymClass } from '../types';
import { weeklyText } from '../utils';
import { CoachClassStudentsModal } from './CoachClassStudentsModal';

const DERIVED_STATUS_LABELS: Record<ClassDerivedStatus, { label: string; color: string }> = {
  UPCOMING: { label: 'Sắp diễn ra', color: 'processing' },
  ONGOING: { label: 'Đang giảng dạy', color: 'success' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'default' },
};

export function CoachClassesPage() {
  const sports = useQuery(sportsQueryOptions);
  const myClassesQuery = useQuery({
    queryKey: ['coach', 'my-classes'],
    queryFn: () => coachClassesService.listMyClasses(),
  });

  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [derivedStatus, setDerivedStatus] = useState<ClassDerivedStatus | undefined>();
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<GymClass | null>(null);

  const filtered = useMemo(() => {
    const list = myClassesQuery.data ?? [];
    const term = q.trim().toLowerCase();
    return list
      .filter((c) => !sportId || c.course.sport.id === sportId)
      .filter((c) => !derivedStatus || c.derivedStatus === derivedStatus)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.course.name.toLowerCase().includes(term));
  }, [myClassesQuery.data, sportId, derivedStatus, q]);

  const totalStudents = useMemo(() => {
    return (myClassesQuery.data ?? []).reduce((sum, c) => sum + c.enrolledCount, 0);
  }, [myClassesQuery.data]);

  const columns: TableColumnsType<GymClass> = [
    {
      title: 'Tên lớp & Khóa học',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <div className="font-semibold text-sc-ink">{name}</div>
          <div className="text-xs text-sc-muted">{record.course.name}</div>
        </div>
      ),
    },
    {
      title: 'Bộ môn',
      dataIndex: ['course', 'sport', 'name'],
      key: 'sport',
      width: 130,
      render: (sportName: string) => <Tag color="blue">{sportName}</Tag>,
    },
    {
      title: 'Cơ sở & Lịch dạy',
      key: 'schedule',
      render: (_, record) => (
        <div className="text-sm">
          <div className="font-medium text-sc-ink">{record.facility.name}</div>
          <div className="text-xs text-sc-muted">{weeklyText(record.weeklySchedule)}</div>
        </div>
      ),
    },
    {
      title: 'Thời gian',
      key: 'dates',
      width: 170,
      render: (_, record) => (
        <div className="text-xs">
          <div>Từ: {record.startDate ? formatDate(record.startDate) : 'Chưa có'}</div>
          <div>Đến: {record.endDate ? formatDate(record.endDate) : 'Chưa có'}</div>
        </div>
      ),
    },
    {
      title: 'Sĩ số học viên',
      key: 'students',
      width: 160,
      render: (_, record) => {
        const pct = Math.min(100, Math.round((record.enrolledCount / record.maxStudents) * 100));
        return (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-sc-ink">{record.enrolledCount} học viên</span>
              <span className="text-sc-muted">/ {record.maxStudents} max</span>
            </div>
            <Progress percent={pct} size="small" showInfo={false} />
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_, record) => {
        if (record.status === 'CANCELLED') {
          return <Tag color="error">Đã hủy</Tag>;
        }
        if (record.derivedStatus) {
          const conf = DERIVED_STATUS_LABELS[record.derivedStatus];
          return <Tag color={conf?.color}>{conf?.label ?? record.derivedStatus}</Tag>;
        }
        return <Tag color="default">{record.status}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            size="small"
            icon={<Users className="h-3.5 w-3.5" />}
            onClick={() => setSelectedClassForStudents(record)}
          >
            Học viên
          </Button>
          <Link to="/coach/schedule">
            <Button size="small" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              Lịch
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lớp đang giảng dạy"
        description="Quản lý danh sách các lớp học được phân công, lịch trình và học viên từng lớp."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-sc-line">
          <div className="text-xs text-sc-muted">Tổng số lớp phụ trách</div>
          <div className="mt-1 text-2xl font-bold text-sc-ink">{myClassesQuery.data?.length ?? 0}</div>
        </Card>
        <Card className="border-sc-line">
          <div className="text-xs text-sc-muted">Tổng số học viên theo học</div>
          <div className="mt-1 text-2xl font-bold text-sc-primary">{totalStudents}</div>
        </Card>
        <Card className="border-sc-line">
          <div className="text-xs text-sc-muted">Lớp đang diễn ra</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {(myClassesQuery.data ?? []).filter((c) => c.derivedStatus === 'ONGOING').length}
          </div>
        </Card>
      </div>

      <Card className="border-sc-line">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              prefix={<Search className="h-4 w-4 text-sc-muted" />}
              placeholder="Tìm theo tên lớp, khóa học..."
              allowClear
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
            <Select
              allowClear
              placeholder="Bộ môn"
              value={sportId}
              onChange={setSportId}
              className="w-40"
              options={(sports.data ?? []).map((s) => ({ label: s.name, value: s.id }))}
            />
            <Select
              allowClear
              placeholder="Tiến độ lớp"
              value={derivedStatus}
              onChange={setDerivedStatus}
              className="w-40"
              options={[
                { label: 'Sắp diễn ra', value: 'UPCOMING' },
                { label: 'Đang giảng dạy', value: 'ONGOING' },
                { label: 'Đã hoàn thành', value: 'COMPLETED' },
              ]}
            />
          </div>
        </div>

        {myClassesQuery.isError ? (
          <ErrorState
            message={toApiError(myClassesQuery.error).message}
            onRetry={() => void myClassesQuery.refetch()}
          />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={myClassesQuery.isLoading}
            pagination={{ pageSize: 10, showTotal: (t) => `Tổng cộng ${t} lớp` }}
            locale={{
              emptyText: (
                <EmptyState
                  title={q || sportId || derivedStatus ? 'Không có lớp học phù hợp' : 'Chưa có lớp học nào'}
                  description={
                    q || sportId || derivedStatus
                      ? 'Thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.'
                      : 'Hiện tại bạn chưa được phân công phụ trách lớp học nào.'
                  }
                />
              ),
            }}
          />
        )}
      </Card>

      <CoachClassStudentsModal
        open={Boolean(selectedClassForStudents)}
        gymClass={selectedClassForStudents}
        onClose={() => setSelectedClassForStudents(null)}
      />
    </div>
  );
}
