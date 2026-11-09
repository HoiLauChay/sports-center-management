import { Link } from '@tanstack/react-router';
import { Alert } from 'antd';
import { TicketPercent } from 'lucide-react';
import { formatDate } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { useWeeklyDigest } from '../hooks/useManagerAi';
import { AiPanel } from './AiPanel';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function Change({ value }: { value: number | null }) {
  if (value === null) return null;
  const tone = value > 0 ? 'text-sc-success' : value < 0 ? 'text-sc-error' : 'text-sc-muted';
  return (
    <span className={`text-[12.5px] font-semibold tabular-nums ${tone}`}>
      {value > 0 ? '+' : ''}
      {value.toLocaleString('vi-VN')}%
    </span>
  );
}

/** Last week at a glance on the manager dashboard; the server writes it once a week and caches it. */
export function WeeklyDigestCard({ className = '' }: { className?: string }) {
  const digest = useWeeklyDigest();
  const data = digest.data;
  return (
    <AiPanel
      className={className}
      title={data ? `Tóm tắt tuần ${formatDate(data.from)} – ${formatDate(data.to)}` : 'Tóm tắt tuần trước'}
      ai={data?.ai}
      loading={digest.isPending}
    >
      {digest.isError ? (
        <Alert type="warning" showIcon message={describeApiError(digest.error)} />
      ) : (
        data && (
          <>
            <p className="m-0 text-[14.5px] leading-relaxed text-sc-ink">{data.text}</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 xl:grid-cols-7">
              {data.highlights.map(({ label, value, change }) => (
                <li key={label} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-white/70 px-2.5 py-2">
                  <span className="truncate text-[12px] text-sc-muted">{label}</span>
                  <span className="flex items-baseline gap-1.5">
                    <b className="truncate text-[15px] tabular-nums">{value}</b>
                    <Change value={change} />
                  </span>
                </li>
              ))}
            </ul>
            {data.promos.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-sc-ink-2">
                <TicketPercent size={15} className="text-sc-primary" />
                <span>Giờ vắng nên khuyến mãi:</span>
                {data.promos.map((promo) => (
                  <span key={`${promo.facility.id}-${promo.weekday}-${promo.startTime}`}>
                    {promo.facility.name} {WEEKDAYS[promo.weekday]} {promo.startTime} ({promo.occupancyPct}%)
                  </span>
                ))}
                <Link to="/admin/assistant" className="font-semibold">
                  Tạo mã với Trợ lý AI
                </Link>
              </div>
            )}
          </>
        )
      )}
    </AiPanel>
  );
}
