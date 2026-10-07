import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, CreateCourseBody } from '@sports-center/shared';
import { createCourseBodySchema } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormField } from '~/components/form/FormField';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCreateCourse, useUpdateCourse } from '../hooks/useCourses';

interface CourseFormModalProps {
  open: boolean;
  editing: Course | null;
  onClose: () => void;
}

export function CourseFormModal({ open, editing, onClose }: CourseFormModalProps) {
  const sports = useQuery(sportsQueryOptions);
  const isEditing = Boolean(editing);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateCourseBody>({
    resolver: zodResolver(createCourseBodySchema),
    defaultValues: {
      name: '',
      description: '',
      sportId: '',
      totalSessions: 8,
      price: 1_200_000,
      thumbnailUrl: '',
    },
  });

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description ?? '',
        sportId: editing.sport.id,
        totalSessions: editing.totalSessions,
        price: editing.price,
        thumbnailUrl: editing.thumbnailUrl ?? '',
      });
    } else {
      reset({
        name: '',
        description: '',
        sportId: sports.data?.[0]?.id ?? '',
        totalSessions: 8,
        price: 1_200_000,
        thumbnailUrl: '',
      });
    }
  }, [editing, open, reset, sports.data]);

  const createMutation = useCreateCourse(() => {
    onClose();
    reset();
  });

  const updateMutation = useUpdateCourse(() => {
    onClose();
    reset();
  });

  const onSubmit = (data: CreateCourseBody) => {
    const payload = {
      ...data,
      description: data.description?.trim() ? data.description.trim() : undefined,
      thumbnailUrl: data.thumbnailUrl?.trim() ? data.thumbnailUrl.trim() : undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const loading = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      title={isEditing ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
      okText={isEditing ? 'Lưu thay đổi' : 'Tạo khóa học'}
      cancelText="Hủy"
      confirmLoading={loading}
      onOk={() => void handleSubmit(onSubmit)()}
      onCancel={onClose}
      destroyOnClose
      width={560}
    >
      <Form layout="vertical" className="!mt-4">
        <FormField
          control={control}
          name="name"
          label="Tên khóa học"
          render={(field, invalid) => (
            <Input {...field} placeholder="VD: Cầu lông cơ bản cho người mới" status={invalid ? 'error' : undefined} />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="sportId"
            render={({ field, fieldState }) => (
              <Form.Item
                label="Bộ môn"
                required
                validateStatus={fieldState.invalid ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Select
                  {...field}
                  placeholder="Chọn bộ môn"
                  loading={sports.isPending}
                  disabled={isEditing} // Đổi sportId khi đã có lớp sẽ bị conflict
                  options={(sports.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="totalSessions"
            render={({ field, fieldState }) => (
              <Form.Item
                label="Số buổi học"
                required
                validateStatus={fieldState.invalid ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <InputNumber {...field} className="w-full" min={1} max={100} placeholder="VD: 8, 12, 24" />
              </Form.Item>
            )}
          />
        </div>

        <Controller
          control={control}
          name="price"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Học phí (VND)"
              required
              validateStatus={fieldState.invalid ? 'error' : undefined}
              help={fieldState.error?.message}
            >
              <InputNumber
                {...field}
                className="w-full"
                min={0}
                step={50_000}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') || 0)}
              />
            </Form.Item>
          )}
        />

        <FormField
          control={control}
          name="description"
          label="Mô tả khóa học"
          render={(field) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              rows={3}
              placeholder="Nội dung đào tạo, kỹ năng đạt được sau khóa học..."
            />
          )}
        />
      </Form>
    </Modal>
  );
}
