import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { GitNotFoundError, GitVCSProvider, git } from './index.js';

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function createRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vitest-git-trigger-patterns-'));
  roots.push(root);
  await gitCommand(root, 'init');
  await gitCommand(root, 'config', 'user.email', 'test@example.com');
  await gitCommand(root, 'config', 'user.name', 'Test');
  return root;
}

async function gitCommand(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root });
  return stdout.trim();
}

async function createFile(
  root: string,
  path: string,
  contents = '',
): Promise<void> {
  const filename = resolve(root, path);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, contents);
}

describe('git', () => {
  test('maps changed files to focused tests and retains unmatched files', async () => {
    const root = await createRepository();
    await createFile(root, 'src/generated/first.ts');
    await createFile(root, 'src/generated/second.ts');
    await createFile(root, 'src/included.ts');

    const provider = git({
      triggerPatterns: [
        {
          pattern: /\/src\/generated\/([^/]+)\.ts$/g,
          testsToRun: (_, match) => `tests/${match[1]}.test.ts`,
        },
      ],
    });

    const files = await provider.findChangedFiles({ root });

    expect(files.map((file) => relative(root, file)).sort()).toEqual([
      'src/included.ts',
      'tests/first.test.ts',
      'tests/second.test.ts',
    ]);
  });

  test('ignores a changed file when a matching pattern returns no tests', async () => {
    const root = await createRepository();
    await createFile(root, 'src/icons/index.ts');
    await createFile(root, 'src/included.ts');

    const provider = git({
      triggerPatterns: [{ pattern: /\/src\/icons\//, testsToRun: () => [] }],
    });

    const files = await provider.findChangedFiles({ root });

    expect(files.map((file) => relative(root, file))).toEqual([
      'src/included.ts',
    ]);
  });

  test('evaluates a file only once when it is both staged and modified', async () => {
    const root = await createRepository();
    await createFile(root, 'src/changed.ts', 'first');
    await gitCommand(root, 'add', '.');
    await createFile(root, 'src/changed.ts', 'second');
    const testsToRun = vi.fn(() => 'tests/changed.test.ts');

    const provider = git({
      triggerPatterns: [{ pattern: /\/src\/changed\.ts$/, testsToRun }],
    });
    const files = await provider.findChangedFiles({ root });

    expect(files.map((file) => relative(root, file))).toEqual([
      'tests/changed.test.ts',
    ]);
    expect(testsToRun).toHaveBeenCalledOnce();
  });

  test('supports changed file names containing newlines', async () => {
    const root = await createRepository();
    await createFile(root, 'src/line\nbreak.ts');
    await gitCommand(root, 'add', '.');

    const files = await git().findChangedFiles({ root });

    expect(files).toEqual([resolve(root, 'src/line\nbreak.ts')]);
  });

  test('includes committed changes since a revision', async () => {
    const root = await createRepository();
    await createFile(root, 'README.md', 'initial');
    await gitCommand(root, 'add', '.');
    await gitCommand(root, 'commit', '-m', 'initial');
    const baseline = await gitCommand(root, 'rev-parse', 'HEAD');
    await createFile(root, 'src/committed.ts');
    await gitCommand(root, 'add', '.');
    await gitCommand(root, 'commit', '-m', 'change');
    await createFile(root, 'src/untracked.ts');

    const files = await git().findChangedFiles({
      root,
      changedSince: baseline,
    });

    expect(files.map((file) => relative(root, file)).sort()).toEqual([
      'src/committed.ts',
      'src/untracked.ts',
    ]);
  });

  test('includes Git stderr when a changed revision is invalid', async () => {
    const root = await createRepository();

    await expect(
      git().findChangedFiles({ root, changedSince: 'not-a-revision' }),
    ).rejects.toThrow(/not-a-revision/);
  });

  test('resolves returned tests from a nested Vitest project root', async () => {
    const repository = await createRepository();
    const root = resolve(repository, 'packages/app');
    await createFile(root, 'src/generated.ts');

    const provider = git({
      triggerPatterns: [
        {
          pattern: /\/src\/generated\.ts$/,
          testsToRun: () => 'tests/generated.test.ts',
        },
      ],
    });
    const files = await provider.findChangedFiles({ root });

    expect(files).toEqual([resolve(root, 'tests/generated.test.ts')]);
  });
});

describe('GitVCSProvider', () => {
  test('throws a descriptive error outside a Git repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vitest-git-trigger-patterns-'));
    roots.push(root);

    await expect(
      new GitVCSProvider().findChangedFiles({ root }),
    ).rejects.toBeInstanceOf(GitNotFoundError);
  });
});
