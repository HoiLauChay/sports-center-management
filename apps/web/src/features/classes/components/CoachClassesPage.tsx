import { Link } from '@tanstack/react-router';
import { Button, Card, Space, Table, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { useMyClasses } from '../hooks/useCoachClasses';
import type { CoachClassItem } from '../types';
import { classDateRange } from '../utils';
import { ClassStatusTag, WeeklyTags } from './ClassTableParts';
import { CoachClassStudentsModal } from './CoachClassStudentsModal';

/** `/coach/classes`: the classes this coach currently teaches (classes.coach_id), with each class's students (UC_2.21). */
export function CoachClassesPage() {
  const classes = useMyClasses();
  const [studentsOf, setStudentsOf] = useState<CoachClassItem | null>(null);

  const columns: TableColumnsType<CoachClassItem> = [
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
          {record.derivedStatus === 'ONGOING' && record.attendanceSessionId && (
            <Link to="/coach/sessions/$sessionId" params={{ sessionId: record.attendanceSessionId }}>
              <Button size="small" type="primary">
                Điểm danh
              </Button>
            </Link>
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
          <Table<CoachClassItem>
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
