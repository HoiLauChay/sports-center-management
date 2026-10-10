import type {
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
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useSettings } from '~/features/settings';
import { formatDate, VN_TIMEZONE } from '~/lib/format';
import { describeApiError, errorPayload, toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, slotGrid, todayVN } from '~/lib/time';
import { useCreateMaintenance, useMaintenancePreview } from '../hooks/useMaintenance';
import type { SessionResolution } from '../types';

const MINUTE_FORMAT = 'YYYY-MM-DD HH:mm';

const toIso = (value: Dayjs) => dayjs.tz(value.format(MINUTE_FORMAT), VN_TIMEZONE).toISOString();

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
function suggest(session: MaintenanceAffectedSession): SessionResolution | undefined {
  const first = session.alternatives[0];
  return first ? { sessionId: session.id, action: 'MOVE_FACILITY', facilityId: first.id } : undefined;
}

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
    if (action === 'MOVE_FACILITY') onChange(suggest(session) ?? { sessionId: session.id, action, facilityId: '' });
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
        <span className="text-[12.5px] text-sc-error">{error}</span>
      ) : (
        <span className="text-[12.5px] text-sc-success">Sẽ thông báo cho HLV và học viên</span>
      )}
    </div>
  );
}

interface MaintenanceWizardProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Creating a maintenance (BR_2.19, UC_2.4/2.5): 1) facility, time window and reason; 2) preview of the bookings to
 * move and the sessions that need a decision; 3) the result. Confirming stays disabled while any booking has no
 * facility to move to or any session has no complete resolution.
 */
export function MaintenanceWizard({ open, onClose }: MaintenanceWizardProps) {
  const [form] = Form.useForm<{ facilityId: string; range: [Dayjs, Dayjs]; reason: string }>();
  const facilities = useQuery(facilitiesQueryOptions);
  const preview = useMaintenancePreview();
  const create = useCreateMaintenance();
  const [step, setStep] = useState(0);
  const [request, setRequest] = useState<MaintenanceWindow | null>(null);
  const [data, setData] = useState<MaintenancePreview | null>(null);
  const [resolutions, setResolutions] = useState<Resolutions>({});
  const [moves, setMoves] = useState<Moves>({});
  const [blocked, setBlocked] = useState<MaintenanceAffectedBooking[]>([]);
  const [result, setResult] = useState<MaintenanceResult | null>(null);

  const facilityName = (id: string) => facilities.data?.find((entry) => entry.id === id)?.name ?? '';

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
    }, 250);
  };

  const submitWindow = (values: { facilityId: string; range: [Dayjs, Dayjs]; reason: string }) => {
    const next: MaintenanceWindow = {
      facilityId: values.facilityId,
      startAt: toIso(values.range[0]),
      endAt: toIso(values.range[1]),
      reason: values.reason.trim(),
    };
    preview.mutate(next, {
      onSuccess: (affected) => {
        setRequest(next);
        setData(affected);
        setResolutions(Object.fromEntries(affected.affectedSessions.map((session) => [session.id, suggest(session)])));
        setMoves(
          Object.fromEntries(affected.affectedBookings.map((booking) => [booking.id, booking.alternatives[0]?.id])),
        );
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

  const confirm = () => {
    if (!request || !ready) return;
    setBlocked([]);
    create.mutate(
      {
        ...request,
        bookingMoves: bookings.map((booking) => ({ bookingId: booking.id, facilityId: moves[booking.id]! })),
        sessionResolutions: sessions.map((session) => resolutions[session.id]!),
      },
      {
        onSuccess: (created) => {
          setResult(created);
          setStep(2);
        },
        onError: (error) => setBlocked(errorPayload<MaintenanceAffectedBooking[]>(error, 'bookings') ?? []),
      },
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
          <span className="text-[12.5px] whitespace-nowrap text-sc-muted">
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
              <Button type="primary" disabled={!ready} loading={create.isPending} onClick={confirm}>
                Xác nhận bảo trì
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
      title="Đặt lịch bảo trì"
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
          {preview.isError && (
            <Alert type="error" showIcon className="!mb-4" title={toApiError(preview.error).message} />
          )}
          <Form.Item name="facilityId" label="Sân / phòng" rules={[{ required: true, message: 'Chọn sân / phòng' }]}>
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              loading={facilities.isPending}
              placeholder="Chọn sân / phòng"
              options={(facilities.data ?? [])
                .filter((entry) => entry.isActive)
                .map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="Khoảng thời gian bảo trì"
            rules={[{ required: true, message: 'Chọn khoảng thời gian' }]}
          >
            <DatePicker.RangePicker
              showTime={{ format: 'HH:mm', minuteStep: 15 }}
              format="DD/MM/YYYY HH:mm"
              className="w-full"
              disabledDate={(day) => day.format(DATE_FORMAT) < todayVN()}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input maxLength={200} placeholder="VD: Thay mặt sân, sửa điều hòa" />
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
          {create.isError && blockedCount === 0 && (
            <Alert type="error" showIcon title={describeApiError(create.error)} />
          )}
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
                  <span>Hãy chọn khoảng thời gian khác hoặc liên hệ khách trước khi bảo trì.</span>
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
                  <span>Hãy dời ngày giờ các buổi này.</span>
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
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Không có booking nào bị ảnh hưởng' }}
            />
            {bookings.length > 0 && (
              <p className="mt-3 mb-0 text-[13px] text-sc-muted">
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
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Không có buổi học nào bị ảnh hưởng' }}
            />
          </Card>
        </div>
      )}

      {step === 2 && result && (
        <Result
          status="success"
          title="Đã ghi nhận lịch bảo trì"
          subTitle={`${result.maintenance.facility.name}: chuyển ${result.movedBookings} booking sang sân khác, xử lý ${result.sessionsUpdated} buổi học.`}
        />
      )}
    </Modal>
  );
}
