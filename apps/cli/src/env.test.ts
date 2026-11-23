import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildEnvFlags, validateCredentials } from './env.js';
import { setMode } from './mode.js';

const SUBSCRIPTION_TOKEN = 'sk-ant-oat01-example';
const API_KEY = 'sk-ant-api03-example';

const CREDENTIAL_VARS = [
  'SHANNON_AI_MODEL',
  'SHANNON_AI_API_KEY',
  'SHANNON_USE_PI_AUTH',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'AWS_REGION',
  'AWS_BEARER_TOKEN_BEDROCK',
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const name of CREDENTIAL_VARS) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  setMode('local');
});

afterEach(() => {
  for (const name of CREDENTIAL_VARS) {
    const value = saved[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

function assertSubscriptionTokenRejected(source: string): void {
  const result = validateCredentials();
  assert.equal(result.valid, false);
  assert.ok(result.error?.startsWith(`${source} holds a Claude Code subscription token`), result.error);
  assert.match(result.error ?? '', /ai-providers\.md#claude-code-subscription/);
}

test('rejects a lone CLAUDE_CODE_OAUTH_TOKEN on the default anthropic model', () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = SUBSCRIPTION_TOKEN;
  assertSubscriptionTokenRejected('CLAUDE_CODE_OAUTH_TOKEN');
});

test('rejects a subscription token pasted into ANTHROPIC_API_KEY', () => {
  process.env.SHANNON_AI_MODEL = 'anthropic:claude-sonnet-4-6';
  process.env.ANTHROPIC_API_KEY = SUBSCRIPTION_TOKEN;
  assertSubscriptionTokenRejected('ANTHROPIC_API_KEY');
});

test('rejects a subscription token in SHANNON_AI_API_KEY when it is the key sent', () => {
  process.env.SHANNON_AI_MODEL = 'anthropic:claude-sonnet-4-6';
  process.env.SHANNON_AI_API_KEY = SUBSCRIPTION_TOKEN;
  assertSubscriptionTokenRejected('SHANNON_AI_API_KEY');
});

test('accepts an Anthropic API key and ignores an unrelated CLAUDE_CODE_OAUTH_TOKEN', () => {
  process.env.ANTHROPIC_API_KEY = API_KEY;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = SUBSCRIPTION_TOKEN;
  assert.deepEqual(validateCredentials(), { valid: true });
});

test('never forwards CLAUDE_CODE_OAUTH_TOKEN into the worker container', () => {
  process.env.ANTHROPIC_API_KEY = API_KEY;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = SUBSCRIPTION_TOKEN;
  const flags = buildEnvFlags();
  assert.ok(flags.includes('ANTHROPIC_API_KEY'));
  assert.ok(!flags.includes('CLAUDE_CODE_OAUTH_TOKEN'));
});

test('a CLAUDE_CODE_OAUTH_TOKEN does not block another provider', () => {
  process.env.SHANNON_AI_MODEL = 'openai:gpt-5.5';
  process.env.OPENAI_API_KEY = 'sk-example';
  process.env.CLAUDE_CODE_OAUTH_TOKEN = SUBSCRIPTION_TOKEN;
  assert.deepEqual(validateCredentials(), { valid: true });
});

test('with no credential at all, still reports nothing configured', () => {
  const result = validateCredentials();
  assert.equal(result.valid, false);
  assert.match(result.error ?? '', /^No credentials configured/);
});
