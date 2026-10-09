import { ERROR_CODE, type ListBookingsQuery, type ListMyBookingsQuery, type Role } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toBookingResponse } from '~/mappers/booking.mapper';
import bookingRepository from '~/repositories/booking.repository';
import { ErrorWithStatus } from '~/rules/error';
import { toPage } from '~/utils/pagination';

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy booking' });

class BookingService {
  listMine = (accountId: string, query: ListMyBookingsQuery) => this.list({ ...query, accountId });

  list = async (query: ListBookingsQuery) => {
    const [rows, total] = await bookingRepository.findPage(query);
    return toPage(rows.map(toBookingResponse), total, query);
  };

  get = async (viewer: { id: string; role: Role }, id: string) => {
    const row = await bookingRepository.findById(id);
    if (!row || (viewer.role === 'MEMBER' && row.account?.id !== viewer.id)) throw notFound();
    return toBookingResponse(row);
  };
}

export default new BookingService();
