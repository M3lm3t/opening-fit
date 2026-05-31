# OpeningFit Manual Checks

## Signup and Profile Persistence

1. Open `/login` with Supabase environment variables configured.
2. Request an email magic link with a new email address.
3. Confirm the new user appears in Supabase Auth.
4. Confirm `public.profiles` has one row for the new `auth.users.id`.
5. Refresh the app after login and confirm the profile/account panel reloads without RLS errors.
6. Save Chess.com/Lichess usernames from the account panel and refresh again.
7. Confirm the saved usernames are still visible after refresh/login.
8. Check browser console for any `OpeningFit ... failed` Supabase logs.

## RLS Checks

1. As user A, save account details and an analysis.
2. As user B, sign in in another browser/profile.
3. Confirm user B cannot see user A rows in `profiles`, `settings`, `activity_history`, or `report_history`.
4. Confirm inserts have `user_id = auth.uid()` and succeed for the signed-in user.

## Analysis Time Format Persistence

1. On the analyse page, choose each time format option and confirm the selected state is visible on mobile and desktop.
2. Run an import while signed in.
3. Confirm the saved `report_history.summary.analysisTimeFormat` matches the selected option.
4. Confirm `report_history.summary.detectedTimeFormat` is populated when PGN/game metadata includes time control data.
5. Confirm the report history UI shows the selected time format beside saved analyses.
6. Refresh/login again and confirm the saved report still includes the selected time format.
