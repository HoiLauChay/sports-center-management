import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductCategoryBodySchema,
  ERROR_CODE,
  type CreateProductCategoryBody,
  type ProductCategory,
} from '@sports-center/shared';
import { useMutation } from '@tanstack/react-query';
import { App, Button, Form, Input, InputNumber, Modal, Switch, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { RowActions } from '~/components/data/RowActions';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { FormField, FormRootError } from '~/components/form/FormField';
import { useConfirm } from '~/hooks/useConfirm';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { toApiError } from '~/lib/http-errors';
import { useProductCategories, useRefreshShop } from '../hooks/useShop';
import { shopService } from '../services/shop.service';

type CategoryInput = z.input<typeof createProductCategoryBodySchema>;

const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.NAME_TAKEN]: 'name' };
const EMPTY: CategoryInput = { name: '', sortOrder: 0, isActive: true };

function CategoryFormModal({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: ProductCategory | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const refresh = useRefreshShop();
  const form = useForm<CategoryInput, unknown, CreateProductCategoryBody>({
    resolver: zodResolver(createProductCategoryBodySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  useEffect(() => {
    if (!open) return;
    form.reset(category ? { name: category.name, sortOrder: category.sortOrder, isActive: category.isActive } : EMPTY);
  }, [open, category, form]);

  const mutation = useMutation({
    mutationFn: (values: CreateProductCategoryBody) =>
      category ? shopService.updateCategory(category.id, values) : shopService.createCategory(values),
    onSuccess: () => {
      void refresh();
      message.success(category ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
      onClose();
    },
    onError: handleApiError,
  });
  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      open={open}
      title={category ? 'Sửa danh mục' : 'Thêm danh mục'}
      okText="Lưu"
      cancelText="Hủy"
      width={440}
      mask={{ closable: false }}
      confirmLoading={mutation.isPending}
      onOk={() => void onSubmit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
        <FormRootError message={form.formState.errors.root?.message} />
        <FormField
          control={control}
          name="name"
          label="Tên danh mục"
          render={(field, invalid) => (
            <Input {...field} status={invalid ? 'error' : undefined} placeholder="VD: Đồ uống" autoComplete="off" />
          )}
        />
        <div className="grid grid-cols-2 gap-x-4">
          <FormField
            control={control}
            name="sortOrder"
            label="Thứ tự hiển thị"
            extra="Số nhỏ hiện trước"
            render={(field, invalid) => (
              <InputNumber
                value={field.value}
                onChange={(value) => field.onChange(value ?? 0)}
                onBlur={field.onBlur}
                min={0}
                precision={0}
                status={invalid ? 'error' : undefined}
                className="!w-full"
              />
            )}
          />
          <FormField
            control={control}
            name="isActive"
            label="Đang hiển thị"
            render={(field) => <Switch checked={field.value} onChange={field.onChange} />}
          />
        </div>
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}

/** Manager tab: product categories, in the order members see them. */
export function CategoriesPanel() {
  const { message } = App.useApp();
  const confirm = useConfirm();
  const refresh = useRefreshShop();
  const categories = useProductCategories(true);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => shopService.updateCategory(id, { isActive }),
    onSuccess: (category) => {
      void refresh();
      message.success(category.isActive ? `Đã hiện ${category.name}` : `Đã ẩn ${category.name}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  const remove = useMutation({
    mutationFn: (category: ProductCategory) => shopService.removeCategory(category.id),
    onSuccess: (_, category) => {
      void refresh();
      message.success(`Đã xóa ${category.name}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  const openForm = (category: ProductCategory | null) => {
    setEditing(category);
    setFormOpen(true);
  };

  const columns: TableColumnsType<ProductCategory> = [
    { title: 'Thứ tự', dataIndex: 'sortOrder', width: 90, className: 'tabular-nums' },
    { title: 'Danh mục', dataIndex: 'name', render: (name: string) => <b>{name}</b> },
    {
      title: 'Sản phẩm',
      dataIndex: 'productCount',
      align: 'right',
      render: (count: number) => <span className="tabular-nums">{count}</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, category) => (
        <div className="flex items-center justify-end gap-3">
          <Switch
            checked={category.isActive}
            aria-label={`Hiển thị ${category.name}`}
            loading={toggle.isPending && toggle.variables.id === category.id}
            onChange={(isActive) => toggle.mutate({ id: category.id, isActive })}
          />
          <RowActions
            label={`Thao tác với ${category.name}`}
            actions={[
              { key: 'edit', label: 'Sửa', onClick: () => openForm(category) },
              {
                key: 'delete',
                label: 'Xóa',
                danger: true,
                disabled: category.productCount > 0,
                hint: category.productCount > 0 ? 'Danh mục còn sản phẩm' : undefined,
                onClick: () =>
                  confirm({
                    title: `Xóa danh mục ${category.name}?`,
                    okText: 'Xóa',
                    onOk: () => remove.mutateAsync(category).catch(() => undefined),
                  }),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus size={16} />} onClick={() => openForm(null)}>
          Thêm danh mục
        </Button>
      </div>
      {categories.error && !categories.data ? (
        <ErrorState message={toApiError(categories.error).message} onRetry={() => void categories.refetch()} />
      ) : (
        <Table<ProductCategory>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={categories.data}
          loading={categories.isFetching}
          pagination={false}
          locale={{
            emptyText: categories.isPending ? ' ' : <EmptyState title="Chưa có danh mục" />,
          }}
        />
      )}
      <CategoryFormModal open={formOpen} category={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
