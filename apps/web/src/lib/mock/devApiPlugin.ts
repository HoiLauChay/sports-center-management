import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';

const DEMO_SPORTS = [
  { id: 'sport-badminton', name: 'Cầu lông', description: 'Sân cầu lông tiêu chuẩn thi đấu', isActive: true },
  { id: 'sport-swim', name: 'Bơi lội', description: 'Bơi tự do, bơi ếch cho mọi lứa tuổi', isActive: true },
  { id: 'sport-football', name: 'Bóng đá', description: 'Bóng đá sân 5 và sân 7', isActive: true },
  { id: 'sport-yoga', name: 'Yoga', description: 'Yoga cơ bản và nâng cao', isActive: true },
  { id: 'sport-gym', name: 'Gym', description: 'Tập tạ và máy tập thể hình', isActive: true },
  { id: 'sport-tennis', name: 'Tennis', description: 'Sân tennis tiêu chuẩn', isActive: true },
  { id: 'sport-tabletennis', name: 'Bóng bàn', description: 'Bàn bóng bàn thi đấu', isActive: true },
  { id: 'sport-pickleball', name: 'Pickleball', description: 'Sân pickleball ngoài trời', isActive: true },
];

const DEMO_FACILITIES = [
  {
    id: 'fac-badminton-1',
    name: 'Sân cầu lông 1',
    type: 'COURT',
    capacityPerSlot: 4,
    pricePerSlot: 80000,
    isActive: true,
    sports: [DEMO_SPORTS[0]!],
  },
  {
    id: 'fac-badminton-2',
    name: 'Sân cầu lông 2',
    type: 'COURT',
    capacityPerSlot: 4,
    pricePerSlot: 80000,
    isActive: true,
    sports: [DEMO_SPORTS[0]!],
  },
  {
    id: 'fac-swim-1',
    name: 'Hồ bơi trong nhà',
    type: 'ROOM',
    capacityPerSlot: 30,
    pricePerSlot: 60000,
    isActive: true,
    sports: [DEMO_SPORTS[1]!],
  },
  {
    id: 'fac-football-1',
    name: 'Sân bóng đá mini',
    type: 'FIELD',
    capacityPerSlot: 14,
    pricePerSlot: 300000,
    isActive: true,
    sports: [DEMO_SPORTS[2]!],
  },
  {
    id: 'fac-yoga-1',
    name: 'Phòng Yoga',
    type: 'ROOM',
    capacityPerSlot: 20,
    pricePerSlot: 50000,
    isActive: true,
    sports: [DEMO_SPORTS[3]!],
  },
  {
    id: 'fac-gym-1',
    name: 'Phòng Gym',
    type: 'GYM',
    capacityPerSlot: 40,
    pricePerSlot: 40000,
    isActive: true,
    sports: [DEMO_SPORTS[4]!],
  },
];

const DEMO_SETTINGS = {
  id: 1,
  openTime: '06:00',
  closeTime: '22:00',
  slotDurationMinutes: 60,
  maxAdvanceBookingDays: 30,
  membershipReminderDays: 7,
  minTopUpAmount: 50000,
  invoiceTimeoutMinutes: 15,
};

const DEMO_MEMBERSHIPS = [
  {
    id: 'mem-1',
    name: 'Gói Cơ bản 1 tháng',
    description: 'Vào phòng gym không giới hạn trong 30 ngày',
    price: 300000,
    durationDays: 30,
    gymAccess: true,
    bookingDiscountPct: 0,
    classDiscountPct: 0,
    freeBookingSlotsPerMonth: 0,
    isActive: true,
  },
  {
    id: 'mem-2',
    name: 'Gói Tiêu chuẩn 3 tháng',
    description: 'Vào phòng gym, giảm 10% đặt sân và 5% khóa học',
    price: 800000,
    durationDays: 90,
    gymAccess: true,
    bookingDiscountPct: 10,
    classDiscountPct: 5,
    freeBookingSlotsPerMonth: 2,
    isActive: true,
  },
  {
    id: 'mem-3',
    name: 'Gói Cao cấp 12 tháng',
    description: 'Vào phòng gym, giảm 20% đặt sân và 15% khóa học',
    price: 2800000,
    durationDays: 365,
    gymAccess: true,
    bookingDiscountPct: 20,
    classDiscountPct: 15,
    freeBookingSlotsPerMonth: 4,
    isActive: true,
  },
];

interface MockCourse {
  id: string;
  name: string;
  description: string | null;
  sport: (typeof DEMO_SPORTS)[number];
  totalSessions: number;
  price: number;
  thumbnailUrl: string | null;
}

const DEMO_COURSES: MockCourse[] = [
  {
    id: 'course-badminton-basic',
    name: 'Cầu lông cơ bản',
    description: 'Kỹ thuật nền tảng, thể lực và đánh đôi cơ bản',
    sport: DEMO_SPORTS[0]!,
    totalSessions: 8,
    price: 1200000,
    thumbnailUrl: null,
  },
  {
    id: 'course-badminton-adv',
    name: 'Cầu lông nâng cao',
    description: 'Kỹ thuật đập cầu, điều cầu và chiến thuật thi đấu',
    sport: DEMO_SPORTS[0]!,
    totalSessions: 12,
    price: 1800000,
    thumbnailUrl: null,
  },
  {
    id: 'course-swim-basic',
    name: 'Bơi ếch cơ bản',
    description: 'Học thở nước, nổi và bơi ếch thành thạo',
    sport: DEMO_SPORTS[1]!,
    totalSessions: 10,
    price: 1500000,
    thumbnailUrl: null,
  },
  {
    id: 'course-yoga-flow',
    name: 'Vinyasa Yoga',
    description: 'Thư giãn cơ bắp, cân bằng hơi thở và dẻo dai',
    sport: DEMO_SPORTS[3]!,
    totalSessions: 8,
    price: 1000000,
    thumbnailUrl: null,
  },
];

const DEMO_ACCOUNTS = [
  {
    id: 'mock-member-thu',
    email: 'member1@sportscenter.local',
    fullName: 'Hoàng Anh Thư',
    phone: '0903000001',
    dateOfBirth: '1998-05-12',
    gender: 'FEMALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'MEMBER',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      walletBalance: 5_000_000,
      emergencyContact: '0903999999',
      fitnessGoals: 'Rèn luyện sức khỏe, tăng thể lực',
      healthNotes: null,
    },
  },
  {
    id: 'mock-coach-minh',
    email: 'coach1@sportscenter.local',
    fullName: 'Nguyễn Văn Minh',
    phone: '0901000001',
    dateOfBirth: '1992-08-20',
    gender: 'MALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'COACH',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      bio: 'Huấn luyện viên chuyên môn Cầu lông & Bơi lội',
      experience: '6 năm huấn luyện',
      certifications: 'Chứng chỉ HLV Cầu lông cấp Quốc gia',
      coverImageUrl: null,
    },
  },
  {
    id: 'mock-manager-admin',
    email: 'manager@sportscenter.local',
    fullName: 'Quản lý Trung tâm',
    phone: '0900000000',
    dateOfBirth: '1988-10-10',
    gender: 'MALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'MANAGER',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      staffNotes: null,
    },
  },
  {
    id: 'mock-reception-ha',
    email: 'reception1@sportscenter.local',
    fullName: 'Nguyễn Thu Hà',
    phone: '0902000001',
    dateOfBirth: '1995-03-15',
    gender: 'FEMALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'RECEPTIONIST',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      staffNotes: null,
    },
  },
];

let currentUser: (typeof DEMO_ACCOUNTS)[number] | null = null;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-mock',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/v1')) {
          return next();
        }

        const method = req.method?.toUpperCase();

        // 1. Auth routes
        if (url === '/api/v1/auth/login' && method === 'POST') {
          const body = await parseBody(req);
          const email = String(body.email || '')
            .trim()
            .toLowerCase();
          const found = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email) ?? {
            ...DEMO_ACCOUNTS[0]!,
            email,
          };
          currentUser = found;
          res.setHeader('Set-Cookie', 'access_token=dev_token; Path=/; HttpOnly; SameSite=Lax');
          return sendJson(res, 200, {
            status: true,
            message: 'Đăng nhập thành công (Dev Mock)',
            result: currentUser,
          });
        }

        if (url === '/api/v1/auth/me' && method === 'GET') {
          if (currentUser) {
            return sendJson(res, 200, {
              status: true,
              message: 'OK',
              result: currentUser,
            });
          }
          // Default to Member in dev if nothing logged in yet, or 401
          return sendJson(res, 401, {
            status: false,
            code: 'UNAUTHORIZED',
            message: 'Chưa đăng nhập',
          });
        }

        if (url === '/api/v1/auth/logout' && method === 'POST') {
          currentUser = null;
          res.setHeader('Set-Cookie', 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
          return sendJson(res, 200, { status: true, message: 'Đã đăng xuất' });
        }

        if (url === '/api/v1/auth/refresh' && method === 'POST') {
          return sendJson(res, 200, { status: true, message: 'Refreshed' });
        }

        // 2. Catalog routes
        if (url === '/api/v1/sports' && method === 'GET') {
          return sendJson(res, 200, { status: true, message: 'OK', result: DEMO_SPORTS });
        }

        if (url === '/api/v1/facilities' && method === 'GET') {
          return sendJson(res, 200, { status: true, message: 'OK', result: DEMO_FACILITIES });
        }

        if (url === '/api/v1/settings' && method === 'GET') {
          return sendJson(res, 200, { status: true, message: 'OK', result: DEMO_SETTINGS });
        }

        if (url === '/api/v1/memberships' && method === 'GET') {
          return sendJson(res, 200, { status: true, message: 'OK', result: DEMO_MEMBERSHIPS });
        }

        // 3. Specializations
        if (url.includes('/specializations') && method === 'GET') {
          return sendJson(res, 200, {
            status: true,
            message: 'OK',
            result: [
              { id: 'spec-1', sport: DEMO_SPORTS[0], status: 'APPROVED' },
              { id: 'spec-2', sport: DEMO_SPORTS[1], status: 'APPROVED' },
            ],
          });
        }

        // 4. Wallet routes (for cart / checkout preview)
        if ((url === '/api/v1/me/wallet' || url.includes('/wallet')) && method === 'GET') {
          return sendJson(res, 200, {
            status: true,
            message: 'OK',
            result: {
              balance: 5_000_000,
              transactions: {
                items: [],
                page: 1,
                limit: 20,
                total: 0,
              },
            },
          });
        }

        // 5. Courses CRUD
        if (url === '/api/v1/courses' && method === 'GET') {
          return sendJson(res, 200, { status: true, message: 'OK', result: DEMO_COURSES });
        }

        if (url === '/api/v1/courses' && method === 'POST') {
          const body = await parseBody(req);
          const sport = DEMO_SPORTS.find((s) => s.id === body.sportId) ?? DEMO_SPORTS[0]!;
          const newCourse = {
            id: `course-${Date.now()}`,
            name: String(body.name || 'Khóa học mới'),
            description: body.description ? String(body.description) : null,
            sport,
            totalSessions: Number(body.totalSessions || 8),
            price: Number(body.price || 1200000),
            thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl) : null,
          };
          DEMO_COURSES.unshift(newCourse);
          return sendJson(res, 201, { status: true, message: 'Tạo thành công', result: newCourse });
        }

        if (url.startsWith('/api/v1/courses/') && method === 'PATCH') {
          const courseId = decodeURIComponent(url.replace('/api/v1/courses/', ''));
          const body = await parseBody(req);
          const found = DEMO_COURSES.find((c) => c.id === courseId);
          if (found) {
            if (body.name) found.name = String(body.name);
            if (body.description !== undefined) found.description = body.description ? String(body.description) : null;
            if (body.totalSessions) found.totalSessions = Number(body.totalSessions);
            if (body.price) found.price = Number(body.price);
            if (body.thumbnailUrl !== undefined)
              found.thumbnailUrl = body.thumbnailUrl ? String(body.thumbnailUrl) : null;
            if (body.sportId) {
              const sp = DEMO_SPORTS.find((s) => s.id === body.sportId);
              if (sp) found.sport = sp;
            }
            return sendJson(res, 200, { status: true, message: 'Cập nhật thành công', result: found });
          }
          return sendJson(res, 404, { status: false, message: 'Không tìm thấy khóa học' });
        }

        if (url.startsWith('/api/v1/courses/') && method === 'DELETE') {
          const courseId = decodeURIComponent(url.replace('/api/v1/courses/', ''));
          const idx = DEMO_COURSES.findIndex((c) => c.id === courseId);
          if (idx !== -1) {
            DEMO_COURSES.splice(idx, 1);
            return sendJson(res, 200, { status: true, message: 'Đã xóa' });
          }
          return sendJson(res, 404, { status: false, message: 'Không tìm thấy khóa học' });
        }

        return next();
      });
    },
  };
}
