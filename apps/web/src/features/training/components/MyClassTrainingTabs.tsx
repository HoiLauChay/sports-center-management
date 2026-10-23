import type { MyClassTraining } from '@sports-center/shared';
import { PROGRESS_MILESTONES } from '@sports-center/shared';
import { Skeleton, Tabs } from 'antd';
import type { ReactNode } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { toApiError } from '~/lib/http-errors';
import { useMyClassTraining } from '../hooks/useClassTraining';
import { MILESTONE_LABEL } from '../utils';
import { AnnouncementList } from './class/AnnouncementsTab';
import { PlanView } from './class/PlanForm';
import { ReviewScores } from './class/ReviewCard';

function PlansPart({ data }: { data: MyClassTraining }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <SectionTitle>Kế hoạch của lớp</SectionTitle>
        <PlanView plan={data.classPlan} />
      </section>
      <section>
        <SectionTitle>Kế hoạch riêng của bạn</SectionTitle>
        <PlanView plan={data.myPlan} />
      </section>
    </div>
  );
}

function ReviewsPart({ data }: { data: MyClassTraining }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PROGRESS_MILESTONES.map((milestone) => {
        const review = data.reviews.find((entry) => entry.milestone === milestone);
        return (
          <div key={milestone} className="flex flex-col gap-2 rounded-lg border border-solid border-sc-border-soft p-4">
            <b>Đánh giá {MILESTONE_LABEL[milestone].toLowerCase()}</b>
            {review ? (
              <ReviewScores review={review} />
            ) : (
              <span className="text-[14.5px] text-sc-muted-2">HLV chưa đánh giá</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A member's sessions, plans, progress reviews and class announcements for one class (UC_4.7, UC_4.8). */
export function MyClassTrainingTabs({ classId, sessions }: { classId: string; sessions: ReactNode }) {
  const training = useMyClassTraining(classId);
  const wrap = (render: (data: MyClassTraining) => ReactNode) => {
    if (training.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
    if (training.isError) {
      return <ErrorState message={toApiError(training.error).message} onRetry={() => void training.refetch()} />;
    }
    return render(training.data);
  };
  return (
    <Tabs
      items={[
        { key: 'sessions', label: 'Buổi học', children: sessions },
        { key: 'plans', label: 'Kế hoạch tập luyện', children: wrap((data) => <PlansPart data={data} />) },
        { key: 'reviews', label: 'Đánh giá tiến độ', children: wrap((data) => <ReviewsPart data={data} />) },
        {
          key: 'announcements',
          label: 'Thông báo lớp',
          children: wrap((data) => <AnnouncementList items={data.announcements} />),
        },
      ]}
    />
  );
}
