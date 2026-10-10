import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Shipped code: retailer pages and emails are untrusted input.
    files: ['src/**/*.{ts,tsx}', 'entrypoints/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'Render text, not HTML. Retailer and email content is untrusted.',
        },
        { selector: "CallExpression[callee.name='eval']", message: 'Dynamic code evaluation is not allowed.' },
        { selector: "NewExpression[callee.name='Function']", message: 'Dynamic code evaluation is not allowed.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
