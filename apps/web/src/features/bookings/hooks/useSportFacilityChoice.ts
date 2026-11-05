import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';

/**
 * Sport → facility choice shared by the booking pickers: only sports with an active facility are offered, and a sport
 * with a single facility picks it straight away.
 */
export function useSportFacilityChoice() {
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const [sportChoice, setSportChoice] = useState<string>();
  const [facilityChoice, setFacilityChoice] = useState<string>();

  const bookable = useMemo(() => (facilities.data ?? []).filter((facility) => facility.isActive), [facilities.data]);
  const facilitiesOf = (sportId: string | undefined) =>
    bookable.filter((facility) => facility.sports.some((entry) => entry.id === sportId));
  const sportOptions = useMemo(
    () =>
      (sports.data ?? []).filter(
        (sport) =>
          sport.isActive && bookable.some((facility) => facility.sports.some((entry) => entry.id === sport.id)),
      ),
    [sports.data, bookable],
  );
  const sport = sportOptions.find((entry) => entry.id === sportChoice);
  const sportFacilities = useMemo(
    () => bookable.filter((facility) => facility.sports.some((entry) => entry.id === sport?.id)),
    [bookable, sport],
  );
  const facility = sportFacilities.find((entry) => entry.id === facilityChoice);
  const step = !sport ? 0 : !facility ? 1 : 2;

  const pickSport = (id: string) => {
    const choices = facilitiesOf(id);
    setSportChoice(id);
    setFacilityChoice(choices.length === 1 ? choices[0]?.id : undefined);
  };
  const pickFacility = (id: string) => setFacilityChoice(id);
  const goToStep = (target: number) => {
    if (target <= 0) setSportChoice(undefined);
    if (target <= 1) setFacilityChoice(undefined);
  };

  return {
    isPending: facilities.isPending || sports.isPending,
    error: facilities.error ?? sports.error,
    refetch: () => {
      void facilities.refetch();
      void sports.refetch();
    },
    sportOptions,
    sportFacilities,
    facilitiesOf,
    sport,
    facility,
    step,
    pickSport,
    pickFacility,
    goToStep,
  };
}

export type SportFacilityChoice = ReturnType<typeof useSportFacilityChoice>;
