import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { classesService, type ListClassesQuery } from '../services/classes.service';

export function useClasses(query: ListClassesQuery) {
  return useQuery({
    queryKey: ['classes', 'list', query],
    queryFn: () => classesService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: ['classes', 'detail', id],
    queryFn: () => classesService.get(id),
    retry: false,
  });
}
