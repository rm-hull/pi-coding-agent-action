import { describe, expect, test, vi } from 'vitest';
import { setupGitHubTestEnv } from './helpers/github-test-env';
setupGitHubTestEnv({ envPathPrefix: 'gh-event-comments' });

const noop = (): void => {};

vi.mock('@actions/github', () => ({
  context: {},
}));

const commentsModule = import('@alexanderfortin/pi-platform-github');
const { findPreviousBotComment, findPreviousBotReviewComment } = await commentsModule;

describe('comments pagination and loop breaks', () => {
  test('listAllIssueComments breaks pagination when page returns fewer than 100 comments', async () => {
    const listComments = vi.fn().mockImplementation(({ page }) => {
      if (page === 1) {
        // Return 99 comments (less than MAX_COMMENTS_PER_PAGE=100) to trigger break
        return Promise.resolve({
          data: Array.from({ length: 99 }, (_, i) => ({
            id: i + 1,
            body: i === 49 ? '<!-- pi-coding-agent-comment -->\nmatch' : 'comment',
          })),
        });
      }
      return Promise.resolve({ data: [] });
    });

    const deps = {
      octokit: {
        rest: {
          issues: { listComments },
        },
      } as any,
      context: {
        repo: { owner: 'owner', repo: 'repo' },
        issue: { number: 1 },
        eventName: 'issue_comment',
        payload: {},
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };

    const res = await findPreviousBotComment(deps);
    expect(res).toBeDefined();
    expect(res?.id).toBe(50);
    expect(listComments).toHaveBeenCalledTimes(1);

    // GitHub's issues.listComments does NOT support sort/direction — verify
    // we don't send them (they would be silently ignored).
    const lastCall = listComments.mock.calls[0]![0];
    expect(lastCall).not.toHaveProperty('sort');
    expect(lastCall).not.toHaveProperty('direction');
  });

  test('listAllReviewComments breaks pagination when page returns fewer than 100 comments', async () => {
    const listReviewComments = vi.fn().mockImplementation(({ page }) => {
      if (page === 1) {
        // Return 5 comments (less than MAX_COMMENTS_PER_PAGE=100) to trigger break
        return Promise.resolve({
          data: Array.from({ length: 5 }, (_, i) => ({
            id: i + 200,
            body:
              i === 2 ? '<!-- pi-coding-agent-review-comment -->\nreview match' : 'review comment',
            in_reply_to_id: 789,
          })),
        });
      }
      return Promise.resolve({ data: [] });
    });

    const deps = {
      octokit: {
        rest: {
          pulls: { listReviewComments },
        },
      } as any,
      context: {
        repo: { owner: 'owner', repo: 'repo' },
        issue: { number: 1 },
        payload: {
          comment: { id: 789 },
        },
        eventName: 'issue_comment',
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };

    const res = await findPreviousBotReviewComment(deps);
    expect(res).toBeDefined();
    expect(res?.id).toBe(202);
    expect(listReviewComments).toHaveBeenCalledTimes(1);
  });

  test('findPreviousBotComment selects the most recent (highest-id) bot comment from multiple matches', async () => {
    // GitHub returns issue comments in ascending-id order (oldest first).
    // Verify we pick the highest-id bot-authored comment.
    const listComments = vi.fn().mockResolvedValue({
      data: [
        { id: 10, body: 'regular comment' },
        { id: 20, body: '<!-- pi-coding-agent-comment -->\nold match 1' },
        { id: 30, body: 'regular comment' },
        { id: 40, body: '<!-- pi-coding-agent-comment -->\nnewer match 2' },
        { id: 50, body: '<!-- pi-coding-agent-comment -->\nnewest match 3' },
      ],
    });

    const deps = {
      octokit: { rest: { issues: { listComments } } } as any,
      context: {
        repo: { owner: 'owner', repo: 'repo' },
        issue: { number: 1 },
        eventName: 'issue_comment',
        payload: {},
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };

    const res = await findPreviousBotComment(deps);
    expect(res).toBeDefined();
    expect(res?.id).toBe(50);
    expect(res?.body).toContain('newest match 3');
  });

  test('findPreviousBotComment returns undefined when no issue number in context', async () => {
    const depsNoIssue = {
      octokit: {} as any,
      context: {
        issue: { number: 0 },
        repo: { owner: 'owner', repo: 'repo' },
        eventName: 'issue_comment',
        payload: {},
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotComment(depsNoIssue)).toBeUndefined();
  });

  test('findPreviousBotReviewComment returns undefined when no issue number or comment id in context', async () => {
    const _depsNoIssue = {
      octokit: {} as any,
      context: {
        issue: { number: 1 },
        repo: { owner: 'owner', repo: 'repo' },
        eventName: 'issue_comment',
        payload: {},
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    // Fix: provide empty issue to test the undefined return
    const depsEmptyIssue = {
      octokit: {} as any,
      context: { issue: {} },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotReviewComment(depsEmptyIssue as any)).toBeUndefined();

    const depsNoCommentId = {
      octokit: {} as any,
      context: {
        issue: { number: 1 },
        payload: {},
        repo: { owner: 'owner', repo: 'repo' },
        eventName: 'issue_comment',
        serverUrl: 'https://github.com',
        workspace: '/github/workspace',
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotReviewComment(depsNoCommentId)).toBeUndefined();
  });
});
