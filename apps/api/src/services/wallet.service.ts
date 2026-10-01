import { ERROR_CODE, type WalletQuery } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toWalletTransactionResponse } from '~/mappers/wallet.mapper';
import accountRepository from '~/repositories/account.repository';
import walletRepository from '~/repositories/wallet.repository';
import { ErrorWithStatus } from '~/rules/error';
import { toPage } from '~/utils/pagination';

class WalletService {
  getMine = (accountId: string, query: WalletQuery) => this.load(accountId, query);

  getForMember = async (accountId: string, query: WalletQuery) => {
    if (!(await accountRepository.findById(accountId, 'MEMBER'))) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Không tìm thấy thành viên',
      });
    }
    return this.load(accountId, query);
  };

  private load = async (accountId: string, query: WalletQuery) => {
    const [profile, [rows, total]] = await Promise.all([
      walletRepository.findBalance(accountId),
      walletRepository.findTransactionPage(accountId, query),
    ]);
    return {
      balance: Number(profile?.walletBalance ?? 0),
      transactions: toPage(rows.map(toWalletTransactionResponse), total, query),
    };
  };
}

export default new WalletService();
