import { createFileRoute } from '@tanstack/react-router';
import { BookingsPage } from '~/features/bookings';

export const Route = createFileRoute('/_authenticated/_member/bookings')({
  component: BookingsPage,
});
