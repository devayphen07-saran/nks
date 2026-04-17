// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config for nks-mobile (Expo / React Native).
 *
 * Run via: pnpm --filter nks-mobile lint
 * Or:      expo lint  (Expo delegates to this config if present)
 */
export default tseslint.config(
  // ── Ignores ───────────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'drizzle/**',           // auto-generated SQL migration files
      'drizzle-sql-transformer.js',
      'metro.config.js',
      'babel.config.js',
    ],
  },

  // ── Base rules ────────────────────────────────────────────────────────────
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Mobile-specific overrides ─────────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Mobile uses createLogger() — bare console.* calls should be avoided
      'no-console': 'warn',

      'prefer-const': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],

      // React Native common false-positives — disable rules that don't apply
      '@typescript-eslint/no-require-imports': 'off', // metro transformer uses require()
    },
  },
);
