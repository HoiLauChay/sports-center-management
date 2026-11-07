import type { Maintenance } from '@sports-center/shared';
import { Alert, Form, Input, Modal, Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import { describeApiError } from '~/lib/http-errors';
import { useAnnounceMaintenance, useMaintenanceNotice } from '../hooks/useManagerAi';
import { AiSourceTag } from './AiPanel';

interface MaintenanceNoticeModalProps {
  maintenance: Maintenance | null;
  onClose: () => void;
}

/**
 * AI drafts a notice for the members who use the facility; the manager edits it and sends it. Nothing goes out
 * until "Gửi thông báo" is pressed. The page remounts it per maintenance (`key`).
 */
export function MaintenanceNoticeModal({ maintenance, onClose }: MaintenanceNoticeModalProps) {
  const notice = useMaintenanceNotice();
  const announce = useAnnounceMaintenance();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const { mutate } = notice;

  useEffect(() => {
    if (!maintenance) return;
    mutate(maintenance.id, {
      onSuccess: (draft) => {
        setTitle(draft.title);
        setMessage(draft.message);
      },
    });
  }, [maintenance, mutate]);

  const ready = Boolean(title.trim() && message.trim());
  return (
    <Modal
      open={Boolean(maintenance)}
      title={
        <span className="flex items-center gap-2">
          Báo hội viên về lịch bảo trì {notice.data && <AiSourceTag ai={notice.data.ai} />}
        </span>
      }
      okText={notice.data ? `Gửi thông báo (${notice.data.recipients} hội viên)` : 'Gửi thông báo'}
      cancelText="Hủy"
      okButtonProps={{ disabled: !ready || !notice.data?.recipients }}
      confirmLoading={announce.isPending}
      onOk={() =>
        maintenance &&
        announce.mutate(
          { id: maintenance.id, body: { title: title.trim(), message: message.trim() } },
          { onSuccess: onClose },
        )
      }
      onCancel={() => !announce.isPending && onClose()}
      destroyOnHidden
    >
      {notice.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : notice.isError ? (
        <Alert type="warning" showIcon message={describeApiError(notice.error)} />
      ) : (
        <>
          <p className="m-0 mb-3 text-[14px] text-sc-muted">
            Gửi tới hội viên đã đặt sân hoặc học lớp tại {maintenance?.facility.name} trong 30 ngày qua và đến hết đợt
            bảo trì. Mỗi người chỉ nhận một lần cho lịch này.
          </p>
          <Form layout="vertical" requiredMark={false}>
            <Form.Item label="Tiêu đề">
              <Input value={title} maxLength={255} onChange={(event) => setTitle(event.target.value)} />
            </Form.Item>
            <Form.Item label="Nội dung">
              <Input.TextArea
                value={message}
                maxLength={2000}
                showCount
                autoSize={{ minRows: 4, maxRows: 8 }}
                onChange={(event) => setMessage(event.target.value)}
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}
