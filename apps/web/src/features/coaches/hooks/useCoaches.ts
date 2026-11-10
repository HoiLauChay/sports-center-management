import { useQuery } from '@tanstack/react-query';
import { coachesService } from '../services/coaches.service';

export function useCoachProfile(id: string) {
  return useQuery({
    queryKey: ['coaches', 'profile', id],
    queryFn: () => coachesService.getProfile(id),
    retry: false,
  });
}
