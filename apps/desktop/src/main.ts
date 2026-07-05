import { app, BrowserWindow, globalShortcut } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveStart, devUrlFromArgv } from './resolve';

const CAPTURE_SHORTCUT = 'Alt+Shift+C';

let win: BrowserWindow | null = null;

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
  });
}
