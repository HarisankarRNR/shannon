/**
 * Parsing for the single model setting, `SHANNON_AI_MODEL=<provider>:<model-id>`.
 *
 * Mirrors apps/worker/src/ai/models.ts. The CLI cannot import from the worker
 * package (it ships as a standalone bundle), so the provider list and the parse
 * rule are duplicated here deliberately and must stay in sync.
 */

/**
 * Providers Shannon curates with their own credential variables, config sections,
 * and setup flows. Any other pi provider is reachable via the generic credential
 * path. Mirrors CURATED_PROVIDERS in apps/worker/src/ai/models.ts.
 */
export const CURATED_PROVIDERS = ['anthropic', 'openai', 'xai', 'amazon-bedrock'] as const;

export type CuratedProviderId = (typeof CURATED_PROVIDERS)[number];

export function isCuratedProvider(value: string): value is CuratedProviderId {
  return (CURATED_PROVIDERS as readonly string[]).includes(value);
}

/** Generic API key, honored for any provider Shannon does not curate. Mirrors the worker. */
export const GENERIC_API_KEY_ENV = 'SHANNON_AI_API_KEY';

/**
 * Env vars carrying each curated provider's API key, in precedence order. Any one of
 * them satisfies the provider. Mirrors PROVIDER_API_KEY_ENV in apps/worker/src/ai/models.ts.
 */
export const PROVIDER_API_KEY_ENV: Readonly<Record<CuratedProviderId, readonly string[]>> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  xai: ['XAI_API_KEY'],
  'amazon-bedrock': ['AWS_BEARER_TOKEN_BEDROCK'],
};

/** Additional env vars a curated provider requires beyond its API key. All must be set. */
export const PROVIDER_EXTRA_ENV: Readonly<Record<CuratedProviderId, readonly string[]>> = {
  anthropic: [],
  openai: [],
  xai: [],
  'amazon-bedrock': ['AWS_REGION'],
};

/** Human-readable credential requirement, used in "nothing configured" errors. */
export const PROVIDER_CREDENTIAL_HINT: Readonly<Record<CuratedProviderId, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
  'amazon-bedrock': 'AWS_REGION and AWS_BEARER_TOKEN_BEDROCK',
};

// === Claude Code Subscription Tokens ===

/** The variable `claude setup-token` users export. Not a Shannon credential; see `claudeSubscriptionTokenError`. */
export const CLAUDE_CODE_OAUTH_TOKEN_ENV = 'CLAUDE_CODE_OAUTH_TOKEN';

/**
 * Marker carried by every Claude Code subscription OAuth token (`sk-ant-oat01-…`). pi
 * switches a request onto Anthropic's OAuth path on this same substring check, whichever
 * variable the value arrived in.
 */
const CLAUDE_SUBSCRIPTION_TOKEN_MARKER = 'sk-ant-oat';

const CLAUDE_SUBSCRIPTION_DOCS_URL =
  'https://github.com/KeygraphHQ/shannon/blob/main/docs/ai-providers.md#claude-code-subscription';

/** Whether a credential value is a Claude Code subscription OAuth token. */
export function isClaudeSubscriptionToken(value: string): boolean {
  return value.includes(CLAUDE_SUBSCRIPTION_TOKEN_MARKER);
}

/**
 * Explain why a Claude Code subscription token cannot run a scan. Anthropic bills a
 * subscription token sent from a third-party harness to metered extra usage, not to
 * the plan, so the scan would fail on an unfunded extra-usage balance or run up charges.
 */
export function claudeSubscriptionTokenError(source: string): string {
  return [
    `${source} holds a Claude Code subscription token, which this version of Shannon does not support.`,
    'Anthropic bills a subscription token used outside Claude Code to metered extra usage rather than your plan.',
    'Use an Anthropic API key (ANTHROPIC_API_KEY), or run Shannon 1.9.0, the final release built on the Claude Agent SDK:',
    `  ${CLAUDE_SUBSCRIPTION_DOCS_URL}`,
  ].join('\n');
}

/** Model used when SHANNON_AI_MODEL is unset. */
export const DEFAULT_MODEL_SPEC = 'anthropic:claude-sonnet-4-6';

export interface ModelSpec {
  providerId: string;
  modelId: string;
}

/**
 * Parse a `<provider>:<model-id>` spec. Splits on the first colon only, so colons
 * inside a model ID survive (`amazon-bedrock:us.anthropic.claude-opus-4-5-20251101-v1:0`).
 * The provider id is passed through as given — the worker's preflight validates it
 * against pi. Returns an error string rather than throwing, for the CLI's flow.
 */
export function parseModelSpec(spec: string): ModelSpec | string {
  const trimmed = spec.trim();
  const separator = trimmed.indexOf(':');
  const malformed = `SHANNON_AI_MODEL must be "<provider>:<model-id>", got "${trimmed}". Example: ${DEFAULT_MODEL_SPEC}`;
  if (separator === -1) return malformed;

  const providerId = trimmed.slice(0, separator).trim();
  const modelId = trimmed.slice(separator + 1).trim();
  if (!providerId || !modelId) return malformed;

  return { providerId, modelId };
}

/** Resolve the run's model spec from the environment, or an error string. */
export function resolveModelSpec(): ModelSpec | string {
  return parseModelSpec(process.env.SHANNON_AI_MODEL || DEFAULT_MODEL_SPEC);
}
