import { getRouteApi } from '@tanstack/react-router';
import { OrderDetailView } from './OrderDetailView';

const memberDetail = getRouteApi('/_authenticated/_member/orders/$orderId');

export function MemberOrderDetailPage() {
  const { orderId } = memberDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/orders', label: 'Hóa đơn của tôi' }} />;
}
