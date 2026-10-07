import { Button, Form, Input, List } from 'antd';
import { formatDateTime } from '~/lib/format';
import { useClassAnnouncements, useSendAnnouncement } from '../hooks/useTraining';

/** Sends a notice or homework to every student of the class (`POST /classes/{id}/announcements`). */
export function AnnouncementTab({ classId, editable }: { classId: string; editable: boolean }) {
  const [form] = Form.useForm<{ title: string; body: string }>();
  const history = useClassAnnouncements(classId);
  const send = useSendAnnouncement(classId);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Form
        form={form}
        layout="vertical"
        disabled={!editable}
        onFinish={(values) => send.mutate(values, { onSuccess: () => form.resetFields() })}
      >
        <Form.Item
          name="title"
          label="Tiêu đề"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề' }]}
        >
          <Input maxLength={150} placeholder="VD: Nhắc mang giày thể thao buổi sau" />
        </Form.Item>
        <Form.Item
          name="body"
          label="Nội dung"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}
        >
          <Input.TextArea rows={6} maxLength={1000} showCount />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={send.isPending}>
          Gửi cho cả lớp
        </Button>
      </Form>
      <div>
        <h4 className="mt-0 mb-2 text-[14px] font-semibold">Đã gửi gần đây</h4>
        <List
          size="small"
          loading={history.isFetching}
          dataSource={history.data ?? []}
          locale={{ emptyText: 'Chưa có thông báo nào cho lớp này' }}
          renderItem={(item) => (
            <List.Item>
              <div className="flex min-w-0 flex-col gap-0.5">
                <b>{item.title}</b>
                <span className="text-sc-ink-2">{item.body}</span>
                <span className="text-[12.5px] text-sc-muted">
                  {formatDateTime(item.createdAt)} · {item.recipients} học viên
                </span>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
