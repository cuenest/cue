import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEngine } from '@cue/engine';
import { EngineContext } from '../useEngine';
import { Capture } from './Capture';

function renderCapture(engine = createEngine()) {
  render(
    <EngineContext.Provider value={engine}>
      <Capture />
    </EngineContext.Provider>,
  );
  return engine;
}

describe('Capture', () => {
  it('adds a trimmed item on submit and clears the input', async () => {
    const user = userEvent.setup();
    const engine = renderCapture();
    const input = screen.getByLabelText('Capture');
    await user.type(input, '  buy milk  ');
    await user.keyboard('{Enter}');
    expect(engine.getItems().map((i) => i.body)).toEqual(['buy milk']);
    expect(input).toHaveValue('');
  });

  it('ignores an empty/whitespace submit', async () => {
    const user = userEvent.setup();
    const engine = renderCapture();
    await user.type(screen.getByLabelText('Capture'), '   ');
    await user.keyboard('{Enter}');
    expect(engine.getItems()).toHaveLength(0);
  });
});
