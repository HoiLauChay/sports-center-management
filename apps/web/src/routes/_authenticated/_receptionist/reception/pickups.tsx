import { createFileRoute } from '@tanstack/react-router';
import { PickupsPage } from '~/features/shop';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/pickups')({
  component: PickupsPage,
});
