import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEngine } from '@cue/engine';
import { App } from './App';

describe('App integration', () => {
  it('captures an item then processes it to empty', async () => {
    const user = userEvent.setup();
    const engine = createEngine();
    render(<App engine={engine} persistent={false} />);

    // capture
    await user.type(screen.getByLabelText('Capture'), 'write spec');
    await user.keyboard('{Enter}');

    // it appears in focus and inbox (both Focus and Inbox render the body)
    expect(screen.getAllByText('write spec').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Inbox \(1\)/)).toBeInTheDocument();

    // process it
    await user.click(screen.getByRole('button', { name: 'Do now' }));
    expect(screen.getByText(/nothing to process/i)).toBeInTheDocument();
    expect(screen.getByText(/Inbox \(0\)/)).toBeInTheDocument();
  });

  it('shows the persistence banner when not persistent', () => {
    render(<App engine={createEngine()} persistent={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/persist/i);
  });
});
