import type { Paginated, Person } from '@sports-center/shared';
import { mockErrors } from '~/lib/mock/errors';
import { createMockStore, newId, nowIso } from '~/lib/mock/store';
import { nowVN } from '~/lib/time';
import {
  NEXT_SUPPORT_STATUS,
  type CreateSupportBody,
  type ListSupportQuery,
  type SupportRequest,
  type UpdateSupportBody,
} from '../types';

interface SupportState {
  requests: SupportRequest[];
}

const ago = (hours: number) => nowVN().subtract(hours, 'hour').toISOString();

const seed = (): SupportState => {
  const person = (fullName: string): Person => ({ id: newId(), fullName });
  const staff: Person = { id: newId(), fullName: 'Lễ tân Quầy 1' };
  return {
    requests: [
      {
        id: newId(),
        account: person('Nguyễn Minh Anh'),
        category: 'PAYMENT',
        subject: 'Đã chuyển khoản nhưng chưa thấy cộng ví',
        description: 'Mình chuyển 500.000₫ lúc 9h sáng nay nhưng số dư ví chưa thay đổi. Nhờ lễ tân kiểm tra giúp.',
        status: 'OPEN',
        resolutionNote: null,
        handledBy: null,
        resolvedAt: null,
        createdAt: ago(3),
        updatedAt: ago(3),
      },
      {
        id: newId(),
        account: person('Trần Quốc Bảo'),
        category: 'BOOKING',
        subject: 'Muốn đổi giờ đặt sân cầu lông',
        description: 'Mình đã đặt sân tối thứ 6 nhưng bận đột xuất, muốn dời sang tối thứ 7.',
        status: 'IN_PROGRESS',
        resolutionNote: 'Đang kiểm tra sân trống tối thứ 7, sẽ phản hồi sớm.',
        handledBy: staff,
        resolvedAt: null,
        createdAt: ago(20),
        updatedAt: ago(5),
      },
      {
        id: newId(),
        account: person('Lê Thu Hà'),
        category: 'MEMBERSHIP',
        subject: 'Hỏi về quyền lợi gia hạn gói',
        description: 'Gói của mình còn 5 ngày, nếu gia hạn bây giờ có được nối tiếp ngày hết hạn không?',
        status: 'RESOLVED',
        resolutionNote: 'Có. Kỳ mới nối tiếp từ ngày hết hạn của gói hiện tại, quyền lợi giữ nguyên theo gói bạn mua.',
        handledBy: staff,
        resolvedAt: ago(30),
        createdAt: ago(48),
        updatedAt: ago(30),
      },
    ],
  };
};

const store = createMockStore<SupportState>('sc_mock_support_v1', seed);

function assertNext(current: SupportRequest['status'], next: NonNullable<UpdateSupportBody['status']>) {
  if (NEXT_SUPPORT_STATUS[current] !== next) {
    throw mockErrors.conflict(
      'INVALID_STATE',
      'Trạng thái chỉ được tiến theo thứ tự: Mới → Đang xử lý → Đã xử lý → Đã đóng',
    );
  }
}

export const supportDb = {
  create(actor: Person, body: CreateSupportBody): SupportRequest {
    return store.update((state) => {
      const now = nowIso();
      const request: SupportRequest = {
        id: newId(),
        account: { id: actor.id, fullName: actor.fullName },
        category: body.category,
        subject: body.subject.trim(),
        description: body.description.trim(),
        status: 'OPEN',
        resolutionNote: null,
        handledBy: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      state.requests.unshift(request);
      return request;
    });
  },

  listMine: (accountId: string): SupportRequest[] =>
    store
      .get()
      .requests.filter((request) => request.account.id === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  list(query: ListSupportQuery): Paginated<SupportRequest> {
    const term = query.q?.trim().toLowerCase();
    const rows = store
      .get()
      .requests.filter((request) => {
        if (query.status && request.status !== query.status) return false;
        if (query.category && request.category !== query.category) return false;
        if (term && !`${request.subject} ${request.account.fullName}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = (query.page - 1) * query.limit;
    return { items: rows.slice(start, start + query.limit), page: query.page, limit: query.limit, total: rows.length };
  },

  get(id: string): SupportRequest {
    const request = store.get().requests.find((entry) => entry.id === id);
    if (!request) throw mockErrors.notFound('Không tìm thấy yêu cầu hỗ trợ');
    return request;
  },

  update(actor: Person, id: string, body: UpdateSupportBody): SupportRequest {
    return store.update((state) => {
      const request = state.requests.find((entry) => entry.id === id);
      if (!request) throw mockErrors.notFound('Không tìm thấy yêu cầu hỗ trợ');
      if (request.status === 'CLOSED')
        throw mockErrors.conflict('INVALID_STATE', 'Yêu cầu đã đóng, không thể cập nhật');

      const note = body.resolutionNote === undefined ? request.resolutionNote : body.resolutionNote.trim() || null;
      if (body.status) {
        assertNext(request.status, body.status);
        if (body.status === 'RESOLVED' && !note) {
          throw mockErrors.invalid('body.resolutionNote', 'Vui lòng nhập phản hồi cho thành viên trước khi hoàn tất');
        }
        request.status = body.status;
        request.handledBy ??= { id: actor.id, fullName: actor.fullName };
        if (body.status === 'RESOLVED') request.resolvedAt = nowIso();
      }
      request.resolutionNote = note;
      request.updatedAt = nowIso();
      return request;
    });
  },
};
