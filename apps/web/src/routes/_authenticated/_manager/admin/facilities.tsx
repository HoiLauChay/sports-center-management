import { createFileRoute } from '@tanstack/react-router';
import { FacilitiesPage } from '~/features/catalog';

export const Route = createFileRoute('/_authenticated/_manager/admin/facilities')({
  component: FacilitiesPage,
});
