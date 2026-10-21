import { useMutation, useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Button, Result, Spin } from 'antd';
import heroImg from '~/assets/images/sports/gym.jpg';
import { PATHS } from '~/constants/paths';
import { toApiError } from '~/lib/http-errors';
import { useCompleteAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { AuthShell } from './AuthShell';
import { NewPasswordStep, type NewPasswordValues } from './NewPasswordStep';

const routeApi = getRouteApi('/_auth/activate');

export function ActivatePage() {
  const { token = '' } = routeApi.useSearch();
  const completeAuth = useCompleteAuth();

  const activation = useQuery({
    queryKey: ['auth', 'activation', token],
    queryFn: () => authService.checkActivation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const activate = useMutation({
    mutationFn: (values: NewPasswordValues) => authService.activate({ token, ...values }),
    onSuccess: completeAuth,
  });

  const unusable = !token || activation.isError;

  return (
    <AuthShell
      visual={{
        image: heroImg,
        imagePosition: 'center 40%',
        kicker: 'Chào mừng bạn',
        title: 'Tài khoản đã sẵn sàng.',
        lead: 'Đặt mật khẩu một lần là bạn có thể vào ứng dụng ngay, những lần sau đăng nhập bằng email và mật khẩu này.',
        facts: [
          { value: '10', label: 'bộ môn' },
          { value: '15', label: 'sân & phòng tập' },
          { value: '06–22h', label: 'mở cửa hằng ngày' },
        ],
      }}
    >
      {unusable && (
        <Result
          status="warning"
          title="Link kích hoạt không dùng được"
          subTitle={
            token
              ? toApiError(activation.error).message
              : 'Link thiếu mã kích hoạt. Bạn vẫn có thể đăng nhập bằng email để nhận mã đặt mật khẩu.'
          }
          extra={
            <Link to={PATHS.login}>
              <Button type="primary">Đăng nhập bằng email</Button>
            </Link>
          }
        />
      )}

      {!unusable && activation.isPending && (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      )}

      {activation.data && (
        <NewPasswordStep
          title="Kích hoạt tài khoản"
          description={
            <>
              Xin chào {activation.data.fullName}, đặt mật khẩu cho tài khoản{' '}
              <b className="text-sc-ink [overflow-wrap:anywhere]">{activation.data.email}</b> để bắt đầu sử dụng.
            </>
          }
          submitLabel="Đặt mật khẩu và vào ứng dụng"
          submitting={activate.isPending}
          error={activate.error ? toApiError(activate.error).message : null}
          onSubmit={(values) => activate.mutate(values)}
        />
      )}
    </AuthShell>
  );
}
