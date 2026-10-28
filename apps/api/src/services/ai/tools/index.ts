import type { AssistantRole } from '@sports-center/shared';

import { COACH_TOOLS } from '~/services/ai/tools/coach';
import { COMMON_TOOLS } from '~/services/ai/tools/common';
import { MEMBER_TOOLS } from '~/services/ai/tools/member';
import { RECEPTION_TOOLS } from '~/services/ai/tools/reception';
import type { Tool } from '~/services/ai/tools/toolkit';

const ROLE_TOOLS: Record<AssistantRole, Tool[]> = {
  MEMBER: MEMBER_TOOLS,
  COACH: COACH_TOOLS,
  RECEPTIONIST: RECEPTION_TOOLS,
};

/** The only tools offered to, and runnable for, this role. */
export const toolsFor = (role: AssistantRole): Tool[] => [...COMMON_TOOLS, ...ROLE_TOOLS[role]];

export { coachPendingWork } from '~/services/ai/tools/coach';
export { actionOf, weekdayOf, type ToolContext } from '~/services/ai/tools/toolkit';
