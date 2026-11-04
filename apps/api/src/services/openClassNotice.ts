import type { Prisma } from '~/generated/prisma/client';
import specializationRepository from '~/repositories/specialization.repository';
import notificationService, { type NotificationInput } from '~/services/notification.service';

interface OpenClass {
  id: string;
  name: string;
  course: { sportId: string; sport: { name: string } };
}

/** Tells every active coach approved for the sport that a class now has no coach, except the one who just left it. */
export const notifyOpenClasses = async (tx: Prisma.TransactionClient, classes: OpenClass[], exceptCoachId?: string) => {
  const inputs: NotificationInput[] = [];
  for (const cls of classes) {
    const coachIds = await specializationRepository.findQualifiedCoachIds(cls.course.sportId, tx);
    inputs.push(
      ...coachIds
        .filter((coachId) => coachId !== exceptCoachId)
        .map((coachId) => ({
          accountId: coachId,
          type: 'CLASS' as const,
          title: 'Lớp cần huấn luyện viên',
          message: `Lớp "${cls.name}" môn ${cls.course.sport.name} đang cần huấn luyện viên.`,
          referenceType: 'OPEN_CLASS',
          referenceId: cls.id,
        })),
    );
  }
  if (inputs.length > 0) await notificationService.create(inputs, tx);
};
