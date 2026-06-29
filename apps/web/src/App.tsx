import { EngineContext } from './useEngine';
import type { CueEngine } from '@cue/engine';

export function App({
  engine,
  persistent = true,
}: {
  engine: CueEngine;
  persistent?: boolean;
}) {
  return (
    <EngineContext.Provider value={engine}>
      {!persistent && (
        <p role="status">Changes won't persist in this browser session.</p>
      )}
      <h1>Cue</h1>
    </EngineContext.Provider>
  );
}
