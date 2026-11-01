import type { RosterEntry, TrainingPlan } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Card, Collapse, Segmented, Spin, Tag } from 'antd';
import { ClipboardList, HeartPulse, Sparkles, Target, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { PlanView } from '~/features/training/components/class/PlanForm';
import { useClassPlans, useRoster } from '~/features/training/hooks/useClassTraining';
import { formatDateTime, initialsOf } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';

type StudentPlanFilter = 'ALL' | 'CUSTOM';

interface StudentPlanRow {
  accountId: string;
  fullName: string;
  rosterEntry: RosterEntry | null;
  plan: TrainingPlan | null;
}

interface ManagerClassPlansTabProps {
  classId: string;
}

/** Read-only view on `/admin/classes/$classId` for managers to supervise the shared class plan and per-student plans. */
export function ManagerClassPlansTab({ classId }: ManagerClassPlansTabProps) {
  const plans = useClassPlans(classId);
  const roster = useRoster(classId);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StudentPlanFilter>('ALL');

  const studentRows = useMemo<StudentPlanRow[]>(() => {
    const planByAccount = new Map<string, TrainingPlan>();
    for (const plan of plans.data?.memberPlans ?? []) {
      if (plan.account) {
        planByAccount.set(plan.account.id, plan);
      }
    }

    const seen = new Set<string>();
    const combined: StudentPlanRow[] = [];

    for (const entry of roster.data ?? []) {
      seen.add(entry.account.id);
      combined.push({
        accountId: entry.account.id,
        fullName: entry.account.fullName,
        rosterEntry: entry,
        plan: planByAccount.get(entry.account.id) ?? null,
      });
    }

    for (const [accountId, plan] of planByAccount.entries()) {
      if (!seen.has(accountId) && plan.account) {
        combined.push({
          accountId,
          fullName: plan.account.fullName,
          rosterEntry: null,
          plan,
        });
      }
    }

    return combined.sort(
      (a, b) => Number(Boolean(b.plan)) - Number(Boolean(a.plan)) || a.fullName.localeCompare(b.fullName, 'vi'),
    );
  }, [plans.data?.memberPlans, roster.data]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return studentRows.filter((row) => {
      if (filter === 'CUSTOM' && !row.plan) return false;
      if (keyword && !row.fullName.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [studentRows, filter, query]);

  if (plans.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  if (plans.isError) {
    return <ErrorState message={toApiError(plans.error).message} onRetry={() => void plans.refetch()} />;
  }

  const classPlan = plans.data.classPlan;
  const customCount = plans.data.memberPlans.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sc-border-soft bg-sc-paper/55 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-primary-soft text-sc-primary">
              <ClipboardList size={18} />
            </span>
            <div>
              <div className="text-[13px] font-semibold tracking-wide text-sc-muted uppercase">
                Giáo án chung của lớp
              </div>
              <div className="text-[14.5px] font-semibold text-sc-ink">
                {classPlan ? `Cập nhật ${formatDateTime(classPlan.updatedAt)}` : 'HLV chưa thiết lập giáo án chung'}
              </div>
            </div>
          </div>
          <Tag color={classPlan ? 'success' : 'default'} className="!m-0">
            {classPlan ? 'Đã có giáo án' : 'Chưa có'}
          </Tag>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-sc-border-soft bg-sc-paper/55 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-primary-soft text-sc-primary">
              <UserCheck size={18} />
            </span>
            <div>
              <div className="text-[13px] font-semibold tracking-wide text-sc-muted uppercase">
                Lộ trình cá nhân hóa
              </div>
              <div className="text-[14.5px] font-semibold text-sc-ink">
                {customCount}/{studentRows.length} học viên có lộ trình tập luyện riêng
              </div>
            </div>
          </div>
          <Tag color={customCount > 0 ? 'processing' : 'default'} className="!m-0">
            {customCount} lộ trình riêng
          </Tag>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card size="small">
          <SectionTitle>Kế hoạch tập luyện chung</SectionTitle>
          {classPlan ? (
            <div className="rounded-xl border border-sc-border-soft bg-sc-paper/45 p-3.5">
              <PlanView plan={classPlan} />
            </div>
          ) : (
            <EmptyState
              title="Chưa có kế hoạch tập luyện chung"
              description="Huấn luyện viên phụ trách lớp chưa lưu mục tiêu và giáo án chung cho lớp này."
            />
          )}
        </Card>

        <Card size="small" loading={roster.isPending && studentRows.length === 0}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Kế hoạch riêng từng học viên</SectionTitle>
            <Segmented<StudentPlanFilter>
              size="small"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: `Tất cả (${studentRows.length})` },
                { value: 'CUSTOM', label: `Có lộ trình riêng (${customCount})` },
              ]}
            />
          </div>

          {studentRows.length > 0 && (
            <div className="mb-3">
              <SearchInput
                placeholder="Tìm theo tên học viên..."
                value={query}
                onChange={setQuery}
                className="w-full"
              />
            </div>
          )}

          {filteredRows.length === 0 ? (
            <EmptyState
              title={
                studentRows.length === 0
                  ? 'Lớp chưa có học viên đăng ký'
                  : filter === 'CUSTOM'
                    ? 'Chưa có học viên nào được thiết lập lộ trình riêng'
                    : 'Không tìm thấy học viên phù hợp'
              }
            />
          ) : (
            <Collapse
              defaultActiveKey={filteredRows
                .filter((row) => row.plan !== null)
                .slice(0, 2)
                .map((row) => row.accountId)}
              items={filteredRows.map((row) => ({
                key: row.accountId,
                label: (
                  <div className="flex flex-wrap items-center justify-between gap-2 pr-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-[12px] font-bold text-sc-primary">
                        {initialsOf(row.fullName)}
                      </span>
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: row.accountId }}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold text-sc-ink hover:text-sc-primary"
                      >
                        {row.fullName}
                      </Link>
                    </div>
                    {row.plan ? (
                      <Tag color="success" className="!m-0">
                        Lộ trình riêng
                      </Tag>
                    ) : (
                      <Tag className="!m-0">Theo giáo án chung</Tag>
                    )}
                  </div>
                ),
                children: (
                  <div className="flex flex-col gap-3 text-[14px]">
                    {(row.rosterEntry?.fitnessGoals || row.rosterEntry?.healthNotes) && (
                      <div className="grid gap-2 rounded-lg border border-sc-border-soft bg-sc-paper/55 p-3 text-[13.5px] sm:grid-cols-2">
                        {row.rosterEntry.fitnessGoals && (
                          <div className="flex items-start gap-2">
                            <Target size={14} className="mt-0.5 shrink-0 text-sc-primary" />
                            <div>
                              <div className="font-semibold text-sc-muted">Mục tiêu học viên</div>
                              <div className="text-sc-ink-2">{row.rosterEntry.fitnessGoals}</div>
                            </div>
                          </div>
                        )}
                        {row.rosterEntry.healthNotes && (
                          <div className="flex items-start gap-2">
                            <HeartPulse size={14} className="mt-0.5 shrink-0 text-amber-600" />
                            <div>
                              <div className="font-semibold text-sc-muted">Lưu ý sức khỏe</div>
                              <div className="text-sc-ink-2">{row.rosterEntry.healthNotes}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {row.plan ? (
                      <PlanView plan={row.plan} />
                    ) : (
                      <div className="inline-flex items-center gap-2 text-[13.5px] text-sc-muted">
                        <Sparkles size={14} className="text-sc-muted-2" />
                        Học viên hiện áp dụng kế hoạch tập luyện chung của lớp.
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
