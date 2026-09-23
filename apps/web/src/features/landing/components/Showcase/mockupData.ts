export const MOCK_USER = { name: 'Hoàng Thị Dung', initials: 'HD', email: 'member.dung@gmail.com' };

export const MOCK_NAV = [
  { label: 'Trang chủ', active: true },
  { label: 'Gói thành viên', active: false },
  { label: 'Lớp học', active: false },
  { label: 'Đặt sân', active: false },
  { label: 'Lịch tập của tôi', active: false },
  { label: 'Kết quả & tiến độ', active: false },
];

export const MOCK_STATS = [
  { title: 'Gói của bạn', value: 'All-access 3 tháng', color: '#0f4d34', hint: 'Còn 47 ngày · giảm 25% sân' },
  { title: 'Buổi tập tháng này', value: '12', color: '#16a34a', hint: '+3 so với tháng trước' },
  { title: 'Kỷ lục mới', value: 'Squat 40 kg', color: '#7c5cbf', hint: 'Tuần trước: 37,5 kg' },
  { title: 'Sân đã đặt', value: 'Tối nay 18:00', color: '#c94a1e', hint: 'Sân cầu lông 2 · 2 giờ' },
];

export interface MockEvent {
  time: string;
  name: string;
  color: string;
}

export const MOCK_WEEK: { day: string; events: MockEvent[] }[] = [
  { day: 'T2', events: [{ time: '06:30', name: 'Gym cơ bản K12', color: '#0f4d34' }] },
  { day: 'T3', events: [] },
  {
    day: 'T4',
    events: [
      { time: '06:30', name: 'Gym cơ bản K12', color: '#0f4d34' },
      { time: '18:00', name: 'Sân cầu lông 2', color: '#16a34a' },
    ],
  },
  { day: 'T5', events: [{ time: '19:00', name: 'Yoga tối', color: '#7c5cbf' }] },
  {
    day: 'T6',
    events: [
      { time: '06:30', name: 'Gym cơ bản K12', color: '#0f4d34' },
      { time: '18:00', name: 'Sân cầu lông 2', color: '#16a34a' },
    ],
  },
  { day: 'T7', events: [{ time: '09:00', name: 'Bơi tự do', color: '#0891b2' }] },
  { day: 'CN', events: [] },
];

export const MOCK_HOURS = Array.from({ length: 16 }, (_, i) => String(6 + i).padStart(2, '0'));

export const MOCK_BOOKED_SLOTS = [2, 3, 7, 12, 13];
export const MOCK_CLASS_SLOTS = [8, 9];
