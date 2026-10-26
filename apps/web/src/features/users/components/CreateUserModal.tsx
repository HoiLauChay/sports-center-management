import { zodResolver } from '@hookform/resolvers/zod';
import {
  CREATABLE_ROLES,
  createUserBodySchema,
  ERROR_CODE,
  type CreateUserBody,
  type CreateUserInput,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Col, Form, Input, Modal, Radio, Row } from 'antd';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { ROLE_LABEL } from '~/constants/roles';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { usersService } from '../services/users.service';

const ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.EMAIL_TAKEN]: 'email',
  [ERROR_CODE.PHONE_TAKEN]: 'phone',
};

const TEXTAREA_ROWS = { minRows: 2, maxRows: 5 };

const DEFAULT_VALUES: DefaultValues<CreateUserInput> = {
  email: '',
  fullName: '',
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
      message.success(`Đã tạo tài khoản cho ${created.email}. Hệ thống đã gửi link kích hoạt tới email này.`);
      close();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!mutation.isPending) mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      title="Tạo tài khoản nhân sự"
      okText="Tạo tài khoản"
      cancelText="Hủy"
      width={560}
      mask={{ closable: false }}
      confirmLoading={mutation.isPending}
      cancelButtonProps={{ disabled: mutation.isPending }}
      closable={!mutation.isPending}
      keyboard={!mutation.isPending}
      onOk={() => void onSubmit()}
      onCancel={() => {
        if (!mutation.isPending) close();
      }}
      destroyOnHidden
    >
      <p className="mt-0 mb-4 text-[15px] text-sc-muted">
        Hệ thống gửi link kích hoạt (24 giờ) tới email này để người dùng đặt mật khẩu và vào ứng dụng.
      </p>
      <Form layout="vertical" requiredMark={false} disabled={mutation.isPending} onFinish={() => void onSubmit()}>
        <FormRootError message={form.formState.errors.root?.message} />

        <FormField
          control={control}
          name="role"
          label="Vai trò"
          render={(field) => (
            <Radio.Group
              block
              optionType="button"
              buttonStyle="solid"
              disabled={mutation.isPending}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              options={CREATABLE_ROLES.map((value) => ({ value, label: ROLE_LABEL[value] }))}
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
                />
              )}
            />
          </Col>
        </Row>
        <FormField
          control={control}
          name="email"
          label="Email"
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
        ) : role ? (
          <FormField
            control={control}
            name="profile.staffNotes"
            label="Ghi chú nhân sự"
            render={(field, invalid) => (
              <Input.TextArea
                {...field}
                value={field.value ?? ''}
                status={invalid ? 'error' : undefined}
                autoSize={TEXTAREA_ROWS}
              />
            )}
          />
        ) : null}
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
