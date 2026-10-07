import { createFileRoute } from '@tanstack/react-router';
import { TrainingPage } from '~/features/training';

export const Route = createFileRoute('/_authenticated/_member/training')({
  component: TrainingPage,
});
