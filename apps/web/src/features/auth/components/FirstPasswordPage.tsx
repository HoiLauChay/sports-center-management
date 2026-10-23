import { useMutation } from '@tanstack/react-query';
import { Button } from 'antd';
import heroImg from '~/assets/images/sports/gym.jpg';
import { toApiError } from '~/lib/http-errors';
import { useCompleteAuth, useLogout } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { useSession } from '../session';
import { AuthShell } from './AuthShell';
import { NewPasswordStep, type NewPasswordValues } from './NewPasswordStep';

export function FirstPasswordPage() {
  const user = useSession();
  const completeAuth = useCompleteAuth();
  const logout = useLogout();

  const setPassword = useMutation({
    mutationFn: (values: NewPasswordValues) => authService.setFirstPassword(values),
    onSuccess: completeAuth,
  });

  if (!user) return null;

  return (
    <AuthShell
      visual={{
        image: heroImg,
        imagePosition: 'center 40%',
        kicker: 'Chào mừng bạn',
        title: 'Còn một bước nữa.',
        lead: 'Đặt mật khẩu để lần sau bạn có thể đăng nhập bằng email, kể cả khi không dùng Google.',
        facts: [
          { value: '10', label: 'bộ môn' },
          { value: '15', label: 'sân & phòng tập' },
          { value: '06–22h', label: 'mở cửa hằng ngày' },
        ],
      }}
    >
      <NewPasswordStep
        title="Tạo mật khẩu"
        description={
          <>
            Xin chào {user.fullName}, bạn vừa đăng nhập bằng Google. Đặt mật khẩu cho tài khoản{' '}
            <b className="text-sc-ink [overflow-wrap:anywhere]">{user.email}</b> để hoàn tất.
          </>
        }
        submitLabel="Đặt mật khẩu và vào ứng dụng"
        submitting={setPassword.isPending}
        error={setPassword.error ? toApiError(setPassword.error).message : null}
        onSubmit={(values) => setPassword.mutate(values)}
      />
      <Button type="link" block className="!mt-2 !text-sc-muted" onClick={() => void logout()}>
        Không phải bạn? Đăng xuất
      </Button>
    </AuthShell>
  );
}
