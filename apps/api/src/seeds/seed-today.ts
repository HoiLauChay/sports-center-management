/* eslint-disable no-console */
import { prisma } from '~/configs/db';
import { addDays, parseTime, toDbTime, todayInCenter } from '~/utils/time';

async function seedTodayData() {
  const today = todayInCenter();
  console.log(`Seeding data for today: ${today}...`);

  // 1. Get or create base accounts
  const manager = await prisma.account.findFirst({ where: { role: 'MANAGER' } });
  if (!manager) {
    throw new Error('Please run bun run db:seed first to create manager!');
  }

  const coachHuan = await prisma.account.findFirst({ where: { email: 'coach1@sportscenter.local' } });
  const coachMai = await prisma.account.findFirst({ where: { email: 'coach2@sportscenter.local' } });
  const coachTuan = await prisma.account.findFirst({ where: { email: 'coach3@sportscenter.local' } });

  const member1 = await prisma.account.findFirst({ where: { email: 'member1@sportscenter.local' } });
  const member2 = await prisma.account.findFirst({ where: { email: 'member2@sportscenter.local' } });
  const member3 = await prisma.account.findFirst({ where: { email: 'member3@sportscenter.local' } });

  const poolFacility = await prisma.facility.findFirst({ where: { name: 'Hồ bơi trong nhà' } });
  const yogaFacility = await prisma.facility.findFirst({ where: { name: 'Phòng Yoga' } });
  const bad1Facility = await prisma.facility.findFirst({ where: { name: 'Sân cầu lông 1' } });
  const bad2Facility = await prisma.facility.findFirst({ where: { name: 'Sân cầu lông 2' } });
  const footballFacility = await prisma.facility.findFirst({ where: { name: 'Sân bóng đá mini' } });
  const gymFacility = await prisma.facility.findFirst({ where: { name: 'Phòng Gym' } });

  const swimSport = await prisma.sport.findFirst({ where: { name: 'Bơi lội' } });
  const yogaSport = await prisma.sport.findFirst({ where: { name: 'Yoga' } });
  const badSport = await prisma.sport.findFirst({ where: { name: 'Cầu lông' } });

  if (!poolFacility || !yogaFacility || !bad1Facility || !swimSport || !yogaSport || !badSport) {
    throw new Error('Please run bun run db:seed:demo first to populate sports and facilities!');
  }

  // 2. Create courses if not exist
  const yogaCourse = await prisma.course.upsert({
    where: { id: 'c0000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'c0000000-0000-4000-8000-000000000001',
      name: 'Yoga Thanh Lọc & Cân Bằng',
      sportId: yogaSport.id,
      price: 500000,
      totalSessions: 12,
      description: 'Khóa học yoga toàn diện giúp tăng cường sức khỏe và thư giãn.',
    },
  });

  const swimCourse = await prisma.course.upsert({
    where: { id: 'c0000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'c0000000-0000-4000-8000-000000000002',
      name: 'Bơi Lội Kỹ Thuật Ếch & Sải',
      sportId: swimSport.id,
      price: 1200000,
      totalSessions: 10,
      description: 'Lớp bơi chuẩn kỹ thuật dành cho người lớn.',
    },
  });

  const badCourse = await prisma.course.upsert({
    where: { id: 'c0000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: 'c0000000-0000-4000-8000-000000000003',
      name: 'Cầu Lông Chiến Thuật Đôi',
      sportId: badSport.id,
      price: 800000,
      totalSessions: 8,
      description: 'Chiến thuật di chuyển và đập cầu đỉnh cao.',
    },
  });

  // 3. Create classes for today
  const class1 = await prisma.class.upsert({
    where: { id: 'c1000000-0000-4000-8000-000000000011' },
    update: {
      status: 'OPEN',
      deletedAt: null,
    },
    create: {
      id: 'c1000000-0000-4000-8000-000000000011',
      name: 'Yoga Sáng Năng Lượng K01',
      courseId: yogaCourse.id,
      facilityId: yogaFacility.id,
      coachId: coachMai?.id ?? null,
      minStudents: 1,
      maxStudents: 12,
      startDate: new Date(today),
      endDate: new Date(addDays(today, 30)),
      weeklySchedule: [{ dayOfWeek: 2, startTime: '08:00', endTime: '09:30' }],
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  const class2 = await prisma.class.upsert({
    where: { id: 'c1000000-0000-4000-8000-000000000012' },
    update: {
      status: 'OPEN',
      deletedAt: null,
    },
    create: {
      id: 'c1000000-0000-4000-8000-000000000012',
      name: 'Bơi Sải Nâng Cao K03',
      courseId: swimCourse.id,
      facilityId: poolFacility.id,
      coachId: coachHuan?.id ?? null,
      minStudents: 1,
      maxStudents: 10,
      startDate: new Date(today),
      endDate: new Date(addDays(today, 30)),
      weeklySchedule: [{ dayOfWeek: 2, startTime: '14:00', endTime: '15:30' }],
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  const class3 = await prisma.class.upsert({
    where: { id: 'c1000000-0000-4000-8000-000000000013' },
    update: {
      status: 'OPEN',
      deletedAt: null,
    },
    create: {
      id: 'c1000000-0000-4000-8000-000000000013',
      name: 'Cầu Lông Thi Đấu Chuyên Sâu',
      courseId: badCourse.id,
      facilityId: bad1Facility.id,
      coachId: coachTuan?.id ?? null,
      minStudents: 1,
      maxStudents: 8,
      startDate: new Date(today),
      endDate: new Date(addDays(today, 30)),
      weeklySchedule: [{ dayOfWeek: 2, startTime: '17:30', endTime: '19:00' }],
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });

  // 4. Create class sessions for today
  await prisma.classSession.deleteMany({
    where: {
      sessionDate: new Date(today),
      classId: { in: [class1.id, class2.id, class3.id] },
    },
  });

  await prisma.classSession.createMany({
    data: [
      {
        classId: class1.id,
        facilityId: yogaFacility.id,
        sessionNumber: 1,
        sessionDate: new Date(today),
        startTime: toDbTime(parseTime('08:00')),
        endTime: toDbTime(parseTime('09:30')),
        status: 'SCHEDULED',
      },
      {
        classId: class2.id,
        facilityId: poolFacility.id,
        sessionNumber: 1,
        sessionDate: new Date(today),
        startTime: toDbTime(parseTime('14:00')),
        endTime: toDbTime(parseTime('15:30')),
        status: 'SCHEDULED',
      },
      {
        classId: class3.id,
        facilityId: bad1Facility.id,
        sessionNumber: 1,
        sessionDate: new Date(today),
        startTime: toDbTime(parseTime('17:30')),
        endTime: toDbTime(parseTime('19:00')),
        status: 'SCHEDULED',
      },
    ],
  });

  // 5. Enroll sample members in classes
  const members = [member1, member2, member3].filter(Boolean);
  for (let i = 0; i < members.length; i++) {
    const mem = members[i]!;
    // Enroll in class 1
    const exists = await prisma.classEnrollment.findFirst({
      where: { classId: class1.id, accountId: mem.id, status: 'ENROLLED' },
    });
    if (!exists) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-ENR1-${mem.id.slice(0, 6)}-${Date.now()}`,
          idempotencyKey: `seed:enr1:${mem.id}`,
          accountId: mem.id,
          receiptSnapshot: { schema_version: 1 },
          subtotal: 500000,
          totalAmount: 500000,
          paymentMethod: 'WALLET',
          items: {
            create: {
              lineNumber: 1,
              type: 'COURSE_ENROLLMENT',
              itemSnapshot: { schema_version: 1 },
              subtotal: 500000,
              totalAmount: 500000,
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

    // Enroll in class 2 for first member
    if (i === 0) {
      const exists2 = await prisma.classEnrollment.findFirst({
        where: { classId: class2.id, accountId: mem.id, status: 'ENROLLED' },
      });
      if (!exists2) {
        const order2 = await prisma.order.create({
          data: {
            orderNumber: `ORD-ENR2-${mem.id.slice(0, 6)}-${Date.now()}`,
            idempotencyKey: `seed:enr2:${mem.id}`,
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
            classId: class2.id,
            accountId: mem.id,
            orderItemId: order2.items[0]!.id,
            status: 'ENROLLED',
          },
        });
      }
    }
  }

  // 6. Seed today's bookings
  if (bad2Facility && footballFacility && gymFacility && member1 && member2) {
    // Booking 1: Sân cầu lông 2
    const b1Order = await prisma.order.create({
      data: {
        orderNumber: `ORD-BK1-${Date.now()}`,
        idempotencyKey: `seed:bk1:${Date.now()}`,
        accountId: member1.id,
        receiptSnapshot: { schema_version: 1 },
        subtotal: 80000,
        totalAmount: 80000,
        paymentMethod: 'WALLET',
        items: {
          create: {
            lineNumber: 1,
            type: 'FACILITY_BOOKING',
            itemSnapshot: { schema_version: 1 },
            subtotal: 80000,
            totalAmount: 80000,
          },
        },
      },
      include: { items: true },
    });
    await prisma.facilityBooking.create({
      data: {
        facilityId: bad2Facility.id,
        accountId: member1.id,
        orderItemId: b1Order.items[0]!.id,
        bookingDate: new Date(today),
        startTime: toDbTime(parseTime('14:00')),
        endTime: toDbTime(parseTime('15:00')),
        unitPrice: 80000,
        benefit: 'NONE',
        status: 'CONFIRMED',
      },
    });

    // Booking 2: Sân bóng đá mini (Khách vãng lai)
    const b2Order = await prisma.order.create({
      data: {
        orderNumber: `ORD-BK2-${Date.now()}`,
        idempotencyKey: `seed:bk2:${Date.now()}`,
        guestName: 'Nguyễn Văn Tuấn',
        guestPhone: '0912345678',
        createdById: manager.id,
        receiptSnapshot: { schema_version: 1 },
        subtotal: 450000,
        totalAmount: 450000,
        paymentMethod: 'CASH',
        items: {
          create: {
            lineNumber: 1,
            type: 'FACILITY_BOOKING',
            itemSnapshot: { schema_version: 1 },
            subtotal: 450000,
            totalAmount: 450000,
          },
        },
      },
      include: { items: true },
    });
    await prisma.facilityBooking.create({
      data: {
        facilityId: footballFacility.id,
        orderItemId: b2Order.items[0]!.id,
        bookingDate: new Date(today),
        startTime: toDbTime(parseTime('17:00')),
        endTime: toDbTime(parseTime('18:30')),
        unitPrice: 450000,
        benefit: 'NONE',
        status: 'CONFIRMED',
      },
    });

    // Booking 3: Phòng Gym (Khách thành viên, gói FREE_SLOT)
    const b3Order = await prisma.order.create({
      data: {
        orderNumber: `ORD-BK3-${Date.now()}`,
        idempotencyKey: `seed:bk3:${Date.now()}`,
        accountId: member2.id,
        receiptSnapshot: { schema_version: 1 },
        subtotal: 40000,
        totalAmount: 0,
        membershipDiscountAmount: 40000,
        paymentMethod: 'WALLET',
        items: {
          create: {
            lineNumber: 1,
            type: 'FACILITY_BOOKING',
            itemSnapshot: { schema_version: 1 },
            subtotal: 40000,
            membershipDiscountAmount: 40000,
            totalAmount: 0,
          },
        },
      },
      include: { items: true },
    });
    await prisma.facilityBooking.create({
      data: {
        facilityId: gymFacility.id,
        accountId: member2.id,
        orderItemId: b3Order.items[0]!.id,
        bookingDate: new Date(today),
        startTime: toDbTime(parseTime('19:00')),
        endTime: toDbTime(parseTime('20:30')),
        unitPrice: 40000,
        benefit: 'GYM_ACCESS',
        status: 'CONFIRMED',
      },
    });
  }

  console.log('✓ Successfully seeded sessions and bookings for today!');
}

seedTodayData()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
