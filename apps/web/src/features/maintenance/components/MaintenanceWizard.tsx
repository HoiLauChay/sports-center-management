import type {
  Maintenance,
  MaintenanceAffectedBooking,
  MaintenanceAffectedSession,
  MaintenancePreview,
  MaintenanceResult,
  MaintenanceWindow,
} from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Steps,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Table } from '~/components/data/Table';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useSettings } from '~/features/settings';
import { formatDate, VN_TIMEZONE } from '~/lib/format';
import { describeApiError, errorPayload, toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, fromMinutes, slotGrid, todayVN, toMinutes } from '~/lib/time';
import { useCreateMaintenance, useMaintenancePreview, useUpdateMaintenance } from '../hooks/useMaintenance';
import type { SessionResolution } from '../types';

const QUARTERS = Array.from({ length: 97 }, (_, index) => fromMinutes(index * 15));
const START_OPTIONS = QUARTERS.slice(0, -1).map((time) => ({ value: time, label: time }));
const END_OPTIONS = QUARTERS.slice(1).map((time) => ({ value: time, label: time }));

const toIso = (day: Dayjs, time: string) =>
  dayjs.tz(day.format(DATE_FORMAT), VN_TIMEZONE).add(toMinutes(time), 'minute').toISOString();

interface WindowForm {
  facilityId: string;
  dates: [Dayjs, Dayjs];
  startTime: string;
  endTime: string;
  reason: string;
}

type Resolutions = Record<string, SessionResolution | undefined>;
type Moves = Record<string, string | undefined>;

/** The first thing missing from a session's resolution, or `null` when it is complete. */
function resolutionError(resolution: SessionResolution | undefined): string | null {
  if (!resolution) return 'Chưa chọn cách xử lý';
  if (resolution.action === 'MOVE_FACILITY') return resolution.facilityId ? null : 'Chọn sân / phòng thay thế';
  if (!resolution.date || !resolution.startTime || !resolution.endTime) return 'Chọn ngày và giờ mới';
  return resolution.startTime < resolution.endTime ? null : 'Giờ kết thúc phải sau giờ bắt đầu';
}

/** Suggested resolution: move the session to the first free facility of the same sport. */
function ResolutionCell({
  session,
  value,
  onChange,
}: {
  session: MaintenanceAffectedSession;
  value: SessionResolution | undefined;
  onChange: (next: SessionResolution | undefined) => void;
}) {
  const settings = useSettings();
  const facilities = useQuery(facilitiesQueryOptions);
  const grid = useMemo(
    () =>
      settings.data ? slotGrid(settings.data.openTime, settings.data.closeTime, settings.data.slotDurationMinutes) : [],
    [settings.data],
  );
  const error = resolutionError(value);
  const noAlternative = session.alternatives.length === 0;

  const choose = (action: SessionResolution['action']) => {
    if (action === 'MOVE_FACILITY') onChange({ sessionId: session.id, action, facilityId: '' });
    else {
      onChange({
        sessionId: session.id,
        action,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    }
  };

  return (
    <div className="flex min-w-72 flex-col gap-1.5">
      <Select
        size="small"
        placeholder="Chọn cách xử lý"
        value={value?.action}
        status={error ? 'error' : undefined}
        onChange={choose}
        options={[
          {
            value: 'MOVE_FACILITY',
            label: noAlternative ? 'Đổi sân / phòng (không còn sân trống)' : 'Đổi sân / phòng',
            disabled: noAlternative,
          },
          { value: 'RESCHEDULE', label: 'Dời ngày giờ' },
        ]}
      />
      {value?.action === 'MOVE_FACILITY' && (
        <Select
          size="small"
          value={value.facilityId || undefined}
          placeholder="Chọn sân / phòng thay thế"
          onChange={(facilityId) => onChange({ ...value, facilityId })}
          options={session.alternatives.map((entry) => ({ value: entry.id, label: entry.name }))}
        />
      )}
      {value?.action === 'RESCHEDULE' && (
        <div className="flex flex-wrap gap-1.5">
          <DatePicker
            size="small"
            allowClear={false}
            format="DD/MM/YYYY"
            value={dayjs(value.date)}
            disabledDate={(day) => day.format(DATE_FORMAT) < todayVN()}
            onChange={(day) => day && onChange({ ...value, date: day.format(DATE_FORMAT) })}
          />
          <Select
            size="small"
            className="w-20"
            value={value.startTime}
            onChange={(startTime) => onChange({ ...value, startTime })}
            options={grid.map((slot) => ({ value: slot.startTime, label: slot.startTime }))}
          />
          <Select
            size="small"
            className="w-20"
            value={value.endTime}
            onChange={(endTime) => onChange({ ...value, endTime })}
            options={grid.map((slot) => ({ value: slot.endTime, label: slot.endTime }))}
          />
          <Select
            size="small"
            className="w-full"
            allowClear
            placeholder="Giữ nguyên sân / phòng"
            value={value.facilityId}
            onChange={(facilityId) => onChange({ ...value, facilityId })}
            options={(facilities.data ?? [])
              .filter((entry) => entry.isActive)
              .map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        </div>
      )}
      {error ? (
        <span className="text-[13.5px] text-sc-error">{error}</span>
      ) : (
        <span className="text-[13.5px] text-sc-success">Sẽ thông báo cho HLV và học viên</span>
      )}
    </div>
  );
}

interface MaintenanceWizardProps {
  open: boolean;
  editing?: Maintenance | null;
  onClose: () => void;
}

/**
 * Creating or editing a planned maintenance (BR_2.19, UC_2.4/2.5): 1) facility, time window and reason;
 * 2) preview of the bookings to move and the sessions that need a decision; 3) the result.
 * Confirming stays disabled while any booking has no facility to move to or any session has no complete resolution.
 */
export function MaintenanceWizard({ open, editing = null, onClose }: MaintenanceWizardProps) {
  const [form] = Form.useForm<WindowForm>();
  const facilities = useQuery(facilitiesQueryOptions);
  const preview = useMaintenancePreview();
  const create = useCreateMaintenance();
  const update = useUpdateMaintenance();
  const [step, setStep] = useState(0);
  const [request, setRequest] = useState<MaintenanceWindow | null>(null);
  const [data, setData] = useState<MaintenancePreview | null>(null);
  const [resolutions, setResolutions] = useState<Resolutions>({});
  const [moves, setMoves] = useState<Moves>({});
  const [blocked, setBlocked] = useState<MaintenanceAffectedBooking[]>([]);
  const [result, setResult] = useState<MaintenanceResult | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const start = dayjs(editing.startAt).tz(VN_TIMEZONE);
      const end = dayjs(editing.endAt).tz(VN_TIMEZONE);
      form.setFieldsValue({
        facilityId: editing.facility.id,
        dates: [start.startOf('day'), end.startOf('day')],
        startTime: start.format('HH:mm'),
        endTime: end.format('HH:mm'),
        reason: editing.reason,
      });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const facilityName = (id: string) =>
    facilities.data?.find((entry) => entry.id === id)?.name ?? editing?.facility.name ?? '';

  const close = () => {
    onClose();
    // Reset after the closing animation so the content does not jump.
    window.setTimeout(() => {
      setStep(0);
      setRequest(null);
      setData(null);
      setResolutions({});
      setMoves({});
      setBlocked([]);
      setResult(null);
      form.resetFields();
      preview.reset();
      create.reset();
      update.reset();
    }, 250);
  };

  const submitWindow = (values: WindowForm) => {
    const next: MaintenanceWindow = {
      facilityId: editing ? editing.facility.id : values.facilityId,
      startAt: toIso(values.dates[0], values.startTime),
      endAt: toIso(values.dates[1], values.endTime),
      reason: values.reason.trim(),
    };
    preview.mutate(next, {
      onSuccess: (affected) => {
        create.reset();
        update.reset();
        setRequest(next);
        setData(affected);
        setResolutions({});
        setMoves({});
        setBlocked([]);
        setStep(1);
      },
    });
  };

  const sessions = data?.affectedSessions ?? [];
  const bookings = data?.affectedBookings ?? [];
  const noAlternative = sessions.filter((session) => session.alternatives.length === 0);
  const stranded = bookings.filter((booking) => booking.alternatives.length === 0);
  const unmoved = bookings.filter((booking) => !moves[booking.id]);
  const unresolved = sessions.filter((session) => resolutionError(resolutions[session.id]) !== null);
  const ready = unresolved.length === 0 && unmoved.length === 0;
  const blockedCount = blocked.length;
  const saving = create.isPending || update.isPending;
  const saveError = editing ? update.error : create.error;
  const isSaveError = editing ? update.isError : create.isError;

  const confirm = () => {
    if (!request || !ready) return;
    setBlocked([]);
    const bookingMoves = bookings.map((booking) => ({ bookingId: booking.id, facilityId: moves[booking.id]! }));
    const sessionResolutions = sessions.map((session) => resolutions[session.id]!);
    const callbacks = {
      onSuccess: (saved: MaintenanceResult) => {
        setResult(saved);
        setStep(2);
      },
      onError: (error: unknown) => setBlocked(errorPayload<MaintenanceAffectedBooking[]>(error, 'bookings') ?? []),
    };

    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            startAt: request.startAt,
            endAt: request.endAt,
            reason: request.reason,
            bookingMoves,
            sessionResolutions,
          },
        },
        callbacks,
      );
      return;
    }

    create.mutate(
      {
        ...request,
        bookingMoves,
        sessionResolutions,
      },
      callbacks,
    );
  };

  const bookingColumns: TableColumnsType<MaintenanceAffectedBooking> = [
    {
      title: 'Khách',
      key: 'who',
      render: (_, booking) =>
        booking.account ? (
          <b>{booking.account.fullName}</b>
        ) : (
          <span>
            <Tag className="!m-0 !mr-1">Khách</Tag>
            {booking.guestName}
          </span>
        ),
    },
    {
      title: 'Thời gian',
      key: 'time',
      render: (_, booking) => (
        <span className="whitespace-nowrap">
          {formatDate(booking.date)} · {booking.startTime}–{booking.endTime}
          {booking.packageId && <Tag className="!m-0 !ml-1.5">Định kỳ</Tag>}
        </span>
      ),
    },
    {
      title: 'Chuyển sang',
      key: 'move',
      render: (_, booking) =>
        booking.alternatives.length === 0 ? (
          <Tag color="error" className="!m-0">
            Không còn sân thay thế
          </Tag>
        ) : (
          <Select
            size="small"
            className="min-w-48"
            value={moves[booking.id]}
            placeholder="Chọn sân / phòng"
            status={moves[booking.id] ? undefined : 'error'}
            onChange={(facilityId) => setMoves((current) => ({ ...current, [booking.id]: facilityId }))}
            options={booking.alternatives.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        ),
    },
  ];

  const sessionColumns: TableColumnsType<MaintenanceAffectedSession> = [
    {
      title: 'Buổi học',
      key: 'session',
      render: (_, session) => (
        <div className="flex min-w-44 flex-col gap-0.5">
          <b>{session.className}</b>
          <span className="text-[13.5px] whitespace-nowrap text-sc-muted">
            {formatDate(session.date)} · {session.startTime}–{session.endTime}
          </span>
          {session.alternatives.length === 0 && (
            <Tag color="error" className="!m-0 w-fit">
              Không còn sân thay thế
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Cách xử lý',
      key: 'resolution',
      render: (_, session) => (
        <ResolutionCell
          session={session}
          value={resolutions[session.id]}
          onChange={(next) => setResolutions((current) => ({ ...current, [session.id]: next }))}
        />
      ),
    },
  ];

  const footer =
    step === 0
      ? [
          <Button key="close" onClick={close}>
            Đóng
          </Button>,
          <Button key="preview" type="primary" loading={preview.isPending} onClick={() => form.submit()}>
            Xem ảnh hưởng
          </Button>,
        ]
      : step === 1
        ? [
            <Button key="back" onClick={() => setStep(0)}>
              Quay lại
            </Button>,
            <Tooltip
              key="confirm"
              title={
                ready
                  ? undefined
                  : unmoved.length > 0
                    ? `Còn ${unmoved.length} booking chưa có sân thay thế`
                    : `Còn ${unresolved.length} buổi học chưa có cách xử lý`
              }
            >
              <Button type="primary" disabled={!ready} loading={saving} onClick={confirm}>
                {editing ? 'Lưu thay đổi' : 'Xác nhận bảo trì'}
              </Button>
            </Tooltip>,
          ]
        : [
            <Button key="done" type="primary" onClick={close}>
              Xong
            </Button>,
          ];

  return (
    <Modal
      open={open}
      title={editing ? `Chỉnh sửa lịch bảo trì · ${editing.facility.name}` : 'Đặt lịch bảo trì'}
      width={940}
      centered
      mask={{ closable: false }}
      onCancel={close}
      footer={footer}
    >
      <Steps
        size="small"
        current={step}
        className="!mb-6"
        items={[{ title: 'Thời gian & lý do' }, { title: 'Ảnh hưởng & cách xử lý' }, { title: 'Hoàn tất' }]}
      />

      {step === 0 && (
        <Form form={form} layout="vertical" onFinish={submitWindow} requiredMark="optional">
          {editing && (
            <Alert
              type="info"
              showIcon
              className="!mb-4"
              title={`Lịch hiện tại: ${dayjs(editing.startAt).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY')} → ${dayjs(editing.endAt).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY')}`}
            />
          )}
          {preview.isError && (
            <Alert type="error" showIcon className="!mb-4" title={toApiError(preview.error).message} />
          )}
          <Form.Item name="facilityId" label="Sân / phòng" rules={[{ required: true, message: 'Chọn sân / phòng' }]}>
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              loading={facilities.isPending}
              disabled={Boolean(editing)}
              placeholder="Chọn sân / phòng"
              options={(facilities.data ?? [])
                .filter((entry) => entry.isActive || entry.id === editing?.facility.id)
                .map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          </Form.Item>
          <Form.Item name="dates" label="Ngày bảo trì" rules={[{ required: true, message: 'Chọn ngày bảo trì' }]}>
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              className="w-full"
              placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}
              disabledDate={(day) => day.format(DATE_FORMAT) < todayVN()}
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="startTime"
              label="Giờ bắt đầu"
              dependencies={['dates']}
              rules={[
                { required: true, message: 'Chọn giờ bắt đầu' },
                ({ getFieldValue }) => ({
                  validator: (_, startTime: string | undefined) => {
                    const dates = getFieldValue('dates') as [Dayjs, Dayjs] | undefined;
                    if (!dates || !startTime) return Promise.resolve();
                    return Date.parse(toIso(dates[0], startTime)) > Date.now()
                      ? Promise.resolve()
                      : Promise.reject(new Error('Thời điểm bắt đầu phải ở tương lai'));
                  },
                }),
              ]}
            >
              <Select showSearch placeholder="Chọn giờ" options={START_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="Giờ kết thúc"
              dependencies={['dates', 'startTime']}
              rules={[
                { required: true, message: 'Chọn giờ kết thúc' },
                ({ getFieldValue }) => ({
                  validator: (_, endTime: string | undefined) => {
                    const dates = getFieldValue('dates') as [Dayjs, Dayjs] | undefined;
                    const startTime = getFieldValue('startTime') as string | undefined;
                    if (!dates || !startTime || !endTime) return Promise.resolve();
                    return toIso(dates[0], startTime) < toIso(dates[1], endTime)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu'));
                  },
                }),
              ]}
            >
              <Select showSearch placeholder="Chọn giờ" options={END_OPTIONS} />
            </Form.Item>
          </div>
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input maxLength={500} />
          </Form.Item>
        </Form>
      )}

      {step === 1 && request && data && (
        <div className="flex flex-col gap-4">
          <Alert
            type="info"
            showIcon
            title={`${facilityName(request.facilityId)} · ${dayjs(request.startAt).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY')} → ${dayjs(request.endAt).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY')} · ${request.reason}`}
          />
          {blockedCount > 0 && (
            <Alert
              type="error"
              showIcon
              title={`Chưa ghi nhận bảo trì: ${blockedCount} mục không thể xử lý`}
              description={
                <ul className="m-0 pl-5">
                  {blocked.map((item) => (
                    <li key={item.id}>
                      Booking của <b>{item.account?.fullName ?? item.guestName}</b> · {formatDate(item.date)}{' '}
                      {item.startTime}–{item.endTime}: không còn sân thay thế
                    </li>
                  ))}
                </ul>
              }
            />
          )}
          {isSaveError && blockedCount === 0 && <Alert type="error" showIcon title={describeApiError(saveError)} />}
          {stranded.length > 0 && (
            <Alert
              type="error"
              showIcon
              title={`${stranded.length} booking không còn sân / phòng thay thế, chưa thể bảo trì khung giờ này`}
              description={
                <>
                  <ul className="m-0 pl-5">
                    {stranded.map((booking) => (
                      <li key={booking.id}>
                        <b>{booking.account?.fullName ?? booking.guestName}</b> · {formatDate(booking.date)}{' '}
                        {booking.startTime}–{booking.endTime}
                      </li>
                    ))}
                  </ul>
                </>
              }
            />
          )}
          {noAlternative.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`${noAlternative.length} buổi học không còn sân / phòng thay thế`}
              description={
                <>
                  <ul className="m-0 pl-5">
                    {noAlternative.map((session) => (
                      <li key={session.id}>
                        <b>{session.className}</b> · {formatDate(session.date)} {session.startTime}–{session.endTime}
                      </li>
                    ))}
                  </ul>
                  <span>Các buổi này chỉ dời được ngày giờ.</span>
                </>
              }
            />
          )}

          <Card size="small" title={`Booking cần chuyển sân (${bookings.length})`}>
            <Table<MaintenanceAffectedBooking>
              rowKey="id"
              size="small"
              columns={bookingColumns}
              dataSource={bookings}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: 'Không có booking nào bị ảnh hưởng' }}
            />
            {bookings.length > 0 && (
              <p className="mt-3 mb-0 text-[14.5px] text-sc-muted">
                Booking giữ nguyên giờ và giá, không hoàn tiền; thành viên được thông báo về sân mới.
              </p>
            )}
          </Card>

          <Card size="small" title={`Buổi học cần xử lý (${sessions.length})`}>
            <Table<MaintenanceAffectedSession>
              rowKey="id"
              size="small"
              columns={sessionColumns}
              dataSource={sessions}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: 'Không có buổi học nào bị ảnh hưởng' }}
            />
          </Card>
        </div>
      )}

      {step === 2 && result && (
        <Result
          status="success"
          title={editing ? 'Đã cập nhật lịch bảo trì' : 'Đã ghi nhận lịch bảo trì'}
          subTitle={`${result.maintenance.facility.name}: chuyển ${result.movedBookings} booking sang sân khác, xử lý ${result.sessionsUpdated} buổi học.`}
        />
      )}
    </Modal>
  );
}
