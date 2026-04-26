// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ─── Local rule: tenant isolation enforcement ─────────────────────────────────
//
// Every public repository method that queries a tenant-scoped table (one with
// a storeFk column) must accept storeId as an explicit parameter.
//
// Pattern (mirrors Ayphen's explicit tenant-ID threading):
//   Controller  — extracts user.activeStoreId from req.user
//   Service     — receives storeId, passes to repository
//   Repository  — takes storeId as first param, adds eq(table.storeFk, storeId)
//
// The rule detects: method body references `storeFk` (outside of an isNull()
// call) AND neither the parameters nor the body mention `storeId` / `tenantId`.
// Private helpers are excluded — they compose queries for the public methods
// that own the storeId parameter.
//
// False positives (e.g. a JOIN condition using storeFk that doesn't need a
// storeId param) can be suppressed per-method with:
//   // eslint-disable-next-line nks-local/require-tenant-param
/** @type {import('eslint').Rule.RuleModule} */
const requireTenantParam = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Public repository methods that reference storeFk must accept storeId as an explicit parameter',
    },
    messages: {
      missingParam:
        'Method "{{name}}" references storeFk but has no storeId parameter — potential cross-tenant data leak. ' +
        'Add storeId: number as the first parameter and scope the WHERE clause to it. ' +
        'If the global-only filter is intentional, suppress with // eslint-disable-next-line nks-local/require-tenant-param',
    },
  },
  create(context) {
    if (!context.filename.endsWith('.repository.ts')) return {};
    return {
      MethodDefinition(node) {
        // Constructors and private helpers are excluded.
        // Private helpers compose queries; the public callers own the storeId param.
        if (node.kind === 'constructor') return;
        // `accessibility` is TypeScript-specific and absent from the base ESTree type.
        if (/** @type {any} */ (node).accessibility === 'private') return;
        if (!node.value.body) return;

        const src = context.sourceCode.getText(node.value.body);

        // Strip intentional global-only filters — isNull(table.storeFk) means
        // "fetch platform-wide records only", which is a valid design choice and
        // does not need a storeId parameter.
        const withoutIsNull = src
          .replace(/isNull\s*\([^)]*storeFk[^)]*\)/g, '__ISNULL__')
          .replace(/isNull\s*\([^)]+\)/g, '__ISNULL__');
        if (!withoutIsNull.includes('storeFk')) return;

        // Exempt when any direct parameter is named storeId / tenantId / storeFk.
        // storeFk is the DB column name and appears as a param in write methods
        // (assignRole, removeRole, etc.) — those are already correctly scoped.
        const params = node.value.params;
        const hasTenantParam = params.some((p) => {
          const name =
            p.type === 'Identifier'
              ? p.name
              : p.type === 'AssignmentPattern'
                ? (/** @type {any} */ (p).left?.name ?? '')
                : '';
          return name === 'storeId' || name === 'tenantId' || name === 'storeFk';
        });
        if (hasTenantParam) return;

        // Also exempt when the body references storeId or tenantId as a variable
        // (e.g. accessed from a destructured opts object: opts.storeId).
        if (src.includes('storeId') || src.includes('tenantId')) return;

        const methodName =
          node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal'
              ? String(node.key.value)
              : '(computed)';

        context.report({
          node: node.key,
          messageId: 'missingParam',
          data: { name: methodName },
        });
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // ── Tenant isolation ─────────────────────────────────────────────────────────
  {
    files: ['src/contexts/**/*.repository.ts', 'src/shared/**/*.repository.ts'],
    plugins: {
      'nks-local': { rules: { 'require-tenant-param': requireTenantParam } },
    },
    rules: {
      'nks-local/require-tenant-param': 'error',
    },
  },
);
