import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd';
import {
  AlertCircle,
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useCurrentUser } from '~/features/auth';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMySpecializations, useRegisterSpecialization } from '../hooks/useSpecializations';
import type { Specialization } from '../types';

const cardHeader = { header: { minHeight: 48 } };

function RegisterModal({ open, taken, onClose }: { open: boolean; taken: Set<string>; onClose: () => void }) {
  const [form] = Form.useForm<{ sportId: string }>();
  const sports = useQuery(sportsQueryOptions);
  const register = useRegisterSpecialization();

  return (
    <Modal
      title="Đăng ký bộ môn chuyên môn"
      open={open}
      centered
      destroyOnHidden
      okText="Gửi Quản lý duyệt"
      cancelText="Đóng"
      confirmLoading={register.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        className="!mt-4"
        onFinish={({ sportId }) => register.mutate(sportId, { onSuccess: onClose })}
      >
        <Form.Item name="sportId" label="Bộ môn" rules={[{ required: true, message: 'Chọn bộ môn' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Chọn bộ môn"
            loading={sports.isPending}
            options={(sports.data ?? [])
              .filter((sport) => sport.isActive)
              .map((sport) => ({ value: sport.id, label: sport.name, disabled: taken.has(sport.id) }))}
          />
        </Form.Item>
      </Form>
      <p className="m-0 text-xs text-sc-muted-2">
        Mỗi bộ môn chỉ có một yêu cầu đang chờ hoặc đã duyệt; bộ môn đó bị mờ. Bị từ chối thì có thể gửi lại được.
      </p>
    </Modal>
  );
}

/** `/coach/specializations` (UC_1.13, BR_1.12): the sports I may teach, my requests and the manager's decisions. */
export function CoachSpecializationsPage() {
  const user = useCurrentUser();
  const specializations = useMySpecializations();
  const [open, setOpen] = useState(false);

  const mine = [...(specializations.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const approved = mine.filter((entry) => entry.status === 'APPROVED');
  const pending = mine.filter((entry) => entry.status === 'PENDING');
  const rejected = mine.filter((entry) => entry.status === 'REJECTED');
  const taken = new Set(mine.filter((entry) => entry.status !== 'REJECTED').map((entry) => entry.sport.id));
  const profile = 'certifications' in user.profile ? user.profile : null;

  const columns: TableColumnsType<Specialization> = [
    {
      title: '#',
      key: 'index',
      width: 55,
      className: '!pl-5',
      render: (_, __, index) => (
        <span className="font-mono text-xs font-semibold text-sc-muted-2">{String(index + 1).padStart(2, '0')}</span>
      ),
    },
    {
      title: 'Bộ môn',
      key: 'sport',
      width: 120,
      render: (_, entry) => <span className="font-semibold text-sc-ink">{entry.sport.name}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (value: Specialization['status']) => {
        if (value === 'APPROVED') {
          return (
            <Tag color="success" className="!m-0 inline-flex items-center gap-1 font-medium">
              <CheckCircle2 size={12} /> Đã duyệt
            </Tag>
          );
        }
        if (value === 'PENDING') {
          return (
            <Tag color="warning" className="!m-0 inline-flex items-center gap-1 font-medium">
              <Clock size={12} /> Chờ duyệt
            </Tag>
          );
        }
        return (
          <Tag color="error" className="!m-0 inline-flex items-center gap-1 font-medium">
            <XCircle size={12} /> Từ chối
          </Tag>
        );
      },
    },
    {
      title: 'Gửi lúc',
      dataIndex: 'createdAt',
      width: 135,
      render: (value: string) => (
        <span className="whitespace-nowrap text-xs text-sc-muted">{formatDateTime(value)}</span>
      ),
    },
    {
      title: 'Xét duyệt & Ghi chú',
      key: 'review',
      className: '!pr-5',
      render: (_, entry) => {
        if (entry.status === 'REJECTED') {
          return (
            <div className="flex flex-col gap-1 py-1">
              {entry.reviewedAt && (
                <span className="text-[11px] text-sc-muted-2">Xét duyệt: {formatDateTime(entry.reviewedAt)}</span>
              )}
              {entry.reviewNote ? (
                <div className="rounded-md border border-red-200 bg-red-50/90 px-2.5 py-1.5 text-xs text-red-700 leading-snug">
                  <span className="font-semibold">Lý do: </span>
                  <span>{entry.reviewNote}</span>
                </div>
              ) : (
                <span className="text-xs text-sc-muted-2">—</span>
              )}
            </div>
          );
        }

        if (entry.status === 'APPROVED') {
          return (
            <div className="flex flex-col gap-0.5 text-xs py-1">
              {entry.reviewedAt && (
                <span className="text-[11px] text-sc-muted">Duyệt lúc: {formatDateTime(entry.reviewedAt)}</span>
              )}
              {entry.reviewNote ? (
                <span className="text-xs text-sc-ink [overflow-wrap:anywhere]">{entry.reviewNote}</span>
              ) : null}
            </div>
          );
        }

        return <span className="text-xs italic text-sc-muted-2">Đang chờ quản lý xét duyệt...</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Chuyên môn của tôi"
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            Đăng ký bộ môn
          </Button>
        }
      />

      {specializations.isError && !specializations.data ? (
        <ErrorState
          message={toApiError(specializations.error).message}
          onRetry={() => void specializations.refetch()}
        />
      ) : (
        <div className="space-y-4">
          {/* Top Metrics Row */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <StatCard
                icon={Award}
                label="Bộ môn được phép dạy"
                loading={specializations.isPending}
                value={approved.length}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                icon={Clock}
                label="Yêu cầu chờ duyệt"
                loading={specializations.isPending}
                value={pending.length}
                tone={pending.length > 0 ? 'warning' : 'default'}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                icon={AlertCircle}
                label="Cần bổ sung hồ sơ"
                loading={specializations.isPending}
                value={rejected.length}
                tone={rejected.length > 0 ? 'warning' : 'default'}
              />
            </Col>
          </Row>

          {/* Main 2-Column Section */}
          <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
            {/* Left Column: Coach Profile & Approved Sports */}
            <Card title="Hồ sơ & Chuyên môn" className="overflow-hidden" styles={cardHeader}>
              {/* Coach Identity */}
              <div className="flex items-center gap-3">
                <Avatar size={48} className="!bg-emerald-600 font-bold text-white shadow-sm shrink-0">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-sc-ink">{user.fullName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-sc-muted">
                    <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                    <span>Huấn luyện viên</span>
                    {user.phone && <span className="truncate">· {user.phone}</span>}
                  </div>
                </div>
              </div>

              <Divider className="!my-3.5" />

              {/* Approved Sports */}
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-sc-muted">
                  Bộ môn đã được duyệt ({approved.length})
                </div>
                {approved.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {approved.map((entry) => (
                      <div
                        key={entry.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                      >
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>{entry.sport.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert type="warning" showIcon title="Chưa có bộ môn nào được duyệt" className="!text-xs" />
                )}
              </div>

              <Divider className="!my-3.5" />

              {/* Qualifications & Experience */}
              <div className="space-y-3.5">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sc-muted">
                    <GraduationCap size={14} className="text-blue-600" />
                    <span>Chứng chỉ chuyên môn</span>
                  </div>
                  {profile?.certifications ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs leading-relaxed text-sc-ink">
                      {profile.certifications}
                    </div>
                  ) : (
                    <span className="text-xs text-sc-muted-2">Chưa cập nhật thông tin chứng chỉ</span>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sc-muted">
                    <Briefcase size={14} className="text-amber-600" />
                    <span>Kinh nghiệm huấn luyện</span>
                  </div>
                  {profile?.experience ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs leading-relaxed text-sc-ink">
                      {profile.experience}
                    </div>
                  ) : (
                    <span className="text-xs text-sc-muted-2">Chưa cập nhật kinh nghiệm</span>
                  )}
                </div>

                {profile?.bio && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sc-muted">
                      <FileText size={14} className="text-slate-500" />
                      <span>Giới thiệu</span>
                    </div>
                    <p className="m-0 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs italic leading-relaxed text-sc-muted">
                      "{profile.bio}"
                    </p>
                  </div>
                )}
              </div>

              <Divider className="!my-3.5" />

              <Button type="dashed" block icon={<Plus size={14} />} onClick={() => setOpen(true)} className="!text-xs">
                Đăng ký thêm bộ môn
              </Button>
            </Card>

            {/* Right Column: Registration & Review History Table */}
            <Card
              title="Lịch sử đăng ký & Xét duyệt"
              className="overflow-hidden"
              styles={{ ...cardHeader, body: { padding: 0 } }}
            >
              <Table<Specialization>
                rowKey="id"
                size="middle"
                columns={columns}
                dataSource={mine}
                loading={specializations.isPending}
                pagination={false}
                scroll={{ x: 620 }}
                locale={{ emptyText: 'Bạn chưa đăng ký bộ môn nào' }}
              />
            </Card>
          </div>
        </div>
      )}

      <RegisterModal open={open} taken={taken} onClose={() => setOpen(false)} />
    </>
  );
}
