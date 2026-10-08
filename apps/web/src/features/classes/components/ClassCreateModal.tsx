import { zodResolver } from '@hookform/resolvers/zod';
import {
  createClassBodySchema,
  type CreateClassBody,
  type ScheduleClash,
  type ScheduleClashReason,
} from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { FormField, FormRootError } from '~/components/form/FormField';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCourses } from '~/features/courses';
import { useFormApiError } from '~/hooks/useFormApiError';
import { formatDate, formatVND } from '~/lib/format';
import { errorPayload } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_LABEL, WEEK_ORDER } from '~/lib/time';
import { classesService } from '../services/classes.service';

type ClassInput = z.input<typeof createClassBodySchema>;

const CLASH_TEXT: Record<ScheduleClashReason, string> = {
  CLOSED: 'phòng / sân đang tạm ngừng',
  PAST: 'buổi đã qua',
  OFF_GRID: 'giờ học không khớp lưới slot',
  MAINTENANCE: 'phòng / sân đang bảo trì',
  CLASS_SESSION: 'trùng buổi học khác',
  BOOKED: 'đã có lượt đặt sân',
  FULL: 'phòng / sân đã kín chỗ',
  COACH_BUSY: 'HLV đã có lịch',
  MEMBER_BUSY: 'học viên đã có lịch',
};

const emptySlot = { dayOfWeek: 1, startTime: '', endTime: '' };

const blankClass = (): ClassInput => ({
  courseId: '',
  name: '',
  facilityId: '',
  startDate: dayjs().add(7, 'day').format(DATE_FORMAT),
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
  const [conflicts, setConflicts] = useState<ScheduleClash[]>([]);
  const form = useForm<ClassInput, unknown, CreateClassBody>({
    resolver: zodResolver(createClassBodySchema),
    defaultValues: blankClass(),
  });
  const { control } = form;
  const schedule = useFieldArray({ control, name: 'weeklySchedule' });
  const handleApiError = useFormApiError(form);
  const courseId = useWatch({ control, name: 'courseId' });
  const course = courses.data?.find((item) => item.id === courseId);
  const facilityOptions = (facilities.data ?? [])
    .filter((facility) => facility.isActive && course && facility.sports.some((sport) => sport.id === course.sport.id))
    .map((facility) => ({ value: facility.id, label: facility.name }));

  useEffect(() => {
    if (!open) return;
    form.reset(blankClass());
  }, [open, form]);

  const close = () => {
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
      {conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          className="!mb-4"
          title="Lịch học bị trùng"
          description={
            <ul className="m-0 list-disc pl-4 text-xs">
              {conflicts.map((clash) => (
                <li key={`${clash.date}-${clash.startTime}-${clash.reason}`}>
                  <strong>{formatDate(clash.date)}</strong> {clash.startTime}–{clash.endTime}:{' '}
                  {clash.classSession
                    ? `trùng buổi của lớp "${clash.classSession.className}"`
                    : CLASH_TEXT[clash.reason]}
                </li>
              ))}
            </ul>
          }
        />
      )}
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
                minDate={dayjs()}
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
              name={`weeklySchedule.${index}.endTime`}
              className="flex-1"
              render={(field, invalid) => {
                const startTime = form.getValues(`weeklySchedule.${index}.startTime`);
                return (
                  <TimePicker.RangePicker
                    className="w-full"
                    format="HH:mm"
                    minuteStep={15}
                    order
                    status={invalid ? 'error' : undefined}
                    value={startTime && field.value ? [dayjs(startTime, 'HH:mm'), dayjs(field.value, 'HH:mm')] : null}
                    onChange={(range) => {
                      form.setValue(`weeklySchedule.${index}.startTime`, range?.[0]?.format('HH:mm') ?? '');
                      field.onChange(range?.[1]?.format('HH:mm') ?? '');
                    }}
                  />
                );
              }}
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
