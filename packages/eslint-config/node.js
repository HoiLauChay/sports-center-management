import { defineConfig } from 'eslint/config';
import globals from 'globals';

import base from './base.js';

export default defineConfig([
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
