import { GENDERS, type Account } from '@sports-center/shared';
import { Button, Col, DatePicker, Divider, Form, Input, Row, Select } from 'antd';
import dayjs from 'dayjs';
import { FormField, FormRootError } from '~/components/form/FormField';
import { ImageUploadField } from '~/components/form/ImageUploadField';
import { useUpdateProfile } from '../hooks/useProfile';
import { GENDER_LABEL } from '../utils/profile';

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: GENDER_LABEL[value] }));
const TEXTAREA_ROWS = { minRows: 2, maxRows: 6 };

interface ProfileEditFormProps {
  user: Account;
  onDone: () => void;
}

export function ProfileEditForm({ user, onDone }: ProfileEditFormProps) {
  const { form, onSubmit, isSubmitting } = useUpdateProfile(user, onDone);
  const { control } = form;
  const rootError = form.formState.errors.root?.message;

  return (
    <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
      <FormRootError message={rootError} />

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <FormField
            control={control}
            name="fullName"
            label="Họ tên"
            render={(field, invalid) => <Input {...field} status={invalid ? 'error' : undefined} autoComplete="name" />}
          />
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Email" extra="Email dùng để đăng nhập, không thể thay đổi">
            <Input value={user.email} disabled />
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
                autoComplete="tel"
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
              <Input
                {...field}
                value={field.value ?? ''}
                status={invalid ? 'error' : undefined}
                autoComplete="street-address"
              />
            )}
          />
        </Col>
        <Col xs={24}>
          <FormField
            control={control}
            name="avatarUrl"
            label="Ảnh đại diện"
            extra="JPG, PNG hoặc WEBP, tối đa 5 MB"
            render={(field, invalid) => (
              <ImageUploadField
                purpose="AVATAR"
                value={field.value}
                onChange={field.onChange}
                fallback={user.fullName.charAt(0).toUpperCase()}
                invalid={invalid}
              />
            )}
          />
        </Col>
      </Row>

      {user.role === 'MEMBER' && (
        <>
          <Divider titlePlacement="start">Hồ sơ hội viên</Divider>
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
          <FormField
            control={control}
            name="profile.fitnessGoals"
            label="Mục tiêu tập luyện"
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
            name="profile.healthNotes"
            label="Ghi chú sức khỏe"
            extra="Chỉ bạn, nhân viên trung tâm và huấn luyện viên lớp bạn đang học xem được"
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
      )}

      {user.role === 'COACH' && (
        <>
          <Divider titlePlacement="start">Hồ sơ huấn luyện viên</Divider>
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
          <FormField
            control={control}
            name="profile.coverImageUrl"
            label="Ảnh bìa"
            extra="JPG, PNG hoặc WEBP, tối đa 5 MB"
            render={(field, invalid) => (
              <ImageUploadField
                purpose="COVER_IMAGE"
                variant="cover"
                value={field.value}
                onChange={field.onChange}
                invalid={invalid}
              />
            )}
          />
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onDone} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="primary" htmlType="submit" loading={isSubmitting}>
          Lưu thay đổi
        </Button>
      </div>
    </Form>
  );
}
