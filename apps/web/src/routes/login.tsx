import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

// TODO: replace with the real page in features/auth
function LoginPage() {
  return <div style={{ padding: 40 }}>Login — đang phát triển</div>;
}
