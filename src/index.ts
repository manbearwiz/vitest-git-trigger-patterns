import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface VCSProviderOptions {
  root: string;
  changedSince?: string | boolean;
}

export interface VCSProvider {
  findChangedFiles(options: VCSProviderOptions): Promise<string[]>;
}

export interface TriggerPattern {
  pattern: RegExp;
  testsToRun: (
    changedFile: string,
    match: RegExpExecArray,
  ) => string | string[];
}

export interface GitVCSProviderOptions {
  /**
   * Replace a changed file with the test files it should run, instead of
   * relying on `forceRerunTriggers` and the module graph.
   *
   * Uses the same shape as `watchTriggerPatterns` and is matched against
   * absolute paths. Returning an empty array ignores the changed file.
   */
  triggerPatterns?: TriggerPattern[];
}

export class GitNotFoundError extends Error {
  constructor() {
    super('Cannot find the Git root for the Vitest project.');
    this.name = 'GitNotFoundError';
  }
}

export class GitVCSProvider implements VCSProvider {
  private readonly options: GitVCSProviderOptions;

  constructor(options: GitVCSProviderOptions = {}) {
    this.options = options;
  }

  private async resolveFiles(root: string, args: string[]): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', [...args, '-z'], {
        cwd: root,
      });
      return stdout
        .split('\0')
        .filter(Boolean)
        .map((changedPath) => resolve(root, changedPath));
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        error.message = String(error.stderr);
      }
      throw error;
    }
  }

  async findChangedFiles(options: VCSProviderOptions): Promise<string[]> {
    const gitRoot = await this.getRoot(options.root);
    if (!gitRoot) {
      throw new GitNotFoundError();
    }

    const changedSince = options.changedSince;
    let files: string[];
    if (typeof changedSince === 'string') {
      const [committed, staged, unstaged] = await Promise.all([
        this.resolveFiles(gitRoot, [
          'diff',
          '--name-only',
          `${changedSince}...HEAD`,
        ]),
        this.resolveFiles(gitRoot, ['diff', '--cached', '--name-only']),
        this.resolveFiles(gitRoot, [
          'ls-files',
          '--other',
          '--modified',
          '--exclude-standard',
        ]),
      ]);
      files = [...committed, ...staged, ...unstaged];
    } else {
      const [staged, unstaged] = await Promise.all([
        this.resolveFiles(gitRoot, ['diff', '--cached', '--name-only']),
        this.resolveFiles(gitRoot, [
          'ls-files',
          '--other',
          '--modified',
          '--exclude-standard',
        ]),
      ]);
      files = [...staged, ...unstaged];
    }

    return this.applyTriggerPatterns([...new Set(files)], options.root);
  }

  private applyTriggerPatterns(files: string[], root: string): string[] {
    const patterns = this.options.triggerPatterns;
    if (!patterns?.length) {
      return files;
    }

    const result = new Set<string>();

    for (const file of files) {
      const triggeredTests = this.resolveTriggeredTests(file, root, patterns);
      if (triggeredTests === null) {
        result.add(file);
        continue;
      }

      for (const test of triggeredTests) {
        result.add(test);
      }
    }

    return [...result];
  }

  private resolveTriggeredTests(
    file: string,
    root: string,
    patterns: TriggerPattern[],
  ): string[] | null {
    let matched = false;
    const result: string[] = [];

    for (const { pattern, testsToRun } of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(file);
      if (!match) {
        continue;
      }

      matched = true;
      const tests = testsToRun(file, match);
      const paths = Array.isArray(tests) ? tests : [tests];
      result.push(...paths.map((test) => resolve(root, test)));
    }

    return matched ? result : null;
  }

  async getRoot(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['rev-parse', '--show-toplevel'],
        { cwd },
      );
      return resolve(stdout.trim());
    } catch {
      return null;
    }
  }
}

export function git(options?: GitVCSProviderOptions): VCSProvider {
  return new GitVCSProvider(options);
}
