import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserBodySchema,
  ERROR_CODE,
  STAFF_ROLES,
  type CreateUserBody,
  type CreateUserInput,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Col, Form, Input, Modal, Row, Segmented } from 'antd';
import { useForm, useWatch } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { ROLE_LABEL } from '~/constants/roles';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { usersService } from '../services/users.service';

const ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.EMAIL_TAKEN]: 'email',
  [ERROR_CODE.PHONE_TAKEN]: 'phone',
};

const TEXTAREA_ROWS = { minRows: 2, maxRows: 5 };

const DEFAULT_VALUES: CreateUserInput = {
  email: '',
  fullName: '',
  role: 'COACH',
  phone: '',
  profile: { bio: '', experience: '', certifications: '', staffNotes: '' },
};

function toPayload({ profile, ...values }: CreateUserBody): CreateUserBody {
  if (!profile) return values;
  const { bio, experience, certifications, staffNotes } = profile;
  return {
    ...values,
    profile: values.role === 'COACH' ? { bio, experience, certifications } : { staffNotes },
  };
}

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const form = useForm<CreateUserInput, unknown, CreateUserBody>({
    resolver: zodResolver(createUserBodySchema),
    mode: 'onTouched',
    defaultValues: DEFAULT_VALUES,
  });
  const { control } = form;
  const role = useWatch({ control, name: 'role' });
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  const close = () => {
    form.reset(DEFAULT_VALUES);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (values: CreateUserBody) => usersService.create(toPayload(values)),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      message.success(`Đã tạo tài khoản. Email đặt mật khẩu đã được gửi tới ${created.email}.`);
      close();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      open={open}
      title="Tạo tài khoản nhân sự"
      okText="Tạo tài khoản"
      cancelText="Hủy"
      width={560}
      mask={{ closable: false }}
      confirmLoading={mutation.isPending}
      onOk={() => void onSubmit()}
      onCancel={close}
      destroyOnHidden
    >
      <p className="mt-0 mb-4 text-sm text-sc-muted">
        Hệ thống tạo mật khẩu ngẫu nhiên và gửi email để người được tạo tự đặt mật khẩu.
      </p>
      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
        <FormRootError message={form.formState.errors.root?.message} />

        <FormField
          control={control}
          name="role"
          label="Vai trò"
          render={(field) => (
            <Segmented
              block
              value={field.value}
              onChange={field.onChange}
              options={STAFF_ROLES.map((value) => ({ value, label: ROLE_LABEL[value] }))}
            />
          )}
        />
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <FormField
              control={control}
              name="fullName"
              label="Họ tên"
              render={(field, invalid) => (
                <Input {...field} status={invalid ? 'error' : undefined} autoComplete="off" />
              )}
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormField
              control={control}
              name="phone"
              label="Số điện thoại (tùy chọn)"
              render={(field, invalid) => (
                <Input
                  {...field}
                  value={field.value ?? ''}
                  status={invalid ? 'error' : undefined}
                  type="tel"
                  autoComplete="off"
                  placeholder="VD: 0912345678"
                />
              )}
            />
          </Col>
        </Row>
        <FormField
          control={control}
          name="email"
          label="Email"
          extra="Dùng để đăng nhập và nhận email đặt mật khẩu"
          render={(field, invalid) => (
            <Input {...field} status={invalid ? 'error' : undefined} type="email" autoComplete="off" />
          )}
        />

        {role === 'COACH' ? (
          <>
            <FormField
              control={control}
              name="profile.bio"
              label="Giới thiệu"
              render={(field, invalid) => (
                <Input.TextArea
                  {...field}
                  value={field.value ?? ''}
                  status={invalid ? 'error' : undefined}
                  autoSize={TEXTAREA_ROWS}
                />
              )}
            />
            <FormField
              control={control}
              name="profile.experience"
              label="Kinh nghiệm"
              render={(field, invalid) => (
                <Input.TextArea
                  {...field}
                  value={field.value ?? ''}
                  status={invalid ? 'error' : undefined}
                  autoSize={TEXTAREA_ROWS}
                />
              )}
            />
            <FormField
              control={control}
              name="profile.certifications"
              label="Chứng chỉ"
              render={(field, invalid) => (
                <Input.TextArea
                  {...field}
                  value={field.value ?? ''}
                  status={invalid ? 'error' : undefined}
                  autoSize={TEXTAREA_ROWS}
                />
              )}
            />
          </>
        ) : (
          <FormField
            control={control}
            name="profile.staffNotes"
            label="Ghi chú nhân sự"
            extra="Chỉ Quản lý xem và sửa được"
            render={(field, invalid) => (
              <Input.TextArea
                {...field}
                value={field.value ?? ''}
                status={invalid ? 'error' : undefined}
                autoSize={TEXTAREA_ROWS}
              />
            )}
          />
        )}
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
