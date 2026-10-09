import {
  ERROR_CODE,
  type CreateCheckInBody,
  type ListCheckInsQuery,
  type ListMyCheckInsQuery,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toCheckInResponse } from '~/mappers/checkin.mapper';
import accountRepository from '~/repositories/account.repository';
import checkinRepository from '~/repositories/checkin.repository';
import { ErrorWithStatus } from '~/rules/error';
import { addDays, toCenterDateTime, todayInCenter } from '~/utils/time';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy thành viên',
  });
const notAllowed = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.CHECKIN_NOT_ALLOWED, message });

const startOf = (date: string) => toCenterDateTime(date, 0);
const dayWindow = (date: string) => ({ from: startOf(date), to: startOf(addDays(date, 1)) });

class CheckinService {
  create = async (receptionistId: string, { accountId }: CreateCheckInBody) => {
    const member = await accountRepository.findById(accountId, 'MEMBER');
    if (!member) throw notFound();
    if (member.status !== 'ACTIVE') throw notAllowed('Tài khoản thành viên không hoạt động');

    const today = new Date(todayInCenter());
    const [booked, inClass] = await Promise.all([
      checkinRepository.hasBookingOn(accountId, today),
      checkinRepository.hasSessionOn(accountId, today),
    ]);
    if (!booked && !inClass) {
      throw notAllowed('Thành viên không có lượt đặt sân hay buổi học nào hôm nay');
    }
    return toCheckInResponse(await checkinRepository.create(accountId, receptionistId));
  };

  listMine = async (accountId: string, { from, to }: ListMyCheckInsQuery) =>
    (
      await checkinRepository.findByAccount(accountId, {
        from: from ? startOf(from) : undefined,
        to: to ? startOf(addDays(to, 1)) : undefined,
      })
    ).map(toCheckInResponse);

  list = async ({ date = todayInCenter() }: ListCheckInsQuery) =>
    (await checkinRepository.findBetween(dayWindow(date))).map(toCheckInResponse);
}

export default new CheckinService();
