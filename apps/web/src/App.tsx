import { EngineContext } from './useEngine';
import { Capture } from './components/Capture';
import { Focus } from './components/Focus';
import { Inbox } from './components/Inbox';
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
      <Capture />
      <Focus />
      <Inbox />
    </EngineContext.Provider>
  );
}
