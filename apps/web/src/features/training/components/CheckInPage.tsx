import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Result, Spin, Table, Tag, type TableColumnsType } from 'antd';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { InfoTable } from '~/components/data/InfoTable';
import { EmptyState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { usersService } from '~/features/users/services/users.service';
import { formatDateTime } from '~/lib/format';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { useCheckIn, useCheckInCheck, useCheckInsToday } from '../hooks/useTraining';
import { CHECKIN_BASIS_LABEL, CHECKIN_BASIS_REASON, type CheckIn } from '../types';

const columns: TableColumnsType<CheckIn> = [
  {
    title: 'Giờ',
    dataIndex: 'checkedInAt',
    width: 90,
    render: (value: string) => (
      <span className="whitespace-nowrap text-sc-muted">{formatDateTime(value).slice(0, 5)}</span>
    ),
  },
  { title: 'Thành viên', dataIndex: ['account', 'fullName'] },
  {
    title: 'Căn cứ',
    dataIndex: 'basis',
    render: (value: CheckIn['basis']) => <Tag className="!m-0">{CHECKIN_BASIS_LABEL[value]}</Tag>,
  },
  { title: 'Nhân viên', dataIndex: ['by', 'fullName'] },
];

/** `/reception/checkin`: find a member, see whether they may enter (BR_4.1) and check them in. */
export function CheckInPage() {
  const { message } = App.useApp();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<string | undefined>();
  const [done, setDone] = useState<CheckIn | null>(null);

  const found = useQuery({
    queryKey: ['training', 'checkin-find', term],
    queryFn: () => usersService.list({ q: term, role: 'MEMBER', status: 'ACTIVE', page: 1, limit: 5 }),
    enabled: term.length > 0,
    staleTime: 0,
  });
  const candidates = found.data?.items ?? [];
  const memberId = picked ?? (candidates.length === 1 ? candidates[0]!.id : undefined);

  const check = useCheckInCheck(memberId);
  const checkIn = useCheckIn();
  const today = useCheckInsToday();

  const search = () => {
    setPicked(undefined);
    setDone(null);
    setTerm(input.trim());
  };

  const confirm = () => {
    if (!memberId) return;
    checkIn.mutate(memberId, {
      onSuccess: (created) => {
        setDone(created);
        message.success(`Đã check-in ${created.account.fullName}`);
      },
      onError: (error) => message.error(describeApiError(error)),
    });
  };

  const result = check.data;

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
                onPressEnter={search}
              />
              <Button type="primary" size="large" className="!rounded-l-none !px-[18px]" onClick={search}>
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
            {candidates.length > 1 && !picked && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-sc-muted">
                  Có {candidates.length} thành viên khớp, chọn một người:
                </span>
                {candidates.map((member) => (
                  <Button key={member.id} block className="!justify-start" onClick={() => setPicked(member.id)}>
                    {member.fullName} · {member.phone ?? member.email}
                  </Button>
                ))}
              </div>
            )}

            {check.isFetching && !result && (
              <div className="flex justify-center py-4">
                <Spin />
              </div>
            )}
            {check.isError && <Alert type="error" showIcon title={toApiError(check.error).message} />}

            {result && done && (
              <Result
                status="success"
                title={`Check-in thành công: ${done.account.fullName}`}
                subTitle={`${formatDateTime(done.checkedInAt)} · ${CHECKIN_BASIS_LABEL[done.basis]}`}
                extra={
                  <Button
                    onClick={() => {
                      setInput('');
                      setTerm('');
                      setPicked(undefined);
                      setDone(null);
                    }}
                  >
                    Check-in người tiếp theo
                  </Button>
                }
              />
            )}

            {result && !done && (
              <>
                <InfoTable
                  rows={[
                    {
                      label: 'Thành viên',
                      value: `${result.member.fullName}${result.member.phone ? ` · ${result.member.phone}` : ''}`,
                    },
                    {
                      label: 'Tài khoản',
                      value:
                        result.member.status === 'ACTIVE' ? (
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
                      label: 'Gói',
                      value: result.gymAccess ? (
                        <>
                          <Tag color="success" className="!m-0">
                            Đang hoạt động
                          </Tag>
                          <Tag color="success" className="!m-0">
                            gym_access
                          </Tag>
                        </>
                      ) : (
                        <span className="text-sc-muted">Không có quyền vào gym</span>
                      ),
                    },
                    {
                      label: 'Booking hôm nay',
                      value: result.bookingsToday.length ? (
                        result.bookingsToday.map((entry) => (
                          <Tag key={entry.id} color="processing" className="!m-0">
                            {entry.facility.name} {entry.startTime}–{entry.endTime}
                          </Tag>
                        ))
                      ) : (
                        <span className="text-sc-muted">Không có</span>
                      ),
                    },
                    {
                      label: 'Buổi học hôm nay',
                      value: result.sessionsToday.length ? (
                        result.sessionsToday.map((entry) => (
                          <Tag key={entry.id} color="purple" className="!m-0">
                            {entry.className} {entry.startTime}
                          </Tag>
                        ))
                      ) : (
                        <span className="text-sc-muted">Không có</span>
                      ),
                    },
                  ]}
                />
                {result.lastCheckInToday && (
                  <Alert
                    type="info"
                    showIcon
                    title={`Thành viên đã check-in lúc ${formatDateTime(result.lastCheckInToday).slice(0, 5)} hôm nay.`}
                  />
                )}
                {result.eligible && result.basis ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-solid border-[#b7eb8f] bg-[#f6ffed] px-3 py-2.5 text-[13.5px] font-medium">
                      <CircleCheck size={15} className="text-[#389e0d]" />
                      Đủ điều kiện: {CHECKIN_BASIS_REASON[result.basis]}
                    </div>
                    <Button type="primary" size="large" block loading={checkIn.isPending} onClick={confirm}>
                      ✓ Xác nhận check-in
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2 rounded-lg border border-solid border-[#ffe58f] bg-[#fffbe6] px-3 py-2.5 text-[13.5px]">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#d48806]" />
                    <div className="flex flex-col gap-1">
                      <b>Chưa đủ điều kiện check-in</b>
                      <ul className="m-0 pl-4 text-[13px] text-sc-ink-2">
                        {result.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
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
