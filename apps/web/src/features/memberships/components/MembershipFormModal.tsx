import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMembershipBodySchema,
  ERROR_CODE,
  MAX_MONEY,
  type CreateMembershipBody,
  type CreateMembershipInput,
  type MembershipPackage,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Col, Form, Input, InputNumber, Modal, Row, Switch } from 'antd';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { cacheMembershipPackage, membershipsQueryOptions } from '../hooks/useMemberships';
import { membershipsService } from '../services/memberships.service';

const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.NAME_TAKEN]: 'name' };
const EMPTY: CreateMembershipInput = {
  name: '',
  description: '',
  price: 0,
  durationDays: 30,
  gymAccess: false,
  bookingDiscountPct: 0,
  classDiscountPct: 0,
  freeBookingSlotsPerMonth: 0,
  isActive: true,
};
const moneyFormatter = (value: number | string | undefined) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const moneyParser = (value: string | undefined) => {
  const digits = (value ?? '').replace(/\./g, '').replace(/\s/g, '');
  return /^-?\d+$/.test(digits) ? Number(digits) : NaN;
};

function Required({ children }: { children: string }) {
  return (
    <>
      <span className="mr-1 text-sc-error">*</span>
      {children}
    </>
  );
}

interface MembershipFormModalProps {
  open: boolean;
  membership: MembershipPackage | null;
  onClose: () => void;
}

export function MembershipFormModal({ open, membership, onClose }: MembershipFormModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const form = useForm<CreateMembershipInput, unknown, CreateMembershipBody>({
    resolver: zodResolver(createMembershipBodySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  useEffect(() => {
    if (open) form.reset(membership ? { ...membership, description: membership.description ?? '' } : EMPTY);
  }, [open, membership, form]);

  const mutation = useMutation({
    mutationFn: ({ isActive, description, ...values }: CreateMembershipBody) => {
      const payload = { ...values, description: description?.trim() || null };
      return membership
        ? membershipsService.update(membership.id, payload)
        : membershipsService.create({ ...payload, isActive });
    },
    onSuccess: (savedMembership) => {
      cacheMembershipPackage(queryClient, savedMembership);
      void queryClient.invalidateQueries({ queryKey: membershipsQueryOptions.queryKey });
      message.success(membership ? 'Đã cập nhật gói thành viên' : 'Đã tạo gói thành viên');
      onClose();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!mutation.isPending) mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      title={membership ? 'Cập nhật gói' : 'Tạo gói thành viên'}
      okText="Lưu"
      cancelText="Hủy"
      width={520}
      mask={{ closable: false }}
      closable={!mutation.isPending}
      keyboard={!mutation.isPending}
      cancelButtonProps={{ disabled: mutation.isPending }}
      confirmLoading={mutation.isPending}
      onOk={() => void onSubmit()}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()} disabled={mutation.isPending}>
        <FormRootError message={form.formState.errors.root?.message} />
        <FormField
          control={control}
          name="name"
          label={<Required>Tên gói</Required>}
          render={(field, invalid) => (
            <Input
              {...field}
              maxLength={255}
              autoComplete="off"
              placeholder="VD: Gói năng động 30 ngày"
              status={invalid ? 'error' : undefined}
            />
          )}
        />
        <FormField
          control={control}
          name="description"
          label="Mô tả ngắn"
          render={(field, invalid) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              maxLength={5000}
              autoSize={{ minRows: 2, maxRows: 5 }}
              status={invalid ? 'error' : undefined}
            />
          )}
        />
        <Row gutter={16}>
          <Col xs={24} sm={9}>
            <FormField
              control={control}
              name="price"
              label={<Required>Giá (₫)</Required>}
              render={(field, invalid) => (
                <InputNumber<number>
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onInput={(value) => field.onChange(value.trim() ? moneyParser(value) : undefined)}
                  onBlur={field.onBlur}
                  min={0}
                  max={MAX_MONEY}
                  precision={0}
                  step={50000}
                  formatter={moneyFormatter}
                  parser={moneyParser}
                  changeOnBlur={false}
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </Col>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="durationDays"
              label={<Required>Thời hạn (ngày)</Required>}
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  min={1}
                  max={2147483647}
                  precision={0}
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </Col>
          <Col xs={24} sm={7}>
            <FormField
              control={control}
              name="gymAccess"
              label="Vào gym miễn phí"
              render={(field) => <Switch checked={field.value} onChange={field.onChange} />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="bookingDiscountPct"
              label="Giảm đặt sân (%)"
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  min={0}
                  max={100}
                  precision={0}
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </Col>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="classDiscountPct"
              label="Giảm học phí (%)"
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  min={0}
                  max={100}
                  precision={0}
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </Col>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="freeBookingSlotsPerMonth"
              label="Slot miễn phí / tháng"
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  min={0}
                  max={2147483647}
                  precision={0}
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </Col>
        </Row>
        <p className="m-0 text-xs text-sc-muted-2">
          {membership
            ? 'Kỳ đã thanh toán giữ nguyên quyền lợi lúc mua; thay đổi áp dụng cho kỳ mua hoặc gia hạn tiếp theo. '
            : ''}
          Thứ tự tính giá: giá gốc → quyền lợi gói → coupon. Vào gym miễn phí vẫn cần đặt slot.
        </p>
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
