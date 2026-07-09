import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings } from './settings';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cue-desktop-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('desktop settings', () => {
  it('defaults to hub mode off when no file exists', () => {
    expect(loadSettings(join(dir, 'missing.json'))).toEqual({ hubMode: false });
  });

  it('round-trips saved settings', () => {
    const file = join(dir, 'nested', 'cue.json'); // parent dir does not exist yet
    saveSettings(file, { hubMode: true, hubPort: 4444 });
    expect(loadSettings(file)).toEqual({ hubMode: true, hubPort: 4444 });
  });

  it('falls back to defaults on corrupt json', () => {
    const file = join(dir, 'bad.json');
    saveSettings(file, { hubMode: true });
    writeFileSync(file, '{ not json');
    expect(loadSettings(file)).toEqual({ hubMode: false });
  });
});
