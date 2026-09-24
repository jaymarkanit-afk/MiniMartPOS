const authForm = document.getElementById("authForm");
const signInTab = document.getElementById("signInTab");
const signUpTab = document.getElementById("signUpTab");
const footerToggle = document.getElementById("footerToggle");
const formTitle = document.getElementById("formTitle");
const formIntro = document.getElementById("formIntro");
const footerPrompt = document.getElementById("footerPrompt");
const submitButton = document.getElementById("submitButton");
const forgotPassword = document.getElementById("forgotPassword");
const rememberField = document.getElementById("rememberField");
const message = document.getElementById("message");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const role = document.getElementById("role");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const passwordStrength = document.getElementById("passwordStrength");
const fields = document.querySelectorAll(".signup-only");

let mode = "signIn";
let isSubmitting = false;
let failedAttempts = 0;
let lockoutTimer = null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const namePattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const passwordRules = [
  [/^.{10,}$/, "at least 10 characters"],
  [/[A-Z]/, "one uppercase letter"],
  [/[a-z]/, "one lowercase letter"],
  [/\d/, "one number"],
  [/[!@#$%^&*(),.?":{}|<>[\]\\/~`_+=;'-]/, "one special character"],
];

function setMessage(element, text, valid = false) {
  element.textContent = text ? `${valid ? "✓ " : ""}${text}` : "";
  element.classList.toggle("is-valid", valid);
}

function validateEmail() {
  const value = email.value.trim();
  if (!value)
    return (
      setMessage(document.getElementById("emailMessage"), "Email is required"),
      false
    );
  if (!emailPattern.test(value))
    return (
      setMessage(
        document.getElementById("emailMessage"),
        "Enter a valid email address",
      ),
      false
    );
  setMessage(
    document.getElementById("emailMessage"),
    "Email format is valid",
    true,
  );
  return true;
}

function validateName() {
  if (mode === "signIn") return true;
  const value = fullName.value.trim();
  if (!value)
    return (
      setMessage(
        document.getElementById("fullNameMessage"),
        "Full name is required",
      ),
      false
    );
  if (value.length < 2 || !namePattern.test(value))
    return (
      setMessage(
        document.getElementById("fullNameMessage"),
        "Use at least 2 letters, spaces, or hyphens only",
      ),
      false
    );
  setMessage(document.getElementById("fullNameMessage"), "Name is valid", true);
  return true;
}

function validatePassword() {
  const value = password.value;
  const unmet = passwordRules
    .filter(([rule]) => !rule.test(value))
    .map(([, text]) => text);
  const sameAsIdentity =
    value &&
    (value.toLowerCase() === email.value.trim().toLowerCase() ||
      value.toLowerCase() === fullName.value.trim().toLowerCase());
  const passwordMessage = document.getElementById("passwordMessage");
  if (mode === "signIn") {
    setMessage(
      passwordMessage,
      value ? "Password entered" : "Password is required",
      Boolean(value),
    );
    passwordStrength.hidden = true;
    return Boolean(value);
  }
  const score = passwordRules.length - unmet.length;
  passwordStrength.hidden = !value;
  passwordStrength.textContent = `Strength: ${score >= 5 ? "Strong" : score >= 3 ? "Medium" : "Weak"}`;
  passwordStrength.className = `strength ${score >= 5 ? "is-strong" : score >= 3 ? "is-medium" : ""}`;
  if (!value)
    return (setMessage(passwordMessage, "Password is required"), false);
  if (sameAsIdentity)
    return (
      setMessage(passwordMessage, "Password cannot match your email or name"),
      false
    );
  if (unmet.length)
    return (setMessage(passwordMessage, `Add ${unmet.join(", ")}`), false);
  setMessage(passwordMessage, "Password meets all requirements", true);
  return true;
}

function validateConfirmation() {
  if (mode === "signIn") return true;
  const valid =
    confirmPassword.value === password.value && Boolean(confirmPassword.value);
  setMessage(
    document.getElementById("confirmMessage"),
    valid ? "Passwords match" : "Passwords must match exactly",
    valid,
  );
  return valid;
}

function updateButton() {
  const valid =
    validateEmail() &&
    validatePassword() &&
    validateName() &&
    validateConfirmation();
  submitButton.disabled = !valid || isSubmitting || Boolean(lockoutTimer);
}

function setMode(nextMode) {
  mode = nextMode;
  const isSignUp = mode === "signUp";
  fields.forEach((field) => {
    field.hidden = !isSignUp;
  });
  rememberField.hidden = isSignUp;
  forgotPassword.hidden = isSignUp;
  signInTab.classList.toggle("is-active", !isSignUp);
  signUpTab.classList.toggle("is-active", isSignUp);
  signInTab.setAttribute("aria-selected", String(!isSignUp));
  signUpTab.setAttribute("aria-selected", String(isSignUp));
  formTitle.textContent = isSignUp
    ? "Create your staff account"
    : "Sign in to your register";
  formIntro.textContent = isSignUp
    ? "Set up access for the Mini Mart register."
    : "Use your staff account to access the Mini Mart register.";
  footerPrompt.textContent = isSignUp
    ? "Already have an account?"
    : "New staff account?";
  footerToggle.textContent = isSignUp ? "Sign in" : "Sign up";
  submitButton.textContent = isSignUp ? "Create account" : "Sign in";
  message.textContent = "";
  updateButton();
}

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function startLockout() {
  let seconds = 30;
  submitButton.disabled = true;
  showMessage(`Too many failed attempts. Try again in ${seconds} seconds.`);
  lockoutTimer = window.setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      window.clearInterval(lockoutTimer);
      lockoutTimer = null;
      failedAttempts = 0;
      showMessage("");
      updateButton();
      return;
    }
    showMessage(`Too many failed attempts. Try again in ${seconds} seconds.`);
  }, 1000);
}

function errorText(error, signingUp) {
  const text = (error?.message || "").toLowerCase();
  if (
    text.includes("already registered") ||
    text.includes("already been registered")
  )
    return "This email is already registered. Try signing in instead.";
  if (text.includes("invalid login credentials"))
    return "Incorrect email or password.";
  if (text.includes("email not confirmed"))
    return "Please check your email to verify your account before signing in.";
  if (text.includes("password"))
    return signingUp
      ? "Your password does not meet the password requirements. Please choose a stronger password."
      : "Incorrect email or password.";
  if (text.includes("rate limit") || text.includes("too many"))
    return "Too many requests. Please wait a moment and try again.";
  return signingUp
    ? "We could not create your account. Check your details and try again."
    : "We could not sign you in. Check your details and try again.";
}

async function submitAuth(event) {
  event.preventDefault();
  updateButton();
  if (submitButton.disabled || !window.supabaseClient) return;
  isSubmitting = true;
  submitButton.disabled = true;
  submitButton.textContent =
    mode === "signUp" ? "Creating account..." : "Signing in...";
  showMessage("");
  try {
    if (mode === "signUp") {
      const { data, error } = await window.supabaseClient.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: {
          data: { full_name: fullName.value.trim(), role: role.value || null },
        },
      });
      if (error) throw error;
      if (data.session) await window.supabaseClient.auth.signOut();
      showMessage(
        "Please check your email to verify your account before signing in.",
        "success",
      );
      authForm.reset();
      setMode("signIn");
      return;
    }
    const persistSession = document.getElementById("rememberMe").checked;
    window.supabaseClient = window.createMiniMartSupabaseClient(persistSession);
    localStorage.setItem(
      "miniMartSessionMode",
      persistSession ? "persistent" : "session",
    );
    const { data, error } = await window.supabaseClient.auth.signInWithPassword(
      { email: email.value.trim(), password: password.value },
    );
    if (error) throw error;
    if (!data.user?.email_confirmed_at) {
      await window.supabaseClient.auth.signOut();
      showMessage(
        "Please check your email to verify your account before signing in.",
      );
      return;
    }
    failedAttempts = 0;
    window.location.replace("index.html");
  } catch (error) {
    console.error("Authentication error:", error);

    if (mode === "signIn") {
      failedAttempts += 1;
      if (failedAttempts >= 5) startLockout();
    }
    showMessage(errorText(error, mode === "signUp"));
  } finally {
    isSubmitting = false;
    if (!lockoutTimer) {
      submitButton.textContent =
        mode === "signUp" ? "Create account" : "Sign in";
      updateButton();
    }
  }
}

async function resetPassword(event) {
  event.preventDefault();
  if (!validateEmail() || !window.supabaseClient) return;
  try {
    await window.supabaseClient.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: `${window.location.origin}/login.html`,
    });
  } catch {
    // Keep this response identical to avoid account enumeration.
  }
  showMessage(
    "If that email is registered, a reset link has been sent.",
    "success",
  );
}

document.querySelectorAll("[data-password-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordTarget);
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.innerHTML = "&#128065;";
    button.setAttribute("aria-label", `${visible ? "Show" : "Hide"} password`);
    button.title = `${visible ? "Show" : "Hide"} password`;
  });
});
[email, fullName, password, confirmPassword].forEach((input) =>
  input.addEventListener("input", updateButton),
);
signInTab.addEventListener("click", () => setMode("signIn"));
signUpTab.addEventListener("click", () => setMode("signUp"));
footerToggle.addEventListener("click", () =>
  setMode(mode === "signIn" ? "signUp" : "signIn"),
);
forgotPassword.addEventListener("click", resetPassword);
authForm.addEventListener("submit", submitAuth);

setMode("signIn");
if (!window.supabaseAuthConfigured)
  showMessage(
    "Sign-in is temporarily unavailable. Please contact the administrator.",
  );
if (window.supabaseAuthIsLocalDemo)
  showMessage("Temporary local login: admin@gmail.com", "success");
