import type { ProgressMilestone, RosterEntry } from '@sports-center/shared';
import { PROGRESS_MILESTONES } from '@sports-center/shared';
import { Drawer, Rate, Spin, Table, Tag } from 'antd';
import { InfoGrid } from '~/components/data/InfoGrid';
import { ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { GENDER_LABEL } from '~/lib/account';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useSaveMemberPlan, useSaveReview, useStudentProgress } from '../../hooks/useClassTraining';
import { ATTENDANCE_TAG } from '../../types';
import { PlanForm, PlanView } from './PlanForm';
import { ReviewCard } from './ReviewCard';

interface StudentDrawerProps {
  classId: string;
  entry: RosterEntry | null;
  open: boolean;
  reached: Record<ProgressMilestone, boolean>;
  /** Managers only look; the class coach edits the plan and reviews. */
  readOnly: boolean;
  onClose: () => void;
}

function StudentDetail({
  classId,
  entry,
  reached,
  readOnly,
}: Omit<StudentDrawerProps, 'onClose' | 'open'> & { entry: RosterEntry }) {
  const accountId = entry.account.id;
  const progress = useStudentProgress(classId, accountId);
  const savePlan = useSaveMemberPlan(classId, accountId);
  const saveReview = useSaveReview(classId, accountId);

  if (progress.isPending) return <Spin />;
  if (progress.isError) {
    return <ErrorState message={toApiError(progress.error).message} onRetry={() => void progress.refetch()} />;
  }
  const { attendance, results, plan, reviews } = progress.data;
  const resultOf = (sessionId: string) => results.find((result) => result.session.id === sessionId);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Hồ sơ tập luyện</SectionTitle>
        <InfoGrid
          single
          items={[
            { label: 'Mục tiêu tập luyện', value: entry.fitnessGoals },
            { label: 'Ghi chú sức khỏe', value: entry.healthNotes },
            { label: 'Liên hệ khẩn cấp', value: entry.emergencyContact },
            {
              label: 'Thông tin',
              value: [
                entry.account.gender && GENDER_LABEL[entry.account.gender],
                entry.account.dateOfBirth && `Sinh ${formatDate(entry.account.dateOfBirth)}`,
                entry.account.phone,
              ]
                .filter(Boolean)
                .join(' · '),
            },
          ]}
        />
      </section>

      <section>
        <SectionTitle>Kế hoạch riêng</SectionTitle>
        {readOnly ? (
          <PlanView plan={plan} />
        ) : (
          <PlanForm
            key={plan?.updatedAt ?? 'new'}
            plan={plan}
            saving={savePlan.isPending}
            onSave={(body) => savePlan.mutate(body)}
          />
        )}
      </section>

      <section>
        <SectionTitle>Đánh giá tiến độ</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {PROGRESS_MILESTONES.map((milestone) => (
            <ReviewCard
              key={milestone}
              milestone={milestone}
              review={reviews.find((review) => review.milestone === milestone)}
              reached={reached[milestone]}
              saving={saveReview.isPending}
              onSave={readOnly ? undefined : (body) => saveReview.mutateAsync({ milestone, ...body })}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Điểm danh và kết quả</SectionTitle>
        <Table
          rowKey={(row) => row.session.id}
          size="small"
          pagination={false}
          dataSource={attendance}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Buổi',
              render: (_, row) => (
                <span className="whitespace-nowrap">
                  {row.session.sessionNumber} · {formatDate(row.session.date).slice(0, 5)}
                </span>
              ),
            },
            {
              title: 'Điểm danh',
              render: (_, row) =>
                row.status ? (
                  <Tag color={ATTENDANCE_TAG[row.status].color} className="!m-0">
                    {ATTENDANCE_TAG[row.status].label}
                  </Tag>
                ) : (
                  <span className="text-sc-muted-2">—</span>
                ),
            },
            {
              title: 'Kết quả',
              render: (_, row) => {
                const result = resultOf(row.session.id);
                return result ? (
                  <div className="flex flex-col">
                    <Rate disabled value={result.rating} className="!text-[14px] whitespace-nowrap" />
                    {result.comment && <span className="text-[13.5px] text-sc-muted">{result.comment}</span>}
                  </div>
                ) : null;
              },
            },
            { title: 'Ghi chú', render: (_, row) => row.note },
          ]}
        />
      </section>
    </div>
  );
}

/** A student of the class: training profile, own plan, progress reviews and the session history (UC_4.10–4.12). */
export function StudentDrawer({ entry, open, onClose, ...props }: StudentDrawerProps) {
  return (
    <Drawer title={entry?.account.fullName} open={open && Boolean(entry)} onClose={onClose} size={640} destroyOnHidden>
      {entry && <StudentDetail entry={entry} {...props} />}
    </Drawer>
  );
}
