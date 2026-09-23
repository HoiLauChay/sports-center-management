import { defineConfig, globalIgnores } from 'eslint/config';

import node from '@sports-center/eslint-config/node';

export default defineConfig([globalIgnores(['src/generated']), ...node]);
