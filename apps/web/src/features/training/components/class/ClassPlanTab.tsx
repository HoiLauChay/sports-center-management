import { Spin } from 'antd';
import { ErrorState } from '~/components/feedback/States';
import { toApiError } from '~/lib/http-errors';
import { useClassPlans, useSaveClassPlan } from '../../hooks/useClassTraining';
import { PlanForm, PlanView } from './PlanForm';

/** The plan shared by the whole class (BR_4.8); per-student plans live in each student's drawer. */
export function ClassPlanTab({ classId, readOnly }: { classId: string; readOnly: boolean }) {
  const plans = useClassPlans(classId);
  const save = useSaveClassPlan(classId);

  if (plans.isPending) return <Spin />;
  if (plans.isError) {
    return <ErrorState message={toApiError(plans.error).message} onRetry={() => void plans.refetch()} />;
  }
  const { classPlan } = plans.data;

  return (
    <div className="max-w-3xl">
      {readOnly ? (
        <PlanView plan={classPlan} />
      ) : (
        <PlanForm
          classId={classId}
          accountId={null}
          key={classPlan?.updatedAt ?? 'new'}
          plan={classPlan}
          saving={save.isPending}
          onSave={(body) => save.mutate(body)}
        />
      )}
    </div>
  );
}
