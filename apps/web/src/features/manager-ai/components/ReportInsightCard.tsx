import type { ReportRangeQuery, ReportType } from '@sports-center/shared';
import { Alert, Button } from 'antd';
import { Sparkles } from 'lucide-react';
import { describeApiError } from '~/lib/http-errors';
import { useReportInsight } from '../hooks/useManagerAi';
import { AiPanel } from './AiPanel';

interface ReportInsightCardProps {
  report: ReportType;
  range: ReportRangeQuery;
}

/** "Nhận xét bằng AI" above the report tabs: written only when asked, for the tab and range on screen. */
export function ReportInsightCard({ report, range }: ReportInsightCardProps) {
  const insight = useReportInsight();
  const run = () => insight.mutate({ report, ...range });

  if (insight.isIdle) {
    return (
      <div className="mb-4 flex justify-end">
        <Button icon={<Sparkles size={15} />} onClick={run}>
          Nhận xét bằng AI
        </Button>
      </div>
    );
  }
  return (
    <AiPanel
      className="mb-4"
      title="Nhận xét báo cáo"
      ai={insight.data?.ai}
      loading={insight.isPending}
      onRefresh={run}
    >
      {insight.isError ? (
        <Alert type="warning" showIcon message={describeApiError(insight.error)} />
      ) : (
        <p className="m-0 text-[14.5px] leading-relaxed whitespace-pre-line text-sc-ink">{insight.data?.text}</p>
      )}
    </AiPanel>
  );
}
