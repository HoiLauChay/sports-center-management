import { Button, Form, Input, Modal, Rate, Table, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { useConfirm } from '~/hooks/useConfirm';
import { toApiError } from '~/lib/http-errors';
import {
  useAttendance,
  useCreateEvaluation,
  useDeleteEvaluation,
  useSessionEvaluations,
  useUpdateEvaluation,
} from '../hooks/useTraining';
import type { AttendanceRecord, Evaluation } from '../types';

interface Row {
  record: AttendanceRecord;
  evaluation?: Evaluation;
}

/** Rating 1-5 and a comment for each student of the session; one evaluation per student per session (BR_4.5). */
export function EvaluationsTab({ sessionId, editable }: { sessionId: string; editable: boolean }) {
  const confirm = useConfirm();
  const students = useAttendance(sessionId);
  const evaluations = useSessionEvaluations(sessionId);
  const create = useCreateEvaluation(sessionId);
  const update = useUpdateEvaluation(sessionId);
  const remove = useDeleteEvaluation(sessionId);
  const [target, setTarget] = useState<Row | null>(null);
  const [form] = Form.useForm<{ rating: number; comment?: string }>();

  const rows: Row[] = (students.data ?? []).map((record) => ({
    record,
    evaluation: evaluations.data?.find((entry) => entry.account.id === record.account.id),
  }));

  const open = (row: Row) => {
    setTarget(row);
    form.setFieldsValue({ rating: row.evaluation?.rating ?? 0, comment: row.evaluation?.comment ?? '' });
  };

  const submit = (values: { rating: number; comment?: string }) => {
    if (!target) return;
    const done = { onSuccess: () => setTarget(null) };
    if (target.evaluation) {
      update.mutate({ id: target.evaluation.id, rating: values.rating, comment: values.comment ?? '' }, done);
    } else {
      create.mutate({ accountId: target.record.account.id, rating: values.rating, comment: values.comment }, done);
    }
  };

  const columns: TableColumnsType<Row> = [
    { title: 'Học viên', key: 'student', render: (_, row) => <b>{row.record.account.fullName}</b> },
    {
      title: 'Điểm',
      key: 'rating',
      render: (_, row) =>
        row.evaluation ? <Rate disabled value={row.evaluation.rating} /> : <Tag className="!m-0">Chưa đánh giá</Tag>,
    },
    {
      title: 'Nhận xét',
      key: 'comment',
      render: (_, row) => row.evaluation?.comment ?? <span className="text-sc-muted-2">—</span>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, row) =>
        editable ? (
          <div className="flex justify-end gap-1.5">
            <Button size="small" type={row.evaluation ? 'default' : 'primary'} onClick={() => open(row)}>
              {row.evaluation ? 'Sửa' : 'Đánh giá'}
            </Button>
            {row.evaluation && (
              <Button
                size="small"
                danger
                onClick={() =>
                  confirm({
                    title: `Xóa đánh giá của ${row.record.account.fullName}?`,
                    content: 'Sau khi xóa bạn có thể viết đánh giá mới cho buổi học này.',
                    okText: 'Xóa',
                    onOk: () => remove.mutateAsync(row.evaluation!.id).catch(() => undefined),
                  })
                }
              >
                Xóa
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  if (students.isError && !students.data) {
    return <ErrorState message={toApiError(students.error).message} onRetry={() => void students.refetch()} />;
  }

  return (
    <>
      <Table<Row>
        rowKey={(row) => row.record.account.id}
        size="middle"
        columns={columns}
        dataSource={rows}
        loading={(students.isFetching && !students.data) || evaluations.isFetching}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState title="Buổi học chưa có học viên" /> }}
      />
      <Modal
        open={Boolean(target)}
        centered
        destroyOnHidden
        title={`Đánh giá ${target?.record.account.fullName ?? ''}`}
        okText="Lưu đánh giá"
        cancelText="Đóng"
        confirmLoading={create.isPending || update.isPending}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="!mt-4">
          <Form.Item
            name="rating"
            label="Điểm (1–5)"
            rules={[{ type: 'number', min: 1, max: 5, required: true, message: 'Chọn điểm từ 1 đến 5' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="Nhận xét">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
