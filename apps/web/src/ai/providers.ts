/**
 * AI provider registry. Two dialects cover ~everything:
 *   - anthropic     → Anthropic's Messages API (native SDK)
 *   - openai        → any OpenAI-compatible /chat/completions endpoint
 *                     (OpenAI, Groq, OpenRouter, DeepSeek, Together, Ollama,
 *                      and Gemini via its OpenAI-compatible endpoint)
 * The user pastes a key; we auto-detect the provider from its prefix and let
 * them override (needed because a bare `sk-` is ambiguous across providers).
 */
export type Dialect = 'anthropic' | 'openai';

export interface Provider {
  id: string;
  label: string;
  dialect: Dialect;
  /** Base URL for the openai dialect (ignored for anthropic). */
  baseURL?: string;
  defaultModel: string;
  keyHint: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'anthropic', label: 'Anthropic', dialect: 'anthropic', defaultModel: 'claude-opus-4-8', keyHint: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', dialect: 'openai', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', keyHint: 'sk-…' },
  { id: 'groq', label: 'Groq', dialect: 'openai', baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyHint: 'gsk_…' },
  { id: 'openrouter', label: 'OpenRouter', dialect: 'openai', baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet', keyHint: 'sk-or-…' },
  { id: 'gemini', label: 'Google Gemini', dialect: 'openai', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash', keyHint: 'AIza…' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', dialect: 'openai', baseURL: '', defaultModel: '', keyHint: 'any key' },
];

export function providerById(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}

/** Best-guess provider from a key's prefix. `sk-` (ambiguous) defaults to OpenAI. */
export function detectProvider(key: string): Provider {
  const k = key.trim();
  if (k.startsWith('sk-ant-')) return providerById('anthropic');
  if (k.startsWith('sk-or-')) return providerById('openrouter');
  if (k.startsWith('gsk_')) return providerById('groq');
  if (k.startsWith('AIza')) return providerById('gemini');
  if (k.startsWith('sk-')) return providerById('openai');
  return providerById('openai');
}
