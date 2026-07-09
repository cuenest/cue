import { app, BrowserWindow, globalShortcut, Menu, dialog, clipboard } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveStart, devUrlFromArgv } from './resolve';
import { HubController } from './hub-controller';
import { hubUrls } from './lan';
import { loadSettings, saveSettings, type DesktopSettings } from './settings';

const CAPTURE_SHORTCUT = 'Alt+Shift+C';

let win: BrowserWindow | null = null;

// ---- Hub mode: this device can host a sync hub for the user's other devices --
const settingsFile = join(app.getPath('userData'), 'cue-desktop.json');
let settings: DesktopSettings = loadSettings(settingsFile);
const hub = new HubController({
  dataDir: join(app.getPath('userData'), 'hub-data'),
  port: settings.hubPort,
});

function persist(): void {
  saveSettings(settingsFile, settings);
}

/** Turn hub hosting on/off; reverts + reports if the hub can't start. */
async function setHubMode(on: boolean): Promise<void> {
  try {
    if (on) await hub.start();
    else await hub.stop();
    settings = { ...settings, hubMode: hub.running };
  } catch (err) {
    settings = { ...settings, hubMode: false };
    void dialog.showMessageBox({
      type: 'error',
      message: 'Could not start the hub on this device',
      detail: `${err instanceof Error ? err.message : String(err)}\n\nAnother app may be using the port.`,
    });
  } finally {
    persist();
    buildMenu();
  }
}

function showHubAddress(): void {
  if (!hub.running || hub.port === null) return;
  const urls = hubUrls(hub.port);
  void dialog
    .showMessageBox({
      type: 'info',
      message: 'This device is hosting a Cue hub',
      detail:
        'On another device, paste one of these as the hub when creating or ' +
        `joining a space (same network):\n\n${urls.join('\n')}`,
      buttons: ['Copy address', 'Close'],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) clipboard.writeText(urls[0] ?? '');
    });
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'Hub',
      submenu: [
        {
          label: 'Host a sync hub on this device',
          type: 'checkbox',
          checked: hub.running,
          click: (item) => void setHubMode(item.checked),
        },
        {
          label: 'Show hub address…',
          enabled: hub.running,
          click: showHubAddress,
        },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 760,
    height: 940,
    autoHideMenuBar: true,
    backgroundColor: '#f6f4ee',
    title: 'Cue',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const start = resolveStart({
    devUrl: devUrlFromArgv(process.argv, process.env),
    distIndex: join(__dirname, '..', '..', 'web', 'dist', 'index.html'),
    exists: existsSync,
  });

  if (start.kind === 'url') {
    void win.loadURL(start.value);
  } else if (start.kind === 'file') {
    void win.loadFile(start.value);
  } else {
    void win.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<body style="font-family:monospace;background:#f6f4ee;color:#1d1b16;padding:2rem">' +
            '<h2>Cue desktop</h2>' +
            '<p>No web build found. Run <code>pnpm --filter @cue/web build</code> first, ' +
            'or start the dev server and launch with <code>--dev-url=http://localhost:5178</code>.</p>' +
            '</body>',
        ),
    );
  }

  win.on('closed', () => {
    win = null;
  });
}

/** Summon the window and put the cursor in the capture box. */
function focusCapture(): void {
  if (!win) createWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  void win.webContents
    .executeJavaScript(
      `window.location.hash = '/';` +
        `setTimeout(() => document.querySelector('input[aria-label="Capture"]')?.focus(), 150);`,
      true,
    )
    .catch(() => {
      /* page may still be loading — autofocus covers it */
    });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', focusCapture);

  void app.whenReady().then(() => {
    createWindow();
    buildMenu();
    if (settings.hubMode) void setHubMode(true); // resume hosting from last session
    const ok = globalShortcut.register(CAPTURE_SHORTCUT, focusCapture);
    if (!ok) console.warn(`[cue-desktop] could not register global shortcut ${CAPTURE_SHORTCUT}`);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!win) createWindow();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    void hub.stop();
  });
}
