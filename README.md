# vitest-git-trigger-patterns

[![npm](https://img.shields.io/npm/v/vitest-git-trigger-patterns?style=flat-square)](https://www.npmjs.com/package/vitest-git-trigger-patterns?activeTab=versions)
[![install size](https://flat.badgen.net/packagephobia/install/vitest-git-trigger-patterns)](https://packagephobia.com/result?p=vitest-git-trigger-patterns)
[![NPM](https://img.shields.io/npm/l/vitest-git-trigger-patterns?style=flat-square)](https://raw.githubusercontent.com/manbearwiz/vitest-git-trigger-patterns/master/LICENSE)
[![npm](https://img.shields.io/npm/dt/vitest-git-trigger-patterns?style=flat-square)](https://www.npmjs.com/package/vitest-git-trigger-patterns)
[![GitHub issues](https://img.shields.io/github/issues/manbearwiz/vitest-git-trigger-patterns?style=flat-square)](https://github.com/manbearwiz/vitest-git-trigger-patterns/issues)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release&style=flat-square)](https://github.com/semantic-release/semantic-release)

A custom Git VCS provider for Vitest that maps broad file changes to focused tests during `--changed` runs, mirroring the behavior of the [`watchTriggerPatterns`](https://vitest.dev/config/watchtriggerpatterns) configuration.

## Why?

Vitest's `--changed` flag is incredibly useful for running tests related to changed files, but it can sometimes be too broad. For example, modifying a globally shared icon or style file might trigger every test that imports it. 

While Vitest allows you to narrow this focus in `watch` mode using `watchTriggerPatterns`, those patterns are ignored when using the `--changed` flag. This package bridges that gap.

## Installation

```sh
npm install --save-dev vitest-git-trigger-patterns
```

## Usage

Specify the custom VCS provider in your `vitest.config.ts`:

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
# or against a specific branch
vitest --changed origin/main
```

## How It Works

Patterns receive the absolute changed-file path and the result of `RegExp.exec`. Returned test paths may be absolute or relative to the Vitest project root. Files that do not match a pattern are passed through for Vitest's normal module-graph handling.

Returning an empty array prevents module-graph fallback for that changed file. All matching patterns are evaluated, so another matching pattern can still return tests.
