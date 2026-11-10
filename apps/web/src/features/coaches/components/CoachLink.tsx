import type { Person } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';

/** A coach's name that opens their public profile; a class with no coach yet says so. */
export function CoachLink({ coach, fallback = 'Đang cập nhật' }: { coach: Person | null; fallback?: string }) {
  if (!coach) return <>{fallback}</>;
  return (
    <Link
      to="/coaches/$coachId"
      params={{ coachId: coach.id }}
      className="font-semibold !text-sc-primary underline-offset-2 hover:underline"
    >
      {coach.fullName}
    </Link>
  );
}
