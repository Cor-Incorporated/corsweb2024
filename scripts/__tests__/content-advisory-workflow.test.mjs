// @vitest-environment node
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const workflow = yaml.load(readFileSync('.github/workflows/content-advisory.yml', 'utf8'));
const job = workflow.jobs.advisory;

describe('content advisory workflow trust boundary', () => {
  it('accepts all Japanese collections and CMS/fork branches without making a required check', () => {
    expect(workflow.on.pull_request_target).toEqual({
      types: ['opened', 'synchronize', 'reopened'],
      paths: ['src/content/*/ja/**'],
    });
    expect(workflow.permissions).toEqual({});
    expect(job.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    expect(job['continue-on-error']).toBe(true);
    expect(job['runs-on']).toBe('ubuntu-latest');
    expect(readFileSync('scripts/cms/pr-status-core.mjs', 'utf8')).not.toContain('Japanese content advisory');
  });

  it('executes only the trusted default revision, with no PR checkout or dependency install', () => {
    const checkout = job.steps.filter((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkout).toHaveLength(1);
    expect(checkout[0].with).toEqual({ ref: '${{ github.sha }}', 'persist-credentials': false });
    const runs = job.steps.filter((step) => step.run);
    expect(runs.map((step) => step.run)).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/npm (ci|install)|git fetch|gh pr checkout/),
    ]));
    const inspect = runs.find((step) => step.run === 'node scripts/content-advisory.mjs');
    expect(inspect.env).toEqual({
      GH_TOKEN: '${{ github.token }}',
      GH_REPO: '${{ github.repository }}',
      PR_NUMBER: '${{ github.event.pull_request.number }}',
      HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      BASE_SHA: '${{ github.sha }}',
    });
    expect(JSON.stringify(workflow)).not.toContain('secrets.');
    for (const step of job.steps.filter((step) => step.uses)) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
  });

  it('keeps failure visible and archives the hidden report directory', () => {
    expect(job.steps.find((step) => step.if === 'failure()').run).toContain('::warning');
    const artifact = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(artifact.if).toBe('always()');
    expect(artifact.with.path).toBe('.content-advisory/');
    expect(artifact.with['include-hidden-files']).toBe(true);
    expect(artifact.with['retention-days']).toBe(7);
  });
});
