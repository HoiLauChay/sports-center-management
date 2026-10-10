import type { CreateAnnouncementBody } from '@sports-center/shared';
import { Button, Form, Input } from 'antd';
import { useSendAnnouncement } from '../hooks/useTraining';

/** Sends a notice or homework to every student of the class (`POST /classes/{id}/announcements`). */
export function AnnouncementTab({ classId }: { classId: string }) {
  const [form] = Form.useForm<CreateAnnouncementBody>();
  const send = useSendAnnouncement(classId);

  return (
    <Form
      form={form}
      layout="vertical"
      className="max-w-2xl"
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
        extra="Học viên đang học lớp nhận thông báo trong mục Thông báo."
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}
      >
        <Input.TextArea rows={6} maxLength={1000} showCount />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={send.isPending}>
        Gửi cho cả lớp
      </Button>
    </Form>
  );
}
