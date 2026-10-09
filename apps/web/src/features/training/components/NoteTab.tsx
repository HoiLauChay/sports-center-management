import type { SessionNote } from '@sports-center/shared';
import { Alert, App, Button, Form, Input, Spin } from 'antd';
import { Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { FileDropModal } from '~/components/form/FileDropModal';
import { formatDateTime } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { uploadFile } from '~/lib/upload';
import { useSaveNote, useSessionNote } from '../hooks/useTraining';

const MAX_ATTACHMENTS = 10;

const fileName = (url: string) => decodeURIComponent(url.split('/').at(-1) ?? url);

interface NoteFormProps {
  sessionId: string;
  editable: boolean;
  saved: SessionNote | null;
}

function NoteForm({ sessionId, editable, saved }: NoteFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ title: string; content: string }>();
  const save = useSaveNote(sessionId);
  const [attachments, setAttachments] = useState(saved?.attachments ?? []);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const attach = async (file: File) => {
    setPicking(false);
    setUploading(true);
    try {
      const url = await uploadFile(file, 'SESSION_ATTACHMENT');
      setAttachments((current) => [...current, url]);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!editable}
      initialValues={{ title: saved?.title ?? '', content: saved?.content ?? '' }}
      onFinish={(values) => save.mutate({ ...values, attachments })}
      className="max-w-3xl"
    >
      {saved && (
        <Alert
          type="success"
          showIcon
          className="!mb-4"
          title={`Đã lưu lúc ${formatDateTime(saved.updatedAt)}. Học viên của lớp xem được nội dung này.`}
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
      <Form.Item label={`Tệp đính kèm (${attachments.length}/${MAX_ATTACHMENTS})`}>
        <div className="flex flex-col items-start gap-1.5">
          {attachments.map((url) => (
            <span key={url} className="flex items-center gap-2 text-[13.5px]">
              <Paperclip size={14} className="text-sc-muted" />
              <a href={url} target="_blank" rel="noreferrer noopener">
                {fileName(url)}
              </a>
              {editable && (
                <Button
                  size="small"
                  type="text"
                  aria-label="Bỏ tệp"
                  icon={<X size={14} />}
                  onClick={() => setAttachments((current) => current.filter((entry) => entry !== url))}
                />
              )}
            </span>
          ))}
          {editable && attachments.length < MAX_ATTACHMENTS && (
            <Button size="small" loading={uploading} icon={<Paperclip size={14} />} onClick={() => setPicking(true)}>
              Thêm tệp
            </Button>
          )}
        </div>
      </Form.Item>
      {editable && (
        <Button type="primary" htmlType="submit" loading={save.isPending} disabled={uploading}>
          {saved ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}
        </Button>
      )}
      <FileDropModal
        open={picking}
        title="Thêm tệp đính kèm"
        purpose="SESSION_ATTACHMENT"
        onSelect={(file) => void attach(file)}
        onCancel={() => setPicking(false)}
      />
    </Form>
  );
}

/** One session note per session (BR_4.4): title, content and up to 10 uploaded files. */
export function NoteTab({ sessionId, editable }: { sessionId: string; editable: boolean }) {
  const note = useSessionNote(sessionId);
  if (note.isPending) return <Spin />;
  return (
    <NoteForm key={note.data?.updatedAt ?? 'new'} sessionId={sessionId} editable={editable} saved={note.data ?? null} />
  );
}
