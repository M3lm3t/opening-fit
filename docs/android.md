# OpeningFit Android

## Architecture

```text
React / Vite (shared application and product logic)
                    ↓
             Capacitor 8 shell
                    ↓
                  Android

Shared remote services: FastAPI + Supabase
```

The Android application bundles the same Vite production build as the website. It does not host the production website through `server.url`, create a separate account, or fork analysis, reports, repertoire, training, persistence, or entitlement logic.

## Local requirements

- Node.js 22 or later (the package requires Node 20.19 or later; Capacitor 8 tooling uses modern Node releases)
- Android Studio with Android SDK Platform 36 and Build Tools installed
- JDK 21 (Capacitor 8 compiles the Android project with Java 21)
- An Android emulator or USB-debuggable device for `android:run`

Set `JAVA_HOME` and `ANDROID_HOME`, or let Android Studio create `android/local.properties`. That file is ignored and must not be committed.

## Commands

From `frontend`:

```powershell
npm ci
npm run build
npm run android:sync
npm run android:open
```

Run on a configured emulator/device:

```powershell
npm run android:run
```

Build a debug APK:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is generated under `android/app/build/outputs/apk/debug/` and is ignored by Git.

Build an unsigned release bundle for verification:

```powershell
cd android
.\gradlew.bat bundleRelease
```

The AAB is generated under `android/app/build/outputs/bundle/release/`. Play distribution still requires a private release keystore and signing configuration supplied outside Git.

## Application identity and SDK

- App ID / package: `com.openingfit.app`
- Display name: `OpeningFit`
- Capacitor web directory: `dist`
- Minimum SDK: 24
- Compile SDK: 36
- Target SDK: 36
- Android Gradle Plugin: 8.13.0
- Gradle wrapper: 8.14.3
- Java: 21

Increment `versionCode` for every Play upload and update `versionName` for the user-visible release in `android/app/build.gradle`. Do not reuse a published version code.

Launcher and splash assets are generated from the existing OpeningFit knight artwork in `frontend/assets/logo.svg`. Regenerate them with the official `@capacitor/assets` tool when the approved brand source changes.

## API and security

Web production continues using same-origin API paths. The bundled native app uses `https://www.openingfit.com` unless `VITE_API_BASE_URL` is provided at build time. Release cleartext traffic is disabled.

The Android manifest requests only internet access. It does not request camera, microphone, contacts, location, or storage access. Supabase continues using the public URL and anon/publishable key supplied through existing Vite configuration. Never add a Supabase service-role key, Stripe secret, signing password, keystore, `google-services.json`, or secret `.env` file to the Android project.

## Authentication and app links

Email/password sign-in uses the unchanged Supabase client, storage key, session persistence, and refresh behavior. OAuth and magic links use:

`https://www.openingfit.com/account`

The native shell accepts both PKCE `code` callbacks and access/refresh-token callbacks, then restores the same Supabase user session.

Repository-side Android App Link intent filters exist for `openingfit.com` and `www.openingfit.com`, but links are not production-verified until domain association is deployed. Required external setup:

1. Add `https://www.openingfit.com/account` to Supabase Auth redirect URLs.
2. Keep the Google OAuth client/provider configuration connected to that Supabase project.
3. Obtain the SHA-256 fingerprint for the final Play App Signing certificate.
4. Publish `https://www.openingfit.com/.well-known/assetlinks.json` with the real fingerprint:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.openingfit.app",
      "sha256_cert_fingerprints": ["REAL_PLAY_SIGNING_SHA256_FINGERPRINT"]
    }
  }
]
```

The placeholder above is documentation only and must never be deployed. Verify association with Android Studio/App Links Assistant and a Play-signed build before describing App Links as production verified.

The checked-in association currently contains the local Android debug certificate solely for ADB/device authentication testing. Before a Play release, add the Play App Signing SHA-256 certificate fingerprint to the same `com.openingfit.app` statement and verify the Play-installed build. Do not remove a still-needed development fingerprint until debug callback testing no longer uses it.

## Navigation and browser boundaries

Android Back closes the top visible dialog first, then uses existing browser history, and exits only when no internal WebView history remains. HTTPS links intentionally leaving the bundled application use Capacitor Browser. Stripe checkout and account management therefore open securely outside the WebView; web behavior continues to use normal browser navigation.

The website keeps its service worker. The native bundle does not register it, avoiding stale bundled assets and competing caches.

## Billing

Google Play Billing is deliberately not implemented in this foundation. Checkout still calls the existing authenticated FastAPI Stripe endpoint, and entitlement restoration still comes exclusively from the existing backend/Supabase records. Existing paid, cancelled-until-period-end, and lifetime access semantics are unchanged.

Before Play submission, confirm whether the app's external Stripe purchase flow is allowed for its store category and target markets. If Play Billing is required, implement it behind the existing billing-navigation seam without adding a second premium flag or entitlement source.

## Remaining Google Play work

- Create the Play Console application and complete store listing/data-safety declarations.
- Configure Play App Signing and deploy the real `assetlinks.json` fingerprint.
- Create secure release signing configuration outside the repository.
- Verify OAuth consent/client configuration and Supabase redirect allow-list.
- Test email/password, OAuth return, imports, reports, history, repertoire, training, and entitlement restoration on physical Android devices.
- Decide and implement a policy-compliant Android purchase route; Play Billing is not part of this block.
- Produce screenshots, feature graphic, privacy declarations, content rating, and closed-test release.
