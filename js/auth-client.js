const SUPABASE_URL = "SUPABASE_URL";
const SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY";
const LOCAL_DEMO_EMAIL = "admin@gmail.com";
const LOCAL_DEMO_PASSWORD = "Testadmin,12";
const LOCAL_SESSION_KEY = "miniMartLocalDemoSession";
const isLocalHost = ["", "localhost", "127.0.0.1", "::1"].includes(
  window.location.hostname,
);
const isVercelHost =
  window.location.hostname === "vercel.app" ||
  window.location.hostname.endsWith(".vercel.app");
const isSupabaseConfigured =
  SUPABASE_URL !== "SUPABASE_URL" && SUPABASE_ANON_KEY !== "SUPABASE_ANON_KEY";
const isLocalDemoAuth = !isSupabaseConfigured && (isLocalHost || isVercelHost);
window.supabaseClient = null;
window.supabaseAuthConfigured = false;
window.supabaseAuthIsLocalDemo = isLocalDemoAuth;

function createLocalDemoClient(persistSession) {
  const storage = persistSession ? window.localStorage : window.sessionStorage;
  return {
    auth: {
      async getSession() {
        try {
          return {
            data: {
              session: JSON.parse(storage.getItem(LOCAL_SESSION_KEY) || "null"),
            },
            error: null,
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      },
      async signInWithPassword({ email, password }) {
        if (
          email.trim().toLowerCase() !== LOCAL_DEMO_EMAIL ||
          password !== LOCAL_DEMO_PASSWORD
        )
          return {
            data: { user: null, session: null },
            error: new Error("Invalid login credentials"),
          };
        const user = {
          id: "local-demo-admin",
          email: LOCAL_DEMO_EMAIL,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { full_name: "Mini Mart Admin", role: "Owner" },
        };
        const session = { user, access_token: "local-demo-session" };
        storage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
        return { data: { user, session }, error: null };
      },
      async signOut() {
        window.localStorage.removeItem(LOCAL_SESSION_KEY);
        window.sessionStorage.removeItem(LOCAL_SESSION_KEY);
        return { error: null };
      },
      async signUp() {
        return {
          data: { user: null, session: null },
          error: new Error("Temporary local login only"),
        };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
    },
  };
}

window.createMiniMartSupabaseClient = (persistSession) =>
  isLocalDemoAuth
    ? createLocalDemoClient(persistSession)
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: persistSession ? window.localStorage : window.sessionStorage,
        },
      });

try {
  const persist = localStorage.getItem("miniMartSessionMode") !== "session";
  window.supabaseClient = window.createMiniMartSupabaseClient(persist);
  window.supabaseAuthConfigured = isSupabaseConfigured || isLocalDemoAuth;
} catch (error) {
  window.supabaseAuthError = error;
}
