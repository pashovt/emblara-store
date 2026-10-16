-- Grant the FIRST merchant account. Run ONCE, by you, in the Supabase SQL Editor.
-- This is not a migration and is never reachable from the browser or from sign-up.
--
-- 1. Supabase dashboard > Authentication > Users > Add user (email + password, tick
--    "Auto confirm user"). Do not use public sign-up for this.
-- 2. Replace the email below with that user's email, read it, run it.
-- 3. It must return exactly 1 row. 0 rows means the email matches no confirmed user.

insert into emblara.staff (user_id, email)
select id, email
from auth.users
where lower(email) = lower('REPLACE-WITH-OWNER-EMAIL')
  and email_confirmed_at is not null
on conflict (user_id) do nothing
returning user_id, email;

-- Revoking access later takes effect on the next request, because the server
-- re-checks this table every time:
--   delete from emblara.staff where lower(email) = lower('someone@example.com');
