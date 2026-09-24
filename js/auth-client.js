const SUPABASE_URL = "SUPABASE_URL";
const SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY";

const LOCAL_DEMO_EMAIL = "admin@gmail.com";
const LOCAL_DEMO_PASSWORD = "Testadmin,12";

const LOCAL_SESSION_KEY = "miniMartLocalDemoSession";


// ============================================================
// HOST DETECTION
// ============================================================

const hostname = window.location.hostname;

const isLocalHost = [
  "",
  "localhost",
  "127.0.0.1",
  "::1",
].includes(hostname);

const isVercelHost =
  hostname === "vercel.app" ||
  hostname.endsWith(".vercel.app");

const isCloudflareQuickTunnel =
  hostname.endsWith(".trycloudflare.com");


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const isSupabaseConfigured =
  SUPABASE_URL !== "SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "SUPABASE_ANON_KEY" &&
  SUPABASE_URL.trim() !== "" &&
  SUPABASE_ANON_KEY.trim() !== "";


// ============================================================
// LOCAL DEMO AUTH
//
// This is useful when Supabase has not been configured yet.
//
// It now works on:
// - localhost
// - 127.0.0.1
// - Vercel
// - Cloudflare Quick Tunnel
// ============================================================

const isLocalDemoAuth =
  !isSupabaseConfigured &&
  (
    isLocalHost ||
    isVercelHost ||
    isCloudflareQuickTunnel
  );


// ============================================================
// GLOBAL AUTH STATE
// ============================================================

window.supabaseClient = null;

window.supabaseAuthConfigured =
  isSupabaseConfigured || isLocalDemoAuth;

window.supabaseAuthIsLocalDemo =
  isLocalDemoAuth;

window.supabaseAuthError = null;


// ============================================================
// LOCAL DEMO CLIENT
// ============================================================

function createLocalDemoClient(persistSession) {

  const storage =
    persistSession
      ? window.localStorage
      : window.sessionStorage;


  return {

    auth: {

      // --------------------------------------------------------
      // GET SESSION
      // --------------------------------------------------------

      async getSession() {

        try {

          const storedSession =
            storage.getItem(
              LOCAL_SESSION_KEY
            );

          return {
            data: {
              session:
                storedSession
                  ? JSON.parse(storedSession)
                  : null,
            },
            error: null,
          };

        } catch (error) {

          console.error(
            "Failed to read local session:",
            error
          );

          return {
            data: {
              session: null,
            },
            error: null,
          };

        }

      },


      // --------------------------------------------------------
      // LOGIN
      // --------------------------------------------------------

      async signInWithPassword({
        email,
        password,
      }) {

        const cleanEmail =
          String(email || "")
            .trim()
            .toLowerCase();


        if (
          cleanEmail !==
            LOCAL_DEMO_EMAIL ||
          password !==
            LOCAL_DEMO_PASSWORD
        ) {

          return {
            data: {
              user: null,
              session: null,
            },

            error:
              new Error(
                "Invalid login credentials"
              ),
          };

        }


        const user = {

          id:
            "local-demo-admin",

          email:
            LOCAL_DEMO_EMAIL,

          email_confirmed_at:
            new Date().toISOString(),

          user_metadata: {

            full_name:
              "Mini Mart Admin",

            role:
              "Owner",

          },

        };


        const session = {

          user,

          access_token:
            "local-demo-session",

          token_type:
            "bearer",

        };


        try {

          storage.setItem(
            LOCAL_SESSION_KEY,
            JSON.stringify(session)
          );

        } catch (error) {

          console.error(
            "Could not save local session:",
            error
          );

        }


        return {

          data: {
            user,
            session,
          },

          error: null,

        };

      },


      // --------------------------------------------------------
      // LOGOUT
      // --------------------------------------------------------

      async signOut() {

        try {

          window.localStorage.removeItem(
            LOCAL_SESSION_KEY
          );

          window.sessionStorage.removeItem(
            LOCAL_SESSION_KEY
          );

        } catch (error) {

          console.error(
            "Failed to clear session:",
            error
          );

        }


        return {
          error: null,
        };

      },


      // --------------------------------------------------------
      // SIGN UP
      // --------------------------------------------------------

      async signUp() {

        return {

          data: {
            user: null,
            session: null,
          },

          error:
            new Error(
              "Temporary local login only"
            ),

        };

      },


      // --------------------------------------------------------
      // RESET PASSWORD
      // --------------------------------------------------------

      async resetPasswordForEmail() {

        return {

          data: {},

          error: null,

        };

      },

    },

  };

}


// ============================================================
// CREATE AUTH CLIENT
// ============================================================

window.createMiniMartSupabaseClient =
  function (persistSession = true) {

    // --------------------------------------------------------
    // LOCAL DEMO MODE
    // --------------------------------------------------------

    if (isLocalDemoAuth) {

      return createLocalDemoClient(
        persistSession
      );

    }


    // --------------------------------------------------------
    // REAL SUPABASE MODE
    // --------------------------------------------------------

    if (isSupabaseConfigured) {

      if (
        !window.supabase ||
        typeof window.supabase.createClient !==
          "function"
      ) {

        throw new Error(
          "Supabase library is not loaded."
        );

      }


      return window.supabase.createClient(

        SUPABASE_URL,

        SUPABASE_ANON_KEY,

        {

          auth: {

            persistSession,

            autoRefreshToken:
              true,

            detectSessionInUrl:
              true,

            storage:
              persistSession
                ? window.localStorage
                : window.sessionStorage,

          },

        }

      );

    }


    // --------------------------------------------------------
    // NOT CONFIGURED
    // --------------------------------------------------------

    throw new Error(
      "Authentication is not configured. " +
      "Add your Supabase URL and anon key " +
      "or use the local demo environment."
    );

  };


// ============================================================
// INITIALIZE CLIENT
// ============================================================

try {

  const persist =
    localStorage.getItem(
      "miniMartSessionMode"
    ) !== "session";


  window.supabaseClient =
    window.createMiniMartSupabaseClient(
      persist
    );


  window.supabaseAuthConfigured =
    true;


  console.log(
    "Mini Mart authentication initialized."
  );


  if (isLocalDemoAuth) {

    console.log(
      "Authentication mode: LOCAL DEMO"
    );

    console.log(
      "Demo email:",
      LOCAL_DEMO_EMAIL
    );

  } else {

    console.log(
      "Authentication mode: SUPABASE"
    );

  }

} catch (error) {

  window.supabaseClient =
    null;

  window.supabaseAuthConfigured =
    false;

  window.supabaseAuthError =
    error;


  console.error(
    "Mini Mart authentication initialization failed:",
    error
  );

}


// ============================================================
// OPTIONAL DEBUG INFORMATION
// ============================================================

console.log(
  "Mini Mart Auth:",
  {
    hostname,
    isLocalHost,
    isVercelHost,
    isCloudflareQuickTunnel,
    isSupabaseConfigured,
    isLocalDemoAuth,
    authConfigured:
      window.supabaseAuthConfigured,
  }
);