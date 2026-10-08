// Lint config. Four rules here are load-bearing and must stay clean:
// `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`, `no-undef`, and
// the no-silent-catch pair (see each for why).
//
// React error #310 ("Rendered more hooks than during the previous render") has
// hit production three times, always the same shape: a hook sitting below an
// early return, where the guard flips after mount. Nothing caught it because
// the repo had `eslint-disable-line react-hooks/exhaustive-deps` comments but
// no ESLint. rules-of-hooks is an error and must stay clean.
//
// exhaustive-deps is an error too. A hook missing a dependency keeps using the
// values from an earlier render — the "only right after a reload" bugs
// (permissions frozen at sign-in, closed days not noticed). The backlog was
// cleared before it was made an error. When a hook really must ignore a
// dependency, disable it on that line and say why:
//   // eslint-disable-next-line react-hooks/exhaustive-deps -- <reason>
// Adding a dependency that is a fresh object/array every render makes the
// effect re-run every render — stabilise it (useMemo/useCallback, a module
// constant, or depend on a primitive) rather than reaching for the disable.

import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import noSilentCatch from './eslint-rules/no-silent-catch.js';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'android/**',
      'ios/**',
      'public/**',
      'Pelikn-Materials/**',
    ],
  },

  // Baseline for every source file. `js.configs.recommended` is not enabled
  // wholesale — this config exists to gate hooks, and a few hundred pre-existing
  // no-unused-vars would bury the rule that matters.
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // No `project` — parser-only, no type-aware rules. Keeps lint fast.
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      local: { rules: { 'no-silent-catch': noSilentCatch } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // No silently swallowed errors. A failed save that looks like it worked
      // is worse than a crash — it is how compliance records go missing
      // without anyone knowing. An empty catch must hold a comment saying why
      // ignoring is safe; otherwise report it (src/lib/reportError.js) or show
      // it to the user. `no-empty` covers try/catch, `local/no-silent-catch`
      // covers `.catch(() => {})` and friends.
      'no-empty': ['error', { allowEmptyCatch: false }],
      'local/no-silent-catch': 'error',
    },
  },

  // Service worker: workbox globals, no window/document.
  {
    files: ['src/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },

  // Tests run under vitest with jsdom, so they keep the browser globals above
  // and add the vitest ones. Node globals too — specs reach for `global`
  // when stubbing (e.g. `global.fetch = vi.fn()`).
  {
    files: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'src/**/__tests__/**', 'src/test-setup.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.node,
      },
    },
  },

  // `no-undef` for plain JS/JSX only.
  //
  // tsconfig sets `checkJs: false`, so tsc never type-checks .js/.jsx — and
  // that is most of this codebase. A missing import in a .jsx file was
  // therefore caught by nothing: not tsc, not lint. Rollup emits a warning
  // ("X is not exported by Y") but still exits 0, so the build went green too.
  // This closes that gap.
  //
  // Deliberately NOT applied to .ts/.tsx: tsc already checks those under
  // `strict`, and typescript-eslint recommends against no-undef on TS files
  // because type-only references trip it.
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-undef': 'error',
    },
  },
];
