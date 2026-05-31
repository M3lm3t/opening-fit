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

## Style-Based Starter Recommendations

1. Import an account with 1 game and confirm `Starter Opening Recommendations` appears.
2. Import an account with 3 games and confirm recommendations are labelled `Style-Based Recommendation`.
3. Import an account with 10+ games but no repeated openings and confirm the low-data reasons are shown.
4. Import an account with clear repeated openings and confirm detected openings remain primary.
5. Toggle `Use style-based recommendations when opening data is limited` off and on.
6. Confirm aggressive/tactical samples include Italian/Scotch/Vienna-style suggestions.
7. Confirm solid/positional samples include London/Queen's Gambit/Caro-Kann/French-style suggestions.
8. Confirm theory-heavy openings appear only as `Future Upgrade Openings`.
9. While logged in, save/import and confirm `report_history.style_profile` and `report_history.style_based_recommendations` are populated after the migration is applied.
10. Check mobile, desktop, light mode, and dark mode.
