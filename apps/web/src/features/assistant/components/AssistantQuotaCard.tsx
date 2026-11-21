import type { MemberAssistantQuota } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Popconfirm, Progress, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { SearchInput } from '~/components/form/SearchInput';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { formatDate } from '~/lib/format';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { monthLabel, useAssistantQuotas, useResetAssistantQuota } from '../hooks/useAssistantQuotas';

/** Manager: members who asked the AI assistant this month, each one resettable, plus a reset for everyone. */
export function AssistantQuotaCard() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [q, setQ] = useState('');
  const quotas = useAssistantQuotas({ page, limit, q: q || undefined });
  const reset = useResetAssistantQuota();
  const resetting = (accountId?: string) => reset.isPending && reset.variables === accountId;

  const columns: TableColumnsType<MemberAssistantQuota> = [
    {
      title: 'Hội viên',
      key: 'member',
      render: (_, member) => (
        <div className="flex min-w-0 flex-col">
          <Link to="/admin/users/$userId" params={{ userId: member.id }} className="font-semibold">
            {member.fullName}
          </Link>
          <span className="truncate text-[13.5px] text-sc-muted">{member.email}</span>
        </div>
      ),
    },
    {
      title: 'Đã dùng',
      key: 'used',
      width: 240,
      render: (_, { used, limit: max }) => (
        <div className="flex items-center gap-3">
          <Progress
            percent={max > 0 ? Math.min(100, (used / max) * 100) : 100}
            status={used >= max ? 'exception' : 'normal'}
            showInfo={false}
            size="small"
            className="!m-0 flex-1"
          />
          <span className="font-mono text-[13.5px] whitespace-nowrap">
            {used}/{max}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, member) => (
        <Popconfirm
          title={`Reset lượt hỏi AI của ${member.fullName}?`}
          description="Hội viên sẽ có lại đủ lượt hỏi của tháng này."
          okText="Reset"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          onConfirm={() => reset.mutateAsync(member.id).catch(() => undefined)}
        >
          <Button size="small" loading={resetting(member.id)} disabled={reset.isPending && !resetting(member.id)}>
            Reset
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const data = quotas.data;

  return (
    <Card className="!mt-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Lượt hỏi trợ lý AI</SectionTitle>
          <p className="-mt-2 mb-0 text-[15px] text-sc-muted">
            {data
              ? `Hội viên đã hỏi trợ lý trong tháng ${monthLabel(data.period)}. Tự làm mới ngày ${formatDate(data.resetsOn)}.`
              : 'Hội viên đã hỏi trợ lý trong tháng này.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Tìm tên hoặc email"
            maxLength={100}
            className="!w-60"
          />
          <Popconfirm
            title="Reset lượt hỏi AI của mọi hội viên?"
            description="Mọi hội viên sẽ có lại đủ lượt hỏi của tháng này. Không thể hoàn tác."
            okText="Reset tất cả"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => reset.mutateAsync(undefined).catch(() => undefined)}
          >
            <Button danger loading={resetting(undefined)} disabled={reset.isPending && !resetting(undefined)}>
              Reset tất cả
            </Button>
          </Popconfirm>
        </div>
      </div>
      <DataTable<MemberAssistantQuota>
        columns={columns}
        data={data}
        isLoading={quotas.isPending}
        error={quotas.error}
        onRetry={() => void quotas.refetch()}
        page={page}
        limit={limit}
        onPageChange={(nextPage, nextLimit) => {
          setPage(nextLimit === limit ? nextPage : 1);
          setLimit(nextLimit);
        }}
        emptyTitle={q ? 'Không tìm thấy hội viên' : 'Chưa ai hỏi trợ lý tháng này'}
        emptyDescription={q ? 'Thử tên hoặc email khác.' : 'Hội viên hỏi trợ lý AI sẽ hiện ở đây.'}
      />
    </Card>
  );
}
