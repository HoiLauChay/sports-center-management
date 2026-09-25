import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import { Button, Result } from 'antd';
import { PATHS } from '~/constants/paths';
import { ForbiddenError } from '~/lib/access';

function BackHome() {
  return (
    <Link to={PATHS.dashboard}>
      <Button type="primary">Về trang tổng quan</Button>
    </Link>
  );
}

export function ForbiddenPage() {
  return <Result status="403" title="403" subTitle="Bạn không có quyền truy cập trang này." extra={<BackHome />} />;
}

export function NotFoundPage() {
  return <Result status="404" title="404" subTitle="Không tìm thấy trang bạn yêu cầu." extra={<BackHome />} />;
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  if (error instanceof ForbiddenError) return <ForbiddenPage />;
  return (
    <Result
      status="error"
      title="Đã có lỗi xảy ra"
      subTitle="Trang gặp sự cố khi hiển thị. Vui lòng thử lại."
      extra={<Button onClick={reset}>Thử lại</Button>}
    />
  );
}
