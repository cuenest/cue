# @cue/mobile

**iOS + Android** app via **Capacitor** — wraps the built web app (`apps/web/dist`) in a native shell. One codebase, every surface.

## What's wired

- **Hub baked in.** The wrapped web build defaults to the deployed hub via `apps/web/.env.production` (`VITE_DEFAULT_HUB`), so a freshly built APK syncs to the real hub — not `localhost`. Override by exporting `VITE_DEFAULT_HUB` before building, or point a space at any hub in Settings.
- **Brand launcher icon.** The adaptive icon (Android 8+) is the Cue mark — ink "C" on brand yellow (`res/drawable-v24/ic_launcher_foreground.xml` + `res/values/ic_launcher_background.xml`). App id `io.cuenest.cue`, label "Cue".
- **PWA assets travel with it.** `cap copy` bundles the service worker + manifest, so offline launch works inside the shell too.

## Build an APK (needs your machine)

Requires **Android Studio** (or Android SDK + JDK 17+) — not available in CI, so the APK is built locally.

```bash
pnpm --filter @cue/mobile sync       # builds the web app (prod hub) and copies it into android/
pnpm --filter @cue/mobile android    # opens the project in Android Studio
# …or headless, from apps/mobile/android:
./gradlew assembleDebug              # → app/build/outputs/apk/debug/app-debug.apk
```

### Regenerating icons + splash for every density

The adaptive icon is already branded in-repo. To regenerate **all** legacy densities and the
splash from the brand source in `assets/` (recommended before a release build):

```bash
npx @capacitor/assets generate --android   # reads apps/mobile/assets/icon.svg|png
```

## iOS

Not yet added — requires a Mac. `pnpm exec cap add ios` from this directory scaffolds it; the same
`.env.production` hub wiring and `assets/` icons apply.

## Planned (device-side, needs a real device to iterate)

- **Share-to-capture** — an `ACTION_SEND` intent filter so "Share → Cue" from any app drops text
  straight into the queue (the mobile analogue of the extension's right-click capture). Needs a
  receive-intent plugin + `AndroidManifest` filter + a small web handler.
- **QR deep-link** — scan a `cue1.…` link code with the camera to join a space (today: paste the code).

## Status

Android project scaffolded, branded, and hub-wired; `cap copy` verified to bundle the prod-hub web
build. APK build + on-device testing happen locally (Android SDK required).
