/**
 * Library entry: re-exports the hub so other packages (e.g. the desktop app,
 * which can host a hub in-process) can embed it. Unlike ./index.ts, importing
 * this does NOT start a server — the consumer calls createHub itself.
 */
export { createHub, type Hub, type HubOptions } from './server';
