import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

// TODO: replace with the real page in features/auth
function ForgotPasswordPage() {
  return <div style={{ padding: 40 }}>ForgotPassword — đang phát triển</div>;
}
