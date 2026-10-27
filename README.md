# Assignment Hub

A mobile-friendly **website** where students upload assignments and teachers review every submission by **name and roll number**. It runs on **GitHub Pages** (free) and uses **Supabase** (free) for logins, the database, and file storage.

No app install, no build step. Open the link in any phone or computer browser.

---

## What you get

| Student side | Teacher side |
| --- | --- |
| Sign up with full name + roll number | Log in with the teacher account |
| Upload a file with an assignment title | See every submission: student name, roll number, title, file, date |
| See their own past submissions, view or delete them | Search by name, roll number, or title |
| Private: students can only see their own files | Download any student's file with one click |

Files are stored in a **private** Supabase bucket. Students cannot see each other's work.

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
  - For an easy classroom setup, turn **Confirm email OFF**. Students can sign up and log in immediately.
  - If you keep it **ON**, students must click the link in their inbox before logging in.
- **Authentication → URL Configuration**
  - **Site URL:** your GitHub Pages address, e.g. `https://yourname.github.io/assignment-hub/`
  - **Redirect URLs:** add the same address.

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

## 4. Create the teacher account

Students create their own accounts from the **Sign up** tab. The teacher account is made once by you.

**Option A — sign up, then promote (easiest)**

1. Open the website → **Sign up** and create an account with the teacher’s email (roll number can be anything, e.g. `T-01`).
2. In Supabase **SQL Editor**, run (replace the email and name):

```sql
update public.profiles
set role = 'teacher',
    full_name = 'Teacher Name',
    roll_number = null
where email = 'teacher@example.com';
```

3. Log out and log back in. The dashboard now shows **Student submissions**.

**Option B — create the user in Supabase**

1. **Authentication → Users → Add user** (enable “Auto Confirm User”).
2. Run the same `update ... where email = ...` SQL as above.

Check who is a teacher:

```sql
select full_name, roll_number, email, role
from public.profiles
order by role, full_name;
```

---

## How the app works

1. A student signs up → a row is created in `profiles` with their name and roll number (role `student`).
2. They enter an assignment title, choose a file, and tap **Upload assignment** → the file goes to the private `assignments` bucket under their user id, and a row is added to `submissions`.
3. A student can **view** or **delete** only their own uploads. Deleting removes the database row and the stored file.
4. The teacher opens the site → sees every submission, newest first, with student name + roll number → searches or downloads.
5. All file links are **signed URLs** that expire quickly, so files can’t be shared publicly.

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

Clear all test data:

```sql
delete from public.submissions;
```

Then **Storage → assignments** → select files → **Delete**.

Export a CSV: run the “List all submissions” query in the SQL Editor, then use the **Download CSV** option.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| “Almost there” screen | Fill in both values in `config.js`; use the exact `https://xxxx.supabase.co` URL. |
| “Invalid login credentials” | Wrong email/password. If the account was just created and email confirmation is ON, confirm the email first. |
| “Email not confirmed” | Confirm the email, or turn **Confirm email** OFF in Supabase → Authentication → Email. |
| “Supabase blocked this action” / RLS error | `supabase/schema.sql` was not run in full, or was run in the wrong project. Re-run it. |
| “The 'assignments' storage bucket is missing” | Re-run `schema.sql` (it creates the bucket and policies). |
| Uploads fail only for big files | The app limit is 25 MB. Supabase also has a project upload limit (default 50 MB) under **Storage → Settings**. |
| Teacher still sees the student view | Run the teacher `update` SQL, then log out and log back in. |
| Confirmation link opens `localhost` | Set **Site URL** in Supabase → Authentication → URL Configuration to your GitHub Pages address. |
| Download button does nothing | Re-run `schema.sql`; pop-up blockers can also block the tab — allow pop-ups for the site. |
| Changes don’t show up | Wait for the GitHub Pages build (Actions tab) and hard-refresh the page. |
| Signup says “rate limit” | Supabase limits confirmation emails; wait a minute or turn email confirmation OFF. |

---

## Security notes

- `config.js` contains the **anon/publishable** key. That is designed to be public. Security comes from RLS policies.
- **Never** put the `service_role` key in the website, GitHub, or chat.
- Students can read, view and delete only their own submissions and files.
- Teachers can read all submissions and download all files because of `public.is_teacher()`.
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
