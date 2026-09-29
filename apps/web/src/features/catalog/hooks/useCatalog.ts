import { queryOptions } from '@tanstack/react-query';
import { facilitiesService } from '../services/facilities.service';
import { sportsService } from '../services/sports.service';

export const sportsQueryOptions = queryOptions({
  queryKey: ['sports'],
  queryFn: sportsService.list,
});

export const facilitiesQueryOptions = queryOptions({
  queryKey: ['facilities'],
  queryFn: () => facilitiesService.list(),
});
