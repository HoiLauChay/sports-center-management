import { createFileRoute } from '@tanstack/react-router';
import { AssistantPage } from '~/features/assistant';

export const Route = createFileRoute('/_authenticated/_member/assistant')({
  component: AssistantPage,
});
