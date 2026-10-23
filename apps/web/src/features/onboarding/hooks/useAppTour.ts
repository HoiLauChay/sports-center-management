import type { Account } from '@sports-center/shared';
import { useCallback, useState } from 'react';
import { isTourRole } from '../config/tourSteps';

// Bump the version when the tour changes enough that everyone should see it again.
const SEEN_KEY = (userId: string) => `sc_tour_v1:${userId}`;

function readSeen(userId: string) {
  try {
    return localStorage.getItem(SEEN_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

function saveSeen(userId: string) {
  try {
    localStorage.setItem(SEEN_KEY(userId), '1');
  } catch {
    return;
  }
}

export function useAppTour(user: Account | null) {
  const userId = user?.id;
  const enabled = !!user && isTourRole(user.role);
  const [replay, setReplay] = useState(false);
  // Also tracked in state so a blocked localStorage cannot reopen the tour right after closing it.
  const [closedFor, setClosedFor] = useState<string>();

  const firstVisit = !!userId && closedFor !== userId && !readSeen(userId);
  const open = enabled && (replay || firstVisit);

  const start = useCallback(() => setReplay(true), []);

  const close = useCallback(() => {
    setReplay(false);
    setClosedFor(userId);
    if (userId) saveSeen(userId);
  }, [userId]);

  return { enabled, open, start, close };
}
