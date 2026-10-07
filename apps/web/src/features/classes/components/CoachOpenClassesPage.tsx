import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Popconfirm, Select, Table, Tag, type TableColumnsType } from 'antd';
import { Award, CheckCircle, ClipboardList, Clock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { coachClassesService, type OpenClassItem } from '../services/coachClasses.service';
import { weeklyText } from '../utils';

export function CoachOpenClassesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const specializationsQuery = useQuery({
    queryKey: ['coach', 'specializations'],
    queryFn: () => coachClassesService.getApprovedSpecializations(),
  });

  const openClassesQuery = useQuery({
    queryKey: ['coach', 'open-classes'],
    queryFn: () => coachClassesService.listOpenClasses(),
  });

  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [conflictError, setConflictError] = useState<string | null>(null);

  const approvedSports = useMemo(() => {
    return (specializationsQuery.data ?? []).map((s) => s.sport);
  }, [specializationsQuery.data]);

  const filtered = useMemo(() => {
    const list = openClassesQuery.data ?? [];
    const term = q.trim().toLowerCase();
    return list
      .filter((c) => !sportId || c.course.sport.id === sportId)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.course.name.toLowerCase().includes(term));
  }, [openClassesQuery.data, sportId, q]);

  const registerMutation = useMutation({
    mutationFn: (classId: string) => coachClassesService.registerToTeach(classId),
    onSuccess: () => {
      setConflictError(null);
      message.success('Gửi đơn đăng ký dạy lớp thành công. Vui lòng chờ Quản lý duyệt!');
      void queryClient.invalidateQueries({ queryKey: ['coach', 'open-classes'] });
    },
    onError: (err) => {
      const apiErr = toApiError(err);
      setConflictError(apiErr.message);
    },
  });

  const columns: TableColumnsType<OpenClassItem> = [
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
      title: 'Dự kiến khai giảng',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 160,
      render: (date: string | null) => (date ? formatDate(date) : 'Chưa xếp ngày'),
    },
    {
      title: 'Sĩ số',
      key: 'capacity',
      width: 140,
      render: (_, record) => (
        <div className="text-xs">
          <div>
            Tối thiểu: <span className="font-medium">{record.minStudents}</span>
          </div>
          <div>
            Tối đa: <span className="font-medium">{record.maxStudents}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Đăng ký dạy',
      key: 'action',
      width: 180,
      render: (_, record) => {
        if (record.hasApplied || record.registrationStatus === 'PENDING') {
          return (
            <Tag color="processing" icon={<Clock className="h-3 w-3 inline mr-1" />}>
              Đã đăng ký (Chờ duyệt)
            </Tag>
          );
        }

        if (record.registrationStatus === 'APPROVED') {
          return (
            <Tag color="success" icon={<CheckCircle className="h-3 w-3 inline mr-1" />}>
              Đã duyệt phụ trách
            </Tag>
          );
        }

        return (
          <Popconfirm
            title="Đăng ký dạy lớp này?"
            description={`Bạn muốn đăng ký phụ trách lớp ${record.name}?`}
            okText="Đăng ký"
            cancelText="Hủy"
            onConfirm={() => registerMutation.mutate(record.id)}
          >
            <Button
              type="primary"
              size="small"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              loading={registerMutation.isPending && registerMutation.variables === record.id}
            >
              Đăng ký dạy
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lớp học cần Huấn luyện viên"
        description="Danh sách các lớp học đang mở tuyển HLV phụ trách bộ môn theo chuyên môn của bạn."
      />

      {/* Acceptance Criteria Banner: Chỉ hiện lớp thuộc bộ môn đã duyệt */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Award className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-blue-900">Chuyên môn đã được duyệt của bạn</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-blue-800">
              {approvedSports.length > 0 ? (
                approvedSports.map((sport) => (
                  <Tag key={sport.id} color="cyan" className="m-0 font-medium">
                    {sport.name}
                  </Tag>
                ))
              ) : (
                <span className="italic">Bạn chưa có bộ môn nào được duyệt chuyên môn.</span>
              )}
              <span className="text-blue-600 ml-2">
                (Hệ thống tự động lọc chỉ hiển thị các lớp học thuộc chuyên môn đã được duyệt)
              </span>
            </div>
          </div>
        </div>
      </div>

      {conflictError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setConflictError(null)}
          message="Không thể đăng ký dạy lớp"
          description={conflictError}
        />
      )}

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
              placeholder="Bộ môn đã duyệt"
              value={sportId}
              onChange={setSportId}
              className="w-48"
              options={approvedSports.map((s) => ({ label: s.name, value: s.id }))}
            />
          </div>
        </div>

        {openClassesQuery.isError ? (
          <ErrorState
            message={toApiError(openClassesQuery.error).message}
            onRetry={() => void openClassesQuery.refetch()}
          />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={openClassesQuery.isLoading}
            pagination={{ pageSize: 10, showTotal: (t) => `Tổng cộng ${t} lớp cần HLV` }}
            locale={{
              emptyText: (
                <EmptyState
                  title={q || sportId ? 'Không tìm thấy lớp học phù hợp' : 'Hiện chưa có lớp nào cần HLV'}
                  description={
                    q || sportId
                      ? 'Thử thay đổi bộ môn hoặc xóa từ khóa tìm kiếm.'
                      : 'Các lớp thuộc bộ môn đã duyệt của bạn hiện đã đủ HLV phụ trách hoặc chưa mở thêm.'
                  }
                />
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
}
