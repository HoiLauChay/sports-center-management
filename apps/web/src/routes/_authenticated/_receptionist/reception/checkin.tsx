import { createFileRoute } from '@tanstack/react-router';
import { CheckInPage } from '~/features/training';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/checkin')({
  component: CheckInPage,
});
