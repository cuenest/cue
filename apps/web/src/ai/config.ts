import { detectProvider, providerById, type Provider } from './providers';
import { AI_KEY_STORAGE } from './assistant';

export interface AiConfig {
  key: string;
  providerId: string;
  /** Model id; empty falls back to the provider's default. */
  model: string;
  /** Base URL override (openai dialect / custom endpoints); empty uses provider default. */
  baseURL: string;
}

const CONFIG_KEY = 'cue-ai-config';

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const c = JSON.parse(raw) as AiConfig;
      return c.key ? c : null;
    }
    // migrate an old key-only setup (was Anthropic)
    const legacy = localStorage.getItem(AI_KEY_STORAGE);
    if (legacy) {
      const p = detectProvider(legacy);
      return { key: legacy, providerId: p.id, model: '', baseURL: '' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setAiConfig(cfg: AiConfig | null): void {
  try {
    if (cfg && cfg.key) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(AI_KEY_STORAGE); // superseded
  } catch {
    /* private mode */
  }
}

/** Resolve a config to the concrete dialect/model/baseURL used to make a request. */
export function resolveProvider(cfg: AiConfig): { provider: Provider; model: string; baseURL: string } {
  const provider = providerById(cfg.providerId);
  return {
    provider,
    model: cfg.model.trim() || provider.defaultModel,
    baseURL: cfg.baseURL.trim() || provider.baseURL || '',
  };
}
