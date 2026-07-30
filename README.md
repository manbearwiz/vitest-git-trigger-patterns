# vitest-git-trigger-patterns

[![npm](https://img.shields.io/npm/v/vitest-git-trigger-patterns?style=flat-square)](https://www.npmjs.com/package/vitest-git-trigger-patterns?activeTab=versions)
[![install size](https://flat.badgen.net/packagephobia/install/vitest-git-trigger-patterns)](https://packagephobia.com/result?p=vitest-git-trigger-patterns)
[![NPM](https://img.shields.io/npm/l/vitest-git-trigger-patterns?style=flat-square)](https://raw.githubusercontent.com/manbearwiz/vitest-git-trigger-patterns/master/LICENSE)
[![npm](https://img.shields.io/npm/dt/vitest-git-trigger-patterns?style=flat-square)](https://www.npmjs.com/package/vitest-git-trigger-patterns)
[![GitHub issues](https://img.shields.io/github/issues/manbearwiz/vitest-git-trigger-patterns?style=flat-square)](https://github.com/manbearwiz/vitest-git-trigger-patterns/issues)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release&style=flat-square)](https://github.com/semantic-release/semantic-release)

Git VCS provider for Vitest to map broad changed files to focused tests during `--changed` runs

## Why?

- Vitest's `--changed` option is great for running tests related to changed files, but it can be too broad in some cases. For example, if you change a shared icon or style file, Vitest will run all tests that import that file, which can be a lot of tests.

## Installation

```sh
npm install --save-dev vitest-git-trigger-patterns
```

## Usage

You can specify the VCS provider in your `vitest.config.ts`:

```ts
import type { UserConfig } from "vitest/config";
import { git } from "vitest-git-trigger-patterns";

export default {
  test: {
    experimental: {
      vcsProvider: git({
        triggerPatterns: [
          {
            pattern: /\/apps\/([^/]+)\/src\/(icons|i18n|styles)\//,
            testsToRun: (_, match) => [`./apps/${match[1]}/tests/rendering.test.ts`, `./apps/${match[1]}/tests/smoke.test.ts`],
          },
          {
            pattern: /\/apps\/([^/]+)\/package\.json$/,
            testsToRun: (_, match) => `./apps/${match[1]}/tests/smoke.test.ts`,
          },
        ],
      }),
    },
  },
} satisfies UserConfig;
```

Run Vitest with changed-file detection as usual:

```sh
vitest --changed
vitest --changed origin/main
```

Patterns receive the absolute changed-file path and the result of `RegExp.exec`. Returned test paths may be absolute or relative to the Vitest project root. Files that do not match a pattern are passed through for Vitest's normal module-graph handling.

Returning an empty array prevents module-graph fallback for that changed file. All matching patterns are evaluated, so another matching pattern can still return tests.
