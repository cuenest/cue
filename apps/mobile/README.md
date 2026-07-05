# @cue/mobile

**iOS + Android** app via **Capacitor** — wraps the built web app (`apps/web/dist`) in a native shell. One codebase, every surface.

## Android

The `android/` directory is a complete Gradle project (checked in, per Capacitor convention). To build you need Android Studio (or the Android SDK + JDK 17+):

```bash
pnpm --filter @cue/mobile sync       # builds the web app and copies it into android/
pnpm --filter @cue/mobile android    # opens the project in Android Studio
# or from apps/mobile/android:  ./gradlew assembleDebug
```

The app id is `io.cuenest.cue`. Sync works fully offline; joining an encrypted sync space uses the same link codes as every other surface (paste the code — camera QR scanning is a planned native upgrade).

## iOS

Not yet added — requires a Mac. `pnpm exec cap add ios` from this directory will scaffold it.

## Status

Android project scaffolded and syncing. APK build requires the Android SDK (not part of CI yet).
