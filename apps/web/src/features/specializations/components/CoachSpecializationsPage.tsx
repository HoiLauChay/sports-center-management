import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Modal, Select, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { useCurrentUser } from '~/features/auth';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMySpecializations, useRegisterSpecialization } from '../hooks/useSpecializations';
import { SPECIALIZATION_STATUS_TAG, type Specialization } from '../types';

const cardHeader = { header: { minHeight: 52 } };

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
        Mỗi bộ môn chỉ có một yêu cầu đang chờ hoặc đã duyệt; bộ môn đó bị mờ. Bị từ chối thì gửi lại được.
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
  const taken = new Set(mine.filter((entry) => entry.status !== 'REJECTED').map((entry) => entry.sport.id));
  const profile = 'certifications' in user.profile ? user.profile : null;

  const columns: TableColumnsType<Specialization> = [
    {
      title: 'Bộ môn',
      key: 'sport',
      render: (_, entry) => (
        <Tag color="green" className="!m-0">
          {entry.sport.name}
        </Tag>
      ),
    },
    {
      title: 'Ghi chú duyệt',
      dataIndex: 'reviewNote',
      render: (value: string | null) => value || <span className="text-sc-muted-2">—</span>,
    },
    {
      title: 'Gửi lúc',
      dataIndex: 'createdAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: Specialization['status']) => <MappedTag value={value} map={SPECIALIZATION_STATUS_TAG} />,
    },
    {
      title: 'Xét duyệt',
      dataIndex: 'reviewedAt',
      render: (value: string | null) =>
        value ? (
          <span className="whitespace-nowrap text-xs text-sc-muted">{formatDateTime(value)}</span>
        ) : (
          <Tag className="!m-0">Chờ</Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Chuyên môn của tôi"
        description="Chỉ được đăng ký dạy / được phân công lớp thuộc bộ môn đã duyệt. Bị từ chối thì gửi lại được."
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
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card title="Đang được dạy" styles={cardHeader}>
            {approved.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {approved.map((entry) => (
                  <Tag key={entry.id} color="green" className="!m-0">
                    {entry.sport.name}
                  </Tag>
                ))}
              </div>
            ) : (
              <Alert type="warning" showIcon title="Chưa có bộ môn nào được duyệt" />
            )}
            {profile && (
              <p className="mt-3 mb-0 text-xs text-sc-muted-2">
                Chứng chỉ: {profile.certifications || '—'} · Kinh nghiệm: {profile.experience || '—'}
              </p>
            )}
          </Card>
          <Card title="Lịch sử đăng ký" styles={{ ...cardHeader, body: { padding: 0 } }}>
            <Table<Specialization>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={mine}
              loading={specializations.isPending}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Bạn chưa đăng ký bộ môn nào' }}
            />
          </Card>
        </div>
      )}
      <RegisterModal open={open} taken={taken} onClose={() => setOpen(false)} />
    </>
  );
}
