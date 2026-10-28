/* ============================================================
   Assignment Hub — app logic
   Requires: config.js + Supabase JS (loaded by index.html)
   ============================================================ */

(() => {
  "use strict";

  /* ---------- Config ---------- */

  const cfg = window.APP_CONFIG || {};
  const SUPA_URL = String(cfg.SUPABASE_URL || "").trim();
  const SUPA_KEY = String(cfg.SUPABASE_ANON_KEY || "").trim();
  const BUCKET = "assignments";
  const MAX_BYTES = 25 * 1024 * 1024;

  // Students log in with a roll number, but Supabase Auth needs an email.
  // We derive a private identifier from the roll number behind the scenes.
  const STUDENT_EMAIL_DOMAIN = "students.assignment-hub.app";

  const state = {
    client: null,
    user: null,
    profile: null,
    mode: "login",
    role: "student",
    intendedRole: null,
    authAction: null,
    file: null,
    mine: [],
    rows: [],
    students: [],
    query: "",
    entering: false,
  };

  /* ---------- DOM ---------- */

  const $ = (id) => document.getElementById(id);

  const el = {
    boot: $("boot"),
    setupView: $("setupView"),
    setupDetail: $("setupDetail"),
    fatalView: $("fatalView"),
    fatalMessage: $("fatalMessage"),
    fatalRetry: $("fatalRetry"),
    authView: $("authView"),
    appView: $("appView"),

    roleTabs: $("roleTabs"),
    authTabs: $("authTabs"),
    authError: $("authError"),
    authInfo: $("authInfo"),
    studentLoginForm: $("studentLoginForm"),
    studentLoginRoll: $("studentLoginRoll"),
    studentLoginPassword: $("studentLoginPassword"),
    studentLoginBtn: $("studentLoginBtn"),
    studentSignupForm: $("studentSignupForm"),
    studentSignupName: $("studentSignupName"),
    studentSignupRoll: $("studentSignupRoll"),
    studentSignupPassword: $("studentSignupPassword"),
    studentSignupBtn: $("studentSignupBtn"),
    teacherLoginForm: $("teacherLoginForm"),
    teacherLoginEmail: $("teacherLoginEmail"),
    teacherLoginPassword: $("teacherLoginPassword"),
    teacherLoginBtn: $("teacherLoginBtn"),
    teacherSignupForm: $("teacherSignupForm"),
    teacherSignupName: $("teacherSignupName"),
    teacherSignupEmail: $("teacherSignupEmail"),
    teacherSignupPassword: $("teacherSignupPassword"),
    teacherSignupBtn: $("teacherSignupBtn"),

    userAvatar: $("userAvatar"),
    userName: $("userName"),
    userSub: $("userSub"),
    logoutBtn: $("logoutBtn"),

    studentView: $("studentView"),
    studentFirst: $("studentFirst"),
    studentRollPill: $("studentRollPill"),
    uploadForm: $("uploadForm"),
    assignmentTitle: $("assignmentTitle"),
    dropZone: $("dropZone"),
    fileInput: $("fileInput"),
    filePreview: $("filePreview"),
    previewExt: $("previewExt"),
    previewName: $("previewName"),
    previewSize: $("previewSize"),
    clearFile: $("clearFile"),
    uploadBtn: $("uploadBtn"),
    uploadProgress: $("uploadProgress"),
    uploadNote: $("uploadNote"),
    myCount: $("myCount"),
    refreshMine: $("refreshMine"),
    myList: $("myList"),
    myEmpty: $("myEmpty"),

    teacherView: $("teacherView"),
    statTotal: $("statTotal"),
    statStudents: $("statStudents"),
    statLatest: $("statLatest"),
    teacherSearch: $("teacherSearch"),
    refreshAll: $("refreshAll"),
    teacherList: $("teacherList"),
    teacherEmpty: $("teacherEmpty"),
    teacherEmptyTitle: $("teacherEmptyTitle"),
    teacherEmptyText: $("teacherEmptyText"),
    rosterCount: $("rosterCount"),
    rosterList: $("rosterList"),
    rosterEmpty: $("rosterEmpty"),
    submissionsPanel: $("submissionsPanel"),

    toasts: $("toasts"),
  };

  /* ---------- Icons / formatting helpers ---------- */

  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12M10 11v5.5M14 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5m0 3h.01M10.3 3.9 2.4 17.4A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const shortDateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

  function fmtBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fullDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
  }

  function timeAgo(iso) {
    const d = new Date(iso);
    const t = d.getTime();
    if (Number.isNaN(t)) return "";
    const diff = Math.round((t - Date.now()) / 1000);
    const abs = Math.abs(diff);
    if (abs < 45) return "just now";
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 604800) return rtf.format(Math.round(diff / 86400), "day");
    return shortDateFmt.format(d);
  }

  function extOf(name) {
    const m = String(name || "").match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toUpperCase() : "FILE";
  }

  function extClass(name) {
    const parts = String(name || "").toLowerCase().split(".");
    const ext = parts.length > 1 ? parts.pop() : "";
    if (ext === "pdf") return "ext-pdf";
    if (["doc", "docx", "rtf", "odt", "txt"].includes(ext)) return "ext-doc";
    if (["png", "jpg", "jpeg", "gif", "webp", "heic", "svg", "bmp"].includes(ext)) return "ext-img";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "ext-zip";
    if (["xls", "xlsx", "csv", "ods", "ppt", "pptx"].includes(ext)) return "ext-sheet";
    return "ext-file";
  }

  function safeFileName(name) {
    const cleaned = String(name || "file")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");
    return (cleaned || "file").slice(-120);
  }

  function studentEmail(rollNumber) {
    const slug = String(rollNumber || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/^[_-]+|[_-]+$/g, "");
    return /[a-z0-9]/.test(slug) ? `roll.${slug}@${STUDENT_EMAIL_DOMAIN}` : "";
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }

  function avatarStyle(name) {
    let hue = 0;
    for (const ch of String(name || "?")) hue = (hue * 31 + ch.codePointAt(0)) % 360;
    return `background:hsl(${hue} 72% 94%);color:hsl(${hue} 46% 34%);border-color:hsl(${hue} 58% 87%)`;
  }

  function friendlyError(message, role) {
    const raw = String(message || "");
    const m = raw.toLowerCase();
    const isStudent = role === "student";
    if (m.includes("invalid login")) {
      return isStudent ? "Wrong roll number or password. Please try again." : "Wrong email or password. Please try again.";
    }
    if (m.includes("email not confirmed")) {
      return isStudent
        ? "This student account is not confirmed. Ask the class admin to confirm it (or turn OFF “Confirm email” in Supabase), then try again."
        : "Please confirm your email first — check your inbox for the link.";
    }
    if (m.includes("already registered")) {
      return isStudent
        ? "That roll number already has an account. Try logging in."
        : "An account with this email already exists. Try logging in.";
    }
    if (m.includes("password should be")) return "Password must be at least 6 characters.";
    if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Network problem. Check your connection and try again.";
    if (m.includes("row-level security") || m.includes("permission")) {
      return "Supabase blocked this action. Make sure supabase/schema.sql was run in full.";
    }
    if (m.includes("bucket not found")) return "The 'assignments' storage bucket is missing. Run supabase/schema.sql.";
    if (m.includes("payload") || m.includes("too large") || m.includes("maximum")) return "That file is too large. The limit is 25 MB.";
    return raw || "Something went wrong. Please try again.";
  }

  /* ---------- Views / alerts / buttons ---------- */

  function setTopView(view) {
    [el.setupView, el.fatalView, el.authView, el.appView].forEach((v) => {
      v.hidden = v !== view;
    });
  }

  function finishBoot() {
    if (el.boot) el.boot.hidden = true;
  }

  function showSetup(reason) {
    setTopView(el.setupView);
    el.setupDetail.textContent = reason || "";
    finishBoot();
  }

  function showFatal(message) {
    setTopView(el.fatalView);
    el.fatalMessage.textContent = message || "Something went wrong while loading the app.";
    finishBoot();
  }

  function showAuth() {
    setTopView(el.authView);
    setAuthRole("student");
    setAuthMode("login");
    hideAlerts();
    finishBoot();
  }

  function hideAlerts() {
    el.authError.hidden = true;
    el.authInfo.hidden = true;
    el.authError.textContent = "";
    el.authInfo.textContent = "";
  }

  function showAlert(type, message) {
    hideAlerts();
    const box = type === "error" ? el.authError : el.authInfo;
    box.textContent = message;
    box.hidden = false;
  }

  function setAuthMode(mode) {
    state.mode = mode;
    [...el.authTabs.querySelectorAll(".auth-tab")].forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderAuthForms();
    hideAlerts();
  }

  function setAuthRole(role) {
    state.role = role === "teacher" ? "teacher" : "student";
    [...el.roleTabs.querySelectorAll(".role-tab")].forEach((btn) => {
      const active = btn.dataset.role === state.role;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderAuthForms();
    hideAlerts();
  }

  function renderAuthForms() {
    const forms = [
      el.studentLoginForm,
      el.studentSignupForm,
      el.teacherLoginForm,
      el.teacherSignupForm,
    ];
    forms.forEach((form) => {
      form.hidden = true;
    });

    const isTeacher = state.role === "teacher";
    const isLogin = state.mode === "login";
    const active = isTeacher
      ? isLogin
        ? el.teacherLoginForm
        : el.teacherSignupForm
      : isLogin
        ? el.studentLoginForm
        : el.studentSignupForm;

    active.hidden = false;
  }

  function setButtonBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent.trim();
      btn.disabled = true;
      const target = btn.querySelector("span") || btn;
      if (label) target.textContent = label;
    } else {
      btn.disabled = false;
      const target = btn.querySelector("span") || btn;
      target.textContent = btn.dataset.idleLabel || target.textContent;
    }
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast ${type === "error" ? "toast-error" : "toast-success"}`;
    const icon = document.createElement("span");
    icon.innerHTML = type === "error" ? ICON_WARN : ICON_CHECK;
    const text = document.createElement("span");
    text.textContent = message;
    node.append(icon.firstElementChild, text);
    el.toasts.appendChild(node);
    window.setTimeout(() => {
      node.classList.add("is-out");
      window.setTimeout(() => node.remove(), 240);
    }, 4200);
  }

  /* ---------- Boot ---------- */

  function isConfigured() {
    if (!SUPA_URL || !SUPA_KEY) return false;
    if (/YOUR[-_]|PASTE|REPLACE|xxxx|example/i.test(SUPA_URL + " " + SUPA_KEY)) return false;
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPA_URL) && SUPA_KEY.length >= 20;
  }

  function setupReason() {
    if (!SUPA_URL) return "SUPABASE_URL is still empty in config.js.";
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPA_URL)) {
      return "SUPABASE_URL should look like https://abcd1234.supabase.co (no trailing path).";
    }
    if (!SUPA_KEY) return "SUPABASE_ANON_KEY is still empty in config.js.";
    if (SUPA_KEY.length < 20) return "SUPABASE_ANON_KEY looks too short — copy the whole anon / publishable key.";
    return "Replace the placeholder values in config.js with your real Supabase keys.";
  }

  async function boot() {
    wireEvents();

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      showFatal("The Supabase library could not load. Check your internet connection and reload the page.");
      return;
    }

    if (!isConfigured()) {
      showSetup(setupReason());
      return;
    }

    try {
      state.client = window.supabase.createClient(SUPA_URL, SUPA_KEY);

      state.client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          state.user = null;
          state.profile = null;
          state.mine = [];
          state.rows = [];
          showAuth();
          return;
        }
        if (session && session.user && (!state.user || state.user.id !== session.user.id)) {
          const user = session.user;
          window.setTimeout(() => enter(user), 0);
        }
      });

      const { data, error } = await state.client.auth.getSession();
      if (error) throw error;

      if (data && data.session && data.session.user) {
        await enter(data.session.user);
      } else {
        showAuth();
      }
    } catch (err) {
      console.error("[assignment-hub] boot failed:", err);
      showFatal(friendlyError(err && err.message));
    } finally {
      finishBoot();
    }
  }

  /* ---------- Auth ---------- */

  function beginAuth(role, action) {
    state.intendedRole = role;
    state.authAction = action;
  }

  function cancelAuth() {
    state.intendedRole = null;
    state.authAction = null;
  }

  async function handleStudentLogin(event) {
    event.preventDefault();
    hideAlerts();

    const rollNumber = el.studentLoginRoll.value.trim();
    const password = el.studentLoginPassword.value;

    if (!rollNumber || !password) {
      showAlert("error", "Enter your roll number and password.");
      return;
    }

    const email = studentEmail(rollNumber);
    if (!email) {
      showAlert("error", "Enter a valid roll number.");
      return;
    }

    beginAuth("student", "login");
    setButtonBusy(el.studentLoginBtn, true, "Logging in…");
    try {
      const { error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) {
        cancelAuth();
        showAlert("error", friendlyError(error.message, "student"));
      }
    } catch (err) {
      cancelAuth();
      showAlert("error", friendlyError(err && err.message, "student"));
    } finally {
      setButtonBusy(el.studentLoginBtn, false);
    }
  }

  async function handleStudentSignup(event) {
    event.preventDefault();
    hideAlerts();

    const fullName = el.studentSignupName.value.trim().replace(/\s+/g, " ");
    const rollNumber = el.studentSignupRoll.value.trim();
    const password = el.studentSignupPassword.value;

    if (fullName.length < 2) {
      showAlert("error", "Enter your full name.");
      return;
    }
    if (!rollNumber) {
      showAlert("error", "Enter your roll number.");
      return;
    }

    const email = studentEmail(rollNumber);
    if (!email) {
      showAlert("error", "Enter a valid roll number (letters and numbers only).");
      return;
    }
    if (password.length < 6) {
      showAlert("error", "Password must be at least 6 characters.");
      return;
    }

    beginAuth("student", "signup");
    setButtonBusy(el.studentSignupBtn, true, "Creating account…");
    try {
      const { data, error } = await state.client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, roll_number: rollNumber },
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });

      if (error) {
        cancelAuth();
        showAlert("error", friendlyError(error.message, "student"));
        return;
      }

      if (data && data.session) {
        return; // onAuthStateChange routes into the app
      }

      cancelAuth();
      el.studentSignupPassword.value = "";
      setAuthMode("login");
      el.studentLoginRoll.value = rollNumber;
      showAlert(
        "info",
        "Account created, but email confirmation is ON. Student logins don’t use email — ask the class admin to confirm this account (or turn OFF “Confirm email” in Supabase), then log in with your roll number."
      );
    } catch (err) {
      cancelAuth();
      showAlert("error", friendlyError(err && err.message, "student"));
    } finally {
      setButtonBusy(el.studentSignupBtn, false);
    }
  }

  async function handleTeacherLogin(event) {
    event.preventDefault();
    hideAlerts();

    const email = el.teacherLoginEmail.value.trim();
    const password = el.teacherLoginPassword.value;

    if (!email || !password) {
      showAlert("error", "Enter your email and password.");
      return;
    }
    if (!validEmail(email)) {
      showAlert("error", "Enter a valid email address.");
      return;
    }

    beginAuth("teacher", "login");
    setButtonBusy(el.teacherLoginBtn, true, "Logging in…");
    try {
      const { error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) {
        cancelAuth();
        showAlert("error", friendlyError(error.message, "teacher"));
      }
    } catch (err) {
      cancelAuth();
      showAlert("error", friendlyError(err && err.message, "teacher"));
    } finally {
      setButtonBusy(el.teacherLoginBtn, false);
    }
  }

  async function handleTeacherSignup(event) {
    event.preventDefault();
    hideAlerts();

    const fullName = el.teacherSignupName.value.trim().replace(/\s+/g, " ");
    const email = el.teacherSignupEmail.value.trim();
    const password = el.teacherSignupPassword.value;

    if (fullName.length < 2) {
      showAlert("error", "Enter your full name.");
      return;
    }
    if (!validEmail(email)) {
      showAlert("error", "Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      showAlert("error", "Password must be at least 6 characters.");
      return;
    }

    beginAuth("teacher", "signup");
    setButtonBusy(el.teacherSignupBtn, true, "Sending request…");
    try {
      const { data, error } = await state.client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, requested_teacher: true },
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });

      if (error) {
        cancelAuth();
        showAlert("error", friendlyError(error.message, "teacher"));
        return;
      }

      if (data && data.session) {
        return; // enter() detects the unapproved teacher and signs out
      }

      cancelAuth();
      el.teacherSignupPassword.value = "";
      setAuthMode("login");
      el.teacherLoginEmail.value = email;
      showAlert(
        "info",
        "Request received. Confirm your email if asked, then wait for the class admin to activate teacher access."
      );
    } catch (err) {
      cancelAuth();
      showAlert("error", friendlyError(err && err.message, "teacher"));
    } finally {
      setButtonBusy(el.teacherSignupBtn, false);
    }
  }

  async function rejectEntry(message, role, type) {
    cancelAuth();
    try {
      await state.client.auth.signOut();
    } catch (err) {
      // Ignore: the account is not allowed in, regardless of sign-out errors.
    }
    setAuthRole(role || "student");
    setAuthMode("login");
    showAlert(type || "info", message);
  }

  async function enter(user) {
    if (!user || state.entering) return;
    if (state.user && state.profile && state.user.id === user.id) return;
    state.entering = true;
    finishBoot();

    try {
      const { data: profile, error } = await state.client
        .from("profiles")
        .select("id, full_name, roll_number, role, email")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        showFatal("Your account exists, but its profile is missing. Run supabase/schema.sql in Supabase, then reload.");
        return;
      }

      const intended = state.intendedRole;
      if (intended && profile.role !== intended) {
        const wasSignup = state.authAction === "signup";
        const message =
          intended === "teacher"
            ? profile.roll_number
              ? "This is a student account. Choose Student to log in with your roll number."
              : wasSignup
                ? "Request received. The class admin must activate teacher access before you can log in."
                : "Teacher access is not active for this account yet. Ask the class admin to approve it, then log in again."
            : "This is a teacher account. Choose Teacher to log in.";

        await rejectEntry(message, intended, wasSignup ? "info" : "error");
        return;
      }

      // Self-service teacher requests are stored as students with no roll number.
      if (profile.role !== "teacher" && !profile.roll_number) {
        await rejectEntry(
          "This account is waiting for admin activation. Ask the class admin to activate it, then log in again.",
          "teacher",
          "info"
        );
        return;
      }

      cancelAuth();
      state.user = user;
      state.profile = profile;
      renderHeader();

      if (profile.role === "teacher") {
        showTeacherPanel();
        setTopView(el.appView);
        await loadTeacher();
      } else {
        showStudentPanel();
        setTopView(el.appView);
        await loadMine();
      }
    } catch (err) {
      console.error("[assignment-hub] profile load failed:", err);
      cancelAuth();
      showFatal(friendlyError(err && err.message));
    } finally {
      state.entering = false;
    }
  }

  function renderHeader() {
    const p = state.profile;
    if (!p) return;
    el.userName.textContent = p.full_name || "User";
    el.userSub.textContent =
      p.role === "teacher" ? "Teacher" : p.roll_number ? `Roll no. ${p.roll_number}` : "Student";
    el.userAvatar.textContent = initials(p.full_name);
    el.userAvatar.setAttribute("style", avatarStyle(p.full_name));
    el.userAvatar.title = p.full_name || "";
  }

  function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || "there";
  }

  function showStudentPanel() {
    el.teacherView.hidden = true;
    el.studentView.hidden = false;
    el.studentFirst.textContent = firstName(state.profile.full_name);
    el.studentRollPill.textContent = state.profile.roll_number
      ? `Roll ${state.profile.roll_number}`
      : "Roll —";
    resetUploadForm();
  }

  function showTeacherPanel() {
    el.studentView.hidden = true;
    el.teacherView.hidden = false;
    el.teacherSearch.value = "";
    state.query = "";
  }

  async function logout() {
    try {
      await state.client.auth.signOut();
    } catch (err) {
      toast(friendlyError(err && err.message), "error");
    }
  }

  /* ---------- Student ---------- */

  function setFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast(`"${file.name}" is too large. Maximum size is 25 MB.`, "error");
      resetFile();
      return;
    }
    state.file = file;
    el.previewExt.textContent = extOf(file.name);
    el.previewExt.className = "file-badge " + extClass(file.name);
    el.previewName.textContent = file.name;
    el.previewSize.textContent = fmtBytes(file.size);
    el.filePreview.hidden = false;
    el.dropZone.hidden = true;
    hideNote();
  }

  function resetFile() {
    state.file = null;
    el.fileInput.value = "";
    el.filePreview.hidden = true;
    el.dropZone.hidden = false;
    el.previewExt.className = "file-badge";
  }

  function resetUploadForm() {
    el.assignmentTitle.value = "";
    resetFile();
    hideNote();
    el.uploadProgress.hidden = true;
  }

  function hideNote() {
    el.uploadNote.hidden = true;
    el.uploadNote.textContent = "";
    el.uploadNote.className = "form-note";
  }

  function setNote(message, type) {
    el.uploadNote.textContent = message;
    el.uploadNote.className = "form-note" + (type ? ` is-${type}` : "");
    el.uploadNote.hidden = false;
  }

  async function handleUpload(event) {
    event.preventDefault();

    const title = el.assignmentTitle.value.trim();
    const file = state.file;

    if (!title) {
      setNote("Add a title for this assignment.", "error");
      el.assignmentTitle.focus();
      return;
    }
    if (!file) {
      setNote("Choose a file to upload.", "error");
      el.dropZone.focus();
      return;
    }
    if (file.size > MAX_BYTES) {
      setNote("That file is too large. Maximum size is 25 MB.", "error");
      return;
    }

    const path = `${state.user.id}/${Date.now()}-${safeFileName(file.name)}`;

    setButtonBusy(el.uploadBtn, true, "Uploading…");
    el.uploadProgress.hidden = false;
    hideNote();

    try {
      const { error: uploadError } = await state.client.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await state.client.from("submissions").insert({
        student_id: state.user.id,
        assignment_title: title,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
      });

      if (insertError) {
        try {
          await state.client.storage.from(BUCKET).remove([path]);
        } catch (_) {
          /* best effort cleanup */
        }
        throw insertError;
      }

      resetUploadForm();
      setNote("Uploaded — your teacher can see it now.", "success");
      toast("Assignment submitted successfully.");
      await loadMine();
    } catch (err) {
      console.error("[assignment-hub] upload failed:", err);
      setNote(friendlyError(err && err.message), "error");
      toast("Upload failed. Please try again.", "error");
    } finally {
      setButtonBusy(el.uploadBtn, false);
      el.uploadProgress.hidden = true;
    }
  }

  function skeletonList(count) {
    return Array.from({ length: count }, () => '<div class="skeleton"></div>').join("");
  }

  function downloadButton(id) {
    return `<button class="btn-soft" type="button" data-download="${escapeHtml(id)}" aria-label="Download file">
      ${ICON_DOWNLOAD}<span>Download</span>
    </button>`;
  }

  function teacherActions(id) {
    return `<div class="row-actions">
      <button class="btn-soft" type="button" data-view="${escapeHtml(id)}" aria-label="View file">
        ${ICON_EYE}<span>View</span>
      </button>
      ${downloadButton(id)}
    </div>`;
  }

  function studentActions(id) {
    return `<div class="row-actions">
      <button class="btn-soft" type="button" data-view="${escapeHtml(id)}" aria-label="View file">
        ${ICON_EYE}<span>View</span>
      </button>
      <button class="btn-soft danger" type="button" data-delete="${escapeHtml(id)}" aria-label="Delete submission">
        ${ICON_TRASH}<span>Delete</span>
      </button>
    </div>`;
  }

  function studentRow(s) {
    return `<article class="sub-item">
      <span class="file-badge ${extClass(s.file_name)}" aria-hidden="true">${escapeHtml(extOf(s.file_name))}</span>
      <div class="sub-main">
        <h3 title="${escapeHtml(s.assignment_title)}">${escapeHtml(s.assignment_title)}</h3>
        <p class="sub-meta">
          <span class="file-name" title="${escapeHtml(s.file_name)}">${escapeHtml(s.file_name)}</span>
          <span class="dot">·</span><span>${fmtBytes(s.file_size)}</span>
          <span class="dot">·</span>
          <time datetime="${escapeHtml(s.created_at)}" title="${escapeHtml(fullDate(s.created_at))}">${escapeHtml(timeAgo(s.created_at))}</time>
        </p>
      </div>
      ${studentActions(s.id)}
    </article>`;
  }

  async function loadMine() {
    if (!state.user) return;
    el.myList.innerHTML = skeletonList(2);
    el.myList.hidden = false;
    el.myEmpty.hidden = true;

    try {
      const { data, error } = await state.client
        .from("submissions")
        .select("*")
        .eq("student_id", state.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      state.mine = data || [];
      renderMine();
    } catch (err) {
      console.error("[assignment-hub] load submissions failed:", err);
      el.myList.innerHTML = `<div class="alert alert-error">${escapeHtml(friendlyError(err && err.message))}</div>`;
      el.myCount.textContent = "0";
    }
  }

  function renderMine() {
    el.myCount.textContent = String(state.mine.length);
    el.myList.innerHTML = state.mine.map(studentRow).join("");
    el.myList.hidden = state.mine.length === 0;
    el.myEmpty.hidden = state.mine.length > 0;
  }

  /* ---------- Teacher ---------- */

  function teacherRow(row) {
    const student = row.student || {};
    const name = student.full_name || "Unknown student";
    const roll = student.roll_number || "—";
    return `<article class="sub-item">
      <span class="avatar sm" style="${avatarStyle(name)}" aria-hidden="true">${escapeHtml(initials(name))}</span>
      <div class="sub-main">
        <div class="student-line">
          <h3 title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
          <span class="roll-pill">Roll ${escapeHtml(roll)}</span>
        </div>
        <p class="sub-title" title="${escapeHtml(row.assignment_title)}">${escapeHtml(row.assignment_title)}</p>
        <p class="sub-meta">
          <span class="file-name" title="${escapeHtml(row.file_name)}">${escapeHtml(row.file_name)}</span>
          <span class="dot">·</span><span>${fmtBytes(row.file_size)}</span>
          <span class="dot">·</span>
          <time datetime="${escapeHtml(row.created_at)}" title="${escapeHtml(fullDate(row.created_at))}">${escapeHtml(timeAgo(row.created_at))}</time>
        </p>
      </div>
      ${teacherActions(row.id)}
    </article>`;
  }

  function rosterRow(student, stats) {
    const name = student.full_name || "Unknown student";
    const roll = student.roll_number || "—";
    const count = stats ? stats.count : 0;
    const meta = count
      ? `${count} submission${count === 1 ? "" : "s"} · Last ${timeAgo(stats.latest)}`
      : "No uploads yet";

    return `<article class="sub-item roster-item">
      <span class="avatar sm" style="${avatarStyle(name)}" aria-hidden="true">${escapeHtml(initials(name))}</span>
      <div class="sub-main">
        <div class="student-line">
          <h3 title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
          <span class="roll-pill">Roll ${escapeHtml(roll)}</span>
        </div>
        <p class="sub-meta">${escapeHtml(meta)}</p>
      </div>
      <div class="roster-actions">
        ${count ? `<button class="btn-soft" type="button" data-roster-filter="${escapeHtml(student.roll_number || name)}" aria-label="View ${escapeHtml(name)}'s work">${ICON_EYE}<span>View work</span></button>` : ""}
        <button class="icon-btn subtle danger" type="button" data-remove-student="${escapeHtml(student.id)}" aria-label="Remove ${escapeHtml(name)}" title="Remove this student account">
          ${ICON_TRASH}
        </button>
      </div>
    </article>`;
  }

  function renderRoster() {
    el.rosterCount.textContent = String(state.students.length);

    if (!state.students.length) {
      el.rosterList.innerHTML = "";
      el.rosterList.hidden = true;
      el.rosterEmpty.hidden = false;
      return;
    }

    const stats = new Map();
    for (const row of state.rows) {
      const current = stats.get(row.student_id) || { count: 0, latest: row.created_at };
      current.count += 1;
      if (new Date(row.created_at) > new Date(current.latest)) current.latest = row.created_at;
      stats.set(row.student_id, current);
    }

    el.rosterList.innerHTML = state.students.map((student) => rosterRow(student, stats.get(student.id))).join("");
    el.rosterList.hidden = false;
    el.rosterEmpty.hidden = true;
  }

  async function loadRoster() {
    try {
      const { data, error } = await state.client
        .from("profiles")
        .select("id, full_name, roll_number, created_at")
        .eq("role", "student")
        .not("roll_number", "is", null)
        .order("full_name", { ascending: true });

      if (error) throw error;
      state.students = (data || []).filter((student) => student.roll_number);
    } catch (err) {
      console.error("[assignment-hub] roster load failed:", err);
      state.students = [];
      el.rosterCount.textContent = "0";
      el.rosterList.innerHTML = `<div class="alert alert-error">${escapeHtml(friendlyError(err && err.message))}</div>`;
      el.rosterList.hidden = false;
      el.rosterEmpty.hidden = true;
      return;
    }

    renderRoster();
  }

  async function removeStudent(id, btn) {
    const student = state.students.find((item) => item.id === id);
    if (!student) {
      toast("That student could not be found.", "error");
      return;
    }

    const name = student.full_name || "this student";
    const roll = student.roll_number ? ` (Roll ${student.roll_number})` : "";
    const confirmed = window.confirm(
      `Remove "${name}"${roll} permanently?\n\nThis deletes the student's account, all their submissions, and every uploaded file. This cannot be undone.`
    );
    if (!confirmed) return;

    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    try {
      // Remove storage first, while the teacher still has access to the folder.
      const folder = student.id;
      const { data: files, error: listError } = await state.client
        .storage
        .from(BUCKET)
        .list(folder, { limit: 1000 });
      if (listError) throw listError;

      const paths = (files || [])
        .filter((file) => file && file.name)
        .map((file) => `${folder}/${file.name}`);

      if (paths.length) {
        const { error: removeError } = await state.client.storage.from(BUCKET).remove(paths);
        if (removeError) throw removeError;
      }

      // The database function verifies the caller is a teacher, then deletes
      // the auth user. Profiles, submissions and sessions cascade automatically.
      const { error } = await state.client.rpc("delete_student_account", { target_id: folder });
      if (error) throw error;

      state.students = state.students.filter((item) => item.id !== id);
      state.rows = state.rows.filter((row) => row.student_id !== id);

      const query = state.query.trim().toLowerCase();
      if (query && (query === String(student.roll_number || "").toLowerCase() || query === name.toLowerCase())) {
        state.query = "";
        el.teacherSearch.value = "";
      }

      updateStats();
      renderRoster();
      renderTeacher();
      toast("Student account removed.");
    } catch (err) {
      console.error("[assignment-hub] remove student failed:", err);
      toast(friendlyError(err && err.message), "error");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }
  }

  async function loadTeacher() {
    el.teacherList.innerHTML = skeletonList(3);
    el.teacherList.hidden = false;
    el.teacherEmpty.hidden = true;
    el.rosterList.innerHTML = skeletonList(2);
    el.rosterList.hidden = false;
    el.rosterEmpty.hidden = true;

    const withJoin =
      "id, student_id, assignment_title, file_path, file_name, file_size, created_at, student:profiles!submissions_student_id_fkey(full_name, roll_number)";

    try {
      let { data, error } = await state.client
        .from("submissions")
        .select(withJoin)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback for projects where the FK relationship name differs.
        const fallback = await state.client
          .from("submissions")
          .select("*")
          .order("created_at", { ascending: false });

        if (fallback.error) throw fallback.error;

        const rows = fallback.data || [];
        const ids = [...new Set(rows.map((r) => r.student_id))];
        let profiles = [];

        if (ids.length) {
          const profileRes = await state.client
            .from("profiles")
            .select("id, full_name, roll_number")
            .in("id", ids);
          if (profileRes.error) throw profileRes.error;
          profiles = profileRes.data || [];
        }

        const byId = new Map(profiles.map((p) => [p.id, p]));
        data = rows.map((r) => ({ ...r, student: byId.get(r.student_id) || null }));
      }

      state.rows = data || [];
      await loadRoster();
      updateStats();
      renderTeacher();
    } catch (err) {
      console.error("[assignment-hub] teacher load failed:", err);
      state.rows = [];
      el.teacherList.innerHTML = `<div class="alert alert-error">${escapeHtml(friendlyError(err && err.message))}</div>`;
      await loadRoster();
      updateStats();
    }
  }

  function updateStats() {
    const uploadedStudents = new Set(state.rows.map((r) => r.student_id)).size;
    el.statTotal.textContent = String(state.rows.length);
    el.statStudents.textContent = String(state.students.length || uploadedStudents);

    if (state.rows.length) {
      el.statLatest.textContent = timeAgo(state.rows[0].created_at);
      el.statLatest.title = fullDate(state.rows[0].created_at);
    } else {
      el.statLatest.textContent = "—";
      el.statLatest.removeAttribute("title");
    }
  }

  function renderTeacher() {
    const q = state.query.trim().toLowerCase();

    const rows = q
      ? state.rows.filter((r) => {
          const student = r.student || {};
          return [student.full_name, student.roll_number, r.assignment_title, r.file_name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);
        })
      : state.rows;

    el.teacherList.innerHTML = rows.map(teacherRow).join("");
    el.teacherList.hidden = rows.length === 0;
    el.teacherEmpty.hidden = rows.length > 0;

    if (rows.length === 0) {
      if (state.rows.length === 0) {
        el.teacherEmptyTitle.textContent = "No submissions yet";
        el.teacherEmptyText.textContent = "As soon as a student uploads, it will show up here.";
      } else {
        el.teacherEmptyTitle.textContent = "No matches";
        el.teacherEmptyText.textContent = `Nothing found for “${state.query.trim()}”.`;
      }
    }
  }

  /* ---------- Downloads ---------- */

  async function viewSubmission(id, btn) {
    const submission = state.mine.find((s) => s.id === id) || state.rows.find((s) => s.id === id);
    if (!submission) {
      toast("That file could not be found.", "error");
      return;
    }

    // Open the tab immediately so mobile browsers do not block it.
    const preview = window.open("", "_blank");

    if (btn) btn.classList.add("is-loading");
    try {
      const { data, error } = await state.client.storage
        .from(BUCKET)
        .createSignedUrl(submission.file_path, 300);

      if (error) throw error;

      if (preview) {
        preview.location.href = data.signedUrl;
      } else {
        window.location.href = data.signedUrl;
      }
    } catch (err) {
      if (preview) preview.close();
      console.error("[assignment-hub] view failed:", err);
      toast(friendlyError(err && err.message), "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  }

  async function deleteSubmission(id, btn) {
    const submission = state.mine.find((s) => s.id === id);
    if (!submission) {
      toast("That submission could not be found.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${submission.assignment_title}"?\n\nThe uploaded file will be permanently removed.`
    );
    if (!confirmed) return;

    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    try {
      const { error } = await state.client
        .from("submissions")
        .delete()
        .eq("id", id)
        .eq("student_id", state.user.id);

      if (error) throw error;

      try {
        const { error: storageError } = await state.client.storage
          .from(BUCKET)
          .remove([submission.file_path]);
        if (storageError) throw storageError;
      } catch (storageErr) {
        // The database row is already gone; log orphan cleanup for the admin.
        console.warn("[assignment-hub] could not remove stored file:", storageErr);
      }

      state.mine = state.mine.filter((s) => s.id !== id);
      renderMine();
      toast("Submission deleted.");
    } catch (err) {
      console.error("[assignment-hub] delete failed:", err);
      toast(friendlyError(err && err.message), "error");
      if (btn) btn.disabled = false;
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  }

  async function downloadSubmission(id, btn) {
    const submission =
      state.mine.find((s) => s.id === id) || state.rows.find((s) => s.id === id);

    if (!submission) {
      toast("That file could not be found.", "error");
      return;
    }

    if (btn) btn.classList.add("is-loading");

    try {
      const { data, error } = await state.client.storage
        .from(BUCKET)
        .createSignedUrl(submission.file_path, 120, { download: submission.file_name || true });

      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("[assignment-hub] download failed:", err);
      toast(friendlyError(err && err.message), "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  }

  /* ---------- Events ---------- */

  function wireEvents() {
    el.roleTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".role-tab");
      if (!tab) return;
      setAuthRole(tab.dataset.role === "teacher" ? "teacher" : "student");
    });

    el.authTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".auth-tab");
      if (!tab) return;
      setAuthMode(tab.dataset.mode === "signup" ? "signup" : "login");
    });

    el.studentLoginForm.addEventListener("submit", handleStudentLogin);
    el.studentSignupForm.addEventListener("submit", handleStudentSignup);
    el.teacherLoginForm.addEventListener("submit", handleTeacherLogin);
    el.teacherSignupForm.addEventListener("submit", handleTeacherSignup);
    el.logoutBtn.addEventListener("click", logout);
    el.uploadForm.addEventListener("submit", handleUpload);

    el.dropZone.addEventListener("click", () => el.fileInput.click());

    el.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.fileInput.click();
      }
    });

    el.fileInput.addEventListener("change", () => {
      const file = el.fileInput.files && el.fileInput.files[0];
      if (file) setFile(file);
    });

    ["dragenter", "dragover"].forEach((type) => {
      el.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        el.dropZone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      el.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        el.dropZone.classList.remove("is-dragover");
      });
    });

    el.dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) setFile(file);
    });

    // Stop the browser from opening files dropped outside the zone.
    window.addEventListener("dragover", (event) => event.preventDefault());
    window.addEventListener("drop", (event) => event.preventDefault());

    el.clearFile.addEventListener("click", resetFile);

    el.assignmentTitle.addEventListener("input", hideNote);

    el.refreshMine.addEventListener("click", async () => {
      el.refreshMine.classList.add("is-spinning");
      await loadMine();
      window.setTimeout(() => el.refreshMine.classList.remove("is-spinning"), 300);
    });

    el.refreshAll.addEventListener("click", async () => {
      el.refreshAll.classList.add("is-spinning");
      await loadTeacher();
      window.setTimeout(() => el.refreshAll.classList.remove("is-spinning"), 300);
    });

    el.teacherSearch.addEventListener("input", () => {
      state.query = el.teacherSearch.value;
      renderTeacher();
    });

    el.rosterList.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-remove-student]");
      if (removeBtn) {
        removeStudent(removeBtn.dataset.removeStudent, removeBtn);
        return;
      }

      const btn = event.target.closest("[data-roster-filter]");
      if (!btn) return;
      const query = btn.dataset.rosterFilter || "";
      el.teacherSearch.value = query;
      state.query = query;
      renderTeacher();
      el.submissionsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    [el.myList, el.teacherList].forEach((list) => {
      list.addEventListener("click", (event) => {
        const viewBtn = event.target.closest("[data-view]");
        if (viewBtn) {
          viewSubmission(viewBtn.dataset.view, viewBtn);
          return;
        }

        const deleteBtn = event.target.closest("[data-delete]");
        if (deleteBtn) {
          deleteSubmission(deleteBtn.dataset.delete, deleteBtn);
          return;
        }

        const downloadBtn = event.target.closest("[data-download]");
        if (downloadBtn) downloadSubmission(downloadBtn.dataset.download, downloadBtn);
      });
    });

    el.fatalRetry.addEventListener("click", () => window.location.reload());
  }

  /* ---------- Go ---------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

})();
