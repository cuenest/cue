import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEngine } from '@cue/engine';
import { EngineContext } from '../useEngine';
import { Focus } from './Focus';

function renderFocus(engine = createEngine()) {
  render(
    <EngineContext.Provider value={engine}>
      <Focus />
    </EngineContext.Provider>,
  );
  return engine;
}

describe('Focus', () => {
  it('shows inbox-zero message when there is nothing to process', () => {
    renderFocus();
    expect(screen.getByText(/nothing to process/i)).toBeInTheDocument();
  });

  it('shows the next item and completes it via "Do now"', async () => {
    const user = userEvent.setup();
    const engine = createEngine();
    engine.addItem('first');
    engine.addItem('second');
    renderFocus(engine);

    expect(screen.getByText('first')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Do now' }));
    // first is done, focus advances to second
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(engine.getItems().find((i) => i.body === 'first')?.status).toBe('done');
  });

  it('delegates using the prompted name', async () => {
    const user = userEvent.setup();
    const engine = createEngine();
    engine.addItem('task');
    vi.spyOn(window, 'prompt').mockReturnValue('Sam');
    renderFocus(engine);

    await user.click(screen.getByRole('button', { name: 'Delegate' }));
    const item = engine.getItems()[0];
    expect(item.status).toBe('delegated');
    expect(item.delegatedTo).toBe('Sam');
  });
});
