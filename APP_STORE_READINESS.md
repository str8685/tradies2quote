# Tradies2Quote App Store readiness

Last checked: 2026-06-05

Goal: keep the current PWA live while adding a clean iOS App Store release path.

## Repo findings

- The app uses Next.js 16.2.4, React 19.2.4, Supabase, Stripe, and pdf-lib.
- No Capacitor packages are installed yet.
- No iOS native project exists yet.
- PWA manifest exists at `src/app/manifest.ts`.
- iOS home-screen web-app metadata exists in `src/app/layout.tsx`.
- Settings has sign out but needs an in-app account closure path before App Store review.

## Main App Store blockers

1. Add an iOS native wrapper with Capacitor.
2. Add native value so Apple does not see the app as a thin website wrapper.
3. Add in-app account closure initiation from Settings.
4. Prepare accurate App Store privacy answers.
5. Add iOS permission descriptions for microphone, camera, photos, files, and sharing.
6. Prepare App Review notes with a demo login and test steps.
7. Keep web/PWA scripts working for Vercel.

## Recommended build path

Keep two targets from the same repo:

- `tradies2quote.com`, Next.js PWA on Vercel.
- `Tradies2Quote iOS`, Capacitor iOS app using the same backend and native plugins.

## Capacitor packages to add

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/camera @capacitor/filesystem @capacitor/share @capacitor/preferences @capacitor/splash-screen
```

## Scripts to add after testing

```json
{
  "ios:sync": "next build && npx cap sync ios",
  "ios:open": "npx cap open ios",
  "ios:build": "next build && npx cap copy ios"
}
```

## App details

- App name: Tradies2Quote
- Bundle ID: `com.str8builders.tradies2quote`
- Category: Business or Productivity
- Support URL: `https://tradies2quote.com/support`
- Privacy URL: `https://tradies2quote.com/privacy`

## Review notes summary

Tradies2Quote helps trade businesses record job notes, generate a quote, review materials/labour/GST, export/share a PDF, and convert accepted work into an invoice. Native iOS release should use microphone, camera/photo import, file/share export, offline draft metadata, native splash, and native app icons.
