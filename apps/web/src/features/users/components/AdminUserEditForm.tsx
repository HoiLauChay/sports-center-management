import { zodResolver } from '@hookform/resolvers/zod';
import {
  ERROR_CODE,
  GENDERS,
  updateUserBodySchema,
  type Account,
  type UpdateUserBody,
  type UpdateUserInput,
} from '@sports-center/shared';
import { App, Button, Col, DatePicker, Form, Input, Row, Select, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { Lock } from 'lucide-react';
import { useForm, type Control, type FieldPath } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { GENDER_LABEL, getCoachProfile, getMemberProfile, getStaffProfile } from '~/lib/account';
import { useUpdateUser } from '../hooks/useUserMutations';

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: GENDER_LABEL[value] }));
const TEXTAREA_ROWS = { minRows: 2, maxRows: 6 };
const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.PHONE_TAKEN]: 'phone' };

function toFormValues(user: Account): UpdateUserInput {
  const base = {
    fullName: user.fullName,
    phone: user.phone ?? '',
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    address: user.address ?? '',
  };

  const member = getMemberProfile(user);
  if (member) {
    return {
      ...base,
      profile: {
        emergencyContact: member.emergencyContact ?? '',
        fitnessGoals: member.fitnessGoals ?? '',
        healthNotes: member.healthNotes ?? '',
      },
    };
  }

  const coach = getCoachProfile(user);
  if (coach) {
    return {
      ...base,
      profile: {
        bio: coach.bio ?? '',
        experience: coach.experience ?? '',
        certifications: coach.certifications ?? '',
      },
    };
  }

  const staff = getStaffProfile(user);
  return staff ? { ...base, profile: { staffNotes: staff.staffNotes ?? '' } } : base;
}

interface TextAreaFieldProps {
  control: Control<UpdateUserInput>;
  name: FieldPath<UpdateUserInput>;
  label: string;
}

function TextAreaField({ control, name, label }: TextAreaFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field, invalid) => (
        <Input.TextArea
          {...field}
          value={typeof field.value === 'string' ? field.value : ''}
          status={invalid ? 'error' : undefined}
          autoSize={TEXTAREA_ROWS}
        />
      )}
    />
  );
}

interface AdminUserEditFormProps {
  user: Account;
  onDone: () => void;
}

export function AdminUserEditForm({ user, onDone }: AdminUserEditFormProps) {
  const { message } = App.useApp();
  const mutation = useUpdateUser(user.id);

  const form = useForm<UpdateUserInput, unknown, UpdateUserBody>({
    resolver: zodResolver(updateUserBodySchema),
    mode: 'onTouched',
    defaultValues: toFormValues(user),
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  const onSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => {
        message.success('Đã cập nhật thông tin tài khoản');
        onDone();
      },
      onError: handleApiError,
    }),
  );

  return (
    <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
      <FormRootError message={form.formState.errors.root?.message} />

      <SectionTitle>Thông tin cá nhân</SectionTitle>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <FormField
            control={control}
            name="fullName"
            label="Họ tên"
            render={(field, invalid) => <Input {...field} status={invalid ? 'error' : undefined} autoComplete="off" />}
          />
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Email đăng nhập">
            <Input
              value={user.email}
              disabled
              suffix={
                <Tooltip title="Email dùng để đăng nhập, không thể thay đổi">
                  <Lock size={14} className="text-sc-muted-2" />
                </Tooltip>
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} xl={12}>
          <FormField
            control={control}
            name="phone"
            label="Số điện thoại"
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
        <Col xs={12} xl={6}>
          <FormField
            control={control}
            name="dateOfBirth"
            label="Ngày sinh"
            render={(field, invalid) => (
              <DatePicker
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ? dayjs(field.value) : null}
                onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : null)}
                status={invalid ? 'error' : undefined}
                format="DD/MM/YYYY"
                placeholder="DD/MM/YYYY"
                disabledDate={(date) => date.isAfter(dayjs(), 'day')}
                className="w-full"
              />
            )}
          />
        </Col>
        <Col xs={12} xl={6}>
          <FormField
            control={control}
            name="gender"
            label="Giới tính"
            render={(field, invalid) => (
              <Select
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? undefined}
                onChange={(value) => field.onChange(value ?? null)}
                status={invalid ? 'error' : undefined}
                options={GENDER_OPTIONS}
                placeholder="Chọn giới tính"
                allowClear
              />
            )}
          />
        </Col>
        <Col xs={24}>
          <FormField
            control={control}
            name="address"
            label="Địa chỉ"
            render={(field, invalid) => (
              <Input {...field} value={field.value ?? ''} status={invalid ? 'error' : undefined} autoComplete="off" />
            )}
          />
        </Col>
      </Row>

      {user.role === 'MEMBER' && (
        <>
          <SectionTitle>Hồ sơ hội viên</SectionTitle>
          <FormField
            control={control}
            name="profile.emergencyContact"
            label="Liên hệ khẩn cấp"
            render={(field, invalid) => (
              <Input
                {...field}
                value={field.value ?? ''}
                status={invalid ? 'error' : undefined}
                placeholder="Tên và số điện thoại người thân"
              />
            )}
          />
          <TextAreaField control={control} name="profile.fitnessGoals" label="Mục tiêu tập luyện" />
          <TextAreaField control={control} name="profile.healthNotes" label="Ghi chú sức khỏe" />
        </>
      )}

      {user.role === 'COACH' && (
        <>
          <SectionTitle>Hồ sơ huấn luyện viên</SectionTitle>
          <TextAreaField control={control} name="profile.bio" label="Giới thiệu" />
          <TextAreaField control={control} name="profile.experience" label="Kinh nghiệm" />
          <TextAreaField control={control} name="profile.certifications" label="Chứng chỉ" />
        </>
      )}

      {(user.role === 'RECEPTIONIST' || user.role === 'MANAGER') && (
        <>
          <SectionTitle>Hồ sơ nhân sự</SectionTitle>
          <TextAreaField control={control} name="profile.staffNotes" label="Ghi chú nhân sự" />
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-sc-border-soft pt-5">
        <div className="flex gap-2">
          <Button onClick={onDone} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </Form>
  );
}
