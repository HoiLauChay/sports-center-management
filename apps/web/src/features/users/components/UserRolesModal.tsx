import { ASSIGNABLE_ROLES, type Account, type AssignableRole } from '@sports-center/shared';
import { Alert, App, Checkbox, Form, Modal } from 'antd';
import { useState } from 'react';
import { ROLE_LABEL } from '~/constants/roles';
import { toApiError } from '~/lib/http-errors';
import { useUpdateUserRoles } from '../hooks/useUserMutations';

interface UserRolesModalProps {
  user: Pick<Account, 'id' | 'fullName' | 'roles'>;
  onClose: () => void;
}

const OPTIONS = ASSIGNABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

/** Manager grants or removes the member, coach and receptionist roles of an account; a manager account is never edited. */
export function UserRolesModal({ user, onClose }: UserRolesModalProps) {
  const { message } = App.useApp();
  const mutation = useUpdateUserRoles(user.id);
  const [roles, setRoles] = useState<AssignableRole[]>(
    user.roles.filter((role): role is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(role)),
  );
  const [error, setError] = useState<string | null>(null);
  const losesCoach = user.roles.includes('COACH') && !roles.includes('COACH');

  const submit = () => {
    if (mutation.isPending) return;
    if (roles.length === 0) {
      setError('Chọn ít nhất một vai trò');
      return;
    }
    mutation.mutate(
      { roles },
      {
        onSuccess: () => {
          message.success('Đã cập nhật vai trò');
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
      title={`Vai trò của ${user.fullName}`}
      okText="Lưu"
      cancelText="Đóng"
      confirmLoading={mutation.isPending}
      onOk={submit}
      onCancel={onClose}
    >
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item validateStatus={error ? 'error' : undefined} help={error ?? undefined} className="!mb-0">
          <Checkbox.Group
            className="flex flex-col gap-2"
            options={OPTIONS}
            value={roles}
            onChange={(next) => {
              setRoles(next);
              if (error) setError(null);
            }}
          />
        </Form.Item>
      </Form>
      {losesCoach && (
        <Alert
          type="warning"
          showIcon
          className="!mt-4"
          title="Các lớp chưa bắt đầu của huấn luyện viên này chuyển về chờ phân công."
        />
      )}
    </Modal>
  );
}
