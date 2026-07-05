import { useEffect, useState } from 'react';

export type Route = 'queue' | 'calendar' | 'ask' | 'settings';

function read(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'calendar' || h === 'settings' || h === 'ask' ? h : 'queue';
}

export function navigate(route: Route): void {
  window.location.hash = route === 'queue' ? '/' : `/${route}`;
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
