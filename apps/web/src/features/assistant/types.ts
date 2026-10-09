export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export type AssistantSource = 'membership' | 'classes' | 'schedule' | 'checkIns';

/** What the assistant may read about the signed-in member; the same facts the context panel shows. */
export interface AssistantContext {
  /** Sources whose request failed: their fields hold no data and must not be read as "none". */
  unavailable: AssistantSource[];
  firstName: string;
  membership: { name: string; endDate: string; daysLeft: number; progress: number } | null;
  classes: string[];
  nextSession: { date: string; startTime: string; endTime: string; title: string; facility: string } | null;
  checkInsThisMonth: number;
  openingHours: { openTime: string; closeTime: string } | null;
}
