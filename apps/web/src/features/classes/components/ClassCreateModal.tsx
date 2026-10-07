import type { Course, Facility, WeeklySlot } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, TimePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCourses } from '~/features/courses';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DAY_LABEL, WEEK_ORDER } from '~/lib/time';
import { classAdminService, type ScheduleClash } from '../services/classAdmin.service';

const { Text } = Typography;

interface ClassCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormValues {
  courseId: string;
  name: string;
  facilityId: string;
  startDate: Dayjs | null;
  weeklySchedule: WeeklySlot[];
  minStudents: number;
  maxStudents: number;
}

export function ClassCreateModal({ open, onClose, onSuccess }: ClassCreateModalProps) {
  const queryClient = useQueryClient();
  const courses = useCourses();
  const facilities = useQuery(facilitiesQueryOptions);

  const [form] = Form.useForm<FormValues>();
  const watchedCourseId = Form.useWatch('courseId', form);
  const selectedCourseId = watchedCourseId ?? courses.data?.[0]?.id;
  const [conflicts, setConflicts] = useState<ScheduleClash[] | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const selectedCourse: Course | undefined = useMemo(
    () => courses.data?.find((c) => c.id === selectedCourseId),
    [courses.data, selectedCourseId],
  );

  // Lọc chỉ cơ sở hỗ trợ bộ môn của khóa học được chọn
  const validFacilities: Facility[] = useMemo(() => {
    if (!selectedCourse) return facilities.data ?? [];
    return (facilities.data ?? []).filter((f) => f.isActive && f.sports.some((s) => s.id === selectedCourse.sport.id));
  }, [facilities.data, selectedCourse]);

  const handleClose = () => {
    setConflicts(null);
    setGeneralError(null);
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      setConflicts(null);
      setGeneralError(null);
      return classAdminService.create({
        courseId: values.courseId,
        name: values.name.trim(),
        facilityId: values.facilityId,
        startDate: values.startDate!.format('YYYY-MM-DD'),
        weeklySchedule: values.weeklySchedule,
        minStudents: values.minStudents,
        maxStudents: values.maxStudents,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      onClose();
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const errorObj = err as { code?: string; conflicts?: ScheduleClash[]; message?: string };
      if (errorObj.code === 'SCHEDULE_CONFLICT' && Array.isArray(errorObj.conflicts)) {
        setConflicts(errorObj.conflicts);
      } else {
        setGeneralError(toApiError(err).message);
      }
    },
  });

  const handleFinish = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Modal
      open={open}
      title="Tạo lớp học mới"
      okText="Tạo lớp"
      cancelText="Hủy"
      width={680}
      confirmLoading={createMutation.isPending}
      onOk={() => void form.submit()}
      onCancel={handleClose}
      destroyOnClose
    >
      {/* Acceptance criteria: Lỗi trùng lịch hiển thị chi tiết các buổi bị trùng */}
      {conflicts && conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          className="!mb-4 !mt-2"
          message={<span className="font-bold text-red-700">Lịch học bị trùng tại cơ sở đã chọn:</span>}
          description={
            <div className="mt-2 text-xs">
              <p className="mb-2 text-sc-ink-2">
                Không thể tạo lớp do các buổi học sau bị trùng khung giờ với lịch hiện có:
              </p>
              <ul className="m-0 list-disc space-y-1 pl-4 text-red-600">
                {conflicts.map((clash, idx) => (
                  <li key={idx}>
                    <strong>{formatDate(clash.date)}</strong> ({clash.startTime} – {clash.endTime}):{' '}
                    {clash.classSession ? (
                      <span>
                        Trùng với buổi học của lớp <strong>&quot;{clash.classSession.className}&quot;</strong>
                      </span>
                    ) : (
                      <span>Đã có lượt đặt sân hoặc bảo trì trong khung giờ này</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 mb-0 text-sc-muted">
                Gợi ý: Hãy đổi cơ sở, chọn ngày bắt đầu khác hoặc đổi khung giờ trong lịch tuần.
              </p>
            </div>
          }
        />
      )}

      {generalError && <Alert type="error" showIcon message={generalError} className="!mb-4 !mt-2" />}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        className="!mt-3"
        initialValues={{
          minStudents: 4,
          maxStudents: 12,
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Form.Item name="courseId" label="Khóa học" rules={[{ required: true, message: 'Vui lòng chọn khóa học' }]}>
            <Select
              placeholder="Chọn khóa học"
              loading={courses.isPending}
              onChange={(val: string) => {
                const c = courses.data?.find((item) => item.id === val);
                if (c) {
                  form.setFieldValue('name', `${c.name} · Lớp mới`);
                  form.setFieldValue('facilityId', undefined); // Reset facility
                }
              }}
              options={(courses.data ?? []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.sport.name} · ${c.totalSessions} buổi)`,
              }))}
            />
          </Form.Item>

          <Form.Item name="name" label="Tên lớp học" rules={[{ required: true, message: 'Vui lòng nhập tên lớp học' }]}>
            <Input placeholder="VD: Cầu lông cơ bản · Lớp K1" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Form.Item
            name="facilityId"
            label={`Cơ sở học ${selectedCourse ? `(Bộ môn ${selectedCourse.sport.name})` : ''}`}
            rules={[{ required: true, message: 'Vui lòng chọn cơ sở' }]}
          >
            <Select
              placeholder={validFacilities.length ? 'Chọn cơ sở' : 'Không có cơ sở phù hợp bộ môn'}
              loading={facilities.isPending}
              disabled={!validFacilities.length}
              options={validFacilities.map((f) => ({
                value: f.id,
                label: f.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Ngày khai giảng (bắt đầu)"
            rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
          >
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              placeholder="Chọn ngày bắt đầu"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </div>

        <div className="mb-2">
          <Text strong>Lịch học hàng tuần</Text>
          <p className="mt-0 text-xs text-sc-muted">
            Hệ thống sẽ tự động sinh đủ {selectedCourse?.totalSessions ?? 8} buổi học theo các khung giờ này.
          </p>
        </div>

        <Form.List name="weeklySchedule">
          {(fields, { add, remove }) => (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-sc-border p-3">
              {fields.map(({ key, name, ...restField }) => (
                <div key={key} className="flex items-center gap-2">
                  <Form.Item
                    {...restField}
                    name={[name, 'dayOfWeek']}
                    className="!mb-0 w-36"
                    rules={[{ required: true, message: 'Chọn thứ' }]}
                  >
                    <Select
                      options={WEEK_ORDER.map((dayNum) => ({
                        value: dayNum,
                        label: DAY_LABEL[dayNum],
                      }))}
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'startTime']}
                    className="!mb-0 w-28"
                    rules={[{ required: true, message: 'Bắt đầu' }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={15} placeholder="Bắt đầu" />
                  </Form.Item>

                  <span>đến</span>

                  <Form.Item
                    {...restField}
                    name={[name, 'endTime']}
                    className="!mb-0 w-28"
                    rules={[{ required: true, message: 'Kết thúc' }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={15} placeholder="Kết thúc" />
                  </Form.Item>

                  {fields.length > 1 && (
                    <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => remove(name)} />
                  )}
                </div>
              ))}

              <Button
                type="dashed"
                onClick={() => add({ dayOfWeek: 1, startTime: '18:00', endTime: '19:30' })}
                icon={<Plus size={14} />}
                className="mt-2"
                block
              >
                Thêm buổi trong tuần
              </Button>
            </div>
          )}
        </Form.List>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="minStudents"
            label="Sĩ số tối thiểu"
            rules={[{ required: true, message: 'Nhập sĩ số tối thiểu' }]}
          >
            <InputNumber min={1} max={50} className="w-full" />
          </Form.Item>

          <Form.Item name="maxStudents" label="Sĩ số tối đa" rules={[{ required: true, message: 'Nhập sĩ số tối đa' }]}>
            <InputNumber min={1} max={100} className="w-full" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
