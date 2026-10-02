import { zodResolver } from '@hookform/resolvers/zod';
import { App, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Segmented, Switch } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { MoneyInput } from '~/components/form/MoneyInput';
import { ORDER_ITEM_TYPES, ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { useFormApiError } from '~/hooks/useFormApiError';
import { nowVN } from '~/lib/time';
import { useCouponMutations } from '../hooks/useCoupons';
import { couponSchema, type CouponFormInput, type CouponFormValues } from '../schemas/coupon.schema';
import type { Coupon } from '../types';

function emptyForm(): CouponFormInput {
  return {
    code: '',
    name: '',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscount: null,
    validFrom: nowVN().startOf('day').toISOString(),
    validTo: nowVN().add(30, 'day').endOf('day').toISOString(),
    maxUses: null,
    maxUsesPerUser: 1,
    minOrderAmount: null,
    applicableTypes: [],
    isActive: true,
  };
}

const fromCoupon = (coupon: Coupon): CouponFormInput => ({
  code: coupon.code,
  name: coupon.name,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  maxDiscount: coupon.maxDiscount,
  validFrom: coupon.validFrom,
  validTo: coupon.validTo,
  maxUses: coupon.maxUses,
  maxUsesPerUser: coupon.maxUsesPerUser,
  minOrderAmount: coupon.minOrderAmount,
  applicableTypes: coupon.applicableTypes ?? [],
  isActive: coupon.isActive,
});

function Required({ children }: { children: string }) {
  return (
    <>
      <span className="mr-1 text-sc-error">*</span>
      {children}
    </>
  );
}

interface CouponFormModalProps {
  open: boolean;
  coupon: Coupon | null;
  onClose: () => void;
}

/** Create / edit a coupon (UC_3.8). A percent coupon above 100 is rejected before and after saving. */
export function CouponFormModal({ open, coupon, onClose }: CouponFormModalProps) {
  const { save } = useCouponMutations();
  const { message } = App.useApp();
  const form = useForm<CouponFormInput, unknown, CouponFormValues>({
    resolver: zodResolver(couponSchema),
    mode: 'onTouched',
    defaultValues: emptyForm(),
  });
  const { control } = form;
  const handleApiError = useFormApiError(form);
  const discountType = useWatch({ control, name: 'discountType' });
  const validFrom = useWatch({ control, name: 'validFrom' });
  const validTo = useWatch({ control, name: 'validTo' });

  useEffect(() => {
    if (open) form.reset(coupon ? fromCoupon(coupon) : emptyForm());
  }, [open, coupon, form]);

  const submit = form.handleSubmit((values) => {
    if (save.isPending) return;
    save.mutate(
      {
        id: coupon?.id,
        input: {
          code: values.code,
          name: values.name,
          discountType: values.discountType,
          discountValue: values.discountValue,
          maxDiscount: values.discountType === 'PERCENT' ? values.maxDiscount : null,
          validFrom: values.validFrom,
          validTo: values.validTo,
          maxUses: values.maxUses,
          maxUsesPerUser: values.maxUsesPerUser,
          minOrderAmount: values.minOrderAmount,
          applicableTypes: values.applicableTypes.length ? values.applicableTypes : null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          handleApiError(error);
          message.destroy();
        },
      },
    );
  });

  const rangeError = form.formState.errors.validFrom?.message ?? form.formState.errors.validTo?.message;

  return (
    <Modal
      open={open}
      title={coupon ? `Sửa mã ${coupon.code}` : 'Tạo mã giảm giá'}
      okText="Lưu"
      cancelText="Hủy"
      width={640}
      mask={{ closable: false }}
      confirmLoading={save.isPending}
      onOk={() => void submit()}
      onCancel={() => !save.isPending && onClose()}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void submit()} disabled={save.isPending}>
        <FormRootError message={form.formState.errors.root?.message} />
        <Row gutter={16}>
          <Col xs={24} sm={10}>
            <FormField
              control={control}
              name="code"
              label={<Required>Mã</Required>}
              render={(field, invalid) => (
                <Input
                  {...field}
                  maxLength={50}
                  autoComplete="off"
                  placeholder="WELCOME20"
                  className="font-mono uppercase"
                  status={invalid ? 'error' : undefined}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                />
              )}
            />
          </Col>
          <Col xs={24} sm={14}>
            <FormField
              control={control}
              name="name"
              label={<Required>Tên chương trình</Required>}
              render={(field, invalid) => (
                <Input {...field} maxLength={255} autoComplete="off" status={invalid ? 'error' : undefined} />
              )}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="discountType"
              label="Loại giảm"
              render={(field) => (
                <Segmented
                  block
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  options={[
                    { value: 'PERCENT', label: 'Phần trăm' },
                    { value: 'FIXED', label: 'Số tiền' },
                  ]}
                />
              )}
            />
          </Col>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="discountValue"
              label={<Required>{discountType === 'PERCENT' ? 'Giảm (%)' : 'Giảm (₫)'}</Required>}
              render={(field, invalid) =>
                discountType === 'PERCENT' ? (
                  <InputNumber
                    ref={field.ref}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? undefined)}
                    onBlur={field.onBlur}
                    min={1}
                    precision={0}
                    suffix="%"
                    status={invalid ? 'error' : undefined}
                    className="!w-full"
                  />
                ) : (
                  <MoneyInput
                    ref={field.ref}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? undefined)}
                    onBlur={field.onBlur}
                    min={1}
                    step={10_000}
                    status={invalid ? 'error' : undefined}
                  />
                )
              }
            />
          </Col>
          <Col xs={24} sm={8}>
            {discountType === 'PERCENT' && (
              <FormField
                control={control}
                name="maxDiscount"
                label="Giảm tối đa"
                extra="Để trống = không giới hạn"
                render={(field, invalid) => (
                  <MoneyInput
                    ref={field.ref}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? null)}
                    onBlur={field.onBlur}
                    min={1}
                    step={50_000}
                    status={invalid ? 'error' : undefined}
                  />
                )}
              />
            )}
          </Col>
        </Row>

        <Form.Item
          label={<Required>Thời gian hiệu lực</Required>}
          validateStatus={rangeError ? 'error' : undefined}
          help={rangeError}
        >
          <DatePicker.RangePicker
            showTime={{ format: 'HH:mm' }}
            format="DD/MM/YYYY HH:mm"
            allowClear={false}
            className="!w-full"
            value={[validFrom ? dayjs(validFrom) : null, validTo ? dayjs(validTo) : null]}
            onChange={(range) => {
              form.setValue('validFrom', range?.[0]?.toISOString() ?? '', { shouldValidate: true, shouldTouch: true });
              form.setValue('validTo', range?.[1]?.toISOString() ?? '', { shouldValidate: true, shouldTouch: true });
            }}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <FormField
              control={control}
              name="maxUses"
              label="Tổng lượt dùng"
              extra="Để trống = không giới hạn"
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  onBlur={field.onBlur}
                  min={1}
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
              name="maxUsesPerUser"
              label={<Required>Lượt / người</Required>}
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  min={1}
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
              name="minOrderAmount"
              label="Ngưỡng tối thiểu"
              extra="Tổng giá gốc các dịch vụ áp dụng"
              render={(field, invalid) => (
                <MoneyInput
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  onBlur={field.onBlur}
                  step={50_000}
                  status={invalid ? 'error' : undefined}
                />
              )}
            />
          </Col>
        </Row>

        <FormField
          control={control}
          name="applicableTypes"
          label="Loại dịch vụ áp dụng"
          extra="Không chọn = áp dụng mọi loại dịch vụ. Không áp dụng cho nạp ví."
          render={(field) => (
            <Checkbox.Group
              value={field.value}
              onChange={(value) => field.onChange(value)}
              options={ORDER_ITEM_TYPES.map((type) => ({ value: type, label: ORDER_ITEM_TYPE_LABEL[type] }))}
            />
          )}
        />
        <FormField
          control={control}
          name="isActive"
          label="Đang bật"
          render={(field) => <Switch checked={field.value} onChange={field.onChange} />}
        />
        <p className="m-0 text-xs text-sc-muted-2">
          Mỗi đơn dùng một mã, không cộng dồn, chỉ dành cho thành viên có tài khoản. Giảm tính một lần trên tổng sau ưu
          đãi gói của các dịch vụ áp dụng rồi phân bổ về từng dòng.
        </p>
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
