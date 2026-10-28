# Assignment Hub

A mobile-friendly **website** where students upload assignments and teachers review every submission by **name and roll number**. It runs on **GitHub Pages** (free) and uses **Supabase** (free) for logins, the database, and file storage.

No app install, no build step. Open the link in any phone or computer browser.

---

## What you get

| Student side | Teacher side |
| --- | --- |
| Sign up with full name + roll number + password — **no email needed** | Request a teacher account with email + password |
| Log in with roll number + password | Log in with email + password after the admin activates it |
| Upload a file with an assignment title | See every registered student — even before they upload — plus every submission |
| See their own past submissions, view or delete them | Search by name, roll number, or title |
| Receive private messages and class announcements, with an unread badge | Message one student or every student; see read counts |
| View and download class materials shared by the teacher | Upload PDFs, notes or slides for the whole class; delete materials |
| Private: students can only see their own assignment files | View or download any student's file |
|  | Remove a student permanently: account, submissions, messages and files are deleted |

Assignment files are stored in a **private** Supabase bucket. Students cannot see each other's work. Class materials are stored in a separate private bucket that every signed-in student may read.

---

## Files

```
assignment-hub/
├── index.html          the website (open this)
├── styles.css          mobile + desktop styling
├── app.js              app logic (auth, upload, lists)
├── config.js           ← YOUR Supabase keys go here
├── icon.svg            logo / favicon
├── supabase/
│   └── schema.sql      run once in Supabase
└── README.md           this file
```

Everything is plain HTML/CSS/JS — no npm, no build command.

---

# Setup (about 10 minutes)

## 1. Create the Supabase backend

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Pick a name, a database password (save it somewhere), and the region closest to you.
3. Wait for the project to finish provisioning (~2 minutes).
4. In the left sidebar, open **SQL Editor** → **New query**.
5. Open `supabase/schema.sql` from this folder, copy **everything**, paste it into the editor, and click **Run**.
   You should see “Success. No rows returned.”
6. Open **Project Settings → API** and copy:
   - **Project URL** — e.g. `https://abcd1234.supabase.co`
   - **anon / public** key (or the new **publishable** key)

> Never copy the `service_role` key into the website. Only the **anon / publishable** key belongs in `config.js`.

### Auth settings

In Supabase:

- **Authentication → Sign In / Providers → Email**
  - **Turn “Confirm email” OFF.** This is required for student logins. Students use a roll number + password, so the app derives an internal identifier such as `roll.21@students.assignment-hub.app` behind the scenes. That address is not a real mailbox, so a confirmation link can never be clicked.
  - If you leave confirmation **ON**, a new student account is created but cannot log in until you confirm it manually in **Authentication → Users** (or turn confirmation off).
  - Teachers use their real email, so confirmation works normally for them.
- **Authentication → URL Configuration**
  - **Site URL:** your GitHub Pages address, e.g. `https://yourname.github.io/assignment-hub/`
  - **Redirect URLs:** add the same address.

> Roll numbers must be unique across everyone using the site, because each roll number maps to exactly one login. For multiple sections, use a class prefix such as `10A-21`.

---

## 2. Put your keys in `config.js`

Open `config.js` and replace the two placeholders:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...your-anon-key...",
};
```

Save the file. That’s the only code change required.

> If you see the “Almost there” screen in the browser, the keys are missing or still contain placeholders.

---

## 3. Publish on GitHub Pages (free)

1. Create a **public** repository on GitHub, e.g. `assignment-hub`.
2. Upload the **contents of this folder** so `index.html` sits at the top level of the repo
   (not inside an extra folder). Keep the `supabase/` subfolder as it is.
3. In the repo: **Settings → Pages**
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or `master`) + `/ (root)`
   - Click **Save**.
4. Wait 1–2 minutes. Your site appears at:

   ```
   https://YOUR-USERNAME.github.io/assignment-hub/
   ```

5. Go back to Supabase → **Authentication → URL Configuration** and set the **Site URL** and **Redirect URL** to that address.

Open the link on a phone and on a computer — the layout adapts to both. Students can bookmark it or add it to their home screen from the browser menu; it’s a normal website, not an app store app.

### Search engines

The page includes a title, description, and social-preview tags so it can appear in search results once GitHub Pages / Google crawl it (this can take days or weeks, and nobody can guarantee a ranking). To keep the site **out** of search results, change this line in `index.html`:

```html
<meta name="robots" content="noindex, nofollow" />
```

---

## 4. Activate the teacher account

Students sign themselves up from **Student → Sign up**. Teacher access is never granted by the website: choosing **Teacher** and signing up only creates a request. The account stays a student with no roll number until you promote it in SQL.

**Option A — teacher requests, you approve (easiest)**

1. Open the website → choose **Teacher** → **Sign up**.
2. Enter the teacher’s full name, email, and password → **Request teacher account**. If prompted, the teacher confirms their email.
3. The app shows “waiting for admin activation” until you promote the account.
4. In Supabase **SQL Editor**, run (replace the email and name):

```sql
update public.profiles
set role = 'teacher',
    full_name = 'Teacher Name',
    roll_number = null
where email = 'teacher@example.com';
```

5. Ask the teacher to log in again via **Teacher → Log in** with their email and password. The **Class dashboard** now shows the roster, messages, class materials and submissions.

To list accounts that signed up with a real email but are still students (likely teacher requests):

```sql
select full_name, email, created_at
from public.profiles
where role = 'student'
  and email not like 'roll.%@students.assignment-hub.app'
order by created_at desc;
```

**Option B — create the user in Supabase**

1. **Authentication → Users → Add user** (enable “Auto Confirm User”).
2. Run the same `update ... where email = ...` SQL as above.
3. The teacher logs in via **Teacher → Log in**.

Check who is a teacher:

```sql
select full_name, roll_number, email, role
from public.profiles
order by role, full_name;
```

---

## How the app works

1. A student signs up → the app turns their roll number into a private internal email (never shown) and creates a row in `profiles` with their name and roll number (role `student`).
2. They log in with **roll number + password**, enter an assignment title, choose a file, and tap **Upload assignment** → the file goes to the private `assignments` bucket under their user id, and a row is added to `submissions`.
3. A student can **view** or **delete** only their own uploads. Deleting removes the database row and the stored file.
4. The teacher requests an account, the admin promotes it, then the teacher logs in with **email + password** → sees the full class roster (including students with no uploads) and every submission, newest first, with student name + roll number → searches, views or downloads any file.
5. The teacher can send a **private message** to one student or an **announcement to every current student**. Announcements create one message row per recipient, so each student has their own read state; the teacher sees a grouped sent list with read counts. Students get an unread badge and an in-app toast on login, when they return to the tab, and within 45 seconds while the page is open.
6. The teacher can upload a PDF, document, slide deck or image to **Class materials**. Every student can view or download it; only the teacher can upload or delete materials.
7. The teacher can permanently remove a student with the trash button. The app deletes the student's stored files, then calls a teacher-only database function that deletes the auth account; the profile, submissions and messages cascade automatically.
8. All file links are **signed URLs** that expire quickly, so files can’t be shared publicly.

Permissions are enforced by Supabase **Row Level Security** (RLS) from `schema.sql`, not by the website code. Even someone who reads the JavaScript cannot list other students’ files.

---

## Managing data

List all submissions with student info:

```sql
select s.created_at, p.full_name, p.roll_number, s.assignment_title, s.file_name, s.file_size
from public.submissions s
join public.profiles p on p.id = s.student_id
order by s.created_at desc;
```

Delete one submission (database row):

```sql
delete from public.submissions where id = 'PASTE-SUBMISSION-ID';
```

The file itself stays in Storage. To remove it too, go to **Storage → assignments**, open the student's folder, and delete the matching file.

List sent messages and read status:

```sql
select m.created_at, p.full_name as recipient, m.audience, m.body, m.read_at
from public.messages m
join public.profiles p on p.id = m.recipient_id
order by m.created_at desc;
```

List class materials:

```sql
select title, file_name, file_size, created_at
from public.materials
order by created_at desc;
```

Clear all test data:

```sql
delete from public.messages;
delete from public.materials;
delete from public.submissions;
```

Then **Storage → assignments** → select files → **Delete**, and **Storage → materials** → select files → **Delete**.

To remove a student manually, use **Authentication → Users → Delete user** and then delete their folder under **Storage → assignments**. The teacher's **Remove** button does both steps automatically and also removes their submissions and messages. Teacher-uploaded class materials belong to the teacher account, not the student, and are not deleted when a student is removed.

Export a CSV: run the “List all submissions” query in the SQL Editor, then use the **Download CSV** option.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| “Almost there” screen | Fill in both values in `config.js`; use the exact `https://xxxx.supabase.co` URL. |
| “Wrong roll number or password” (student) | Check the roll number exactly as registered and the password. Case and spaces are ignored; each roll number can only have one account. |
| “Wrong email or password” (teacher) | Check the teacher email and password. The account must also be promoted to `teacher` before it can enter the dashboard. |
| Student sees “email confirmation is ON” after sign-up | Supabase → Authentication → Email → turn **Confirm email OFF**. Then confirm the account manually in **Authentication → Users**, or ask the student to log in again. |
| “This account is waiting for admin activation” | The teacher request exists but is still a student. Run the promotion SQL in section 4, then log in again. |
| “Email not confirmed” | Confirm the email, or turn **Confirm email OFF** in Supabase → Authentication → Email. For students this must be OFF, because their internal address is not a real inbox. |
| “Supabase blocked this action” / RLS error | `supabase/schema.sql` was not run in full, or was run in the wrong project. Re-run it. |
| “The 'assignments' storage bucket is missing” | Re-run `schema.sql` (it creates the bucket and policies). |
| Messages or class materials don't appear | Re-run `schema.sql` to create the `messages`, `materials` and `materials` storage policies, then hard-refresh. |
| “Only teachers can…” or a message fails to send | The account is not a teacher, or the student was removed from the roster. Refresh the dashboard. |
| Student can't see a class material | Confirm the `materials` bucket exists and the “materials: everyone reads files” storage policy is present. Re-run `schema.sql`. |
| Uploads fail only for big files | The app limit is 25 MB. Supabase also has a project upload limit (default 50 MB) under **Storage → Settings**. |
| Teacher still sees the student view | Run the promotion SQL in section 4, then log out and log back in. Choosing **Teacher** on the website does not grant access. |
| Confirmation link opens `localhost` | Set **Site URL** in Supabase → Authentication → URL Configuration to your GitHub Pages address. |
| Download button does nothing | Re-run `schema.sql`; pop-up blockers can also block the tab — allow pop-ups for the site. |
| Changes don’t show up | Wait for the GitHub Pages build (Actions tab) and hard-refresh the page. |
| Signup says “rate limit” | Supabase limits confirmation emails; wait a minute or turn email confirmation OFF. Student signups don’t need email at all. |

---

## Security notes

- `config.js` contains the **anon/publishable** key. That is designed to be public. Security comes from RLS policies.
- **Never** put the `service_role` key in the website, GitHub, or chat.
- Students can read, view and delete only their own submissions and files.
- Students can read only messages addressed to them, and can update only the `read_at` field on those messages. A student cannot insert a message or read another student's message.
- Teachers can read all submissions and view or download all files because of `public.is_teacher()`.
- Class materials are readable by every authenticated user and can be inserted or deleted only by a teacher, inside that teacher's own storage folder.
- Teachers can remove a student through the roster. The database function `delete_student_account` re-checks the teacher role and refuses to delete teachers, pending teacher requests, or the caller's own account.
- Removing a student is a **hard delete**: auth account, profile, submissions, messages and stored assignment files. The same roll number can create a new account later; removal is not a permanent ban.
- Choosing **Teacher** at sign-up only sends a request: the database trigger always creates new accounts as `student`. Only your SQL can promote a teacher.
- Student roll numbers are converted into internal email identifiers for Supabase Auth. They are not real inboxes and are never shown to other students.
- Only you can promote a teacher — by running SQL in Supabase. The website cannot change roles.
- Free Supabase projects pause after a period of inactivity; open the Supabase dashboard and restore the project if the site suddenly can’t load data.

---

## Customising

- **School / app name:** search for “Assignment Hub” in `index.html` and replace it.
- **Colours:** edit the `:root` variables at the top of `styles.css` (`--primary`, `--bg`, etc.).
- **Upload limit:** change `MAX_BYTES` in `app.js` (`25 * 1024 * 1024`) and keep it below Supabase’s storage limit.
- **File types:** the input accepts any file. To restrict, add an `accept` attribute to `#fileInput` in `index.html`, e.g. `accept=".pdf,.doc,.docx"`.

---

## Free-tier limits (typical)

- **GitHub Pages:** free for public repositories.
- **Supabase:** free tier includes a small database (~500 MB), 1 GB file storage, and generous auth. Fine for a class; check the current limits on Supabase’s pricing page.
