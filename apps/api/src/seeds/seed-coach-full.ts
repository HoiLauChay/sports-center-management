/* eslint-disable no-console */
import { prisma } from '~/configs/db';
import { addDays, parseTime, toDbTime, todayInCenter } from '~/utils/time';

async function seedCoachFullData() {
  const today = todayInCenter();
  console.log(`Seeding comprehensive coach data for date: ${today}...`);

  // 1. Get Manager & Coach Huan
  const manager = await prisma.account.findFirst({ where: { role: 'MANAGER' } });
  if (!manager) {
    throw new Error('Manager account not found. Run db:seed first.');
  }

  const coachHuan = await prisma.account.findFirst({
    where: { email: 'coach1@sportscenter.local' },
    include: { coachProfile: true },
  });
  if (!coachHuan) {
    throw new Error('Coach Huan account not found. Run db:seed first.');
  }

  const member1 = await prisma.account.findFirst({ where: { email: 'member1@sportscenter.local' } });
  const member2 = await prisma.account.findFirst({ where: { email: 'member2@sportscenter.local' } });
  const member3 = await prisma.account.findFirst({ where: { email: 'member3@sportscenter.local' } });

  // 2. Update Coach Profile with rich info
  await prisma.coachProfile.upsert({
    where: { accountId: coachHuan.id },
    update: {
      bio: 'Huấn luyện viên bơi lội và thể hình với 8 năm kinh nghiệm đào tạo vận động viên và hội viên phong trào.',
      experience: '8 năm đào tạo tại Trung tâm Thể thao Quốc gia & CLB Bơi Lội',
      certifications: 'Chứng chỉ HLV Bơi lội Cấp 2 FINA, Chứng chỉ Personal Trainer NASM',
    },
    create: {
      accountId: coachHuan.id,
      bio: 'Huấn luyện viên bơi lội và thể hình với 8 năm kinh nghiệm đào tạo vận động viên và hội viên phong trào.',
      experience: '8 năm đào tạo tại Trung tâm Thể thao Quốc gia & CLB Bơi Lội',
      certifications: 'Chứng chỉ HLV Bơi lội Cấp 2 FINA, Chứng chỉ Personal Trainer NASM',
    },
  });

  // 3. Setup Specializations for Coach Huan:
  // - Gym: APPROVED
  // - Bơi lội: APPROVED
  // - Bóng đá: PENDING
  // - Yoga: REJECTED with note
  const sports = await prisma.sport.findMany();
  const swimSport = sports.find((s) => s.name === 'Bơi lội');
  const gymSport = sports.find((s) => s.name === 'Gym');
  const footballSport = sports.find((s) => s.name === 'Bóng đá');
  const yogaSport = sports.find((s) => s.name === 'Yoga');

  if (swimSport && gymSport) {
    // Swim: APPROVED
    const swimSpec = await prisma.coachSpecialization.findFirst({
      where: { coachId: coachHuan.id, sportId: swimSport.id },
    });
    if (swimSpec) {
      await prisma.coachSpecialization.update({
        where: { id: swimSpec.id },
        data: { status: 'APPROVED', reviewedById: manager.id, reviewedAt: new Date(Date.now() - 14 * 86400000) },
      });
    }

    // Gym: APPROVED
    const gymSpec = await prisma.coachSpecialization.findFirst({
      where: { coachId: coachHuan.id, sportId: gymSport.id },
    });
    if (gymSpec) {
      await prisma.coachSpecialization.update({
        where: { id: gymSpec.id },
        data: { status: 'APPROVED', reviewedById: manager.id, reviewedAt: new Date(Date.now() - 14 * 86400000) },
      });
    }

    // Football: PENDING
    if (footballSport) {
      const fbSpec = await prisma.coachSpecialization.findFirst({
        where: { coachId: coachHuan.id, sportId: footballSport.id },
      });
      if (!fbSpec) {
        await prisma.coachSpecialization.create({
          data: {
            coachId: coachHuan.id,
            sportId: footballSport.id,
            status: 'PENDING',
            createdAt: new Date(Date.now() - 2 * 86400000),
          },
        });
      }
    }

    // Yoga: REJECTED with note
    if (yogaSport) {
      const yogaSpec = await prisma.coachSpecialization.findFirst({
        where: { coachId: coachHuan.id, sportId: yogaSport.id, status: 'REJECTED' },
      });
      if (!yogaSpec) {
        // delete any active to avoid unique constraint
        await prisma.coachSpecialization.deleteMany({
          where: { coachId: coachHuan.id, sportId: yogaSport.id },
        });
        await prisma.coachSpecialization.create({
          data: {
            coachId: coachHuan.id,
            sportId: yogaSport.id,
            status: 'REJECTED',
            reviewNote: 'Yêu cầu bổ sung chứng chỉ HLV Yoga RYT-200 hoặc chứng chỉ sư phạm yoga tương đương.',
            reviewedById: manager.id,
            reviewedAt: new Date(Date.now() - 3 * 86400000),
            createdAt: new Date(Date.now() - 5 * 86400000),
          },
        });
      }
    }
  }

  // 4. Facilities & Courses
  const poolFacility = await prisma.facility.findFirst({ where: { name: 'Hồ bơi trong nhà' } });
  const gymFacility = await prisma.facility.findFirst({ where: { name: 'Phòng Gym' } });

  if (!poolFacility || !gymFacility || !swimSport || !gymSport) {
    throw new Error('Facilities or sports missing.');
  }

  const COURSE_SWIM_ID = 'c0000000-0000-4000-8000-000000000002';
  const COURSE_GYM_ID = 'c0000000-0000-4000-8000-000000000004';
  const CLASS_SWIM_ID = 'c1000000-0000-4000-8000-000000000012';
  const CLASS_GYM_ID = 'c1000000-0000-4000-8000-000000000014';
  const CLASS_OPEN_SWIM_ID = 'c1000000-0000-4000-8000-000000000021';
  const CLASS_OPEN_GYM_ID = 'c1000000-0000-4000-8000-000000000022';

  // 4b. Clean up legacy or previous runs
  const targetClassIds = [
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000022',
    CLASS_SWIM_ID,
    CLASS_GYM_ID,
    CLASS_OPEN_SWIM_ID,
    CLASS_OPEN_GYM_ID,
  ];
  const oldSessions = await prisma.classSession.findMany({
    where: { classId: { in: targetClassIds } },
    select: { id: true },
  });
  const oldSessionIds = oldSessions.map((s) => s.id);
  await prisma.memberEvaluation.deleteMany({ where: { sessionId: { in: oldSessionIds } } });
  await prisma.classAttendance.deleteMany({ where: { sessionId: { in: oldSessionIds } } });
  await prisma.classSession.deleteMany({ where: { id: { in: oldSessionIds } } });
  await prisma.classEnrollment.deleteMany({ where: { classId: { in: targetClassIds } } });
  await prisma.classCoachRegistration.deleteMany({ where: { classId: { in: targetClassIds } } });
  await prisma.class.deleteMany({
    where: {
      id: {
        in: [
          '00000000-0000-0000-0000-000000000012',
          '00000000-0000-0000-0000-000000000014',
          '00000000-0000-0000-0000-000000000021',
          '00000000-0000-0000-0000-000000000022',
        ],
      },
    },
  });

  const swimCourse = await prisma.course.upsert({
    where: { id: COURSE_SWIM_ID },
    update: {},
    create: {
      id: COURSE_SWIM_ID,
      name: 'Bơi Lội Kỹ Thuật Ếch & Sải',
      sportId: swimSport.id,
      price: 1200000,
      totalSessions: 10,
      description: 'Lớp bơi chuẩn kỹ thuật dành cho người lớn.',
    },
  });

  const gymCourse = await prisma.course.upsert({
    where: { id: COURSE_GYM_ID },
    update: {},
    create: {
      id: COURSE_GYM_ID,
      name: 'Gym Thể Hình & Siết Cơ',
      sportId: gymSport.id,
      price: 900000,
      totalSessions: 12,
      description: 'Khóa học tập tạ và máy tập thể hình chuyên sâu.',
    },
  });

  // 5. Classes taught by Coach Huan
  // Class 1: Bơi Sải Nâng Cao K03
  const class1 = await prisma.class.upsert({
    where: { id: CLASS_SWIM_ID },
    update: {
      status: 'OPEN',
      coachId: coachHuan.id,
      weeklySchedule: [
        { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' },
        { dayOfWeek: 4, startTime: '14:00', endTime: '15:30' },
      ],
    },
    create: {
      id: CLASS_SWIM_ID,
      name: 'Bơi Sải Nâng Cao K03',
      courseId: swimCourse.id,
      facilityId: poolFacility.id,
      coachId: coachHuan.id,
      minStudents: 1,
      maxStudents: 10,
      startDate: new Date(today),
      endDate: new Date(addDays(today, 30)),
      weeklySchedule: [
        { dayOfWeek: 2, startTime: '14:00', endTime: '15:30' },
        { dayOfWeek: 4, startTime: '14:00', endTime: '15:30' },
      ],
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  // Class 2: Gym Siết Cơ Nâng Cao K01
  const class2 = await prisma.class.upsert({
    where: { id: CLASS_GYM_ID },
    update: {
      status: 'OPEN',
      coachId: coachHuan.id,
      weeklySchedule: [
        { dayOfWeek: 2, startTime: '20:30', endTime: '22:00' },
        { dayOfWeek: 6, startTime: '09:00', endTime: '10:30' },
      ],
    },
    create: {
      id: CLASS_GYM_ID,
      name: 'Gym Siết Cơ Nâng Cao K01',
      courseId: gymCourse.id,
      facilityId: gymFacility.id,
      coachId: coachHuan.id,
      minStudents: 2,
      maxStudents: 12,
      startDate: new Date(today),
      endDate: new Date(addDays(today, 30)),
      weeklySchedule: [
        { dayOfWeek: 2, startTime: '20:30', endTime: '22:00' },
        { dayOfWeek: 6, startTime: '09:00', endTime: '10:30' },
      ],
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  // 6. Open classes that need a coach (/coach/open-classes)
  // Needs: status in ['DRAFT', 'PENDING_APPROVAL'], coachId: null, startDate > today
  const futureStart = addDays(today, 7);
  const futureEnd = addDays(today, 37);

  await prisma.class.upsert({
    where: { id: CLASS_OPEN_SWIM_ID },
    update: {
      status: 'DRAFT',
      coachId: null,
      startDate: new Date(futureStart),
      endDate: new Date(futureEnd),
    },
    create: {
      id: CLASS_OPEN_SWIM_ID,
      name: 'Bơi Sinh Tồn Cho Người Lớn K02',
      courseId: swimCourse.id,
      facilityId: poolFacility.id,
      coachId: null,
      minStudents: 2,
      maxStudents: 8,
      startDate: new Date(futureStart),
      endDate: new Date(futureEnd),
      weeklySchedule: [{ dayOfWeek: 3, startTime: '18:00', endTime: '19:30' }],
      status: 'DRAFT',
    },
  });

  await prisma.class.upsert({
    where: { id: CLASS_OPEN_GYM_ID },
    update: {
      status: 'DRAFT',
      coachId: null,
      startDate: new Date(futureStart),
      endDate: new Date(futureEnd),
    },
    create: {
      id: CLASS_OPEN_GYM_ID,
      name: 'Gym Fitness Khởi Động K05',
      courseId: gymCourse.id,
      facilityId: gymFacility.id,
      coachId: null,
      minStudents: 2,
      maxStudents: 15,
      startDate: new Date(futureStart),
      endDate: new Date(futureEnd),
      weeklySchedule: [{ dayOfWeek: 5, startTime: '19:00', endTime: '20:30' }],
      status: 'DRAFT',
    },
  });

  // 7. Enrollments for Class 1 & Class 2
  const sampleMembers = [member1, member2, member3].filter(Boolean);
  for (let i = 0; i < sampleMembers.length; i++) {
    const mem = sampleMembers[i]!;
    // Enroll into Class 1
    const exists1 = await prisma.classEnrollment.findFirst({
      where: { classId: class1.id, accountId: mem.id, status: 'ENROLLED' },
    });
    if (!exists1) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-COACH-C1-${mem.id.slice(0, 6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          idempotencyKey: `seed:coach:c1:${mem.id}:${Date.now()}:${Math.random()}`,
          accountId: mem.id,
          receiptSnapshot: { schema_version: 1 },
          subtotal: 1200000,
          totalAmount: 1200000,
          paymentMethod: 'WALLET',
          items: {
            create: {
              lineNumber: 1,
              type: 'COURSE_ENROLLMENT',
              itemSnapshot: { schema_version: 1 },
              subtotal: 1200000,
              totalAmount: 1200000,
            },
          },
        },
        include: { items: true },
      });
      await prisma.classEnrollment.create({
        data: {
          classId: class1.id,
          accountId: mem.id,
          orderItemId: order.items[0]!.id,
          status: 'ENROLLED',
        },
      });
    }

    // Enroll into Class 2 (members 0 & 1)
    if (i < 2) {
      const exists2 = await prisma.classEnrollment.findFirst({
        where: { classId: class2.id, accountId: mem.id, status: 'ENROLLED' },
      });
      if (!exists2) {
        const order2 = await prisma.order.create({
          data: {
            orderNumber: `ORD-COACH-C2-${mem.id.slice(0, 6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            idempotencyKey: `seed:coach:c2:${mem.id}:${Date.now()}:${Math.random()}`,
            accountId: mem.id,
            receiptSnapshot: { schema_version: 1 },
            subtotal: 900000,
            totalAmount: 900000,
            paymentMethod: 'WALLET',
            items: {
              create: {
                lineNumber: 1,
                type: 'COURSE_ENROLLMENT',
                itemSnapshot: { schema_version: 1 },
                subtotal: 900000,
                totalAmount: 900000,
              },
            },
          },
          include: { items: true },
        });
        await prisma.classEnrollment.create({
          data: {
            classId: class2.id,
            accountId: mem.id,
            orderItemId: order2.items[0]!.id,
            status: 'ENROLLED',
          },
        });
      }
    }
  }

  // 8. Sessions for Coach Huan
  // Clean old sessions for class1 and class2
  await prisma.classSession.deleteMany({
    where: { classId: { in: [class1.id, class2.id] } },
  });

  // Session 1: Today afternoon (Class 1: Bơi Sải) - already completed
  const session1 = await prisma.classSession.create({
    data: {
      classId: class1.id,
      facilityId: poolFacility.id,
      sessionNumber: 1,
      sessionDate: new Date(today),
      startTime: toDbTime(parseTime('14:00')),
      endTime: toDbTime(parseTime('15:30')),
      status: 'SCHEDULED',
      noteTitle: 'Buổi 1: Khởi động khớp & Kỹ thuật thở bơi sải',
      noteContent: 'Hội viên hoàn thành tốt phần khởi động và bài tập ép chân. Cần lưu ý tư thế đầu khi lấy hơi.',
      noteUpdatedAt: new Date(),
    },
  });

  // Session 2: Tonight (Class 2: Gym Siết Cơ) - 20:30 to 22:00 (Starts in ~15 mins!)
  await prisma.classSession.create({
    data: {
      classId: class2.id,
      facilityId: gymFacility.id,
      sessionNumber: 1,
      sessionDate: new Date(today),
      startTime: toDbTime(parseTime('20:30')),
      endTime: toDbTime(parseTime('22:00')),
      status: 'SCHEDULED',
      noteTitle: 'Buổi 1: Test thể lực & Kỹ thuật Squat / Deadlift căn bản',
      noteContent: 'Chuẩn bị thảm tập, dây kháng lực và tạ tay 5-10kg.',
      noteUpdatedAt: new Date(),
    },
  });

  // Future sessions across the next 14 days
  const futureSessionsData = [
    // Day +2 (Thursday)
    {
      classId: class1.id,
      facilityId: poolFacility.id,
      sessionNumber: 2,
      sessionDate: new Date(addDays(today, 2)),
      startTime: toDbTime(parseTime('14:00')),
      endTime: toDbTime(parseTime('15:30')),
      status: 'SCHEDULED' as const,
    },
    // Day +4 (Saturday)
    {
      classId: class2.id,
      facilityId: gymFacility.id,
      sessionNumber: 2,
      sessionDate: new Date(addDays(today, 4)),
      startTime: toDbTime(parseTime('09:00')),
      endTime: toDbTime(parseTime('10:30')),
      status: 'SCHEDULED' as const,
    },
    // Day +7 (Tuesday next week)
    {
      classId: class1.id,
      facilityId: poolFacility.id,
      sessionNumber: 3,
      sessionDate: new Date(addDays(today, 7)),
      startTime: toDbTime(parseTime('14:00')),
      endTime: toDbTime(parseTime('15:30')),
      status: 'SCHEDULED' as const,
    },
    {
      classId: class2.id,
      facilityId: gymFacility.id,
      sessionNumber: 3,
      sessionDate: new Date(addDays(today, 7)),
      startTime: toDbTime(parseTime('20:30')),
      endTime: toDbTime(parseTime('22:00')),
      status: 'SCHEDULED' as const,
    },
    // Day +9 (Thursday next week)
    {
      classId: class1.id,
      facilityId: poolFacility.id,
      sessionNumber: 4,
      sessionDate: new Date(addDays(today, 9)),
      startTime: toDbTime(parseTime('14:00')),
      endTime: toDbTime(parseTime('15:30')),
      status: 'SCHEDULED' as const,
    },
    // Day +11 (Saturday next week)
    {
      classId: class2.id,
      facilityId: gymFacility.id,
      sessionNumber: 4,
      sessionDate: new Date(addDays(today, 11)),
      startTime: toDbTime(parseTime('09:00')),
      endTime: toDbTime(parseTime('10:30')),
      status: 'SCHEDULED' as const,
    },
  ];

  await prisma.classSession.createMany({
    data: futureSessionsData,
  });

  // 9. Attendance & Evaluations for Session 1
  if (member1 && member2 && member3) {
    // Attendance
    await prisma.classAttendance.createMany({
      data: [
        {
          sessionId: session1.id,
          accountId: member1.id,
          status: 'PRESENT',
          note: 'Đúng giờ, bơi đủ 20 vòng hồ',
          updatedById: coachHuan.id,
        },
        {
          sessionId: session1.id,
          accountId: member2.id,
          status: 'ABSENT',
          note: 'Báo bận công tác đột xuất',
          updatedById: coachHuan.id,
        },
        {
          sessionId: session1.id,
          accountId: member3.id,
          status: 'PRESENT',
          note: 'Đúng giờ, khởi động tích cực',
          updatedById: coachHuan.id,
        },
      ],
    });

    // Evaluations
    await prisma.memberEvaluation.createMany({
      data: [
        {
          sessionId: session1.id,
          accountId: member1.id,
          coachId: coachHuan.id,
          rating: 5,
          comment: 'Kỹ thuật quạt tay và lấy hơi rất tiến bộ, hoàn thành tốt cự ly 50m bơi sải.',
        },
        {
          sessionId: session1.id,
          accountId: member3.id,
          coachId: coachHuan.id,
          rating: 4,
          comment: 'Thể lực tốt, cần chú ý giữ nhịp thở đều khi tăng tốc ở nửa vòng sau.',
        },
      ],
    });
  }

  console.log('✓ Successfully seeded rich coach data!');
}

seedCoachFullData()
  .catch((e) => {
    console.error('Error seeding coach data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
