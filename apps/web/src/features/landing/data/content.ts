import { PATHS } from '~/constants/paths';
import { MIN_COURT_RATE, SPORTS, TOTAL_COACHES, TOTAL_COURTS, TOTAL_ROOMS } from './sports';

export const NAV_LINKS = [
  { href: '#sports', label: 'Bộ môn' },
  { href: '#features', label: 'Đặt sân & lớp học' },
  { href: '#benefits', label: 'Thành viên' },
  { href: '#pricing', label: 'Bảng giá' },
  { href: '#info', label: 'Giờ mở cửa' },
];

export const HERO = {
  kicker: 'Trung tâm thể thao đa môn · Mở cửa 06:00 – 22:00, 7 ngày/tuần',
  title: 'Chơi hết mình, mỗi ngày.',
  lead: 'Gym, yoga, bơi, boxing, cầu lông, tennis, pickleball, bóng rổ, bóng đá — 10 bộ môn dưới một mái nhà. Buổi đầu tiên miễn phí, đặt sân online chỉ mất 30 giây.',
  facts: [
    { title: 'Tập thử miễn phí', desc: 'Buổi đầu tiên ở bất kỳ bộ môn nào, không cần mua gói trước' },
    {
      title: `${TOTAL_COURTS + TOTAL_ROOMS} sân & phòng tập`,
      desc: 'Sân thuê theo giờ, phòng tập theo lớp với HLV có chứng chỉ, hồ bơi',
    },
  ],
  // Third fact; the month number is appended at render time
  promo: { titlePrefix: 'Ưu đãi tháng', desc: 'Mua gói All-access 1 năm tặng thêm 1 tháng và 2 buổi PT' },
};

export const STATS = [
  { value: SPORTS.length, label: 'Bộ môn', hint: SPORTS.map((s) => s.name).join(', ') },
  { value: TOTAL_COURTS, label: 'Sân thuê theo giờ', hint: '06:00 – 22:00, khung 1 giờ' },
  { value: TOTAL_ROOMS, label: 'Phòng tập & hồ bơi', hint: 'Học theo lớp, có HLV' },
  { value: TOTAL_COACHES, label: 'Huấn luyện viên', hint: 'Chứng chỉ NASM, RYT-500, ITF… đúng bộ môn' },
];

export const MANIFESTO =
  'Không chỉ là một phòng gym. Là nơi bạn ghé sau giờ làm để đánh một trận cầu lông, sáng cuối tuần để bơi vài vòng, và tối thứ Ba để kịp lớp yoga. Mọi môn bạn thích — dưới một mái nhà.';

export const SPORTS_SECTION = {
  eyebrow: 'Bộ môn',
  title: 'Chọn môn của bạn. Hoặc thử hết.',
  emphasis: 'Hoặc thử hết.',
  sub: 'Từ gym đến bơi, từ cầu lông đến pickleball — 10 bộ môn, mỗi môn có sân riêng, HLV riêng và lịch riêng. Một thẻ thành viên là chơi được tất cả.',
};

export const SHOWCASE = {
  eyebrow: 'Tài khoản thành viên',
  title: 'Mọi thứ trong điện thoại của bạn.',
  emphasis: 'trong điện thoại của bạn.',
  desc: 'Đặt sân lúc 11 giờ đêm cho sáng mai. Xem còn bao nhiêu ngày gói. Biết hôm nay có lớp gì, HLV nào, phòng nào. Không cần gọi điện hỏi.',
  points: ['Đặt sân 24/7', 'Lịch tập cá nhân', 'Kết quả từng buổi'],
};

export type FeatureKey = 'court' | 'class' | 'progress' | 'ai' | 'invoice';

export interface FeatureStep {
  key: FeatureKey;
  title: string;
  desc: string;
  bullets: string[];
}

export const FEATURES_SECTION = {
  eyebrow: 'Cách hoạt động',
  title: 'Đặt sân, đăng ký lớp, theo dõi tiến độ.',
  emphasis: 'theo dõi tiến độ.',
  sub: 'Năm việc bạn sẽ làm nhiều nhất — và mỗi việc trông như thế nào trên app. Cuộn để xem.',
};

export const FEATURE_STEPS: FeatureStep[] = [
  {
    key: 'court',
    title: 'Đặt sân theo giờ',
    desc: 'Chọn ngày, nhìn lưới sân × khung giờ, bấm vào ô trống là xong. Giá hiện ngay, đã trừ ưu đãi theo gói của bạn. Không gọi điện, không chờ xác nhận.',
    bullets: [
      'Đặt trước tới 14 ngày, 24/7',
      'Thấy ngay giờ nào trống, giờ nào có lớp',
      'Hủy trước giờ chơi, hoàn tiền vào tài khoản',
    ],
  },
  {
    key: 'class',
    title: 'Đăng ký lớp, biết trước HLV',
    desc: 'Mỗi lớp ghi rõ HLV phụ trách, chứng chỉ, phòng, lịch trong tuần và còn bao nhiêu chỗ. Gói của bạn vào được lớp nào, hệ thống báo ngay khi đăng ký.',
    bullets: [
      'HLV đúng chuyên môn từng bộ môn',
      'Lịch tuần rõ ràng, nhắc trước giờ học',
      'Điểm danh bằng mã thành viên',
    ],
  },
  {
    key: 'progress',
    title: 'Xem mình tiến bộ đến đâu',
    desc: 'Sau mỗi buổi, HLV ghi lại chỉ số của bạn: tạ, thời gian, quãng đường, độ gắng sức. Bạn mở app là thấy biểu đồ và kỷ lục cá nhân — không cần tự ghi sổ.',
    bullets: ['Chỉ số theo từng bộ môn', 'Biểu đồ tiến bộ tuần / tháng', 'Kỷ lục cá nhân tự động cập nhật'],
  },
  {
    key: 'ai',
    title: 'Kế hoạch tuần cho riêng bạn',
    desc: 'Nói mục tiêu của bạn, hệ thống gợi ý lịch tập tuần dựa trên kết quả gần nhất; HLV xem và chỉnh trước khi gửi. Thắc mắc gì hỏi trợ lý bất cứ lúc nào.',
    bullets: ['Theo mục tiêu: giảm mỡ, tăng cơ, thi đấu', 'HLV duyệt trước khi gửi cho bạn', 'Trợ lý trả lời 24/7'],
  },
  {
    key: 'invoice',
    title: 'Thanh toán rõ ràng, có hóa đơn',
    desc: 'Mua gói, đăng ký lớp hay thuê sân đều có hóa đơn điện tử gửi về tài khoản: mã tra cứu, QR, số tiền bằng chữ. Lịch sử thanh toán xem lại bất cứ lúc nào.',
    bullets: [
      'Hóa đơn điện tử hợp lệ, in được A4',
      'Lịch sử thanh toán đầy đủ',
      'Chuyển khoản, thẻ hoặc tiền mặt tại quầy',
    ],
  },
];

export interface Benefit {
  key: string;
  tag: string;
  title: string;
  desc: string;
  items: string[];
}

export const BENEFITS_SECTION = {
  eyebrow: 'Quyền lợi thành viên',
  title: 'Bạn nhận được gì khi có gói.',
  emphasis: 'khi có gói.',
  backgroundText: 'THÀNH VIÊN',
  endCard: {
    title: 'Chưa có gói vẫn thuê sân được',
    desc: 'Tạo tài khoản miễn phí, đặt sân theo giá thường. Muốn giảm giá sân và vào lớp thì mua gói sau, lúc nào cũng được.',
    cta: 'Tạo tài khoản',
  },
};

export const BENEFITS: Benefit[] = [
  {
    key: 'court',
    tag: 'Sân',
    title: 'Đặt sân online, giảm tới 40%',
    desc: 'Mở app, chọn sân, chọn giờ — 24/7. Thành viên có gói được giảm 10–40% giá thuê sân tùy gói; hủy trước giờ chơi không mất phí.',
    items: [
      '4 sân cầu lông · 2 tennis · 2 pickleball',
      'Sân bóng rổ, sân bóng đá mini 5 người',
      'Thấy ngay sân nào trống giờ nào',
      'Nhận sân bằng mã, không cần giấy tờ',
    ],
  },
  {
    key: 'class',
    tag: 'Lớp',
    title: 'Lớp nhóm không giới hạn',
    desc: 'Gói All-access vào được mọi lớp đang mở: gym, yoga, boxing, bơi, zumba, cầu lông, tennis… Gói theo môn thì không giới hạn số buổi của môn đó.',
    items: [
      '11 lớp đang mở, khai giảng liên tục',
      'Biết trước HLV, phòng, giờ, còn bao nhiêu chỗ',
      'Điểm danh bằng mã thành viên',
      'Đổi lớp nếu lịch cá nhân thay đổi',
    ],
  },
  {
    key: 'coach',
    tag: 'HLV',
    title: 'HLV theo dõi từng buổi tập',
    desc: 'Mỗi buổi HLV ghi lại chỉ số của bạn — tạ, thời gian, quãng đường, độ gắng sức. Bạn xem lại biểu đồ tiến bộ và kỷ lục cá nhân bất cứ lúc nào.',
    items: [
      'HLV có chứng chỉ đúng bộ môn',
      'Kết quả từng buổi, lưu vĩnh viễn',
      'Biểu đồ tiến bộ theo tuần / tháng',
      'Đánh giá định kỳ từ HLV',
    ],
  },
  {
    key: 'ai',
    tag: 'Kế hoạch',
    title: 'Kế hoạch tuần cho riêng bạn',
    desc: 'Dựa trên mục tiêu và kết quả gần nhất, hệ thống đề xuất lịch tập tuần; HLV xem và chỉnh trước khi gửi cho bạn. Có trợ lý trả lời thắc mắc 24/7.',
    items: [
      'Kế hoạch theo mục tiêu: giảm mỡ, tăng cơ, thi đấu',
      'HLV duyệt trước khi gửi',
      'Nhắc lịch tập và lịch sân',
      'Hỏi đáp về bài tập, dinh dưỡng cơ bản',
    ],
  },
];

export const PRICING_SECTION = {
  eyebrow: 'Bảng giá',
  title: 'Gói theo môn hoặc All-access',
  emphasis: 'All-access',
  sub: `Không có gói vẫn thuê sân được — từ ${MIN_COURT_RATE.toLocaleString('vi-VN')}đ/giờ. Có gói thì được giảm giá sân, mức giảm tăng theo thời hạn gói.`,
};

export const INFO_SECTION = {
  eyebrow: 'Giờ mở cửa & liên hệ',
  title: 'Mở cửa từ 6 giờ sáng',
};

export const OPENING_HOURS = [
  { name: 'Sân cầu lông · tennis · pickleball', time: '06:00 – 22:00', note: 'Hằng ngày · khung 1 giờ' },
  { name: 'Sân bóng rổ · bóng đá mini', time: '06:00 – 22:00', note: 'Hằng ngày · đặt tối thiểu 1 giờ' },
  { name: 'Hồ bơi', time: '06:00 – 21:00', note: 'Nghỉ vệ sinh hồ 13:00 – 14:00' },
  { name: 'Phòng gym', time: '06:00 – 22:00', note: 'Hằng ngày, kể cả lễ' },
  { name: 'Phòng Yoga · Zumba · Boxing', time: 'Theo lịch lớp', note: 'Xem lịch tuần sau khi đăng nhập' },
  { name: 'Quầy tiếp đón', time: '06:00 – 22:00', note: 'Đăng ký, gia hạn gói, thanh toán tại chỗ' },
];

export const CONTACT = {
  address:
    'Nhà thi đấu A & B, khu sân ngoài trời và tòa nhà 3 tầng (gym tầng 1, yoga & boxing tầng 2, zumba tầng 3). Hồ bơi ở tầng hầm.',
  phone: '0901 000 002',
  phoneHref: 'tel:0901000002',
  email: 'hello@sc.vn',
  parking: 'Miễn phí cho thành viên có gói; khách thuê sân 5.000đ/lượt.',
};

export const CTA = {
  title: 'Tối nay sân còn trống?',
  emphasis: 'sân còn trống?',
  lead: 'Đăng nhập, chọn sân, chọn giờ. Hệ thống báo ngay nếu trùng lớp hoặc đã có người đặt.',
};

export interface FooterLink {
  label: string;
  href?: string;
}

export const FOOTER = {
  tagline: 'Không chỉ là một phòng gym. Chơi hết mình, mỗi ngày — 10 bộ môn dưới một mái nhà, mở cửa từ 6 giờ sáng.',
  columns: [
    {
      title: 'Trang',
      links: [
        { label: 'Bộ môn', href: '#sports' },
        { label: 'Đặt sân & lớp học', href: '#features' },
        { label: 'Quyền lợi thành viên', href: '#benefits' },
        { label: 'Bảng giá', href: '#pricing' },
        { label: 'Giờ mở cửa', href: '#info' },
      ],
    },
    {
      title: 'Tài khoản',
      links: [
        { label: 'Đăng nhập', href: PATHS.login },
        { label: 'Đăng ký thành viên', href: PATHS.register },
        { label: 'Quên mật khẩu', href: PATHS.forgotPassword },
      ],
    },
    {
      title: 'Liên hệ',
      links: [
        { label: `Hotline ${CONTACT.phone}`, href: CONTACT.phoneHref },
        { label: CONTACT.email, href: `mailto:${CONTACT.email}` },
        { label: 'Mở cửa 06:00 – 22:00, 7 ngày/tuần' },
        { label: 'Chỉ đường & gửi xe', href: '#info' },
      ],
    },
  ] satisfies { title: string; links: FooterLink[] }[],
  copyright: '© 2026 Sports Center Management System',
  project: 'SWP391 · FA26',
};
