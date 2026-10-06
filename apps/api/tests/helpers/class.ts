import { prisma } from '~/configs/db';
import { addDays, parseTime, todayInCenter, toDbTime } from '~/utils/time';
import { createAccount } from './http';
import { seedFacility } from './schedule';

let seq = 0;

export const seedOpenClass = async ({
  maxStudents = 10,
  startDate = addDays(todayInCenter(), 3),
  endDate = addDays(todayInCenter(), 10),
} = {}) => {
  const coach = await createAccount('COACH', `class-coach${++seq}@example.com`);
  const sport = await prisma.sport.create({ data: { name: `Boxing ${seq}` } });
  const course = await prisma.course.create({
    data: { name: `Boxing cơ bản ${seq}`, sportId: sport.id, price: 300_000, totalSessions: 2 },
  });
  const room = await seedFacility(1, { type: 'ROOM' });
  const session = (sessionNumber: number, date: string) => ({
    facilityId: room.id,
    sessionNumber,
    sessionDate: new Date(date),
    startTime: toDbTime(parseTime('18:00')),
    endTime: toDbTime(parseTime('19:30')),
  });
  return prisma.class.create({
    data: {
      courseId: course.id,
      facilityId: room.id,
      coachId: coach.id,
      name: `Lớp ${seq}`,
      weeklySchedule: [],
      maxStudents,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'OPEN',
      sessions: { create: [session(1, startDate), session(2, endDate)] },
    },
  });
};
