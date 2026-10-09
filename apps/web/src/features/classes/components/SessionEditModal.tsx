import type { ScheduleClash } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { App, DatePicker, Form, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useSettings } from '~/features/settings';
import { errorPayload, fieldErrorsToMap, toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, slotGrid, todayVN } from '~/lib/time';
import { useUpdateSession } from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSession } from '../types';
import { ScheduleClashList } from './ScheduleClashList';

interface SessionForm {
  date: string;
  startTime: string;
  endTime: string;
  facilityId: string;
}

interface SessionEditModalProps {
  item: ClassAdminDetail;
  session: ClassSession | null;
  onClose: () => void;
}

/** Moves one session to another day, time or facility of the class's sport; students and coach are notified. */
export function SessionEditModal({ item, session, onClose }: SessionEditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SessionForm>();
  const [conflicts, setConflicts] = useState<ScheduleClash[]>([]);
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
    });
  }, [session, form]);

  const close = () => {
    setConflicts([]);
    onClose();
  };

  const submit = (values: SessionForm) => {
    if (!session) return;
    setConflicts([]);
    update.mutate(
      { id: session.id, body: values },
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
          else message.error(apiError.message);
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
          <Form.Item name="endTime" label="Kết thúc" rules={[{ required: true, message: 'Chọn giờ kết thúc' }]}>
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
      </Form>
    </Modal>
  );
}
