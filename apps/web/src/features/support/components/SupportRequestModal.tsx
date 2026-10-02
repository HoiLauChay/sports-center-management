import { zodResolver } from '@hookform/resolvers/zod';
import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormField, FormRootError } from '~/components/form/FormField';
import { useFormApiError } from '~/hooks/useFormApiError';
import { useCreateSupportRequest } from '../hooks/useSupport';
import { createSupportSchema, type CreateSupportInput, type CreateSupportValues } from '../schemas/support.schema';
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABEL } from '../types';

interface SupportRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function SupportRequestModal({ open, onClose }: SupportRequestModalProps) {
  const { message } = App.useApp();
  const create = useCreateSupportRequest();
  const form = useForm<CreateSupportInput, unknown, CreateSupportValues>({
    resolver: zodResolver(createSupportSchema),
    mode: 'onTouched',
    defaultValues: { category: undefined, subject: '', description: '' },
  });
  const handleApiError = useFormApiError(form);

  useEffect(() => {
    if (open) form.reset({ category: undefined, subject: '', description: '' });
  }, [open, form]);

  const submit = form.handleSubmit((values) => {
    if (create.isPending) return;
    create.mutate(values, {
      onSuccess: () => {
        message.success('Đã gửi yêu cầu hỗ trợ. Lễ tân sẽ phản hồi sớm.');
        onClose();
      },
      onError: handleApiError,
    });
  });

  return (
    <Modal
      open={open}
      title="Gửi yêu cầu hỗ trợ"
      okText="Gửi yêu cầu"
      cancelText="Hủy"
      width={520}
      mask={{ closable: false }}
      confirmLoading={create.isPending}
      onOk={() => void submit()}
      onCancel={() => !create.isPending && onClose()}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void submit()} disabled={create.isPending}>
        <FormRootError message={form.formState.errors.root?.message} />
        <FormField
          control={form.control}
          name="category"
          label="Loại yêu cầu"
          render={(field, invalid) => (
            <Select
              {...field}
              placeholder="Chọn loại yêu cầu"
              status={invalid ? 'error' : undefined}
              options={SUPPORT_CATEGORIES.map((value) => ({ value, label: SUPPORT_CATEGORY_LABEL[value] }))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="subject"
          label="Tiêu đề"
          render={(field, invalid) => (
            <Input
              {...field}
              maxLength={255}
              autoComplete="off"
              placeholder="VD: Chưa thấy tiền nạp ví"
              status={invalid ? 'error' : undefined}
            />
          )}
        />
        <FormField
          control={form.control}
          name="description"
          label="Nội dung"
          render={(field, invalid) => (
            <Input.TextArea
              {...field}
              maxLength={5000}
              showCount
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="Mô tả vấn đề bạn gặp phải"
              status={invalid ? 'error' : undefined}
            />
          )}
        />
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
