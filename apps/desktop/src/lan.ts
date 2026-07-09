import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

/**
 * The ws:// URLs a hub running on this machine is reachable at. External LAN
 * addresses come first (that's what other devices use), loopback last. Node has
 * reported `family` as both the string 'IPv4' and the number 4 across versions,
 * so we accept either.
 */
export function hubUrls(
  port: number,
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string[] {
  const lan: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      const isIPv4 = ni.family === 'IPv4' || (ni.family as unknown as number) === 4;
      if (isIPv4 && !ni.internal) lan.push(`ws://${ni.address}:${port}`);
    }
  }
  return [...lan, `ws://localhost:${port}`];
}
