-- Security update: only YOUR account (the first one created in this project) can read or change data.
-- Before this, any signed-in account could, which was only safe while "Allow new users to sign up" was off.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

create or replace function public.is_owner() returns boolean
language sql security definer stable set search_path = ''
as $$
  select auth.uid() is not null
     and auth.uid() = (select id from auth.users order by created_at asc limit 1)
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clients','interactions','followups','orders','week_plan','day_status',
                           'prospects','places_cache','settings','push_subscriptions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "signed in" on %I', t);
    execute format('drop policy if exists "owner only" on %I', t);
    execute format('create policy "owner only" on %I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;
