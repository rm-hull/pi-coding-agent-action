import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createGitHubPlatformProvider, parsePlatformType, apiBaseUrlFromServerUrl } from '../src/provider';
import { addReaction } from '../src/reactions';
import { createFinalComment } from '../src/comments';
import { getPrompt, getStartTimeFromContext } from '../src/context';
import { createPullRequest } from '../src/tools/pull-request';
import { updatePullRequest } from '../src/tools/pull-request-update';
import { getIssueOrPRThread } from '../src/tools/thread';
import { fetchPRDiff } from '../src/tools/pr-diff';
import { createReview } from '../src/tools/review';
import { getCIStatus } from '../src/tools/get-ci-status';
import { getWorkflowRunLogs } from '../src/tools/get-workflow-run-logs';

// Mock all the platform modules
vi.mock('../src/reactions');
vi.mock('../src/comments');
vi.mock('../src/context');
vi.mock('../src/tools/pull-request');
vi.mock('../src/tools/pull-request-update');
vi.mock('../src/tools/thread');
vi.mock('../src/tools/pr-diff');
vi.mock('../src/tools/review');
vi.mock('../src/tools/get-ci-status');
vi.mock('../src/tools/get-workflow-run-logs');
vi.mock('../src/context-utils', () => ({
  resolvePlatformContext: (ctx: any) => ctx,
}));

describe('createGitHubPlatformProvider detailed coverage', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    notice: vi.fn(),
    error: vi.fn(),
  };

  const mockContext = {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 123 },
    eventName: 'issue_comment',
    payload: {
      comment: { id: 456, body: '/pi test' },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' },
      },
    },
    serverUrl: 'https://github.com',
    runId: 123456789,
    workspace: '/tmp',
  };

  const mockOctokit = {
    rest: {
      issues: {},
      pulls: {},
      checks: { listForRef: vi.fn() },
      actions: { listJobsForWorkflowRun: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes provider with all required deps', () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
      trigger: '/pi ',
      branchNameTemplate: 'test-branch',
      updateComment: true,
    });

    expect(provider.type).toBe('github');
  });

  test('getContext returns resolved context', () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    expect(provider.getContext()).toEqual(mockContext);
  });

  test('addReaction delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.addReaction();
    expect(addReaction).toHaveBeenCalled();
  });

  test('deleteReaction delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.deleteReaction('smiley');
  });

  test('createFinalComment delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.createFinalComment('body', { provider: 'test', model: 'test' } as any);
    expect(createFinalComment).toHaveBeenCalled();
  });

  test('getPrompt delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.getPrompt('optional prompt');
    expect(getPrompt).toHaveBeenCalled();
  });

  test('getStartTime delegates to module', () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    provider.getStartTime();
    expect(getStartTimeFromContext).toHaveBeenCalled();
  });

  test('createPullRequest delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.createPullRequest({
      title: 'Test PR',
      body: 'Test body',
      head: 'test-branch',
      base: 'main',
    } as any);
    expect(createPullRequest).toHaveBeenCalled();
  });

  test('updatePullRequest delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.updatePullRequest({
      title: 'Test PR',
      body: 'Test body',
      number: 123,
    } as any);
    expect(updatePullRequest).toHaveBeenCalled();
  });

  test('getIssueOrPRThread delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.getIssueOrPRThread();
    expect(getIssueOrPRThread).toHaveBeenCalled();
  });

  test('getPRDiff delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.getPRDiff('owner', 'repo', 123);
    expect(fetchPRDiff).toHaveBeenCalled();
  });

  test('createReview delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.createReview({
      event: 'COMMENT',
      body: 'test review',
    } as any);
    expect(createReview).toHaveBeenCalled();
  });

  test('getCIStatus delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.getCIStatus({ ref: 'main' } as any);
    expect(getCIStatus).toHaveBeenCalled();
  });

  test('getWorkflowRunLogs delegates to module', async () => {
    const provider = createGitHubPlatformProvider({
      octokit: mockOctokit,
      context: mockContext,
      logger: mockLogger,
      platformType: 'github',
    });

    await provider.getWorkflowRunLogs({ runId: 123 } as any);
    expect(getWorkflowRunLogs).toHaveBeenCalled();
  });
});

describe('parsePlatformType', () => {
  test('returns github for empty or github input', () => {
    expect(parsePlatformType('')).toBe('github');
    expect(parsePlatformType('github')).toBe('github');
    expect(parsePlatformType('GITHUB')).toBe('github');
  });

  test('returns forgejo for forgejo or gitea input', () => {
    expect(parsePlatformType('forgejo')).toBe('forgejo');
    expect(parsePlatformType('gitea')).toBe('forgejo');
  });

  test('returns codeberg for codeberg input', () => {
    expect(parsePlatformType('codeberg')).toBe('codeberg');
  });

  test('returns github and calls onUnknown for unrecognized input', () => {
    const onUnknown = vi.fn();
    const result = parsePlatformType('unknown', onUnknown);
    expect(result).toBe('github');
    expect(onUnknown).toHaveBeenCalledWith('unknown');
  });
});

describe('apiBaseUrlFromServerUrl', () => {
  test('returns undefined for github.com', () => {
    expect(apiBaseUrlFromServerUrl('https://github.com')).toBeUndefined();
  });

  test('returns undefined for github.com subdomains', () => {
    expect(apiBaseUrlFromServerUrl('https://api.github.com')).toBeUndefined();
    expect(apiBaseUrlFromServerUrl('https://gist.github.com')).toBeUndefined();
  });

  test('returns /api/v1 for codeberg hostname', () => {
    expect(apiBaseUrlFromServerUrl('https://codeberg.org')).toBe('https://codeberg.org/api/v1');
    // Note: forgejo/codeberg/gitea hostnames only trigger /api/v1 when explicitly
    // identified via platformType or when the hostname contains those strings
    expect(apiBaseUrlFromServerUrl('https://forge.example.com')).toBe('https://forge.example.com/api/v3');
    expect(apiBaseUrlFromServerUrl('https://gitea.example.com')).toBe('https://gitea.example.com/api/v1');
  });

  test('returns /api/v3 for self-hosted GHE', () => {
    expect(apiBaseUrlFromServerUrl('https://ghe.company.internal')).toBe('https://ghe.company.internal/api/v3');
    expect(apiBaseUrlFromServerUrl('https://github.company.com')).toBe('https://github.company.com/api/v3');
  });

  test('returns /api/v1 when platformType is forgejo regardless of hostname', () => {
    expect(apiBaseUrlFromServerUrl('https://github.com', 'forgejo')).toBe('https://github.com/api/v1');
    expect(apiBaseUrlFromServerUrl('https://ghe.company.internal', 'forgejo')).toBe('https://ghe.company.internal/api/v1');
  });

  test('returns /api/v1 when platformType is codeberg regardless of hostname', () => {
    expect(apiBaseUrlFromServerUrl('https://github.com', 'codeberg')).toBe('https://github.com/api/v1');
    expect(apiBaseUrlFromServerUrl('https://ghe.company.internal', 'codeberg')).toBe('https://ghe.company.internal/api/v1');
  });

  test('throws on empty string', () => {
    expect(() => apiBaseUrlFromServerUrl('')).toThrowError();
  });

  test('trims trailing slash from serverUrl', () => {
    expect(apiBaseUrlFromServerUrl('https://codeberg.org/')).toBe('https://codeberg.org/api/v1');
    expect(apiBaseUrlFromServerUrl('https://ghe.company.internal/')).toBe('https://ghe.company.internal/api/v3');
  });
});
