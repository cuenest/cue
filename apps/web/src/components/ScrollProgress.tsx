import { useEffect, useState } from 'react';

/** Thin yellow rule along the top that tracks scroll position. */
export function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    const update = () => {
      const d = document.documentElement;
      const max = d.scrollHeight - d.clientHeight;
      setP(max > 0 ? window.scrollY / max : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-50 h-[2px] bg-primary transition-[width] duration-100"
      style={{ width: `${p * 100}%` }}
    />
  );
}
