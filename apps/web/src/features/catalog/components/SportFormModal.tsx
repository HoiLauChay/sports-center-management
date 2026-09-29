import { zodResolver } from '@hookform/resolvers/zod';
import { createSportBodySchema, ERROR_CODE, type CreateSportBody, type Sport } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormRootError } from '~/components/form/FormField';
import { ImageUploadField } from '~/components/form/ImageUploadField';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { sportsQueryOptions } from '../hooks/useCatalog';
import { sportsService } from '../services/sports.service';

type SportInput = z.input<typeof createSportBodySchema>;

const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.NAME_TAKEN]: 'name' };
const EMPTY: SportInput = { name: '', description: '', iconUrl: null };

interface SportFormModalProps {
  open: boolean;
  sport: Sport | null;
  onClose: () => void;
}

export function SportFormModal({ open, sport, onClose }: SportFormModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const form = useForm<SportInput, unknown, CreateSportBody>({
    resolver: zodResolver(createSportBodySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  useEffect(() => {
    if (!open) return;
    form.reset(sport ? { name: sport.name, description: sport.description ?? '', iconUrl: sport.iconUrl } : EMPTY);
  }, [open, sport, form]);

  const mutation = useMutation({
    mutationFn: (values: CreateSportBody) =>
      sport ? sportsService.update(sport.id, values) : sportsService.create(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sportsQueryOptions.queryKey });
      message.success(sport ? 'Đã cập nhật bộ môn' : 'Đã thêm bộ môn');
      onClose();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      open={open}
      title={sport ? 'Sửa bộ môn' : 'Thêm bộ môn'}
      okText="Lưu"
      cancelText="Hủy"
      width={520}
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
          name="iconUrl"
          label="Icon"
          render={(field, invalid) => (
            <ImageUploadField
              purpose="SPORT_ICON"
              variant="icon"
              value={field.value}
              onChange={field.onChange}
              fallback={(form.getValues('name') || '?').charAt(0).toUpperCase()}
              invalid={invalid}
            />
          )}
        />
        <FormField
          control={control}
          name="name"
          label="Tên bộ môn"
          render={(field, invalid) => (
            <Input {...field} status={invalid ? 'error' : undefined} placeholder="VD: Cầu lông" autoComplete="off" />
          )}
        />
        <FormField
          control={control}
          name="description"
          label="Mô tả"
          render={(field, invalid) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              status={invalid ? 'error' : undefined}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
          )}
        />
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
