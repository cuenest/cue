import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createEngine } from '@cue/engine';
import { EngineContext } from '../useEngine';
import { Inbox } from './Inbox';

describe('Inbox', () => {
  it('lists inbox items in queue order and shows the count', () => {
    const engine = createEngine();
    const first = engine.addItem('first');
    engine.addItem('second');
    engine.complete(first.id); // completed items leave the inbox

    render(
      <EngineContext.Provider value={engine}>
        <Inbox />
      </EngineContext.Provider>,
    );

    const section = screen.getByRole('region', { name: /inbox/i });
    expect(within(section).getByText(/Inbox \(1\)/)).toBeInTheDocument();
    expect(within(section).getByText('second')).toBeInTheDocument();
    expect(within(section).queryByText('first')).not.toBeInTheDocument();
  });
});
