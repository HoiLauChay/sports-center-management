import { Alert, Button, Card, Popconfirm, Space, Table, Tag, type TableColumnsType } from 'antd';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import {
  useApprovedSpecializations,
  useOpenClasses,
  useRegisterToTeach,
  useWithdrawRegistration,
} from '../hooks/useCoachClasses';
import type { OpenClassItem } from '../services/coachClasses.service';
import { CLASS_STATUS_TAG, classDateRange } from '../utils';
import { WeeklyTags } from './ClassTableParts';

/** `/coach/open-classes` (UC_2.13, BR_2.14): drafts of the coach's approved sports that still need a coach. */
export function CoachOpenClassesPage() {
  const specializations = useApprovedSpecializations();
  const classes = useOpenClasses();
  const register = useRegisterToTeach();
  const withdraw = useWithdrawRegistration();

  const sportNames = (specializations.data ?? []).map((specialization) => specialization.sport.name).join(', ');

  const action = (record: OpenClassItem) => {
    if (record.registration?.status === 'APPROVED') return <Tag color="success">Đã duyệt</Tag>;
    if (record.registration?.status === 'PENDING') {
      return (
        <Space>
          <Tag color="warning">Chờ duyệt</Tag>
          <Popconfirm
            title="Rút đăng ký dạy lớp này?"
            okText="Rút"
            cancelText="Không"
            onConfirm={() => withdraw.mutate(record.id)}
          >
            <Button size="small" loading={withdraw.isPending && withdraw.variables === record.id}>
              Hủy
            </Button>
          </Popconfirm>
        </Space>
      );
    }
    if (record.clash) return <span className="text-xs text-red-600">Bạn bị {record.clash}</span>;
    return (
      <Button
        type="primary"
        size="small"
        loading={register.isPending && register.variables === record.id}
        onClick={() => register.mutate(record.id)}
      >
        Đăng ký dạy
      </Button>
    );
  };

  const columns: TableColumnsType<OpenClassItem> = [
    {
      title: 'Lớp',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-sc-ink">{record.name}</div>
          <div className="text-xs text-sc-muted">
            {record.course.name} · {formatVND(record.course.price)}
          </div>
        </div>
      ),
    },
    { title: 'Bộ môn', render: (_, record) => <Tag color="green">{record.course.sport.name}</Tag> },
    {
      title: 'Lịch',
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          <WeeklyTags schedule={record.weeklySchedule} />
          <span className="text-xs text-sc-muted">
            {classDateRange(record)} · {record.facility.name}
          </span>
        </div>
      ),
    },
    {
      title: 'Trạng thái lớp',
      render: (_, record) => {
        const tag = CLASS_STATUS_TAG[record.status];
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
    },
    {
      title: 'HLV hiện tại',
      render: (_, record) =>
        record.coach ? (
          record.coach.fullName
        ) : (
          <span className="whitespace-nowrap text-orange-500">Chưa có · {record.pendingRegistrations} đăng ký</span>
        ),
    },
    { key: 'action', align: 'right', width: 220, render: (_, record) => action(record) },
  ];

  return (
    <>
      <PageHeader
        title="Lớp cần HLV"
        description={`Bộ môn đã duyệt: ${sportNames || 'chưa có'} — chỉ hiện lớp nháp / chờ duyệt chưa có HLV.`}
      />
      {specializations.isSuccess && specializations.data.length === 0 && (
        <Alert
          type="warning"
          showIcon
          className="!mb-4"
          title="Bạn chưa có chuyên môn được duyệt, hãy đăng ký chuyên môn trước khi nhận lớp."
        />
      )}
      <Card>
        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<OpenClassItem>
            rowKey="id"
            columns={columns}
            dataSource={classes.data}
            loading={classes.isPending}
            scroll={{ x: 960 }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <EmptyState
                  title="Chưa có lớp nào cần HLV"
                  description="Các lớp thuộc bộ môn đã duyệt của bạn hiện đã có HLV phụ trách."
                />
              ),
            }}
          />
        )}
      </Card>
    </>
  );
}
