import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductBodySchema,
  ERROR_CODE,
  type CreateProductBody,
  type CreateProductInput,
  type Product,
} from '@sports-center/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Form, Input, InputNumber, Modal, Select, Spin, Switch } from 'antd';
import { ImagePlus, ImageUp, Trash2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { MoneyInput } from '~/components/form/MoneyInput';
import { CROP_PRESETS } from '~/constants/crop';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCroppedUpload } from '~/hooks/useCroppedUpload';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { useProductCategories, useRefreshShop } from '../hooks/useShop';
import { shopService } from '../services/shop.service';

const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.CONFLICT]: 'sku' };

const EMPTY: CreateProductInput = {
  sku: '',
  name: '',
  description: '',
  imageUrl: null,
  categoryId: '',
  sportId: null,
  price: 0,
  lowStockThreshold: 5,
  isActive: true,
  initialStock: 0,
};

/** Square product picture: click to upload / replace, with a remove link under it. */
function ProductImagePicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const { open, uploading, modal } = useCroppedUpload('PRODUCT_IMAGE', CROP_PRESETS.icon, onChange, 'Ảnh sản phẩm');
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        aria-label={value ? 'Đổi ảnh sản phẩm' : 'Tải ảnh sản phẩm'}
        className={`group relative flex size-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-sc-paper p-0 transition-colors ${
          value ? 'border-sc-border-soft' : 'border-dashed border-sc-line hover:border-sc-primary'
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="Ảnh sản phẩm" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 text-[14px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ImageUp size={16} /> Đổi ảnh
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-3 text-center text-[14px] text-sc-muted group-hover:text-sc-primary">
            <ImagePlus size={28} strokeWidth={1.6} />
            Tải ảnh lên
            <span className="text-[12.5px] text-sc-muted-2">Ảnh vuông, tối đa 5MB</span>
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spin />
          </span>
        )}
      </button>
      {value && (
        <Button
          type="link"
          size="small"
          danger
          icon={<Trash2 size={14} />}
          className="!h-auto !p-0"
          disabled={uploading}
          onClick={() => onChange(null)}
        >
          Xóa ảnh
        </Button>
      )}
      {modal}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-sc-border-soft bg-sc-paper/60 px-4 pt-3">
      <h3 className="m-0 mb-3 text-[12.5px] font-bold tracking-[0.06em] text-sc-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

interface ProductFormModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}

export function ProductFormModal({ open, product, onClose }: ProductFormModalProps) {
  const { message } = App.useApp();
  const refresh = useRefreshShop();
  const categories = useProductCategories(true);
  const sports = useQuery(sportsQueryOptions);

  const form = useForm<CreateProductInput, unknown, CreateProductBody>({
    resolver: zodResolver(createProductBodySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  useEffect(() => {
    if (!open) return;
    form.reset(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description ?? '',
            imageUrl: product.imageUrl,
            categoryId: product.category.id,
            sportId: product.sport?.id ?? null,
            price: product.price,
            lowStockThreshold: product.lowStockThreshold,
            isActive: product.isActive,
            initialStock: 0,
          }
        : EMPTY,
    );
  }, [open, product, form]);

  const mutation = useMutation({
    mutationFn: ({ initialStock, ...values }: CreateProductBody) =>
      product ? shopService.updateProduct(product.id, values) : shopService.createProduct({ ...values, initialStock }),
    onSuccess: () => {
      void refresh();
      message.success(product ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm');
      onClose();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      open={open}
      title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      width={720}
      mask={{ closable: false }}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="flex items-center justify-between gap-3">
          <FormField
            control={control}
            name="isActive"
            className="!mb-0"
            render={(field) => (
              <label className="flex cursor-pointer items-center gap-2 text-[15px] text-sc-ink-2">
                <Switch checked={field.value} onChange={field.onChange} />
                {field.value ? 'Đang bán' : 'Ngừng bán'}
              </label>
            )}
          />
          <div className="flex gap-2">
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={mutation.isPending} onClick={() => void onSubmit()}>
              {product ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()} className="!pt-2">
        <FormRootError message={form.formState.errors.root?.message} />

        <div className="flex flex-col gap-x-6 sm:flex-row">
          <FormField
            control={control}
            name="imageUrl"
            className="sm:!mb-0"
            render={(field) => <ProductImagePicker value={field.value} onChange={field.onChange} />}
          />
          <div className="min-w-0 flex-1">
            <FormField
              control={control}
              name="name"
              label="Tên sản phẩm"
              render={(field, invalid) => (
                <Input
                  {...field}
                  size="large"
                  status={invalid ? 'error' : undefined}
                  placeholder="VD: Nước suối Aquafina 500ml"
                  autoComplete="off"
                />
              )}
            />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="sku"
                label="Mã SKU"
                render={(field, invalid) => (
                  <Input
                    {...field}
                    status={invalid ? 'error' : undefined}
                    placeholder="VD: AQUA-500"
                    className="font-mono uppercase"
                    autoComplete="off"
                  />
                )}
              />
              <FormField
                control={control}
                name="categoryId"
                label="Danh mục"
                render={(field, invalid) => (
                  <Select
                    {...field}
                    value={field.value || undefined}
                    status={invalid ? 'error' : undefined}
                    placeholder="Chọn danh mục"
                    loading={categories.isPending}
                    options={(categories.data ?? []).map((category) => ({
                      value: category.id,
                      label: category.isActive ? category.name : `${category.name} (đang ẩn)`,
                    }))}
                  />
                )}
              />
            </div>
            <FormField
              control={control}
              name="sportId"
              label="Bộ môn"
              render={(field) => (
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onChange={(value: string | undefined) => field.onChange(value ?? null)}
                  allowClear
                  placeholder="Dùng chung cho mọi bộ môn"
                  loading={sports.isPending}
                  options={(sports.data ?? []).map((sport) => ({ value: sport.id, label: sport.name }))}
                />
              )}
            />
          </div>
        </div>

        <Section title="Giá & tồn kho">
          <div className="grid gap-x-4 sm:grid-cols-3">
            <FormField
              control={control}
              name="price"
              label="Giá bán"
              render={(field, invalid) => (
                <MoneyInput
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                  onBlur={field.onBlur}
                  step={1000}
                  status={invalid ? 'error' : undefined}
                />
              )}
            />
            {product ? (
              <Form.Item label="Tồn kho hiện tại" extra="Đổi qua nút Kho để giữ lịch sử">
                <div className="flex h-8 items-center gap-2 font-display text-[22px] font-extrabold text-sc-ink tabular-nums">
                  {product.stock}
                  {product.reserved > 0 && (
                    <span className="font-body text-[13.5px] font-normal text-sc-muted">
                      +{product.reserved} chờ nhận
                    </span>
                  )}
                </div>
              </Form.Item>
            ) : (
              <FormField
                control={control}
                name="initialStock"
                label="Tồn kho ban đầu"
                render={(field, invalid) => (
                  <InputNumber
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 0)}
                    onBlur={field.onBlur}
                    min={0}
                    precision={0}
                    suffix="sp"
                    status={invalid ? 'error' : undefined}
                    className="!w-full"
                  />
                )}
              />
            )}
            <FormField
              control={control}
              name="lowStockThreshold"
              label="Báo sắp hết khi còn"
              render={(field, invalid) => (
                <InputNumber
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                  onBlur={field.onBlur}
                  min={0}
                  precision={0}
                  suffix="sp"
                  status={invalid ? 'error' : undefined}
                  className="!w-full"
                />
              )}
            />
          </div>
        </Section>

        <FormField
          control={control}
          name="description"
          label="Mô tả"
          className="!mt-4"
          render={(field, invalid) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              status={invalid ? 'error' : undefined}
              placeholder="Hiện trên thẻ sản phẩm ở cửa hàng (không bắt buộc)"
              autoSize={{ minRows: 2, maxRows: 5 }}
              maxLength={5000}
            />
          )}
        />
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
