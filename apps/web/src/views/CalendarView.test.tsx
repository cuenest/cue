import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createEngine } from '@cue/engine';
import { EngineContext } from '../useEngine';
import { CalendarView } from './CalendarView';

describe('CalendarView', () => {
  it('shows a scheduled Cue item on the month grid', () => {
    const engine = createEngine();
    const item = engine.addItem('dentist prep');
    // schedule for the 15th of the current month at 10:00 local
    const now = new Date();
    engine.schedule(item.id, new Date(now.getFullYear(), now.getMonth(), 15, 10).getTime());

    render(
      <EngineContext.Provider value={engine}>
        <CalendarView />
      </EngineContext.Provider>,
    );

    expect(screen.getAllByText('dentist prep').length).toBeGreaterThan(0);
    // current month title is shown
    const title = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('prompts to add a calendar when no sources exist', () => {
    const engine = createEngine();
    render(
      <EngineContext.Provider value={engine}>
        <CalendarView />
      </EngineContext.Provider>,
    );
    expect(screen.getByText(/add one in settings/i)).toBeInTheDocument();
  });
});
