import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createEngine } from '@cue/engine';
import { EngineContext, useItems } from './useEngine';

function Probe() {
  const items = useItems();
  return <div data-testid="count">{items.length}</div>;
}

describe('useItems', () => {
  it('re-renders when the engine changes', () => {
    const engine = createEngine();
    render(
      <EngineContext.Provider value={engine}>
        <Probe />
      </EngineContext.Provider>,
    );
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    act(() => {
      engine.addItem('a');
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
