import { Alert } from 'antd';
import { Check, ChevronRight, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { FACILITY_TYPE_LABEL } from '~/constants/facility';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import type { SportFacilityChoice } from '../hooks/useSportFacilityChoice';

interface SportFacilityStepsProps {
  choice: SportFacilityChoice;
  /** Label of the last step, shown once a facility is picked. */
  finalLabel: string;
  /** Content of the last step; only rendered once both sport and facility are chosen. */
  children: ReactNode;
}

/** Bộ môn → Sân / phòng → `finalLabel`: each step shows only what it needs, and finished steps can be reopened. */
export function SportFacilitySteps({ choice, finalLabel, children }: SportFacilityStepsProps) {
  const { sport, facility, step } = choice;

  if (choice.isPending) return <PageLoading />;
  if (choice.error) return <ErrorState message={toApiError(choice.error).message} onRetry={choice.refetch} />;
  if (!choice.sportOptions.length) {
    return <Alert type="info" showIcon title="Chưa có sân hoặc phòng nào nhận đặt." />;
  }

  const steps = [
    { label: 'Bộ môn', value: sport?.name },
    { label: 'Sân / phòng', value: facility?.name },
    { label: finalLabel, value: undefined },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0" aria-label="Các bước đặt sân">
        {steps.map((entry, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={entry.label} className="flex items-center gap-2">
              {index > 0 && <ChevronRight size={16} className="text-sc-muted" aria-hidden />}
              <button
                type="button"
                disabled={!done}
                onClick={() => choice.goToStep(index)}
                aria-current={active ? 'step' : undefined}
                title={done ? `Đổi ${entry.label.toLowerCase()}` : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14.5px] [transition:all_0.12s] ${
                  active
                    ? 'border-sc-ink bg-sc-ink text-white'
                    : done
                      ? 'cursor-pointer border-sc-border bg-white text-sc-ink hover:border-sc-primary-border hover:bg-sc-primary-soft'
                      : 'border-sc-border-soft bg-transparent text-sc-muted'
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[12px] font-bold ${
                    active ? 'bg-white text-sc-ink' : done ? 'bg-sc-ink text-white' : 'bg-sc-border-soft'
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : index + 1}
                </span>
                {done && entry.value ? (
                  <>
                    <span className="font-semibold">{entry.value}</span>
                    <Pencil size={12} className="opacity-60" aria-hidden />
                  </>
                ) : (
                  entry.label
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 font-display text-[17px] font-bold tracking-wide uppercase">Bạn muốn chơi môn gì?</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {choice.sportOptions.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => choice.pickSport(entry.id)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-sc-border bg-white p-3 text-left [transition:all_0.12s] hover:border-sc-primary-border hover:bg-sc-primary-soft"
              >
                {entry.iconUrl ? (
                  <img src={entry.iconUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sc-paper font-display text-[18px] font-bold text-sc-ink">
                    {entry.name.charAt(0)}
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-sc-ink">{entry.name}</span>
                  <span className="text-[13.5px] text-sc-muted">
                    {choice.facilitiesOf(entry.id).length} sân / phòng
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 font-display text-[17px] font-bold tracking-wide uppercase">
            Chọn sân / phòng {sport ? `cho ${sport.name}` : ''}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {choice.sportFacilities.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => choice.pickFacility(entry.id)}
                className="flex cursor-pointer flex-col gap-1 rounded-xl border border-sc-border bg-white p-4 text-left [transition:all_0.12s] hover:border-sc-primary-border hover:bg-sc-primary-soft"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-[17px] font-bold text-sc-ink uppercase">
                    {entry.name}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-sc-muted" aria-hidden />
                </span>
                <span className="text-[13.5px] text-sc-muted">
                  {FACILITY_TYPE_LABEL[entry.type]} · Tối đa {entry.capacityPerSlot} người/slot
                </span>
                {entry.description && (
                  <span className="line-clamp-2 text-[14px] text-sc-ink-2">{entry.description}</span>
                )}
                <span className="mt-1 font-semibold text-sc-ink tabular-nums">
                  {formatVND(entry.pricePerSlot)}
                  <span className="font-normal text-sc-muted"> / slot</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && children}
    </div>
  );
}
