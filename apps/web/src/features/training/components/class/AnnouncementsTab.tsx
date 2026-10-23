import type { AnnouncementKind, ClassAnnouncement, CreateAnnouncementBody } from '@sports-center/shared';
import { Button, Form, Input, List, Segmented, Tag } from 'antd';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useAnnouncements } from '../../hooks/useClassTraining';
import { useSendAnnouncement } from '../../hooks/useTraining';
import { ANNOUNCEMENT_TAG } from '../../types';

export function AnnouncementList({ items, loading }: { items: ClassAnnouncement[] | undefined; loading?: boolean }) {
  return (
    <List
      loading={loading}
      dataSource={items}
      locale={{ emptyText: <EmptyState title="Chưa có thông báo nào" /> }}
      renderItem={(item) => (
        <List.Item>
          <div className="flex w-full min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={ANNOUNCEMENT_TAG[item.kind].color} className="!m-0">
                {ANNOUNCEMENT_TAG[item.kind].label}
              </Tag>
              <b className="min-w-0 [overflow-wrap:anywhere]">{item.title}</b>
            </div>
            <p className="m-0 text-[15px] whitespace-pre-line">{item.body}</p>
            <span className="text-[13px] text-sc-muted">
              {item.sender.fullName} · {formatDateTime(item.createdAt)}
            </span>
          </div>
        </List.Item>
      )}
    />
  );
}

/** Sends a notice or homework to every student of the class and lists what was sent before. */
export function AnnouncementsTab({ classId, canSend }: { classId: string; canSend: boolean }) {
  const [form] = Form.useForm<CreateAnnouncementBody>();
  const send = useSendAnnouncement(classId);
  const history = useAnnouncements(classId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canSend && (
        <section>
          <SectionTitle>Gửi cho cả lớp</SectionTitle>
          <p className="mt-0 mb-4 text-[14.5px] text-sc-muted">
            Học viên đang học lớp nhận được trong mục Thông báo và trang Tập luyện.
          </p>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ kind: 'NOTICE' }}
            onFinish={(values) => send.mutate(values, { onSuccess: () => form.resetFields() })}
          >
            <Form.Item name="kind" label="Loại">
              <Segmented
                options={(Object.keys(ANNOUNCEMENT_TAG) as AnnouncementKind[]).map((kind) => ({
                  value: kind,
                  label: ANNOUNCEMENT_TAG[kind].label,
                }))}
              />
            </Form.Item>
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
              <Input.TextArea rows={6} maxLength={2000} showCount />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={send.isPending}>
              Gửi
            </Button>
          </Form>
        </section>
      )}
      <section className={canSend ? '' : 'lg:col-span-2'}>
        <SectionTitle>Đã gửi</SectionTitle>
        {history.isError && !history.data ? (
          <ErrorState message={toApiError(history.error).message} onRetry={() => void history.refetch()} />
        ) : (
          <AnnouncementList items={history.data} loading={history.isPending} />
        )}
      </section>
    </div>
  );
}
