import { zodResolver } from '@hookform/resolvers/zod';
import {
  App,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Space,
  Switch,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { MoneyInput } from '~/components/form/MoneyInput';
import { ORDER_ITEM_TYPES, ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { useFormApiError } from '~/hooks/useFormApiError';
import { useCouponMutations } from '../hooks/useCoupons';
import { couponSchema, type CouponFormInput, type CouponFormValues } from '../schemas/coupon.schema';
import type { Coupon } from '../types';

function emptyForm(): DefaultValues<CouponFormInput> {
  return {
    code: '',
    name: '',
    maxDiscount: null,
    validFrom: '',
    validTo: '',
    maxUses: null,
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
      width={640}
      centered
      mask={{ closable: false }}
      onCancel={() => !save.isPending && onClose()}
      destroyOnHidden
      footer={
        <div className="flex items-center justify-between">
          <FormField
            control={control}
            name="isActive"
            render={(field) => (
              <div className="flex items-center gap-2">
                <Switch checked={field.value} onChange={field.onChange} />
                <span className="text-[15px] font-medium text-sc-text">{field.value ? 'Đang bật' : 'Tắt'}</span>
              </div>
            )}
          />
          <Space>
            <Button onClick={onClose} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="primary" loading={save.isPending} onClick={() => void submit()}>
              Lưu
            </Button>
          </Space>
        </div>
      }
    >
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={() => void submit()}
        disabled={save.isPending}
        className="[&_.ant-form-item]:!mb-3"
      >
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
                <Radio.Group
                  block
                  optionType="button"
                  buttonStyle="solid"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
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
                render={(field, invalid) => (
                  <MoneyInput
                    ref={field.ref}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? null)}
                    onBlur={field.onBlur}
                    min={1}
                    step={50_000}
                    placeholder="Không giới hạn"
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
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  onBlur={field.onBlur}
                  min={1}
                  precision={0}
                  placeholder="Không giới hạn"
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
              label="Đơn tối thiểu"
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
          label={
            <span className="flex items-center gap-1.5">
              <span>Dịch vụ áp dụng</span>
              <span className="text-[13.5px] font-normal text-sc-muted">(để trống = áp dụng cho mọi dịch vụ)</span>
            </span>
          }
          render={(field) => (
            <Checkbox.Group value={field.value} onChange={(value) => field.onChange(value)} className="!w-full">
              <Row gutter={[12, 8]}>
                {ORDER_ITEM_TYPES.map((type) => (
                  <Col xs={12} sm={6} key={type}>
                    <Checkbox value={type} className="!w-full whitespace-nowrap">
                      {ORDER_ITEM_TYPE_LABEL[type]}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          )}
        />
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
