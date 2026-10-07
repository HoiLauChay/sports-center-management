import {
  createClassBodySchema,
  type CreateClassBody,
  type ScheduleClash,
  type SystemSettings,
} from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCourses } from '~/features/courses';
import { useSettings } from '~/features/settings';
import { formatDate, formatVND } from '~/lib/format';
import { errorPayload, toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_LABEL, toMinutes, WEEK_ORDER } from '~/lib/time';
import { classAdminService } from '../services/classAdmin.service';

interface ClassCreateModalProps {
  open: boolean;
  onClose: () => void;
}

interface SlotValues {
  dayOfWeek: number;
  time?: [Dayjs, Dayjs];
}

interface FormValues {
  courseId: string;
  name: string;
  facilityId: string;
  startDate: Dayjs;
  minStudents: number;
  maxStudents: number;
  schedule: SlotValues[];
}

const INITIAL_VALUES: Partial<FormValues> = {
  minStudents: 4,
  maxStudents: 12,
  schedule: [{ dayOfWeek: 1 }],
};

/** Why a weekly slot does not fit the centre's slot grid (opening hours, slot length), or `null` when it does. */
function offGrid(settings: SystemSettings | undefined, start: string, end: string): string | null {
  if (!settings) return null;
  const { openTime, closeTime, slotDurationMinutes: slot } = settings;
  if (toMinutes(start) < toMinutes(openTime) || toMinutes(end) > toMinutes(closeTime)) {
    return `Giờ học phải trong khung ${openTime}–${closeTime}`;
  }
  if ((toMinutes(start) - toMinutes(openTime)) % slot !== 0 || (toMinutes(end) - toMinutes(start)) % slot !== 0) {
    return `Giờ học phải khớp lưới slot ${slot} phút tính từ ${openTime}`;
  }
  return null;
}

function clashText(clash: ScheduleClash) {
  if (clash.classSession) return `trùng buổi học của lớp "${clash.classSession.className}"`;
  if (clash.reason === 'MAINTENANCE') return 'facility đang bảo trì';
  if (clash.reason === 'BOOKED') return 'đã có lượt đặt sân';
  return 'facility không trống';
}

/**
 * Creates a class as a DRAFT section of a course (UC_2.12): every session is generated from the weekly schedule and
 * holds its facility slot right away, so a clash lists each session that collides (BR_2.3).
 */
export function ClassCreateModal({ open, onClose }: ClassCreateModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const courses = useCourses();
  const facilities = useQuery(facilitiesQueryOptions);
  const settings = useSettings();
  const [form] = Form.useForm<FormValues>();
  const courseId = Form.useWatch('courseId', form);
  const startDate = Form.useWatch('startDate', form);
  const [conflicts, setConflicts] = useState<ScheduleClash[]>([]);
  const [error, setError] = useState<string | null>(null);

  const course = courses.data?.find((item) => item.id === courseId);
  const facilityOptions = (facilities.data ?? [])
    .filter((facility) => facility.isActive && course && facility.sports.some((sport) => sport.id === course.sport.id))
    .map((facility) => ({ value: facility.id, label: facility.name }));

  const close = () => {
    setConflicts([]);
    setError(null);
    onClose();
  };

  const create = useMutation({
    mutationFn: (body: CreateClassBody) => classAdminService.create(body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      close();
      void navigate({ to: '/admin/classes/$classId', params: { classId: created.id } });
    },
    onError: (err) => {
      const clashes = errorPayload<ScheduleClash[]>(err, 'conflicts');
      if (clashes?.length) setConflicts(clashes);
      else setError(toApiError(err).message);
    },
  });

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldValue('startDate', dayjs().add(7, 'day'));
  }, [open, form]);

  const submit = (values: FormValues) => {
    setConflicts([]);
    setError(null);
    const parsed = createClassBodySchema.safeParse({
      courseId: values.courseId,
      name: values.name,
      facilityId: values.facilityId,
      startDate: values.startDate.format(DATE_FORMAT),
      minStudents: values.minStudents,
      maxStudents: values.maxStudents,
      weeklySchedule: values.schedule.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.time![0].format('HH:mm'),
        endTime: slot.time![1].format('HH:mm'),
      })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <Modal
      open={open}
      title="Tạo lớp học (chia lớp cho khóa)"
      okText="Tạo lớp DRAFT"
      cancelText="Hủy"
      width={720}
      destroyOnHidden
      confirmLoading={create.isPending}
      onOk={() => form.submit()}
      onCancel={close}
    >
      {conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          className="!mb-4"
          title="Lịch học bị trùng tại facility đã chọn"
          description={
            <ul className="m-0 list-disc pl-4 text-xs">
              {conflicts.map((clash) => (
                <li key={`${clash.date}-${clash.startTime}-${clash.classSession?.id ?? clash.reason}`}>
                  <strong>{formatDate(clash.date)}</strong> {clash.startTime}–{clash.endTime}: {clashText(clash)}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {error && <Alert type="error" showIcon className="!mb-4" title={error} />}

      <Form form={form} layout="vertical" initialValues={INITIAL_VALUES} onFinish={submit}>
        <Form.Item name="courseId" label="Khóa học" rules={[{ required: true, message: 'Chọn khóa học' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn khóa học"
            loading={courses.isPending}
            onChange={() => form.setFieldValue('facilityId', undefined)}
            options={(courses.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.name} · ${item.sport.name} · ${item.totalSessions} buổi · ${formatVND(item.price)}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="name" label="Tên lớp" rules={[{ required: true, whitespace: true, message: 'Nhập tên lớp' }]}>
          <Input maxLength={100} placeholder={course ? `${course.name} K…` : 'VD: Gym cơ bản K15'} />
        </Form.Item>

        <Form.Item name="facilityId" label="Facility mặc định" rules={[{ required: true, message: 'Chọn facility' }]}>
          <Select
            disabled={!course}
            loading={facilities.isPending}
            placeholder={course ? 'Chọn facility hỗ trợ bộ môn' : 'Chọn khóa học trước'}
            options={facilityOptions}
          />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
            <DatePicker className="w-full" format="DD/MM/YYYY" minDate={dayjs()} />
          </Form.Item>
          <Form.Item name="minStudents" label="Sĩ số tối thiểu" rules={[{ required: true, message: 'Nhập sĩ số' }]}>
            <InputNumber className="!w-full" min={1} max={1000} precision={0} />
          </Form.Item>
          <Form.Item
            name="maxStudents"
            label="Sĩ số tối đa"
            dependencies={['minStudents']}
            rules={[
              { required: true, message: 'Nhập sĩ số' },
              ({ getFieldValue }) => ({
                validator: (_, value: number | null) =>
                  value == null || value >= (getFieldValue('minStudents') as number)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Phải không nhỏ hơn sĩ số tối thiểu')),
              }),
            ]}
          >
            <InputNumber className="!w-full" min={1} max={1000} precision={0} />
          </Form.Item>
        </div>

        <div className="mb-2 font-medium">Lịch tuần (sinh buổi học)</div>
        <Form.List
          name="schedule"
          rules={[
            {
              validator: (_, slots: SlotValues[] | undefined) =>
                slots?.length ? Promise.resolve() : Promise.reject(new Error('Cần ít nhất một khung giờ trong tuần')),
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field) => (
                <div key={field.key} className="flex items-start gap-2">
                  <Form.Item
                    name={[field.name, 'dayOfWeek']}
                    className="w-36"
                    rules={[{ required: true, message: 'Chọn thứ' }]}
                  >
                    <Select options={WEEK_ORDER.map((day) => ({ value: day, label: DAY_LABEL[day] }))} />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'time']}
                    className="flex-1"
                    rules={[
                      { required: true, message: 'Chọn giờ học' },
                      {
                        validator: (_, range: [Dayjs, Dayjs] | undefined) => {
                          if (!range) return Promise.resolve();
                          const [start, end] = range.map((value) => value.format('HH:mm'));
                          if (start! >= end!) return Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu'));
                          const reason = offGrid(settings.data, start!, end!);
                          return reason ? Promise.reject(new Error(reason)) : Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <TimePicker.RangePicker className="w-full" format="HH:mm" minuteStep={15} order />
                  </Form.Item>
                  <Button
                    icon={<Trash2 size={16} />}
                    disabled={fields.length === 1}
                    onClick={() => remove(field.name)}
                  />
                </div>
              ))}
              <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => add({ dayOfWeek: 1 })}>
                Thêm khung giờ
              </Button>
              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>

        <p className="mt-3 mb-0 text-xs text-sc-muted">
          Tạo lớp giữ slot facility ngay từ DRAFT
          {course && ` (${course.totalSessions} buổi từ ${startDate?.format('DD/MM/YYYY') ?? '…'})`}. Lớp cần HLV đăng
          ký / được phân công rồi Quản lý duyệt mới OPEN.
        </p>
      </Form>
    </Modal>
  );
}
