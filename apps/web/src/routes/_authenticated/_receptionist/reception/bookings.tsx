import { createFileRoute } from '@tanstack/react-router';
import { ReceptionBookingsPage } from '~/features/bookings';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/bookings')({
  component: ReceptionBookingsPage,
});
