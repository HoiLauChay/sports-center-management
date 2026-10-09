import { zodResolver } from '@hookform/resolvers/zod';
import { createClassBodySchema, type CreateClassBody, type ScheduleClash } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormRootError } from '~/components/form/FormField';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCourses } from '~/features/courses';
import { useSettings } from '~/features/settings';
import { useFormApiError } from '~/hooks/useFormApiError';
import { formatVND } from '~/lib/format';
import { errorPayload } from '~/lib/http-errors';
import { addDays, DATE_FORMAT, DAY_LABEL, slotGrid, todayVN, WEEK_ORDER } from '~/lib/time';
import { classesService } from '../services/classes.service';
import { ScheduleClashList } from './ScheduleClashList';

type ClassInput = z.input<typeof createClassBodySchema>;

const emptySlot = { dayOfWeek: 1, startTime: '', endTime: '' };

const blankClass = (): ClassInput => ({
  courseId: '',
  name: '',
  facilityId: '',
  startDate: addDays(todayVN(), 7),
  minStudents: 4,
  maxStudents: 12,
  weeklySchedule: [emptySlot],
});

interface ClassCreateModalProps {
  open: boolean;
  onClose: () => void;
}

/** Creates a class as a draft of a course (UC_2.12); every session holds its slot, so a clash lists each one (BR_2.3). */
export function ClassCreateModal({ open, onClose }: ClassCreateModalProps) {
  const queryClient = useQueryClient();
  const courses = useCourses();
  const facilities = useQuery(facilitiesQueryOptions);
  const settings = useSettings();
  const grid = settings.data
    ? slotGrid(settings.data.openTime, settings.data.closeTime, settings.data.slotDurationMinutes)
    : [];
  const [conflicts, setConflicts] = useState<ScheduleClash[]>([]);
  const form = useForm<ClassInput, unknown, CreateClassBody>({
    resolver: zodResolver(createClassBodySchema),
    defaultValues: blankClass(),
  });
  const { control } = form;
  const schedule = useFieldArray({ control, name: 'weeklySchedule' });
  const handleApiError = useFormApiError(form);
  const courseId = useWatch({ control, name: 'courseId' });
  const slots = useWatch({ control, name: 'weeklySchedule' });
  const course = courses.data?.find((item) => item.id === courseId);
  const facilityOptions = (facilities.data ?? [])
    .filter((facility) => facility.isActive && course && facility.sports.some((sport) => sport.id === course.sport.id))
    .map((facility) => ({ value: facility.id, label: facility.name }));

  const close = () => {
    form.reset(blankClass());
    setConflicts([]);
    onClose();
  };

  const create = useMutation({
    mutationFn: classesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      close();
    },
    onError: (err) => {
      const clashes = errorPayload<ScheduleClash[]>(err, 'conflicts');
      if (clashes?.length) setConflicts(clashes);
      else handleApiError(err);
    },
  });

  const submit = form.handleSubmit((body) => {
    setConflicts([]);
    create.mutate(body);
  });

  return (
    <Modal
      open={open}
      title="Tạo lớp học"
      okText="Tạo lớp"
      cancelText="Hủy"
      width={720}
      destroyOnHidden
      confirmLoading={create.isPending}
      onOk={() => void submit()}
      onCancel={close}
    >
      <ScheduleClashList conflicts={conflicts} />
      <FormRootError message={form.formState.errors.root?.message} />

      <Form layout="vertical" requiredMark={false} onFinish={() => void submit()}>
        <FormField
          control={control}
          name="courseId"
          label="Khóa học"
          render={(field, invalid) => (
            <Select
              {...field}
              value={field.value || undefined}
              onChange={(value: string) => {
                field.onChange(value);
                form.setValue('facilityId', '');
              }}
              status={invalid ? 'error' : undefined}
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khóa học"
              loading={courses.isPending}
              options={(courses.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.sport.name} · ${item.totalSessions} buổi · ${formatVND(item.price)}`,
              }))}
            />
          )}
        />
        <FormField
          control={control}
          name="name"
          label="Tên lớp"
          render={(field, invalid) => (
            <Input
              {...field}
              maxLength={100}
              status={invalid ? 'error' : undefined}
              placeholder={course ? `${course.name} K…` : 'VD: Gym cơ bản K15'}
            />
          )}
        />
        <FormField
          control={control}
          name="facilityId"
          label="Phòng / sân"
          render={(field, invalid) => (
            <Select
              {...field}
              value={field.value || undefined}
              status={invalid ? 'error' : undefined}
              disabled={!course}
              loading={facilities.isPending}
              placeholder={course ? 'Chọn phòng / sân có bộ môn này' : 'Chọn khóa học trước'}
              options={facilityOptions}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[2fr_1fr_1fr]">
          <FormField
            control={control}
            name="startDate"
            label="Ngày bắt đầu"
            render={(field, invalid) => (
              <DatePicker
                className="w-full"
                format="DD/MM/YYYY"
                minDate={dayjs(addDays(todayVN(), 1))}
                status={invalid ? 'error' : undefined}
                value={field.value ? dayjs(field.value) : null}
                onChange={(value) => field.onChange(value ? value.format(DATE_FORMAT) : '')}
                onBlur={field.onBlur}
              />
            )}
          />
          <FormField
            control={control}
            name="minStudents"
            label="Sĩ số tối thiểu"
            render={(field, invalid) => (
              <InputNumber
                {...field}
                className="!w-full"
                min={1}
                max={1000}
                precision={0}
                status={invalid ? 'error' : undefined}
                onChange={(value) => field.onChange(value ?? undefined)}
              />
            )}
          />
          <FormField
            control={control}
            name="maxStudents"
            label="Sĩ số tối đa"
            render={(field, invalid) => (
              <InputNumber
                {...field}
                className="!w-full"
                min={1}
                max={1000}
                precision={0}
                status={invalid ? 'error' : undefined}
                onChange={(value) => field.onChange(value ?? undefined)}
              />
            )}
          />
        </div>

        <div className="mb-2 font-medium">Lịch học trong tuần</div>
        {schedule.fields.map((slot, index) => (
          <div key={slot.id} className="flex items-start gap-2">
            <FormField
              control={control}
              name={`weeklySchedule.${index}.dayOfWeek`}
              className="w-36"
              render={(field) => (
                <Select {...field} options={WEEK_ORDER.map((day) => ({ value: day, label: DAY_LABEL[day] }))} />
              )}
            />
            <FormField
              control={control}
              name={`weeklySchedule.${index}.startTime`}
              className="flex-1"
              render={(field, invalid) => (
                <Select
                  {...field}
                  value={field.value || undefined}
                  status={invalid ? 'error' : undefined}
                  placeholder="Bắt đầu"
                  options={grid.map((slot) => ({ value: slot.startTime, label: slot.startTime }))}
                />
              )}
            />
            <FormField
              control={control}
              name={`weeklySchedule.${index}.endTime`}
              className="flex-1"
              render={(field, invalid) => (
                <Select
                  {...field}
                  value={field.value || undefined}
                  status={invalid ? 'error' : undefined}
                  placeholder="Kết thúc"
                  options={grid
                    .filter((slot) => !slots[index]?.startTime || slot.endTime > slots[index].startTime)
                    .map((slot) => ({ value: slot.endTime, label: slot.endTime }))}
                />
              )}
            />
            <Button
              icon={<Trash2 size={16} />}
              aria-label="Xóa khung giờ"
              disabled={schedule.fields.length === 1}
              onClick={() => schedule.remove(index)}
            />
          </div>
        ))}
        <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => schedule.append(emptySlot)}>
          Thêm khung giờ
        </Button>
        {form.formState.errors.weeklySchedule?.root?.message && (
          <div className="mt-2 text-sm text-red-600">{form.formState.errors.weeklySchedule.root.message}</div>
        )}

        <p className="mt-3 mb-0 text-xs text-sc-muted">
          Lớp mới ở trạng thái nháp và giữ lịch phòng / sân ngay. Lớp cần có HLV và được duyệt mới nhận đăng ký.
        </p>
      </Form>
    </Modal>
  );
}
