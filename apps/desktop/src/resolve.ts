/** Decides what the desktop window should load, in priority order. */
export type Start =
  | { kind: 'url'; value: string }
  | { kind: 'file'; value: string }
  | { kind: 'none' };

export function resolveStart(opts: {
  /** --dev-url=… flag or CUE_DEV_URL env — used during development. */
  devUrl?: string;
  /** Path to the built web app's index.html. */
  distIndex: string;
  exists: (path: string) => boolean;
}): Start {
  if (opts.devUrl) return { kind: 'url', value: opts.devUrl };
  if (opts.exists(opts.distIndex)) return { kind: 'file', value: opts.distIndex };
  return { kind: 'none' };
}

export function devUrlFromArgv(argv: string[], env: Record<string, string | undefined>): string | undefined {
  const flag = argv.find((a) => a.startsWith('--dev-url='));
  return flag ? flag.slice('--dev-url='.length) : env.CUE_DEV_URL;
}
