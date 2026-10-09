import type { ClassSummary } from '@sports-center/shared';
import { Button, Card, Popconfirm, Space, Table, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useMyClasses, useWithdrawFromClass } from '../hooks/useCoachClasses';
import { classDateRange } from '../utils';
import { ClassStatusTag, WeeklyTags } from './ClassTableParts';
import { CoachClassStudentsModal } from './CoachClassStudentsModal';

/** The API lets a coach leave an open or pending class before its first session. */
const canWithdraw = (item: ClassSummary) =>
  (item.status === 'OPEN' || item.status === 'PENDING_APPROVAL') && (!item.startDate || item.startDate > todayVN());

/** `/coach/classes`: the classes this coach currently teaches (classes.coach_id), with each class's students (UC_2.21). */
export function CoachClassesPage() {
  const classes = useMyClasses();
  const withdraw = useWithdrawFromClass();
  const [studentsOf, setStudentsOf] = useState<ClassSummary | null>(null);

  const columns: TableColumnsType<ClassSummary> = [
    {
      title: 'Lớp',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Button type="link" className="!h-auto !p-0 !font-semibold" onClick={() => setStudentsOf(record)}>
          {name}
        </Button>
      ),
    },
    {
      title: 'Bộ môn',
      render: (_, record) => <Tag color="green">{record.course.sport.name}</Tag>,
    },
    { title: 'Lịch', render: (_, record) => <WeeklyTags schedule={record.weeklySchedule} /> },
    { title: 'Thời gian', render: (_, record) => <span className="whitespace-nowrap">{classDateRange(record)}</span> },
    { title: 'Học viên', render: (_, record) => `${record.enrolledCount}/${record.maxStudents}` },
    {
      title: 'Trạng thái',
      render: (_, record) => <ClassStatusTag item={record} />,
    },
    {
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setStudentsOf(record)}>
            Chi tiết
          </Button>
          {canWithdraw(record) && (
            <Popconfirm
              title="Rút khỏi lớp này?"
              description="Lớp quay về chờ HLV, học viên đã đăng ký được thông báo."
              okText="Rút"
              cancelText="Không"
              onConfirm={() => withdraw.mutate(record.id)}
            >
              <Button size="small" danger loading={withdraw.isPending && withdraw.variables === record.id}>
                Rút khỏi lớp
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Lớp phụ trách" description="Lớp bạn đang là HLV hiện tại." />
      <Card>
        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<ClassSummary>
            rowKey="id"
            columns={columns}
            dataSource={classes.data}
            loading={classes.isPending}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <EmptyState
                  title="Chưa phụ trách lớp nào"
                  description="Đăng ký dạy ở mục Lớp cần HLV, lớp sẽ hiện ở đây khi Quản lý chọn bạn."
                />
              ),
            }}
          />
        )}
      </Card>
      <CoachClassStudentsModal gymClass={studentsOf} onClose={() => setStudentsOf(null)} />
    </>
  );
}
