import { ERROR_CODE, type CheckIn } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Result, Spin, Table, Tag, type TableColumnsType } from 'antd';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { InfoTable } from '~/components/data/InfoTable';
import { EmptyState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { useBookingsOn } from '~/features/bookings/hooks/useBookings';
import { usersService } from '~/features/users/services/users.service';
import { formatDateTime } from '~/lib/format';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useCheckIn, useCheckInsToday } from '../hooks/useTraining';

const timeOf = (iso: string) => formatDateTime(iso).slice(0, 5);

const columns: TableColumnsType<CheckIn> = [
  {
    title: 'Giờ',
    dataIndex: 'checkedInAt',
    width: 90,
    render: (value: string) => <span className="whitespace-nowrap text-sc-muted">{timeOf(value)}</span>,
  },
  { title: 'Thành viên', dataIndex: ['account', 'fullName'] },
  { title: 'Nhân viên', dataIndex: ['checkedBy', 'fullName'] },
];

/**
 * `/reception/checkin`: find a member and check them in. The server allows it for an active member with a booking or
 * a class session today (BR_4.1) and explains a refusal, which the page shows as is.
 */
export function CheckInPage() {
  const { message } = App.useApp();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<string | undefined>();
  const [done, setDone] = useState<CheckIn | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const found = useQuery({
    queryKey: ['training', 'checkin-find', term],
    queryFn: () => usersService.list({ q: term, role: 'MEMBER', page: 1, limit: 5 }),
    enabled: term.length > 0,
    staleTime: 0,
  });
  const candidates = found.data?.items ?? [];
  const member =
    candidates.find((entry) => entry.id === picked) ?? (candidates.length === 1 ? candidates[0] : undefined);

  const checkIn = useCheckIn();
  const today = useCheckInsToday();
  const bookings = useBookingsOn(todayVN());
  const memberBookings = (bookings.data ?? []).filter((booking) => booking.account?.id === member?.id);
  const lastCheckIn = today.data?.find((entry) => entry.account.id === member?.id);

  const reset = (next: string) => {
    setPicked(undefined);
    setDone(null);
    setRefusal(null);
    setTerm(next);
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
      <PageHeader title="Check-in thành viên" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card styles={{ body: { padding: 20 } }}>
          <div className="flex flex-col gap-3.5">
            <div className="flex">
              <Input
                size="large"
                allowClear
                value={input}
                placeholder="SĐT, email hoặc tên thành viên"
                className="!rounded-r-none"
                onChange={(event) => setInput(event.target.value)}
                onPressEnter={() => reset(input.trim())}
              />
              <Button
                type="primary"
                size="large"
                className="!rounded-l-none !px-[18px]"
                onClick={() => reset(input.trim())}
              >
                Tìm
              </Button>
            </div>

            {found.isFetching && (
              <div className="flex justify-center py-2">
                <Spin />
              </div>
            )}
            {found.isError && <Alert type="error" showIcon title={toApiError(found.error).message} />}
            {term && found.isSuccess && candidates.length === 0 && (
              <Alert type="warning" showIcon title="Không tìm thấy thành viên nào khớp." />
            )}
            {candidates.length > 1 && !member && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-sc-muted">
                  Có {candidates.length} thành viên khớp, chọn một người:
                </span>
                {candidates.map((entry) => (
                  <Button key={entry.id} block className="!justify-start" onClick={() => setPicked(entry.id)}>
                    {entry.fullName} · {entry.phone ?? entry.email}
                  </Button>
                ))}
              </div>
            )}

            {member && done && (
              <Result
                status="success"
                title={`Check-in thành công: ${done.account.fullName}`}
                subTitle={formatDateTime(done.checkedInAt)}
                extra={
                  <Button
                    onClick={() => {
                      setInput('');
                      reset('');
                    }}
                  >
                    Check-in người tiếp theo
                  </Button>
                }
              />
            )}

            {member && !done && (
              <>
                <InfoTable
                  rows={[
                    {
                      label: 'Thành viên',
                      value: `${member.fullName}${member.phone ? ` · ${member.phone}` : ''}`,
                    },
                    {
                      label: 'Tài khoản',
                      value:
                        member.status === 'ACTIVE' ? (
                          <Tag color="success" className="!m-0">
                            Đang hoạt động
                          </Tag>
                        ) : (
                          <Tag color="error" className="!m-0">
                            Không hoạt động
                          </Tag>
                        ),
                    },
                    {
                      label: 'Booking hôm nay',
                      value: memberBookings.length ? (
                        memberBookings.map((entry) => (
                          <Tag key={entry.id} color="processing" className="!m-0">
                            {entry.facility.name} {entry.startTime}–{entry.endTime}
                          </Tag>
                        ))
                      ) : (
                        <span className="text-sc-muted">Không có</span>
                      ),
                    },
                  ]}
                />
                {lastCheckIn && (
                  <Alert
                    type="info"
                    showIcon
                    title={`Thành viên đã check-in lúc ${timeOf(lastCheckIn.checkedInAt)} hôm nay.`}
                  />
                )}
                {refusal && (
                  <div className="flex gap-2 rounded-lg border border-solid border-[#ffe58f] bg-[#fffbe6] px-3 py-2.5 text-[13.5px]">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#d48806]" />
                    <div className="flex flex-col gap-1">
                      <b>Chưa đủ điều kiện check-in</b>
                      <span className="text-[13px] text-sc-ink-2">{refusal}</span>
                    </div>
                  </div>
                )}
                <Button type="primary" size="large" block loading={checkIn.isPending} onClick={confirm}>
                  ✓ Xác nhận check-in
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card
          title={`Check-in hôm nay (${today.data?.length ?? 0})`}
          styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}
        >
          <Table<CheckIn>
            rowKey="id"
            columns={columns}
            dataSource={today.data}
            loading={today.isFetching && !today.data}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            locale={{ emptyText: <EmptyState title="Chưa có lượt check-in nào hôm nay" /> }}
          />
        </Card>
      </div>
    </>
  );
}
