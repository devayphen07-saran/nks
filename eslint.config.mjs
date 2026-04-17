// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint flat config — applies across all apps and libs in the monorepo.
 *
 * Each app (nks-backend, nks-mobile) can extend or override via their own
 * eslint.config.mjs. Rules here are intentionally conservative to avoid
 * conflicts with app-level configs.
 *
 * Run: pnpm lint  (delegates to nx run-many -t lint)
 */
export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/.next/**',
      '**/drizzle/**',        // auto-generated migration files
      '**/*.gen.ts',          // codegen outputs
      '**/*.config.js',       // plain-JS config files (metro, babel, etc.)
      '**/coverage/**',
    ],
  },

  // ── Base recommended rules ────────────────────────────────────────────────
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Monorepo-wide TypeScript overrides ────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Explicit any is a red flag — use unknown or a typed generic instead
      '@typescript-eslint/no-explicit-any': 'error',

      // Unused vars are noise — allow underscore-prefixed params to opt out
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // console.log left in code signals missing logger usage
      'no-console': 'warn',

      // Empty catch blocks hide errors silently
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Prefer const for variables that are never reassigned
      'prefer-const': 'error',
    },
  },
);
