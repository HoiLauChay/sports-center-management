import { Button, Card, Popconfirm, Progress } from 'antd';
import { Sparkles } from 'lucide-react';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMemberAssistantQuota, useResetAssistantQuota } from '../hooks/useAssistantQuotas';

/** Manager, member detail: the member's AI questions this month, with a reset. */
export function MemberAssistantBlock({ memberId }: { memberId: string }) {
  const quota = useMemberAssistantQuota(memberId);
  const reset = useResetAssistantQuota();
  const data = quota.data;

  return (
    <Card>
      <SectionTitle>Trợ lý AI</SectionTitle>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0 flex-1 text-[15px]">
          {quota.isPending ? (
            <span className="text-sc-muted">Đang tải…</span>
          ) : quota.isError ? (
            <span className="text-sc-error">{toApiError(quota.error).message}</span>
          ) : (
            data && (
              <>
                <div>
                  Đã hỏi <b>{data.used}</b>/{data.limit} lượt tháng này
                </div>
                <Progress
                  percent={data.limit > 0 ? Math.min(100, (data.used / data.limit) * 100) : 100}
                  status={data.used >= data.limit ? 'exception' : 'normal'}
                  showInfo={false}
                  size="small"
                  className="!m-0"
                />
                <div className="mt-0.5 text-[14px] text-sc-muted">Tự làm mới ngày {formatDate(data.resetsOn)}</div>
              </>
            )
          )}
        </div>
      </div>
      {data && (
        <div className="mt-4">
          <Popconfirm
            title="Reset lượt hỏi AI của hội viên này?"
            description="Hội viên sẽ có lại đủ lượt hỏi của tháng này."
            okText="Reset"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => reset.mutateAsync(memberId).catch(() => undefined)}
          >
            <Button loading={reset.isPending} disabled={data.used === 0}>
              Reset lượt hỏi
            </Button>
          </Popconfirm>
        </div>
      )}
    </Card>
  );
}
