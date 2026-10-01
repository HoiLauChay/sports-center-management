import type { Account, AccountStatus } from '@sports-center/shared';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { toApiError } from '~/lib/http-errors';
import { useUpdateUserStatus } from '../hooks/useUserMutations';
import { STATUS_ACTION } from '../utils/statusActions';

const COACH_NOTE =
  'Các lớp chưa bắt đầu của huấn luyện viên này sẽ chuyển về chờ duyệt, không có huấn luyện viên. Nếu đang dạy lớp chưa kết thúc, hãy phân công huấn luyện viên khác trước.';

const REASON_MAX = 500;

interface UserStatusModalProps {
  user: Pick<Account, 'id' | 'fullName' | 'email' | 'role'>;
  target: AccountStatus;
  open: boolean;
  onClose: () => void;
}

export function UserStatusModal({ user, target, open, onClose }: UserStatusModalProps) {
  const { message } = App.useApp();
  const mutation = useUpdateUserStatus(user.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason('');
    setError(null);
    mutation.reset();
    onClose();
  };

  const action = STATUS_ACTION[target];
  const deactivating = target !== 'ACTIVE';

  const confirm = () => {
    if (mutation.isPending) return;
    setError(null);
    mutation.mutate(
      { status: target, reason: reason.trim() || null },
      {
        onSuccess: () => {
          message.success('Đã cập nhật trạng thái tài khoản');
          close();
        },
        onError: (err) => setError(toApiError(err).message),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={action.title}
      okText={action.label}
      cancelText="Hủy"
      okButtonProps={{ danger: deactivating }}
      confirmLoading={mutation.isPending}
      cancelButtonProps={{ disabled: mutation.isPending }}
      closable={!mutation.isPending}
      keyboard={!mutation.isPending}
      mask={{ closable: false }}
      onOk={confirm}
      onCancel={() => {
        if (!mutation.isPending) close();
      }}
      destroyOnHidden
    >
      <p className="mt-0 mb-4 text-sm text-sc-muted">
        <span className="font-semibold text-sc-ink">{user.fullName}</span> · {user.email}
      </p>
      {deactivating && user.role === 'COACH' && <Alert type="warning" showIcon className="!mb-4" title={COACH_NOTE} />}
      {deactivating && (
        <p className="text-sm text-sc-muted">Tài khoản sẽ bị đăng xuất khỏi mọi phiên và không thể đăng nhập.</p>
      )}
      {error && <Alert type="error" showIcon className="!mb-4" title={error} />}
      <Form layout="vertical" requiredMark={false} disabled={mutation.isPending}>
        <Form.Item label="Lý do (tùy chọn)" className="!mb-0">
          <Input.TextArea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX}
            showCount
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder={deactivating ? 'VD: Nghỉ việc, vi phạm nội quy…' : undefined}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
