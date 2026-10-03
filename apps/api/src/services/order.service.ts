import { ERROR_CODE, type ListMyOrdersQuery, type ListOrdersQuery } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toOrderResponse } from '~/mappers/order.mapper';
import orderRepository from '~/repositories/order.repository';
import { ErrorWithStatus } from '~/rules/error';
import { renderReceiptPdf } from '~/services/receipt/receipt.pdf';
import { buildPaymentReceipt, buildRefundReceipt } from '~/services/receipt/receipt.view';
import { toPage } from '~/utils/pagination';

interface Viewer {
  id: string;
  role: Role;
}

const notFound = (message = 'Không tìm thấy đơn hàng') =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });

class OrderService {
  listMine = async (accountId: string, query: ListMyOrdersQuery) => {
    const [rows, total] = await orderRepository.findPageOfAccount(accountId, query);
    return toPage(rows.map(toOrderResponse), total, query);
  };

  list = async (query: ListOrdersQuery) => {
    const [rows, total] = await orderRepository.findPage(query);
    return toPage(rows.map(toOrderResponse), total, query);
  };

  get = async (viewer: Viewer, id: string) => toOrderResponse(await this.findVisible(viewer, id));

  paymentReceipt = async (viewer: Viewer, id: string) => {
    const view = buildPaymentReceipt(await this.findVisible(viewer, id));
    return { fileName: view.fileName, pdf: await renderReceiptPdf(view) };
  };

  refundReceipt = async (viewer: Viewer, id: string, transactionId: string) => {
    const order = await this.findVisible(viewer, id);
    const refund = order.walletTransactions.find((transaction) => transaction.id === transactionId);
    if (!refund) throw notFound('Không tìm thấy khoản hoàn tiền');
    const view = buildRefundReceipt(order, refund);
    return { fileName: view.fileName, pdf: await renderReceiptPdf(view) };
  };

  private findVisible = async (viewer: Viewer, id: string) => {
    const order = await orderRepository.findById(id);
    if (!order || (viewer.role === 'MEMBER' && order.account?.id !== viewer.id)) throw notFound();
    return order;
  };
}

export default new OrderService();
