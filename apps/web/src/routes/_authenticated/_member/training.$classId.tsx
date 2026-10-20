import { createFileRoute } from '@tanstack/react-router';
import { TrainingClassPage } from '~/features/training';

export const Route = createFileRoute('/_authenticated/_member/training/$classId')({
  component: function TrainingClassRoute() {
    const { classId } = Route.useParams();
    return <TrainingClassPage classId={classId} />;
  },
});
