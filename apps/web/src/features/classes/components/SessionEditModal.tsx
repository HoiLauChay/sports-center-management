import type { ScheduleClash } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Form, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useSettings } from '~/features/settings';
import { errorPayload, fieldErrorsToMap, toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, slotGrid, todayVN } from '~/lib/time';
import { useCoachPool, useUpdateSession } from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSession } from '../types';
import { ScheduleClashList } from './ScheduleClashList';

interface SessionForm {
  date: string;
  startTime: string;
  endTime: string;
  facilityId: string;
  coachId: string | undefined;
}

interface SessionEditModalProps {
  item: ClassAdminDetail;
  session: ClassSession | null;
  onClose: () => void;
}

/**
 * Moves one session to another day, time or facility, or hands it to a substitute coach approved for the sport
 * (BR_2.24); students and both coaches are notified.
 */
export function SessionEditModal({ item, session, onClose }: SessionEditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SessionForm>();
  const [conflicts, setConflicts] = useState<ScheduleClash[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const pool = useCoachPool(item.course.sport.id, Boolean(session));
  const classCoachId = item.coach?.id;
  const facilities = useQuery(facilitiesQueryOptions);
  const settings = useSettings();
  const update = useUpdateSession();
  const startTime = Form.useWatch('startTime', form);

  const grid = settings.data
    ? slotGrid(settings.data.openTime, settings.data.closeTime, settings.data.slotDurationMinutes)
    : [];
  const facilityOptions = (facilities.data ?? [])
    .filter((facility) => facility.isActive && facility.sports.some((sport) => sport.id === item.course.sport.id))
    .map((facility) => ({ value: facility.id, label: facility.name }));

  useEffect(() => {
    if (!session) return;
    form.setFieldsValue({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      facilityId: session.facility.id,
      coachId: session.coach?.id,
    });
  }, [session, form]);

  const close = () => {
    setConflicts([]);
    setFailure(null);
    onClose();
  };

  const submit = (values: SessionForm) => {
    if (!session) return;
    setConflicts([]);
    setFailure(null);
    const { coachId, ...when } = values;
    const coachChanged = coachId !== session.coach?.id;
    update.mutate(
      {
        id: session.id,
        body: { ...when, ...(coachChanged && { coachId: !coachId || coachId === classCoachId ? null : coachId }) },
      },
      {
        onSuccess: () => {
          message.success(`Đã cập nhật buổi ${session.sessionNumber}, HLV và học viên được thông báo.`);
          close();
        },
        onError: (error) => {
          const clashes = errorPayload<ScheduleClash[]>(error, 'conflicts') ?? [];
          const apiError = toApiError(error);
          const fields = Object.entries(fieldErrorsToMap(apiError.errors));
          if (clashes.length > 0) setConflicts(clashes);
          else if (fields.length > 0)
            form.setFields(fields.map(([name, text]) => ({ name: name as keyof SessionForm, errors: [text] })));
          else setFailure(apiError.message);
        },
      },
    );
  };

  return (
    <Modal
      title={session ? `Sửa buổi ${session.sessionNumber}` : ''}
      open={Boolean(session)}
      centered
      destroyOnHidden
      okText="Lưu"
      cancelText="Đóng"
      confirmLoading={update.isPending}
      onCancel={close}
      onOk={() => form.submit()}
    >
      <ScheduleClashList conflicts={conflicts} />
      {failure && <Alert type="error" showIcon className="!mt-4" title={failure} />}
      <Form form={form} layout="vertical" onFinish={submit} className="!mt-4">
        <Form.Item
          name="date"
          label="Ngày học"
          rules={[{ required: true, message: 'Chọn ngày học' }]}
          getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })}
          normalize={(value: dayjs.Dayjs | null) => value?.format(DATE_FORMAT)}
        >
          <DatePicker className="w-full" format="DD/MM/YYYY" minDate={dayjs(todayVN())} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="startTime" label="Bắt đầu" rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]}>
            <Select options={grid.map((slot) => ({ value: slot.startTime, label: slot.startTime }))} />
          </Form.Item>
          <Form.Item
            name="endTime"
            label="Kết thúc"
            dependencies={['startTime']}
            rules={[
              { required: true, message: 'Chọn giờ kết thúc' },
              ({ getFieldValue }) => ({
                validator: (_, value: string | undefined) => {
                  const start = getFieldValue('startTime') as string | undefined;
                  return !value || !start || value > start
                    ? Promise.resolve()
                    : Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu'));
                },
              }),
            ]}
          >
            <Select
              options={grid
                .filter((slot) => !startTime || slot.endTime > startTime)
                .map((slot) => ({ value: slot.endTime, label: slot.endTime }))}
            />
          </Form.Item>
        </div>
        <Form.Item name="facilityId" label="Phòng / sân" rules={[{ required: true, message: 'Chọn phòng / sân' }]}>
          <Select loading={facilities.isPending} options={facilityOptions} />
        </Form.Item>
        <Form.Item
          label="Huấn luyện viên buổi này"
          extra={`Chỉ HLV đã được duyệt bộ môn ${item.course.sport.name}.`}
          className="!mb-0"
        >
          <div className="flex flex-wrap gap-2">
            <Form.Item name="coachId" noStyle>
              <Select
                className="min-w-56 flex-1"
                aria-label="HLV buổi này"
                showSearch={{ optionFilterProp: 'label' }}
                loading={pool.isPending}
                placeholder="Chọn HLV"
                options={(pool.data ?? []).map((coach) => ({
                  value: coach.id,
                  label: coach.id === classCoachId ? `${coach.fullName} (HLV của lớp)` : coach.fullName,
                }))}
              />
            </Form.Item>
            {session?.isSubstitute && classCoachId && (
              <Button onClick={() => form.setFieldValue('coachId', classCoachId)}>Trả về HLV của lớp</Button>
            )}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
