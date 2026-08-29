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
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };

    const res = await findPreviousBotComment(deps);
    expect(res).toBeDefined();
    expect(res?.id).toBe(50);
    expect(listComments).toHaveBeenCalledTimes(1);
  });

  test('listAllReviewComments breaks pagination when page returns fewer than 100 comments', async () => {
    const listReviewComments = vi.fn().mockImplementation(({ page }) => {
      if (page === 1) {
        // Return 5 comments (less than MAX_COMMENTS_PER_PAGE=100) to trigger break
        return Promise.resolve({
          data: Array.from({ length: 5 }, (_, i) => ({
            id: i + 200,
            body: i === 2 ? '<!-- pi-coding-agent-review-comment -->\nreview match' : 'review comment',
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
      },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };

    const res = await findPreviousBotReviewComment(deps);
    expect(res).toBeDefined();
    expect(res?.id).toBe(202);
    expect(listReviewComments).toHaveBeenCalledTimes(1);
  });

  test('findPreviousBotComment returns undefined when no issue number in context', async () => {
    const deps = {
      octokit: {} as any,
      context: { issue: {} },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotComment(deps)).toBeUndefined();
  });

  test('findPreviousBotReviewComment returns undefined when no issue number or comment id in context', async () => {
    const depsNoIssue = {
      octokit: {} as any,
      context: { issue: {} },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotReviewComment(depsNoIssue)).toBeUndefined();

    const depsNoCommentId = {
      octokit: {} as any,
      context: { issue: { number: 1 }, payload: {} },
      logger: { debug: noop, info: noop, warning: noop, notice: noop, error: noop },
    };
    expect(await findPreviousBotReviewComment(depsNoCommentId)).toBeUndefined();
  });
});
