import { ERROR_CODE, type AccountSummary, type CheckIn } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Pagination, Result, Spin, Table, Tag, type TableColumnsType } from 'antd';
import { Calendar, CheckCircle2, Clock, History, TriangleAlert, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { useBookingsOn } from '~/features/bookings/hooks/useBookings';
import { usersService } from '~/features/users/services/users.service';
import { formatDateTime } from '~/lib/format';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useCheckIn, useCheckInsToday } from '../hooks/useTraining';

const timeOf = (iso: string) => formatDateTime(iso).slice(0, 5);

/** Matches candidates against user intent (phone number, email, or full name). */
const matchCandidate = (entry: AccountSummary, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const phone = (entry.phone ?? '').replace(/[\s.\-()]/g, '');
  const email = entry.email.toLowerCase();
  const name = entry.fullName.toLowerCase();

  // Digits: match against phone numbers directly.
  const rawDigits = q.replace(/[\s.\-()]/g, '');
  if (rawDigits.length > 0 && /^\d+$/.test(rawDigits)) {
    if (rawDigits.length < 4) {
      return phone.startsWith(rawDigits);
    }
    return phone.includes(rawDigits);
  }

  // Contains '@': look up strictly by email.
  if (q.includes('@')) {
    return email.includes(q);
  }

  // Text: look up by member name or email username.
  return name.includes(q) || email.includes(q);
};

const columns: TableColumnsType<CheckIn> = [
  {
    title: 'Giờ',
    dataIndex: 'checkedInAt',
    width: 85,
    render: (value: string) => (
      <span className="flex items-center gap-1 font-semibold text-sc-ink tabular-nums text-xs">
        <Clock className="size-3 text-sc-muted" />
        {timeOf(value)}
      </span>
    ),
  },
  {
    title: 'Thành viên',
    dataIndex: ['account', 'fullName'],
    render: (name: string) => (
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
          {name.split(' ').slice(-1)[0]?.[0] ?? 'U'}
        </div>
        <span className="font-medium text-sc-ink truncate block text-xs">{name}</span>
      </div>
    ),
  },
  {
    title: 'Nhân viên',
    dataIndex: ['checkedBy', 'fullName'],
    render: (name: string) => <span className="text-xs text-sc-muted truncate block">{name}</span>,
  },
];

/**
 * `/reception/checkin`: find a member and check them in. The server allows it for an active member with a booking or
 * a class session today (BR_4.1) and explains a refusal, which the page shows as is.
 */
export function CheckInPage() {
  const { message } = App.useApp();
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<string | undefined>();
  const [done, setDone] = useState<CheckIn | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const found = useQuery({
    queryKey: ['training', 'checkin-find', term],
    queryFn: () => usersService.list({ q: term, role: 'MEMBER', page: 1, limit: 15 }),
    enabled: term.length > 0,
    staleTime: 0,
  });
  const candidates = (found.data?.items ?? []).filter((entry) => matchCandidate(entry, term));
  const member =
    candidates.find((entry) => entry.id === picked) ?? (candidates.length === 1 ? candidates[0] : undefined);

  const checkIn = useCheckIn();
  const today = useCheckInsToday();
  const bookings = useBookingsOn(todayVN());
  const memberBookings = (bookings.data ?? []).filter((booking) => booking.account?.id === member?.id);
  const lastCheckIn = today.data?.find((entry) => entry.account.id === member?.id);

  // Danh sách hội viên có lịch đặt hôm nay nhưng chưa check-in
  const checkedInAccountIds = new Set(today.data?.map((c) => c.account.id) ?? []);
  const pendingBookings = (bookings.data ?? []).filter((b) => b.account && !checkedInAccountIds.has(b.account.id));

  // Gom nhóm theo hội viên (tránh 1 người đặt nhiều sân bị nhân bản card) & sắp xếp theo ca gần nhất
  const pendingGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        account: { id: string; fullName: string };
        slots: { id: string; startTime: string; endTime: string; facilityName: string }[];
        earliestTime: string;
      }
    >();

    for (const b of pendingBookings) {
      if (!b.account) continue;
      const existing = map.get(b.account.id);
      const slot = {
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        facilityName: b.facility.name,
      };
      if (existing) {
        existing.slots.push(slot);
        if (b.startTime < existing.earliestTime) {
          existing.earliestTime = b.startTime;
        }
      } else {
        map.set(b.account.id, {
          account: b.account,
          slots: [slot],
          earliestTime: b.startTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.earliestTime.localeCompare(b.earliestTime));
  }, [pendingBookings]);

  const [pendingPage, setPendingPage] = useState(1);
  const PENDING_PAGE_SIZE = 4;
  const paginatedPending = pendingGroups.slice((pendingPage - 1) * PENDING_PAGE_SIZE, pendingPage * PENDING_PAGE_SIZE);

  const reset = (next: string) => {
    setPicked(undefined);
    setDone(null);
    setRefusal(null);
    setTerm(next);
  };

  const selectPending = (acc: { id: string; fullName: string }) => {
    setTerm(acc.fullName);
    setPicked(acc.id);
  };

  const confirm = () => {
    if (!member) return;
    setRefusal(null);
    checkIn.mutate(member.id, {
      onSuccess: (created) => {
        setDone(created);
        message.success(`Đã check-in ${created.account.fullName}`);
      },
      onError: (error) => {
        const apiError = toApiError(error);
        if (apiError.code === ERROR_CODE.CHECKIN_NOT_ALLOWED) setRefusal(apiError.message);
        else message.error(describeApiError(error));
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Check-in thành viên"
        description="Tra cứu và xác nhận lượt vào sân, phòng tập hoặc lớp học hôm nay cho hội viên."
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* Cột trái: Quầy Check-in */}
        <Card className="shadow-sm border border-slate-200/80 dark:border-slate-800" styles={{ body: { padding: 20 } }}>
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-sc-border pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <UserCheck className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-sc-ink leading-tight m-0">Xác thực hội viên</h3>
                <span className="text-xs text-sc-muted">Tra cứu nhanh theo SĐT, email hoặc tên</span>
              </div>
            </div>
            {member && (
              <Button size="small" onClick={() => reset('')}>
                Đổi người khác
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <SearchInput
              size="large"
              allowClear
              value={term}
              placeholder="Nhập SĐT, email hoặc tên thành viên để check-in…"
              maxLength={255}
              onChange={reset}
              loading={found.isFetching}
              autoFocus
            />

            {found.isFetching && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-sc-muted">
                <Spin size="small" />
                <span>Đang tìm kiếm hội viên…</span>
              </div>
            )}

            {found.isError && <Alert type="error" showIcon title={toApiError(found.error).message} />}

            {term && found.isSuccess && candidates.length === 0 && (
              <Alert
                type="warning"
                showIcon
                title="Không tìm thấy hội viên nào khớp"
                description="Vui lòng kiểm tra lại số điện thoại hoặc email của khách."
              />
            )}

            {/* Trạng thái ban đầu: Hiện danh sách khách có lịch đặt hôm nay chờ check-in */}
            {!term && !member && !done && (
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sc-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" />
                    Lịch đặt hôm nay chờ check-in
                  </span>
                  <Tag color="blue" className="!m-0 text-xs font-semibold tabular-nums">
                    {pendingGroups.length} khách ({pendingBookings.length} ca đặt)
                  </Tag>
                </div>

                {paginatedPending.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-2">
                      {paginatedPending.map((item) => (
                        <div
                          key={item.account.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-primary/40 transition-colors shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-bold text-xs tabular-nums">
                              {item.earliestTime}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm text-sc-ink truncate block">
                                {item.account.fullName}
                              </span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.slots.map((s) => (
                                  <span
                                    key={s.id}
                                    className="text-[11px] text-sc-muted bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate"
                                  >
                                    {s.facilityName} ({s.startTime}–{s.endTime})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => selectPending(item.account)}
                            className="font-medium shrink-0 ml-2"
                          >
                            Check-in
                          </Button>
                        </div>
                      ))}
                    </div>

                    {pendingGroups.length > PENDING_PAGE_SIZE && (
                      <div className="flex justify-center pt-2">
                        <Pagination
                          size="small"
                          current={pendingPage}
                          pageSize={PENDING_PAGE_SIZE}
                          total={pendingGroups.length}
                          onChange={setPendingPage}
                          showSizeChanger={false}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <EmptyState
                      title="Không có lịch đặt nào chờ check-in"
                      description="Tất cả khách đặt trước hôm nay đã vào sân hoặc chưa có lịch đặt mới."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Danh sách ứng viên khớp (nhiều hơn 1 người) */}
            {candidates.length > 1 && !member && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-sc-muted">
                  <span>
                    Tìm thấy <b>{candidates.length}</b> thành viên phù hợp:
                  </span>
                  <span className="text-primary font-medium">Bấm để chọn</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-0.5">
                  {candidates.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setPicked(entry.id)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer shadow-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {entry.fullName.split(' ').slice(-1)[0]?.[0] ?? 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-sc-ink truncate group-hover:text-primary transition-colors">
                            {entry.fullName}
                          </div>
                          <div className="text-xs text-sc-muted flex items-center gap-2">
                            {entry.phone && <span className="tabular-nums">{entry.phone}</span>}
                            {entry.phone && <span>·</span>}
                            <span className="truncate">{entry.email}</span>
                          </div>
                        </div>
                      </div>
                      <Tag color={entry.status === 'ACTIVE' ? 'success' : 'default'} className="!m-0 text-[11px]">
                        {entry.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Check-in thành công */}
            {member && done && (
              <div className="py-4">
                <Result
                  status="success"
                  title={
                    <span className="text-base font-bold text-sc-ink">
                      Check-in thành công: {done.account.fullName}
                    </span>
                  }
                  subTitle={
                    <span className="text-xs text-sc-muted">
                      Thời gian xác nhận vào sân: {formatDateTime(done.checkedInAt)}
                    </span>
                  }
                  extra={
                    <Button
                      type="primary"
                      size="large"
                      className="font-semibold !px-6"
                      onClick={() => {
                        reset('');
                      }}
                    >
                      Check-in khách tiếp theo
                    </Button>
                  }
                />
              </div>
            )}

            {/* Chi tiết hội viên đã chọn & Xác nhận check-in */}
            {member && !done && (
              <div className="flex flex-col gap-3.5 pt-1">
                {/* Thông tin hồ sơ hội viên */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      {member.fullName.split(' ').slice(-1)[0]?.[0] ?? 'M'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sc-ink text-base truncate">{member.fullName}</span>
                        <Tag color={member.status === 'ACTIVE' ? 'success' : 'error'} className="!m-0 text-[11px]">
                          {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Không hoạt động'}
                        </Tag>
                      </div>
                      <div className="text-xs text-sc-muted flex items-center gap-2 mt-0.5">
                        {member.phone && <span className="tabular-nums font-medium">{member.phone}</span>}
                        {member.phone && <span>·</span>}
                        <span className="truncate">{member.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tình trạng Booking / Lịch tập hôm nay */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-sc-ink uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      Lịch đặt hôm nay
                    </span>
                    <span className="text-xs text-sc-muted">
                      {memberBookings.length > 0 ? `${memberBookings.length} lịch đặt` : 'Không có lịch đặt'}
                    </span>
                  </div>

                  {memberBookings.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {memberBookings.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                            <span>{entry.facility.name}</span>
                          </div>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                            {entry.startTime} – {entry.endTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 px-3 py-2.5 text-xs text-sc-muted flex items-center gap-2">
                      <Clock className="size-3.5 text-slate-400 shrink-0" />
                      <span>Hội viên không có lịch đặt sân hôm nay. Check-in dựa trên buổi học hoặc gói tập.</span>
                    </div>
                  )}
                </div>

                {/* Cảnh báo đã check-in trước đó */}
                {lastCheckIn && (
                  <Alert
                    type="info"
                    showIcon
                    title={`Đã check-in lúc ${timeOf(lastCheckIn.checkedInAt)} hôm nay.`}
                    description="Khách có thể check-in thêm lượt nếu có ca tập tiếp theo."
                  />
                )}

                {/* Lỗi từ chối check-in từ server */}
                {refusal && (
                  <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-900 dark:text-amber-200">
                    <TriangleAlert className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex flex-col gap-0.5">
                      <b className="font-semibold text-xs uppercase tracking-wide">Chưa đủ điều kiện check-in</b>
                      <span className="text-xs leading-relaxed">{refusal}</span>
                    </div>
                  </div>
                )}

                {/* Nút xác nhận check-in */}
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={checkIn.isPending}
                  onClick={confirm}
                  className="!h-11 font-bold text-sm shadow-sm"
                >
                  ✓ Xác nhận check-in cho {member.fullName}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Cột phải: Lịch sử Check-in hôm nay */}
        <Card
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <span className="font-bold text-sc-ink">Check-in hôm nay</span>
              </div>
              <Tag color="cyan" className="!m-0 text-xs font-semibold tabular-nums">
                {today.data?.length ?? 0} lượt
              </Tag>
            </div>
          }
          className="shadow-sm border border-slate-200/80 dark:border-slate-800 h-full"
          styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}
        >
          <Table<CheckIn>
            rowKey="id"
            columns={columns}
            dataSource={today.data}
            loading={today.isFetching && !today.data}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <div className="py-12">
                  <EmptyState
                    title="Chưa có lượt check-in nào hôm nay"
                    description="Các lượt khách quét mã hoặc check-in thành công sẽ hiển thị tại đây."
                  />
                </div>
              ),
            }}
          />
        </Card>
      </div>
    </>
  );
}
