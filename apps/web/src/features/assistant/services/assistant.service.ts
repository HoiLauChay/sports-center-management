import { formatDate } from '~/lib/format';
import { mockRequest } from '~/lib/mock/errors';
import { formatDayLabel } from '~/lib/time';
import type { AssistantContext, AssistantSource } from '../types';

/** Lowercase, no Vietnamese diacritics: "Gói của tôi" → "goi cua toi". */
function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
}

const FALLBACK =
  'Mình chưa hiểu câu hỏi này. Bạn có thể hỏi về lịch tập, gói thành viên, lớp đang học, lượt check-in hoặc giờ mở cửa của trung tâm.';

const UNAVAILABLE = 'Mình chưa lấy được dữ liệu này lúc này, bạn thử lại sau ít phút nhé.';

function answer(question: string, ctx: AssistantContext): string {
  const q = normalize(question);
  const missing = (source: AssistantSource) => ctx.unavailable.includes(source);

  if (/gio mo cua|mo cua|dong cua|may gio/.test(q)) {
    return ctx.openingHours
      ? `Trung tâm mở cửa từ ${ctx.openingHours.openTime} đến ${ctx.openingHours.closeTime} mỗi ngày.`
      : 'Mình chưa lấy được giờ mở cửa lúc này, bạn thử lại sau nhé.';
  }

  if (/cac goi|goi nao|bang gia|mua goi/.test(q)) {
    return 'Bạn xem danh sách gói cùng quyền lợi và giá ở trang Gói thành viên. Mình có thể cho biết gói hiện tại của bạn nếu bạn hỏi "Gói của tôi còn bao lâu?".';
  }

  if (/goi|het han|gia han|membership/.test(q)) {
    const m = ctx.membership;
    if (missing('membership')) return UNAVAILABLE;
    if (!m) return 'Bạn chưa có gói thành viên nào đang hoạt động. Bạn có thể chọn gói ở trang Gói thành viên.';
    return `Gói thành viên của bạn (${m.name}) còn ${m.daysLeft} ngày, hết hạn ngày ${formatDate(m.endDate)}. Bạn có thể gia hạn ở trang Gói của tôi.`;
  }

  if (/lich|buoi|hom nay|tuan nay|ke tiep|sap toi/.test(q)) {
    const s = ctx.nextSession;
    if (missing('schedule')) return UNAVAILABLE;
    if (!s)
      return 'Trong 2 tuần tới bạn chưa có buổi tập hay lượt đặt sân nào. Bạn có thể đăng ký lớp hoặc đặt sân để bắt đầu.';
    return `Buổi kế tiếp của bạn là ${s.title}, ${s.startTime}–${s.endTime} ${formatDayLabel(s.date)} tại ${s.facility}. Lịch đầy đủ nằm ở trang Lịch của tôi.`;
  }

  if (/lop/.test(q)) {
    if (missing('classes')) return UNAVAILABLE;
    if (ctx.classes.length === 0)
      return 'Bạn chưa tham gia lớp nào. Trang Lớp học có danh sách các lớp đang mở đăng ký.';
    return `Bạn đang học ${ctx.classes.length} lớp: ${ctx.classes.join(', ')}. Để tìm lớp còn chỗ, bạn mở trang Lớp học nhé.`;
  }

  if (/check.?in|di tap|so lan|chuyen can/.test(q)) {
    if (missing('checkIns')) return UNAVAILABLE;
    return `Tháng này bạn đã check-in ${ctx.checkInsThisMonth} lần. Giữ nhịp đều đặn nhé!`;
  }

  if (/bai tap|tap gi|giao an|ke hoach/.test(q)) {
    return 'Bài tập và kết quả từ huấn luyện viên nằm ở trang Kết quả tập luyện. Tính năng gợi ý bài tập cá nhân bằng AI đang được phát triển.';
  }

  return FALLBACK;
}

/** The assistant reply. Mock until the assistant has an API: replies follow keywords over the member's own data. */
export const assistantService = {
  ask: (question: string, context: AssistantContext) => mockRequest(() => answer(question, context), 700),
};
