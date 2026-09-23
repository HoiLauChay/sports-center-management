import app from '~/app';
import { env } from '~/configs/env';

app.listen(env.PORT, () => {
  console.warn(`✓ Server running on http://localhost:${env.PORT}`);
});
