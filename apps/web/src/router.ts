import { useEffect, useState } from 'react';

export type Route = 'queue' | 'calendar' | 'ask' | 'files' | 'notes' | 'settings';

const ROUTES = ['calendar', 'settings', 'ask', 'files', 'notes'] as const;

function read(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const seg = h.split('/')[0] ?? '';
  return (ROUTES as readonly string[]).includes(seg) ? (seg as Route) : 'queue';
}

export function navigate(route: Route): void {
  window.location.hash = route === 'queue' ? '/' : `/${route}`;
}

/** Deep-link to a specific note (opens the Notes tab on that note). */
export function openNote(id: string): void {
  window.location.hash = `/notes/${id}`;
}

/** The note id in the hash (`#/notes/<id>`), or null. */
export function noteIdFromHash(): string | null {
  const h = window.location.hash.replace(/^#\/?/, '');
  const m = /^notes\/(.+)$/.exec(h);
  return m?.[1] ?? null;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
