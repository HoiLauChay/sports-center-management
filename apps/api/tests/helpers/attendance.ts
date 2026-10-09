import { randomUUID } from 'node:crypto';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { addDays, toCenterDateTime, todayInCenter, toDbTime } from '~/utils/time';
import { createAccount } from './http';

export const setupAttendance = async () => {
  const manager = await createAccount('MANAGER', 'attendance-manager@example.com');
  const coach = await createAccount('COACH', 'attendance-coach@example.com');
  const otherCoach = await createAccount('COACH', 'attendance-other-coach@example.com');
  const receptionist = await createAccount('RECEPTIONIST', 'attendance-staff@example.com');
  const member = await createAccount('MEMBER', 'attendance-member@example.com');
  const second = await createAccount('MEMBER', 'attendance-second@example.com');
  const outsider = await createAccount('MEMBER', 'attendance-outsider@example.com');
  const date = addDays(todayInCenter(), -1);
  const start = toCenterDateTime(date, 540);
  const end = toCenterDateTime(date, 600);
  const sport = await prisma.sport.create({ data: { name: 'Attendance sport' } });
  const facility = await prisma.facility.create({
    data: { name: 'Attendance room', type: 'ROOM', capacityPerSlot: 10, pricePerSlot: 0 },
  });
  const course = await prisma.course.create({
    data: { name: 'Attendance course', sportId: sport.id, price: 100_000, totalSessions: 3 },
  });
  const cls = await prisma.class.create({
    data: {
      name: 'Attendance class',
      courseId: course.id,
      facilityId: facility.id,
      coachId: coach.id,
      minStudents: 1,
      maxStudents: 10,
      weeklySchedule: [],
      status: 'OPEN',
      startDate: new Date(date),
      endDate: new Date(addDays(date, 2)),
    },
  });
  let number = 0;
  const makeSession = (data: Partial<Prisma.ClassSessionUncheckedCreateInput> = {}) =>
    prisma.classSession.create({
      data: {
        classId: cls.id,
        facilityId: facility.id,
        sessionNumber: ++number,
        sessionDate: new Date(date),
        startTime: toDbTime(540),
        endTime: toDbTime(600),
        ...data,
      },
    });
  const enroll = async (accountId: string, data: Partial<Prisma.ClassEnrollmentUncheckedCreateInput> = {}) => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `AT-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        accountId,
        paymentMethod: 'WALLET',
        subtotal: 100_000,
        totalAmount: 100_000,
        receiptSnapshot: { schema_version: 1 },
        items: {
          create: {
            lineNumber: 1,
            type: 'COURSE_ENROLLMENT',
            subtotal: 100_000,
            totalAmount: 100_000,
            itemSnapshot: { schema_version: 1 },
          },
        },
      },
      include: { items: true },
    });
    return prisma.classEnrollment.create({
      data: {
        classId: cls.id,
        accountId,
        orderItemId: order.items[0]!.id,
        enrolledAt: new Date(start.getTime() - 86_400_000),
        ...data,
      },
    });
  };
  const session = await makeSession();
  const enrollment = await enroll(member.id);
  await enroll(second.id);
  return {
    manager,
    coach,
    otherCoach,
    receptionist,
    member,
    second,
    outsider,
    cls,
    session,
    enrollment,
    start,
    end,
    date,
    makeSession,
    enroll,
  };
};
