import { Alert, Button, Tag } from 'antd';
import { CircleCheck, CircleX, Sparkles, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { useAssignCoach } from '~/features/classes/hooks/useClassAdmin';
import { describeApiError } from '~/lib/http-errors';
import { useClassReview, useCoachSuggestions } from '../hooks/useManagerAi';
import { AiPanel } from './AiPanel';

const RECOMMENDATION = {
  APPROVE: { color: 'success', label: 'Nên duyệt' },
  REJECT: { color: 'error', label: 'Nên từ chối' },
  REVIEW: { color: 'warning', label: 'Cần xem kỹ' },
} as const;

/** Rule checks plus an AI summary for a class waiting for approval; deciding stays on the page's own buttons. */
export function ClassReviewPanel({ classId, className = '' }: { classId: string; className?: string }) {
  const review = useClassReview();
  const run = () => review.mutate(classId);

  if (review.isIdle) {
    return (
      <div className={`flex justify-end ${className}`}>
        <Button icon={<Sparkles size={15} />} onClick={run}>
          Kiểm tra lớp bằng AI
        </Button>
      </div>
    );
  }
  const data = review.data;
  return (
    <AiPanel
      className={className}
      title="Kiểm tra trước khi duyệt"
      ai={data?.ai}
      loading={review.isPending}
      onRefresh={run}
      extra={
        data && <Tag color={RECOMMENDATION[data.recommendation].color}>{RECOMMENDATION[data.recommendation].label}</Tag>
      }
    >
      {review.isError ? (
        <Alert type="warning" showIcon message={describeApiError(review.error)} />
      ) : (
        data && (
          <>
            <p className="m-0 text-[14.5px] leading-relaxed text-sc-ink">{data.summary}</p>
            <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
              {data.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2 text-[13.5px]">
                  {check.ok ? (
                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-sc-success" />
                  ) : (
                    <CircleX size={16} className="mt-0.5 shrink-0 text-sc-error" />
                  )}
                  <span>
                    <b>{check.label}:</b> {check.detail}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </AiPanel>
  );
}

/** Ranked coaches for a class without one; picking still goes through the normal assign endpoint. */
export function CoachSuggestionsPanel({ classId, className = '' }: { classId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const suggestions = useCoachSuggestions(classId, open);
  const assign = useAssignCoach(classId);

  if (!open) {
    return (
      <div className={`flex justify-end ${className}`}>
        <Button icon={<UserRoundCheck size={15} />} onClick={() => setOpen(true)}>
          Gợi ý HLV phù hợp
        </Button>
      </div>
    );
  }
  const candidates = suggestions.data?.candidates ?? [];
  return (
    <AiPanel
      className={className}
      title="HLV phù hợp"
      ai={suggestions.data ? true : undefined}
      loading={suggestions.isPending}
    >
      {suggestions.isError ? (
        <Alert type="warning" showIcon message={describeApiError(suggestions.error)} />
      ) : candidates.length === 0 ? (
        <p className="m-0 text-[14px] text-sc-muted">
          Chưa có HLV nào đăng ký hoặc có chuyên môn được duyệt cho bộ môn này.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {candidates.map((candidate) => (
            <li
              key={candidate.coach.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  {candidate.coach.fullName}
                  <Tag color={candidate.available ? 'green' : 'default'}>{candidate.score} điểm</Tag>
                </span>
                <span className="block text-[13px] text-sc-muted">{candidate.reasons.join(' · ')}</span>
              </span>
              <Button
                size="small"
                type="primary"
                disabled={!candidate.available}
                loading={
                  assign.isPending && assign.variables && 'coachId' in assign.variables
                    ? assign.variables.coachId === candidate.coach.id
                    : false
                }
                onClick={() =>
                  assign.mutate(
                    candidate.registrationId
                      ? { registrationId: candidate.registrationId }
                      : { coachId: candidate.coach.id },
                  )
                }
              >
                Chọn HLV
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AiPanel>
  );
}
