import type { ClassAnnouncement } from '@sports-center/shared';

import type { AnnouncementRow } from '~/repositories/classTraining.repository';

export const toAnnouncementResponse = (row: AnnouncementRow): ClassAnnouncement => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  sender: row.sender,
  createdAt: row.createdAt.toISOString(),
});
