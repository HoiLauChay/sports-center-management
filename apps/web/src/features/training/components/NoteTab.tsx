import { Alert, Button, Form, Input, Select, Spin } from 'antd';
import { useEffect } from 'react';
import { formatDateTime } from '~/lib/format';
import { useSaveNote, useSessionNote } from '../hooks/useTraining';

interface NoteForm {
  title: string;
  content: string;
  attachments: string[];
}

/** One session note per session (BR_4.4): title, content and links to attached files. */
export function NoteTab({ sessionId, editable }: { sessionId: string; editable: boolean }) {
  const [form] = Form.useForm<NoteForm>();
  const note = useSessionNote(sessionId);
  const save = useSaveNote(sessionId);

  useEffect(() => {
    if (note.data) {
      form.setFieldsValue({ title: note.data.title, content: note.data.content, attachments: note.data.attachments });
    }
  }, [note.data, form]);

  if (note.isPending) return <Spin />;

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!editable}
      initialValues={{ title: '', content: '', attachments: [] }}
      onFinish={(values) => save.mutate(values)}
      className="max-w-3xl"
    >
      {note.data && (
        <Alert
          type="success"
          showIcon
          className="!mb-4"
          title={`Đã lưu lúc ${formatDateTime(note.data.updatedAt)}. Học viên của lớp xem được nội dung này.`}
        />
      )}
      {!editable && (
        <Alert type="warning" showIcon className="!mb-4" title="Buổi học đã bị hủy nên không ghi chú được." />
      )}
      <Form.Item
        name="title"
        label="Tiêu đề"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề' }]}
      >
        <Input maxLength={150} placeholder="VD: Kỹ thuật di chuyển và phát cầu" />
      </Form.Item>
      <Form.Item
        name="content"
        label="Nội dung buổi học và bài tập về nhà"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}
      >
        <Input.TextArea rows={8} maxLength={4000} showCount />
      </Form.Item>
      <Form.Item name="attachments" label="Tệp đính kèm (đường dẫn)">
        <Select mode="tags" tokenSeparators={[' ', ',']} open={false} placeholder="Dán đường dẫn tệp rồi nhấn Enter" />
      </Form.Item>
      {editable && (
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          {note.data ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}
        </Button>
      )}
    </Form>
  );
}
