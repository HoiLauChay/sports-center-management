import { emailSchema, type Account } from '@sports-center/shared';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { toApiError } from '~/lib/http-errors';
import { useChangeUserEmail } from '../hooks/useUserMutations';

interface ChangeEmailModalProps {
  user: Pick<Account, 'id' | 'fullName' | 'email'>;
  onClose: () => void;
}

export function ChangeEmailModal({ user, onClose }: ChangeEmailModalProps) {
  const { message } = App.useApp();
  const mutation = useChangeUserEmail(user.id);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (mutation.isPending) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email không hợp lệ');
      return;
    }
    setError(null);
    mutation.mutate(
      { email: parsed.data },
      {
        onSuccess: (updated) => {
          message.success(`Đã đổi email sang ${updated.email}. Người dùng đăng nhập bằng email mới để đặt mật khẩu.`);
          onClose();
        },
        onError: (err) => setError(toApiError(err).message),
      },
    );
  };

  return (
    <Modal
      open
      centered
      destroyOnHidden
      title={`Đổi email của ${user.fullName}`}
      okText="Đổi email"
      cancelText="Đóng"
      okButtonProps={{ danger: true }}
      confirmLoading={mutation.isPending}
      onOk={submit}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-3">
        <Alert
          type="warning"
          showIcon
          title="Dùng khi người dùng mất email. Hãy xác minh đúng người trước khi đổi."
          description="Người dùng bị đăng xuất khỏi mọi thiết bị và không đăng nhập được bằng mật khẩu cũ. Lần đăng nhập sau, hệ thống gửi mã tới email mới để họ đặt mật khẩu."
        />
        <div className="text-[15px] text-sc-muted">
          Email hiện tại: <b className="break-all text-sc-ink">{user.email}</b>
        </div>
        <Form layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item
            label="Email mới"
            validateStatus={error ? 'error' : undefined}
            help={error ?? undefined}
            className="!mb-0"
          >
            <Input
              autoFocus
              inputMode="email"
              autoComplete="off"
              placeholder="Nhập email mới của người dùng"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}
