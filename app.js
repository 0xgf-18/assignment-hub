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
  const MATERIALS_BUCKET = "materials";
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
    messages: [],
    materials: [],
    lastUnreadCount: 0,
    messagePoll: null,
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

    studentMsgCount: $("studentMsgCount"),
    studentUnreadPill: $("studentUnreadPill"),
    refreshStudentMessages: $("refreshStudentMessages"),
    studentMessageList: $("studentMessageList"),
    studentMessageEmpty: $("studentMessageEmpty"),
    studentMaterialCount: $("studentMaterialCount"),
    refreshStudentMaterials: $("refreshStudentMaterials"),
    studentMaterialList: $("studentMaterialList"),
    studentMaterialEmpty: $("studentMaterialEmpty"),

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

    messageForm: $("messageForm"),
    messageRecipient: $("messageRecipient"),
    messageBody: $("messageBody"),
    sendMessageBtn: $("sendMessageBtn"),
    messageNote: $("messageNote"),
    refreshSentMessages: $("refreshSentMessages"),
    sentMsgCount: $("sentMsgCount"),
    teacherMessageList: $("teacherMessageList"),
    teacherMessageEmpty: $("teacherMessageEmpty"),
    materialForm: $("materialForm"),
    materialTitle: $("materialTitle"),
    materialFile: $("materialFile"),
    materialFileHint: $("materialFileHint"),
    materialUploadBtn: $("materialUploadBtn"),
    materialProgress: $("materialProgress"),
    materialNote: $("materialNote"),
    refreshTeacherMaterials: $("refreshTeacherMaterials"),
    teacherMaterialCount: $("teacherMaterialCount"),
    teacherMaterialList: $("teacherMaterialList"),
    teacherMaterialEmpty: $("teacherMaterialEmpty"),

    toasts: $("toasts"),
  };

  /* ---------- Icons / formatting helpers ---------- */

  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12M10 11v5.5M14 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5m0 3h.01M10.3 3.9 2.4 17.4A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

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
    resetPasswordVisibility(el.authView);
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
    resetPasswordVisibility(el.authView);
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

  function setPasswordVisibility(button, input, visible) {
    if (!button || !input) return;
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    button.title = visible ? "Hide password" : "Show password";
    const label = button.querySelector(".password-toggle-text");
    if (label) label.textContent = visible ? "Hide" : "Show";
  }

  function resetPasswordVisibility(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const input = document.getElementById(button.dataset.passwordToggle);
      setPasswordVisibility(button, input, false);
    });
  }

  function handlePasswordToggle(event) {
    const button = event.target.closest("[data-password-toggle]");
    if (!button) return;
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input || input.disabled) return;

    const show = input.type === "password";
    setPasswordVisibility(button, input, show);
    input.focus({ preventScroll: true });
    try {
      input.setSelectionRange(input.value.length, input.value.length);
    } catch (err) {
      // Some mobile browsers do not expose selection methods on password inputs.
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
          state.students = [];
          state.messages = [];
          state.materials = [];
          state.lastUnreadCount = 0;
          stopMessagePolling();
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
      state.lastUnreadCount = 0;
      stopMessagePolling();
      renderHeader();

      if (profile.role === "teacher") {
        showTeacherPanel();
        setTopView(el.appView);
        await Promise.all([loadTeacher(), loadMessages(), loadMaterials()]);
      } else {
        showStudentPanel();
        setTopView(el.appView);
        await Promise.all([loadMine(), loadMessages(), loadMaterials()]);
        startMessagePolling();
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

  function setFormNote(node, message, type) {
    if (!node) return;
    node.textContent = message;
    node.className = "form-note" + (type ? ` is-${type}` : "");
    node.hidden = false;
  }

  function clearFormNote(node) {
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
    node.className = "form-note";
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
    renderMessageRecipients();
    renderMessages();
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
      state.messages = state.messages.filter((message) => message.recipient_id !== id);

      const query = state.query.trim().toLowerCase();
      if (query && (query === String(student.roll_number || "").toLowerCase() || query === name.toLowerCase())) {
        state.query = "";
        el.teacherSearch.value = "";
      }

      updateStats();
      renderRoster();
      renderMessageRecipients();
      renderMessages();
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

  /* ---------- Messages ---------- */

  function stopMessagePolling() {
    if (state.messagePoll) {
      window.clearInterval(state.messagePoll);
      state.messagePoll = null;
    }
  }

  function startMessagePolling() {
    stopMessagePolling();
    if (!state.profile || state.profile.role !== "student") return;

    state.messagePoll = window.setInterval(() => {
      if (document.visibilityState === "visible") loadMessages({ silent: true });
    }, 45000);
  }

  function renderMessageRecipients() {
    if (!el.messageRecipient || !state.profile || state.profile.role !== "teacher") return;

    const selected = el.messageRecipient.value || "all";
    const options = [`<option value="all">All students (${state.students.length})</option>`];

    for (const student of state.students) {
      const name = student.full_name || "Student";
      const roll = student.roll_number ? ` — Roll ${student.roll_number}` : "";
      options.push(`<option value="${escapeHtml(student.id)}">${escapeHtml(name + roll)}</option>`);
    }

    el.messageRecipient.innerHTML = options.join("");
    const exists = Array.from(el.messageRecipient.options).some((option) => option.value === selected);
    el.messageRecipient.value = exists ? selected : "all";
    if (el.sendMessageBtn) el.sendMessageBtn.disabled = state.students.length === 0;
  }

  function studentMessageRow(message) {
    const unread = !message.read_at;
    const label = message.audience === "all" ? "Class announcement" : "Personal message";

    return `<article class="sub-item message-item${unread ? " is-unread" : ""}">
      <span class="message-badge" aria-hidden="true">${ICON_CHAT}</span>
      <div class="sub-main">
        <div class="student-line">
          <h3>${escapeHtml(label)}</h3>
          ${unread ? `<span class="pill pill-new">New</span>` : ""}
        </div>
        <p class="message-body">${escapeHtml(message.body)}</p>
        <p class="sub-meta">
          <time datetime="${escapeHtml(message.created_at)}" title="${escapeHtml(fullDate(message.created_at))}">${escapeHtml(timeAgo(message.created_at))}</time>
        </p>
      </div>
      ${unread
        ? `<button class="btn-soft" type="button" data-mark-message="${escapeHtml(message.id)}" aria-label="Mark message as read">${ICON_CHECK}<span>Mark read</span></button>`
        : `<span class="read-pill">Read</span>`}
    </article>`;
  }

  function sentMessageRow(group) {
    const total = group.recipients.length;
    const read = group.recipients.filter((message) => message.read_at).length;
    let label;
    let directRoll = "";

    if (group.audience === "all") {
      label = `All students (${total})`;
    } else {
      const student = state.students.find((item) => item.id === group.recipients[0].recipient_id);
      label = student ? `To ${student.full_name}` : "To 1 student";
      directRoll = student && student.roll_number ? student.roll_number : "";
    }

    return `<article class="sub-item message-sent-item">
      <span class="message-badge" aria-hidden="true">${ICON_CHAT}</span>
      <div class="sub-main">
        <div class="student-line">
          <h3>${escapeHtml(label)}</h3>
          <span class="read-pill">${read}/${total} read</span>
        </div>
        <p class="message-preview">${escapeHtml(group.body)}</p>
        <p class="sub-meta">
          <time datetime="${escapeHtml(group.created_at)}" title="${escapeHtml(fullDate(group.created_at))}">${escapeHtml(timeAgo(group.created_at))}</time>
          <span class="dot">·</span>
          <span>${group.audience === "all" ? "Announcement" : `Direct message${directRoll ? ` · Roll ${escapeHtml(directRoll)}` : ""}`}</span>
        </p>
      </div>
      <button class="icon-btn subtle danger" type="button" data-delete-message-batch="${escapeHtml(group.batch_id)}" aria-label="Delete this message" title="Delete this message for all recipients">
        ${ICON_TRASH}
      </button>
    </article>`;
  }

  function renderStudentMessages() {
    const total = state.messages.length;
    const unread = state.messages.filter((message) => !message.read_at).length;

    el.studentMsgCount.textContent = String(total);
    el.studentUnreadPill.hidden = unread === 0;
    el.studentUnreadPill.textContent = `${unread} new`;
    el.studentMessageList.innerHTML = state.messages.map(studentMessageRow).join("");
    el.studentMessageList.hidden = total === 0;
    el.studentMessageEmpty.hidden = total > 0;
  }

  function renderTeacherMessages() {
    const groups = new Map();

    for (const message of state.messages) {
      const key = message.batch_id || message.id;
      let group = groups.get(key);
      if (!group) {
        group = {
          batch_id: key,
          body: message.body,
          audience: message.audience,
          created_at: message.created_at,
          recipients: [],
        };
        groups.set(key, group);
      }
      group.recipients.push(message);
    }

    const list = Array.from(groups.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    el.sentMsgCount.textContent = String(list.length);
    el.teacherMessageList.innerHTML = list.map(sentMessageRow).join("");
    el.teacherMessageList.hidden = list.length === 0;
    el.teacherMessageEmpty.hidden = list.length > 0;
  }

  function renderMessages() {
    if (!state.profile) return;
    if (state.profile.role === "teacher") {
      renderTeacherMessages();
    } else {
      renderStudentMessages();
    }
  }

  async function loadMessages(options = {}) {
    if (!state.user || !state.profile) return;
    const silent = Boolean(options.silent);
    const isTeacher = state.profile.role === "teacher";
    const list = isTeacher ? el.teacherMessageList : el.studentMessageList;
    const empty = isTeacher ? el.teacherMessageEmpty : el.studentMessageEmpty;

    if (!silent) {
      list.innerHTML = skeletonList(2);
      empty.hidden = true;
    }

    try {
      let query = state.client.from("messages").select("*").order("created_at", { ascending: false });
      query = isTeacher
        ? query.eq("teacher_id", state.user.id)
        : query.eq("recipient_id", state.user.id);

      const { data, error } = await query;
      if (error) throw error;

      const next = data || [];
      if (silent && JSON.stringify(next) === JSON.stringify(state.messages)) return;

      state.messages = next;
      renderMessages();

      if (!isTeacher) {
        const unread = state.messages.filter((message) => !message.read_at).length;
        if (unread > state.lastUnreadCount) {
          toast(`${unread} new message${unread === 1 ? "" : "s"} from your teacher.`);
        }
        state.lastUnreadCount = unread;
      }
    } catch (err) {
      if (silent) return;
      console.error("[assignment-hub] messages load failed:", err);
      state.messages = [];
      list.innerHTML = `<div class="alert alert-error">${escapeHtml(friendlyError(err && err.message))}</div>`;
      empty.hidden = true;
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    clearFormNote(el.messageNote);

    const body = el.messageBody.value.trim();
    const target = el.messageRecipient.value || "all";
    const selected = target === "all" ? null : state.students.find((student) => student.id === target);

    if (!body) {
      setFormNote(el.messageNote, "Write a message first.", "error");
      el.messageBody.focus();
      return;
    }

    if (target !== "all" && !selected) {
      setFormNote(el.messageNote, "That student is no longer in the roster. Choose another recipient.", "error");
      renderMessageRecipients();
      return;
    }

    const recipients = target === "all" ? state.students.map((student) => student.id) : [selected.id];
    if (!recipients.length) {
      setFormNote(el.messageNote, "There are no students to message yet.", "error");
      return;
    }

    const batchId = uuid();
    const audience = target === "all" ? "all" : "student";
    const rows = recipients.map((recipientId) => ({
      teacher_id: state.user.id,
      recipient_id: recipientId,
      batch_id: batchId,
      audience,
      body,
    }));

    setButtonBusy(el.sendMessageBtn, true, "Sending…");

    try {
      const { error } = await state.client.from("messages").insert(rows);
      if (error) throw error;

      el.messageBody.value = "";
      setFormNote(
        el.messageNote,
        target === "all"
          ? `Message sent to all ${recipients.length} student${recipients.length === 1 ? "" : "s"}.`
          : "Message sent to the student.",
        "success"
      );
      toast(target === "all" ? "Announcement sent to every student." : "Message sent.");
      await loadMessages();
    } catch (err) {
      console.error("[assignment-hub] send message failed:", err);
      setFormNote(el.messageNote, friendlyError(err && err.message), "error");
      toast("Could not send the message.", "error");
    } finally {
      setButtonBusy(el.sendMessageBtn, false);
    }
  }

  async function markMessageRead(id, btn) {
    const message = state.messages.find((item) => item.id === id);
    if (!message || message.read_at) return;

    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    try {
      const readAt = new Date().toISOString();
      const { error } = await state.client
        .from("messages")
        .update({ read_at: readAt })
        .eq("id", id)
        .eq("recipient_id", state.user.id);

      if (error) throw error;

      state.messages = state.messages.map((item) =>
        item.id === id ? { ...item, read_at: readAt } : item
      );
      state.lastUnreadCount = state.messages.filter((item) => !item.read_at).length;
      renderMessages();
      toast("Message marked as read.");
    } catch (err) {
      console.error("[assignment-hub] mark message failed:", err);
      toast(friendlyError(err && err.message), "error");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }
  }

  async function deleteMessageBatch(batchId, btn) {
    const messages = state.messages.filter((message) => message.batch_id === batchId);
    if (!messages.length) return;

    const confirmed = window.confirm(
      "Delete this message for every recipient?\n\nStudents will no longer see it."
    );
    if (!confirmed) return;

    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    try {
      const { error } = await state.client
        .from("messages")
        .delete()
        .eq("batch_id", batchId)
        .eq("teacher_id", state.user.id);

      if (error) throw error;

      state.messages = state.messages.filter((message) => message.batch_id !== batchId);
      renderMessages();
      toast("Message deleted.");
    } catch (err) {
      console.error("[assignment-hub] delete message failed:", err);
      toast(friendlyError(err && err.message), "error");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }
  }

  /* ---------- Class materials ---------- */

  function materialRow(material, canDelete) {
    const title = material.title || "Class material";

    return `<article class="sub-item material-item">
      <span class="file-badge ${extClass(material.file_name)}" aria-hidden="true">${escapeHtml(extOf(material.file_name))}</span>
      <div class="sub-main">
        <h3 title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
        <p class="sub-meta">
          <span class="file-name" title="${escapeHtml(material.file_name)}">${escapeHtml(material.file_name)}</span>
          <span class="dot">·</span><span>${fmtBytes(material.file_size)}</span>
          <span class="dot">·</span>
          <time datetime="${escapeHtml(material.created_at)}" title="${escapeHtml(fullDate(material.created_at))}">${escapeHtml(timeAgo(material.created_at))}</time>
        </p>
      </div>
      <div class="row-actions">
        <button class="btn-soft" type="button" data-material-view="${escapeHtml(material.id)}" aria-label="View ${escapeHtml(title)}">
          ${ICON_EYE}<span>View</span>
        </button>
        <button class="btn-soft" type="button" data-material-download="${escapeHtml(material.id)}" aria-label="Download ${escapeHtml(title)}">
          ${ICON_DOWNLOAD}<span>Download</span>
        </button>
        ${canDelete ? `<button class="btn-soft danger" type="button" data-material-delete="${escapeHtml(material.id)}" aria-label="Delete ${escapeHtml(title)}">
          ${ICON_TRASH}<span>Delete</span>
        </button>` : ""}
      </div>
    </article>`;
  }

  function renderMaterials() {
    const total = state.materials.length;

    el.studentMaterialCount.textContent = String(total);
    el.teacherMaterialCount.textContent = String(total);
    el.studentMaterialList.innerHTML = state.materials.map((material) => materialRow(material, false)).join("");
    el.teacherMaterialList.innerHTML = state.materials.map((material) => materialRow(material, true)).join("");
    el.studentMaterialList.hidden = total === 0;
    el.teacherMaterialList.hidden = total === 0;
    el.studentMaterialEmpty.hidden = total > 0;
    el.teacherMaterialEmpty.hidden = total > 0;
  }

  async function loadMaterials() {
    if (!state.user || !state.profile) return;
    const isTeacher = state.profile.role === "teacher";
    const list = isTeacher ? el.teacherMaterialList : el.studentMaterialList;
    const empty = isTeacher ? el.teacherMaterialEmpty : el.studentMaterialEmpty;

    list.innerHTML = skeletonList(2);
    empty.hidden = true;

    try {
      const { data, error } = await state.client
        .from("materials")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      state.materials = data || [];
      renderMaterials();
    } catch (err) {
      console.error("[assignment-hub] materials load failed:", err);
      state.materials = [];
      list.innerHTML = `<div class="alert alert-error">${escapeHtml(friendlyError(err && err.message))}</div>`;
      empty.hidden = true;
    }
  }

  function resetMaterialForm() {
    el.materialTitle.value = "";
    el.materialFile.value = "";
    el.materialFileHint.textContent = "PDF, Word, slides, images — up to 25 MB.";
    el.materialProgress.hidden = true;
  }

  function handleMaterialFileChange() {
    clearFormNote(el.materialNote);
    const file = el.materialFile.files && el.materialFile.files[0];
    el.materialFileHint.textContent = file
      ? `${file.name} · ${fmtBytes(file.size)}`
      : "PDF, Word, slides, images — up to 25 MB.";
  }

  async function handleMaterialUpload(event) {
    event.preventDefault();
    clearFormNote(el.materialNote);

    if (!state.profile || state.profile.role !== "teacher") return;

    const title = el.materialTitle.value.trim();
    const file = el.materialFile.files && el.materialFile.files[0];

    if (!title) {
      setFormNote(el.materialNote, "Add a title for this material.", "error");
      el.materialTitle.focus();
      return;
    }

    if (!file) {
      setFormNote(el.materialNote, "Choose a file to upload.", "error");
      el.materialFile.focus();
      return;
    }

    if (file.size > MAX_BYTES) {
      setFormNote(el.materialNote, "That file is too large. Maximum size is 25 MB.", "error");
      return;
    }

    const path = `${state.user.id}/${Date.now()}-${safeFileName(file.name)}`;

    setButtonBusy(el.materialUploadBtn, true, "Uploading…");
    el.materialProgress.hidden = false;

    try {
      const { error: uploadError } = await state.client.storage
        .from(MATERIALS_BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await state.client.from("materials").insert({
        teacher_id: state.user.id,
        title,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
      });

      if (insertError) {
        try {
          await state.client.storage.from(MATERIALS_BUCKET).remove([path]);
        } catch (_) {
          /* best effort cleanup */
        }
        throw insertError;
      }

      resetMaterialForm();
      setFormNote(el.materialNote, "Material uploaded — every student can now view it.", "success");
      toast("Class material uploaded.");
      await loadMaterials();
    } catch (err) {
      console.error("[assignment-hub] material upload failed:", err);
      setFormNote(el.materialNote, friendlyError(err && err.message), "error");
      toast("Upload failed. Please try again.", "error");
    } finally {
      setButtonBusy(el.materialUploadBtn, false);
      el.materialProgress.hidden = true;
    }
  }

  async function viewMaterial(id, btn) {
    const material = state.materials.find((item) => item.id === id);
    if (!material) {
      toast("That material could not be found.", "error");
      return;
    }

    const preview = window.open("", "_blank");
    if (btn) btn.classList.add("is-loading");

    try {
      const { data, error } = await state.client.storage
        .from(MATERIALS_BUCKET)
        .createSignedUrl(material.file_path, 300);

      if (error) throw error;

      if (preview) {
        preview.location.href = data.signedUrl;
      } else {
        window.location.href = data.signedUrl;
      }
    } catch (err) {
      if (preview) preview.close();
      console.error("[assignment-hub] view material failed:", err);
      toast(friendlyError(err && err.message), "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  }

  async function downloadMaterial(id, btn) {
    const material = state.materials.find((item) => item.id === id);
    if (!material) {
      toast("That material could not be found.", "error");
      return;
    }

    if (btn) btn.classList.add("is-loading");

    try {
      const { data, error } = await state.client.storage
        .from(MATERIALS_BUCKET)
        .createSignedUrl(material.file_path, 120, { download: material.file_name || true });

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
      console.error("[assignment-hub] download material failed:", err);
      toast(friendlyError(err && err.message), "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  }

  async function deleteMaterial(id, btn) {
    const material = state.materials.find((item) => item.id === id);
    if (!material) {
      toast("That material could not be found.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${material.title}"?\n\nStudents will no longer be able to view or download it.`
    );
    if (!confirmed) return;

    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    try {
      const { error } = await state.client
        .from("materials")
        .delete()
        .eq("id", id)
        .eq("teacher_id", state.user.id);

      if (error) throw error;

      try {
        const { error: storageError } = await state.client.storage
          .from(MATERIALS_BUCKET)
          .remove([material.file_path]);
        if (storageError) throw storageError;
      } catch (storageErr) {
        console.warn("[assignment-hub] could not remove material file:", storageErr);
      }

      state.materials = state.materials.filter((item) => item.id !== id);
      renderMaterials();
      toast("Class material deleted.");
    } catch (err) {
      console.error("[assignment-hub] delete material failed:", err);
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
    document.addEventListener("click", handlePasswordToggle);
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
      await Promise.all([loadTeacher(), loadMessages(), loadMaterials()]);
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

    /* Messages */
    el.messageForm.addEventListener("submit", handleSendMessage);
    el.messageBody.addEventListener("input", () => clearFormNote(el.messageNote));

    el.refreshSentMessages.addEventListener("click", async () => {
      el.refreshSentMessages.classList.add("is-spinning");
      await loadMessages();
      window.setTimeout(() => el.refreshSentMessages.classList.remove("is-spinning"), 300);
    });

    el.refreshStudentMessages.addEventListener("click", async () => {
      el.refreshStudentMessages.classList.add("is-spinning");
      await loadMessages();
      window.setTimeout(() => el.refreshStudentMessages.classList.remove("is-spinning"), 300);
    });

    el.studentMessageList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-mark-message]");
      if (btn) markMessageRead(btn.dataset.markMessage, btn);
    });

    el.teacherMessageList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-delete-message-batch]");
      if (btn) deleteMessageBatch(btn.dataset.deleteMessageBatch, btn);
    });

    /* Class materials */
    el.materialForm.addEventListener("submit", handleMaterialUpload);
    el.materialFile.addEventListener("change", handleMaterialFileChange);
    el.materialTitle.addEventListener("input", () => clearFormNote(el.materialNote));

    el.refreshStudentMaterials.addEventListener("click", async () => {
      el.refreshStudentMaterials.classList.add("is-spinning");
      await loadMaterials();
      window.setTimeout(() => el.refreshStudentMaterials.classList.remove("is-spinning"), 300);
    });

    el.refreshTeacherMaterials.addEventListener("click", async () => {
      el.refreshTeacherMaterials.classList.add("is-spinning");
      await loadMaterials();
      window.setTimeout(() => el.refreshTeacherMaterials.classList.remove("is-spinning"), 300);
    });

    [el.studentMaterialList, el.teacherMaterialList].forEach((list) => {
      list.addEventListener("click", (event) => {
        const viewBtn = event.target.closest("[data-material-view]");
        if (viewBtn) {
          viewMaterial(viewBtn.dataset.materialView, viewBtn);
          return;
        }

        const downloadBtn = event.target.closest("[data-material-download]");
        if (downloadBtn) {
          downloadMaterial(downloadBtn.dataset.materialDownload, downloadBtn);
          return;
        }

        const deleteBtn = event.target.closest("[data-material-delete]");
        if (deleteBtn) deleteMaterial(deleteBtn.dataset.materialDelete, deleteBtn);
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !state.user || !state.profile) return;
      if (state.profile.role === "student") loadMessages();
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
