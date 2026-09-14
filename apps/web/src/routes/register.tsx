import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

// TODO: replace with the real page in features/auth
function RegisterPage() {
  return <div style={{ padding: 40 }}>Register — đang phát triển</div>;
}
