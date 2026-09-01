import { describe, expect, test, vi, beforeEach } from 'vitest';

import { setupGitHubTestEnv } from './helpers/github-test-env';
setupGitHubTestEnv({ envPathPrefix: 'gh-event-comments' });

const noop = (): void => {};

vi.mock('@actions/github', () => ({
  context: {},
}));

import { Temporal } from '@js-temporal/polyfill';
import type { GitHubModuleDeps } from '@alexanderfortin/pi-platform-github';

// Dynamic import to ensure mocks are set up before module loads
const commentsModule = import('@alexanderfortin/pi-platform-github');

function createTestDeps(payload: Record<string, unknown> = {}): GitHubModuleDeps & {
  octokit: {
    rest: {
      issues: { createComment: ReturnType<typeof vi.fn> };
      pulls: { createReplyForReviewComment: ReturnType<typeof vi.fn> };
    };
  };
} {
  const mockCreateIssueComment = vi.fn(() =>
    Promise.resolve({
      data: { id: 123 },
      headers: {},
      status: 201,
      url: '',
    })
  );
  const mockCreateReviewCommentReply = vi.fn(() =>
    Promise.resolve({
      data: { id: 456 },
      headers: {},
      status: 201,
      url: '',
    })
  );

  return {
    octokit: {
      rest: {
        issues: {
          createComment: mockCreateIssueComment,
        },
        pulls: {
          createReplyForReviewComment: mockCreateReviewCommentReply,
        },
      },
    } as any,
    context: {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      issue: { number: 123 },
      eventName: 'issue_comment',
      payload,
      serverUrl: 'https://github.com',
      runId: 123456789,
      workspace: '/tmp',
    },
    logger: {
      debug: noop,
      info: noop,
      warning: noop,
      notice: noop,
      error: noop,
    },
  };
}

const { formatExecutionTime, formatNumber, createFinalComment } = await commentsModule;

/**
 * Run `createFinalComment` with the given deps/body/metadata, then return
 * the first `issues.createComment` call's first argument (the comment body
 * is at `.body`). Replaces the repeated `mock.calls[0]` extraction pattern.
 */
async function runFinalComment(
  deps: ReturnType<typeof createTestDeps>,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  await createFinalComment(deps, body, metadata);
  const call = (deps.octokit.rest.issues.createComment as any).mock.calls[0] as unknown[];
  return call[0] as Record<string, unknown>;
}

/** Convenience: get the body string from a `createComment` call. */
async function runFinalCommentBody(
  deps: ReturnType<typeof createTestDeps>,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const arg = await runFinalComment(deps, body, metadata);
  return arg.body as string;
}

describe('formatExecutionTime', () => {
  test('formats seconds only', () => {
    const duration = Temporal.Duration.from({ seconds: 30 });
    expect(formatExecutionTime(duration)).toBe('30s');
  });

  test('formats zero seconds', () => {
    const duration = Temporal.Duration.from({ seconds: 0 });
    expect(formatExecutionTime(duration)).toBe('0s');
  });

  test('formats minutes and seconds', () => {
    const duration = Temporal.Duration.from({ minutes: 1, seconds: 30 });
    expect(formatExecutionTime(duration)).toBe('1m 30s');
  });

  test('formats minutes without seconds', () => {
    const duration = Temporal.Duration.from({ minutes: 5 });
    expect(formatExecutionTime(duration)).toBe('5m');
  });

  test('formats hours, minutes, and seconds', () => {
    const duration = Temporal.Duration.from({ hours: 1, minutes: 5, seconds: 30 });
    expect(formatExecutionTime(duration)).toBe('1h 5m 30s');
  });

  test('formats hours and minutes', () => {
    const duration = Temporal.Duration.from({ hours: 2, minutes: 45 });
    expect(formatExecutionTime(duration)).toBe('2h 45m');
  });

  test('formats hours without minutes or seconds', () => {
    const duration = Temporal.Duration.from({ hours: 3 });
    expect(formatExecutionTime(duration)).toBe('3h');
  });

  test('handles large values', () => {
    const duration = Temporal.Duration.from({ hours: 10, minutes: 59, seconds: 59 });
    expect(formatExecutionTime(duration)).toBe('10h 59m 59s');
  });

  test('rounds sub-second durations to nearest second', () => {
    const duration = Temporal.Duration.from({ seconds: 30, milliseconds: 700 });
    expect(formatExecutionTime(duration)).toBe('31s');
  });

  test('rounds down sub-second durations below .5', () => {
    const duration = Temporal.Duration.from({ seconds: 30, milliseconds: 300 });
    expect(formatExecutionTime(duration)).toBe('30s');
  });

  test('handles mixed values with zero seconds', () => {
    const duration = Temporal.Duration.from({ hours: 1, minutes: 30, seconds: 0 });
    expect(formatExecutionTime(duration)).toBe('1h 30m');
  });

  test('handles single unit values', () => {
    expect(formatExecutionTime(Temporal.Duration.from({ seconds: 1 }))).toBe('1s');
    expect(formatExecutionTime(Temporal.Duration.from({ minutes: 1 }))).toBe('1m');
    expect(formatExecutionTime(Temporal.Duration.from({ hours: 1 }))).toBe('1h');
  });
});

describe('formatNumber', () => {
  test('formats small numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(999)).toBe('999');
  });

  test('formats thousands', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(9999)).toBe('10.0K');
    expect(formatNumber(10000)).toBe('10.0K');
    expect(formatNumber(99999)).toBe('100.0K');
  });

  test('formats millions', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(10000000)).toBe('10.0M');
    expect(formatNumber(999999999)).toBe('1000.0M');
  });

  test('handles boundary values', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(999999)).toBe('1000.0K');
    expect(formatNumber(1000000)).toBe('1.0M');
  });

  test('handles negative numbers gracefully', () => {
    expect(formatNumber(-1)).toBe('-1');
    expect(formatNumber(-500)).toBe('-500');
    expect(formatNumber(-1000)).toBe('-1000');
    expect(formatNumber(-1500000)).toBe('-1500000');
  });

  test('handles very large numbers', () => {
    expect(formatNumber(1000000000)).toBe('1000.0M');
    expect(formatNumber(9999999999)).toBe('10000.0M');
  });

  test('formats with one decimal place', () => {
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(12345)).toBe('12.3K');
    expect(formatNumber(1234567)).toBe('1.2M');
  });
});

describe('createFinalComment', () => {
  beforeEach(() => {
    // No need to reset module context anymore
  });

  test('returns undefined for empty body', async () => {
    const deps = createTestDeps();
    const result = await createFinalComment(deps, '', {});
    expect(result).toBeUndefined();
  });

  test('appends action run link to comment body', async () => {
    const deps = createTestDeps();
    const body = 'Here is a result';
    const arg = await runFinalComment(deps, body, {});

    expect(deps.octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(arg).toMatchObject({
      owner: 'test-owner',
      repo: 'test-repo',
      body: expect.stringContaining(
        '[View action run](https://github.com/test-owner/test-repo/actions/runs/123456789)'
      ),
    });
  });

  test('includes model metadata when provided', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringContaining('Model: anthropic/claude-sonnet-4-5'),
    });
  });

  test('includes thinking level in model metadata when not off', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      thinkingLevel: 'medium',
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringContaining('(thinking: medium)'),
    });
  });

  test('does not include thinking level when off', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      thinkingLevel: 'off',
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.not.stringContaining('thinking:'),
    });
  });

  test('includes execution duration when provided', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const duration = Temporal.Duration.from({ minutes: 2, seconds: 30 });
    const metadata = {
      executionDuration: duration,
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringContaining('Time: 2m 30s'),
    });
  });

  test('includes session stats with token usage', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      sessionStats: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.0123,
        version: '1.0.0',
      },
    };

    const commentBody = await runFinalCommentBody(deps, body, metadata);

    expect(commentBody).toContain('Tokens: 1.5K ');
    expect(commentBody).toContain('Cost: $0.01 ');
  });

  test('includes session stats with token usage (rounds up)', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      sessionStats: {
        inputTokens: 2000,
        outputTokens: 0,
        totalTokens: 2000,
        cost: 0.0153,
        version: '1.0.0',
      },
    };

    const commentBody = await runFinalCommentBody(deps, body, metadata);

    expect(commentBody).toContain('Tokens: 2.0K ');
    expect(commentBody).toContain('Cost: $0.02 ');
  });

  test('handles zero session stats', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      sessionStats: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        version: '1.0.0',
      },
    };

    const commentBody = await runFinalCommentBody(deps, body, metadata);

    expect(commentBody).toContain('Tokens: 0');
    expect(commentBody).not.toContain('Cost: $0');
  });

  test('includes action version when provided', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      actionVersion: '2.3.0',
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringContaining('Action v2.3.0'),
    });
  });

  test('includes Pi SDK version when session stats available', async () => {
    const deps = createTestDeps();
    const body = 'Test result';
    const metadata = {
      sessionStats: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.001,
        version: '1.2.3',
      },
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringContaining('Pi SDK v1.2.3'),
    });
  });

  test('separates metadata with pipe characters', async () => {
    const deps = createTestDeps();
    const body = 'Test';
    const metadata = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      executionDuration: Temporal.Duration.from({ seconds: 10 }),
    };

    const arg = await runFinalComment(deps, body, metadata);

    expect(arg).toMatchObject({
      body: expect.stringMatching(/View action run.*\|.*Model:/),
    });
  });

  test('creates reply to PR review comment (inline comment)', async () => {
    const deps = createTestDeps({
      comment: {
        id: 789,
        body: 'inline comment on code',
        pull_request_review_id: 456,
      },
    });

    const body = 'Here is a response to your inline comment';
    await createFinalComment(deps, body, {});

    expect(deps.octokit.rest.pulls.createReplyForReviewComment).toHaveBeenCalled();
    expect(deps.octokit.rest.issues.createComment).not.toHaveBeenCalled();
    const call = (deps.octokit.rest.pulls.createReplyForReviewComment as any).mock
      .calls[0] as unknown[];
    expect(call[0]).toMatchObject({
      pull_number: 123,
      comment_id: 789,
      body: expect.stringContaining(body),
    });
    // Review-comment replies use the dedicated review marker (not the
    // top-level issue-comment marker) so they can be found + overwritten later.
    expect((call[0] as { body: string }).body).toContain('<!-- pi-coding-agent-review-comment -->');
    expect((call[0] as { body: string }).body).not.toContain('<!-- pi-coding-agent-comment -->');
  });

  test('creates top-level issue comment when not PR review comment', async () => {
    const deps = createTestDeps({
      comment: {
        id: 789,
        body: 'regular comment',
      },
    });

    const body = 'Top-level comment';
    const arg = await runFinalComment(deps, body, {});

    expect(deps.octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();
    expect(arg).toMatchObject({
      issue_number: 123,
      body: expect.stringContaining(body),
    });
    // Top-level issue/PR comments use the issue marker.
    expect(arg.body).toContain('<!-- pi-coding-agent-comment -->');
    expect(arg.body).not.toContain('<!-- pi-coding-agent-review-comment -->');
  });

  test('creates top-level comment for pull_request_review event (no comment in payload)', async () => {
    const deps = createTestDeps({
      review: { id: 42, body: '/pi review this' },
    });

    const body = 'Result for review';

    // Should fall through to top-level issue comment (not a review comment reply)
    const arg = await runFinalComment(deps, body, {});
    expect(deps.octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();
    expect(arg).toMatchObject({
      issue_number: 123,
      body: expect.stringContaining(body),
    });
  });

  test('appends action run link to PR review comment reply', async () => {
    const deps = createTestDeps({
      comment: {
        id: 789,
        body: 'inline comment',
        pull_request_review_id: 456,
      },
    });

    const body = 'Result for inline comment';
    await createFinalComment(deps, body, {});

    expect(deps.octokit.rest.pulls.createReplyForReviewComment).toHaveBeenCalled();
    const call = (deps.octokit.rest.pulls.createReplyForReviewComment as any).mock
      .calls[0] as unknown[];
    const commentBody = (call[0] as { body: string }).body;
    expect(commentBody).toContain(body);
    expect(commentBody).toContain('<!-- pi-coding-agent-review-comment -->');
    expect(commentBody).not.toContain('<!-- pi-coding-agent-comment -->');
  });

  test('returns undefined when no issue/PR number in context (unattended mode)', async () => {
    const deps = createTestDeps({
      comment: { id: 999, body: 'test' },
    });
    // Override issue number
    (deps.context as any).issue = { number: undefined };

    const body = 'Test result from unattended pipeline';
    const result = await createFinalComment(deps, body, {});

    expect(result).toBeUndefined();
    expect(deps.octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();
  });

  test('returns undefined when issue number is 0 (unattended mode)', async () => {
    const deps = createTestDeps({
      comment: { id: 999, body: 'test' },
    });
    (deps.context as any).issue = { number: 0 };

    const body = 'Test result from unattended pipeline';
    const result = await createFinalComment(deps, body, {});

    expect(result).toBeUndefined();
    expect(deps.octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();
  });

  test('returns undefined when review comment has pull_request_review_id but no comment id', async () => {
    const deps = createTestDeps({
      comment: {
        body: 'inline comment',
        pull_request_review_id: 456,
        // id is intentionally missing
      },
    });

    const body = 'Response to review';
    const result = await createFinalComment(deps, body, {});

    expect(result).toBeUndefined();
    expect(deps.octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();
  });

  test('returns undefined when review comment has pull_request_review_id but comment id is undefined', async () => {
    const deps = createTestDeps({
      comment: {
        // id is intentionally missing
        body: 'inline comment',
        pull_request_review_id: 456,
      },
    });

    const body = 'Response to review';
    const result = await createFinalComment(deps, body, {});

    expect(result).toBeUndefined();
  });
});

describe('createFinalComment with updateComment', () => {
  test('updates previous bot comment when updateComment is true and comment exists', async () => {
    const mockUpdateComment = vi.fn(() =>
      Promise.resolve({
        data: {
          id: 42,
          body: 'updated body',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-42',
        },
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 42,
            body: '<!-- pi-coding-agent-comment -->\nolder bot response',
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
          { id: 43, body: 'some other comment', user: { type: 'User', login: 'octocat' } },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps(),
      updateComment: true,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: mockListComments,
            updateComment: mockUpdateComment,
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    expect(mockListComments).toHaveBeenCalled();
    expect(mockUpdateComment).toHaveBeenCalled();
    const updateCall = mockUpdateComment.mock.calls[0] as unknown[] | undefined;
    expect(updateCall).toBeDefined();
    const callArg0 = updateCall![0] as {
      owner: string;
      repo: string;
      comment_id: number;
      body: string;
    };
    expect(callArg0).toMatchObject({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 42,
      body: expect.stringContaining('New response'),
    });
    expect(callArg0.body).toContain('<!-- pi-coding-agent-comment -->');
  });

  test('creates new comment when updateComment is true but no previous bot comment exists', async () => {
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [{ id: 43, body: 'some other comment' }],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps(),
      updateComment: true,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(() =>
              Promise.resolve({ data: { id: 99 }, headers: {}, status: 201, url: '' })
            ),
            listComments: mockListComments,
            updateComment: vi.fn(),
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    expect(mockListComments).toHaveBeenCalled();
    expect(deps.octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(deps.octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  test('creates new comment when updateComment is false', async () => {
    const mockListComments = vi.fn();

    const deps = {
      ...createTestDeps(),
      updateComment: false,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(() =>
              Promise.resolve({ data: { id: 99 }, headers: {}, status: 201, url: '' })
            ),
            listComments: mockListComments,
            updateComment: vi.fn(),
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    expect(mockListComments).not.toHaveBeenCalled();
    expect(deps.octokit.rest.issues.createComment).toHaveBeenCalled();
    expect(deps.octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  test('updates previous bot review comment reply when updateComment is true and reply exists', async () => {
    const mockUpdateReviewComment = vi.fn(() =>
      Promise.resolve({
        data: {
          id: 501,
          body: 'updated reply',
          html_url: 'https://github.com/test-owner/test-repo/pull/123#discussion_r501',
        },
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockListReviewComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 501,
            body: '<!-- pi-coding-agent-review-comment -->\nprevious reply',
            in_reply_to_id: 789,
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
          {
            id: 502,
            body: 'some other review comment',
            in_reply_to_id: 789,
            user: { type: 'User', login: 'octocat' },
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps({
        comment: {
          id: 789,
          body: 'inline comment on code',
          pull_request_review_id: 456,
        },
      }),
      updateComment: true,
      octokit: {
        rest: {
          issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
          pulls: {
            createReplyForReviewComment: vi.fn(),
            listReviewComments: mockListReviewComments,
            updateReviewComment: mockUpdateReviewComment,
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'Updated review reply', {});

    expect(mockListReviewComments).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 123, owner: 'test-owner', repo: 'test-repo' })
    );
    expect(mockUpdateReviewComment).toHaveBeenCalled();
    // Must NOT have fallen through to creating a new reply.
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();

    const updateCall = mockUpdateReviewComment.mock.calls[0] as unknown[] | undefined;
    expect(updateCall).toBeDefined();
    const callArg0 = updateCall![0] as {
      owner: string;
      repo: string;
      comment_id: number;
      body: string;
    };
    expect(callArg0).toMatchObject({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 501,
      body: expect.stringContaining('Updated review reply'),
    });
    expect(callArg0.body).toContain('<!-- pi-coding-agent-review-comment -->');
  });

  test('creates new review comment reply when updateComment is true but no previous bot reply exists', async () => {
    const mockListReviewComments = vi.fn(() =>
      Promise.resolve({
        data: [{ id: 502, body: 'some other review comment', in_reply_to_id: 789 }],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps({
        comment: {
          id: 789,
          body: 'inline comment on code',
          pull_request_review_id: 456,
        },
      }),
      updateComment: true,
      octokit: {
        rest: {
          issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
          pulls: {
            createReplyForReviewComment: vi.fn(() =>
              Promise.resolve({ data: { id: 999 }, headers: {}, status: 201, url: '' })
            ),
            listReviewComments: mockListReviewComments,
            updateReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New reply', {});

    expect(mockListReviewComments).toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.updateReviewComment).not.toHaveBeenCalled();

    const call = (deps.octokit.rest.pulls.createReplyForReviewComment as any).mock
      .calls[0] as unknown[];
    expect(call[0]).toMatchObject({
      pull_number: 123,
      comment_id: 789,
      body: expect.stringContaining('New reply'),
    });
    expect((call[0] as { body: string }).body).toContain('<!-- pi-coding-agent-review-comment -->');
  });

  test('migrates a previous bot review reply tagged with the old issue marker onto the review marker', async () => {
    // Simulates a review reply created by a pre-fix version of the action,
    // which tagged the reply with the (issue) BOT_COMMENT_MARKER. The update
    // path should still recognise it and rewrite it with the review marker
    // so the upgrade transition leaves no duplicate behind.
    const mockUpdateReviewComment = vi.fn(() =>
      Promise.resolve({
        data: { id: 501, body: 'updated', html_url: '' },
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockListReviewComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 501,
            body: '<!-- pi-coding-agent-comment -->\nprevious reply',
            in_reply_to_id: 789,
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps({
        comment: {
          id: 789,
          body: 'inline comment on code',
          pull_request_review_id: 456,
        },
      }),
      updateComment: true,
      octokit: {
        rest: {
          issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
          pulls: {
            createReplyForReviewComment: vi.fn(),
            listReviewComments: mockListReviewComments,
            updateReviewComment: mockUpdateReviewComment,
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'Migrated reply', {});

    expect(mockUpdateReviewComment).toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).not.toHaveBeenCalled();

    const updateCall = mockUpdateReviewComment.mock.calls[0] as unknown[] | undefined;
    expect(updateCall).toBeDefined();
    const callArg0 = updateCall![0] as {
      comment_id: number;
      body: string;
    };
    expect(callArg0).toMatchObject({
      comment_id: 501,
      body: expect.stringContaining('Migrated reply'),
    });
    // Rewritten with the review marker (migration) ...
    expect(callArg0.body).toContain('<!-- pi-coding-agent-review-comment -->');
    // ... and no longer tagged with the old issue marker.
    expect(callArg0.body).not.toContain('<!-- pi-coding-agent-comment -->');
  });

  test('updates only the review reply in the current thread, ignoring other threads', async () => {
    // A reply authored by the bot but to a DIFFERENT inline comment must not be
    // overwritten by a re-trigger on comment 789 — a new reply is created instead.
    const mockListReviewComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 501,
            body: '<!-- pi-coding-agent-review-comment -->\nreply to OTHER comment',
            in_reply_to_id: 999,
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockUpdateReviewComment = vi.fn();

    const deps = {
      ...createTestDeps({
        comment: {
          id: 789,
          body: 'inline comment on code',
          pull_request_review_id: 456,
        },
      }),
      updateComment: true,
      octokit: {
        rest: {
          issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
          pulls: {
            createReplyForReviewComment: vi.fn(() =>
              Promise.resolve({ data: { id: 888 }, headers: {}, status: 201, url: '' })
            ),
            listReviewComments: mockListReviewComments,
            updateReviewComment: mockUpdateReviewComment,
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'Fresh reply for thread 789', {});

    expect(mockUpdateReviewComment).not.toHaveBeenCalled();
    expect(deps.octokit.rest.pulls.createReplyForReviewComment).toHaveBeenCalled();
  });

  test('does not consult review comments when the trigger is a top-level issue comment', async () => {
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 42,
            body: '<!-- pi-coding-agent-comment -->\nprevious response',
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockListReviewComments = vi.fn();
    const mockUpdateComment = vi.fn(() =>
      Promise.resolve({ data: { id: 42, body: 'x' }, headers: {}, status: 200, url: '' })
    );

    const deps = {
      ...createTestDeps(), // top-level issue_comment trigger (no pull_request_review_id)
      updateComment: true,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: mockListComments,
            updateComment: mockUpdateComment,
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
            listReviewComments: mockListReviewComments,
            updateReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    expect(mockListComments).toHaveBeenCalled();
    expect(mockListReviewComments).not.toHaveBeenCalled();
    expect(mockUpdateComment).toHaveBeenCalled();
  });

  test('updates the most recent bot comment when multiple exist (ordering fix)', async () => {
    // Regression test for the ordering bug: GitHub returns comments in ascending
    // ID order (oldest first) by default. The bot markers two comments — an
    // older one (id 42) and a newer one (id 88). The code must update id 88,
    // not id 42, by selecting the match with the highest ID.
    const mockUpdateComment = vi.fn(() =>
      Promise.resolve({
        data: { id: 88, body: 'updated', html_url: '' },
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 42,
            body: '<!-- pi-coding-agent-comment -->\nolder bot response',
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
          {
            id: 88,
            body: '<!-- pi-coding-agent-comment -->\nnewer bot response',
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps(),
      updateComment: true,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: mockListComments,
            updateComment: mockUpdateComment,
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'Latest response', {});

    expect(mockUpdateComment).toHaveBeenCalled();
    const updateCall = mockUpdateComment.mock.calls[0] as unknown[] | undefined;
    expect(updateCall).toBeDefined();
    const updateArgs = updateCall![0] as {
      comment_id: number;
      body: string;
    };
    // Must update the *most recent* bot comment (id 88), not the oldest (id 42).
    expect(updateArgs.comment_id).toBe(88);
  });

  test('falls back to createComment when updateComment fails', async () => {
    // When issues.updateComment throws (e.g. transient 5xx), createFinalComment
    // should fall through to createComment so the comment is not lost entirely.
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 88,
            body: '<!-- pi-coding-agent-comment -->\nold bot response',
            user: { type: 'Bot', login: 'pi-coding-agent[bot]' },
          },
        ],
        headers: {},
        status: 200,
        url: '',
      })
    );
    const mockUpdateComment = vi.fn(() => Promise.reject(new Error('500 Server Error')));
    const mockCreateComment = vi.fn(() =>
      Promise.resolve({ data: { id: 999 }, headers: {}, status: 201, url: '' })
    );

    const deps = {
      ...createTestDeps(),
      updateComment: true,
      logger: { ...createTestDeps().logger, warning: vi.fn() },
      octokit: {
        rest: {
          issues: {
            createComment: mockCreateComment,
            listComments: mockListComments,
            updateComment: mockUpdateComment,
          },
          pulls: { createReplyForReviewComment: vi.fn() },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    // Update should have been attempted ...
    expect(mockUpdateComment).toHaveBeenCalled();
    // ... and create should have been called as fallback.
    expect(mockCreateComment).toHaveBeenCalled();
  });

  test('does NOT pass sort/direction to listComments (unsupported, silently ignored)', async () => {
    // Verifies we do NOT send `sort`/`direction` to issues.listComments —
    // GitHub silently ignores those params and the endpoint always returns
    // comments in ascending-ID order (oldest first). We instead select the
    // highest-id match as the most recent bot comment.
    const mockListComments = vi.fn(() =>
      Promise.resolve({
        data: [],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps(),
      updateComment: true,
      octokit: {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: mockListComments,
            updateComment: vi.fn(),
          },
          pulls: {
            createReplyForReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'New response', {});

    expect(mockListComments).toHaveBeenCalledWith(
      expect.objectContaining({
        per_page: 100,
        page: 1,
      })
    );
    // sort and direction should NOT be present — GitHub ignores them.
    const calls = mockListComments.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const callArgs = (calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs).not.toHaveProperty('sort');
    expect(callArgs).not.toHaveProperty('direction');
  });

  test('passes sort=created and direction=desc to listReviewComments (review comments support these params)', async () => {
    // Unlike issues.listComments, pulls.listReviewComments DOES support
    // sort/direction. We pass `sort: 'created', direction: 'desc'` so the API
    // returns review comments newest-first, and we select the first bot-authored
    // match (highest id in this thread) as the most recent prior reply.
    const mockListReviewComments = vi.fn(() =>
      Promise.resolve({
        data: [],
        headers: {},
        status: 200,
        url: '',
      })
    );

    const deps = {
      ...createTestDeps({
        comment: {
          id: 789,
          body: 'inline comment on code',
          pull_request_review_id: 456,
        },
      }),
      updateComment: true,
      octokit: {
        rest: {
          issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
          pulls: {
            createReplyForReviewComment: vi.fn(),
            listReviewComments: mockListReviewComments,
            updateReviewComment: vi.fn(),
          },
        },
      } as any,
    };

    await createFinalComment(deps, 'Updated review reply', {});

    expect(mockListReviewComments).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'created',
        direction: 'desc',
        pull_number: 123,
        owner: 'test-owner',
        repo: 'test-repo',
      })
    );
  });
});
