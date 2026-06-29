import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CueEngine, Item } from '@cue/engine';

export const EngineContext = createContext<CueEngine | null>(null);

export function useEngine(): CueEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('useEngine must be used within EngineContext.Provider');
  return engine;
}

export function useItems(): Item[] {
  const engine = useEngine();
  return useSyncExternalStore(engine.subscribe, engine.getItems, engine.getItems);
}
