import { defineConfig, globalIgnores } from 'eslint/config';

import react from '@sports-center/eslint-config/react';

export default defineConfig([globalIgnores(['src/routeTree.gen.ts', '.tanstack']), ...react]);
