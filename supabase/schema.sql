-- ============================================================
--  Assignment Hub — Supabase schema
--  Run this ONCE in: Supabase Dashboard -> SQL Editor -> New query
--  Safe to re-run (policies/trigger are recreated).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profiles (one row per signed-up user)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  roll_number text,
  email text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current user a teacher?
-- SECURITY DEFINER avoids recursive RLS lookups on profiles.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

-- Policies: read your own profile; teachers can read everyone's.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles: teachers read all" on public.profiles;
create policy "profiles: teachers read all"
  on public.profiles for select
  to authenticated
  using (public.is_teacher());

-- No client-side insert/update/delete policies:
-- profiles are created by the trigger below and roles are changed
-- only by you (the admin) in the SQL editor. This prevents students
-- from promoting themselves to teacher.

grant select on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 2. Auto-create a profile after signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, roll_number, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'roll_number'), ''),
    new.email,
    'student'  -- always student; promote teachers manually (see README)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. Submissions (one row per uploaded file)
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  assignment_title text not null check (char_length(assignment_title) between 1 and 80),
  file_path text not null,
  file_name text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists submissions_student_id_idx on public.submissions (student_id);
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);

alter table public.submissions enable row level security;

drop policy if exists "submissions: student inserts own" on public.submissions;
create policy "submissions: student inserts own"
  on public.submissions for insert
  to authenticated
  with check (
    auth.uid() = student_id
    and file_path like auth.uid()::text || '/%'
  );

drop policy if exists "submissions: student reads own" on public.submissions;
create policy "submissions: student reads own"
  on public.submissions for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "submissions: teachers read all" on public.submissions;
create policy "submissions: teachers read all"
  on public.submissions for select
  to authenticated
  using (public.is_teacher());

drop policy if exists "submissions: student deletes own" on public.submissions;
create policy "submissions: student deletes own"
  on public.submissions for delete
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "submissions: teachers delete" on public.submissions;
create policy "submissions: teachers delete"
  on public.submissions for delete
  to authenticated
  using (public.is_teacher());

grant select, insert, delete on public.submissions to authenticated;

-- ------------------------------------------------------------
-- 4. Private storage bucket for the files
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assignments', 'assignments', false)
on conflict (id) do update set public = false;

-- Students upload only into their own folder: <user-id>/<file>
drop policy if exists "assignments: student uploads own folder" on storage.objects;
create policy "assignments: student uploads own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assignments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "assignments: student reads own files" on storage.objects;
create policy "assignments: student reads own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assignments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "assignments: teachers read all files" on storage.objects;
create policy "assignments: teachers read all files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'assignments' and public.is_teacher());

drop policy if exists "assignments: student deletes own files" on storage.objects;
create policy "assignments: student deletes own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assignments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "assignments: teachers delete files" on storage.objects;
create policy "assignments: teachers delete files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'assignments' and public.is_teacher());

-- ------------------------------------------------------------
-- 5. Remove a student (teacher-only)
--    Deletes the student's auth account; profiles, submissions and
--    stored files are removed by the app before this runs.
-- ------------------------------------------------------------
create or replace function public.delete_student_account(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_roll text;
begin
  if not public.is_teacher() then
    raise exception 'Only teachers can remove students.' using errcode = '42501';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot remove your own account.' using errcode = '42501';
  end if;

  select role, roll_number into target_role, target_roll
  from public.profiles
  where id = target_id;

  if target_role is null then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if target_role <> 'student' or target_roll is null then
    raise exception 'Only student accounts can be removed.' using errcode = '42501';
  end if;

  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.delete_student_account(uuid) from public;
grant execute on function public.delete_student_account(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Promote a teacher (run manually, replace the email)
-- ------------------------------------------------------------
-- update public.profiles
-- set role = 'teacher', full_name = 'Teacher Name'
-- where email = 'teacher@school.com';

-- ------------------------------------------------------------
-- 7. Class materials (teacher uploads, every student can read)
-- ------------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  file_path text not null,
  file_name text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists materials_created_at_idx on public.materials (created_at desc);
create index if not exists materials_teacher_id_idx on public.materials (teacher_id);

alter table public.materials enable row level security;

drop policy if exists "materials: everyone reads" on public.materials;
create policy "materials: everyone reads"
  on public.materials for select
  to authenticated
  using (true);

drop policy if exists "materials: teachers upload" on public.materials;
create policy "materials: teachers upload"
  on public.materials for insert
  to authenticated
  with check (
    public.is_teacher()
    and teacher_id = auth.uid()
    and file_path like auth.uid()::text || '/%'
  );

drop policy if exists "materials: teachers delete own" on public.materials;
create policy "materials: teachers delete own"
  on public.materials for delete
  to authenticated
  using (public.is_teacher() and teacher_id = auth.uid());

grant select, insert, delete on public.materials to authenticated;

-- Private bucket: teacher uploads into their own folder; all signed-in
-- users can read (and therefore create signed URLs for) the files.
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;

drop policy if exists "materials: teachers upload files" on storage.objects;
create policy "materials: teachers upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'materials'
    and public.is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "materials: everyone reads files" on storage.objects;
create policy "materials: everyone reads files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'materials');

drop policy if exists "materials: teachers delete own files" on storage.objects;
create policy "materials: teachers delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'materials'
    and public.is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 8. Teacher messages
--    One row per recipient. "Send to all" creates one row for
--    every current student, so future students do not see old
--    announcements and each student has their own read state.
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null default gen_random_uuid(),
  audience text not null default 'student' check (audience in ('all', 'student')),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_teacher_idx on public.messages (teacher_id, created_at desc);
create index if not exists messages_batch_idx on public.messages (batch_id);

alter table public.messages enable row level security;

drop policy if exists "messages: teacher sends" on public.messages;
create policy "messages: teacher sends"
  on public.messages for insert
  to authenticated
  with check (
    public.is_teacher()
    and teacher_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id
        and p.role = 'student'
        and p.roll_number is not null
    )
  );

drop policy if exists "messages: teacher reads own" on public.messages;
create policy "messages: teacher reads own"
  on public.messages for select
  to authenticated
  using (public.is_teacher() and teacher_id = auth.uid());

drop policy if exists "messages: student reads own" on public.messages;
create policy "messages: student reads own"
  on public.messages for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "messages: student marks read" on public.messages;
create policy "messages: student marks read"
  on public.messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "messages: teacher deletes own" on public.messages;
create policy "messages: teacher deletes own"
  on public.messages for delete
  to authenticated
  using (public.is_teacher() and teacher_id = auth.uid());

grant select, insert, delete on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
