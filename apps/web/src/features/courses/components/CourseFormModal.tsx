import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, CreateCourseBody } from '@sports-center/shared';
import { createCourseBodySchema } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

  // The schema already turns blank description / thumbnail into null, so clearing them on edit reaches the API.
  const onSubmit = (data: CreateCourseBody) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: data });
    else createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      title={isEditing ? 'Cập nhật khóa học' : 'Tạo khóa học'}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={loading}
      onOk={() => void handleSubmit(onSubmit)()}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Form layout="vertical" className="!mt-4">
        <FormField
          control={control}
          name="name"
          label="Tên khóa"
          render={(field, invalid) => (
            <Input {...field} placeholder="VD: Cầu lông cơ bản cho người mới" status={invalid ? 'error' : undefined} />
          )}
        />
        <FormField
          control={control}
          name="sportId"
          label="Bộ môn"
          extra={isEditing ? 'Không đổi bộ môn của khóa đã có lớp.' : undefined}
          render={(field, invalid) => (
            <Select
              {...field}
              status={invalid ? 'error' : undefined}
              placeholder="Chọn bộ môn"
              loading={sports.isPending}
              disabled={isEditing}
              options={(sports.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        />
        <FormField
          control={control}
          name="description"
          label="Mô tả"
          render={(field) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              rows={2}
              placeholder="Nội dung đào tạo, kỹ năng đạt được sau khóa học..."
            />
          )}
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_2fr]">
          <FormField
            control={control}
            name="totalSessions"
            label="Số buổi"
            render={(field, invalid) => (
              <InputNumber {...field} status={invalid ? 'error' : undefined} className="!w-full" min={1} max={100} />
            )}
          />
          <FormField
            control={control}
            name="price"
            label="Học phí (₫)"
            render={(field, invalid) => (
              <InputNumber
                {...field}
                status={invalid ? 'error' : undefined}
                className="!w-full"
                min={0}
                step={50_000}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(value) => Number(value?.replace(/\./g, '') || 0)}
              />
            )}
          />
        </div>
      </Form>
    </Modal>
  );
}
