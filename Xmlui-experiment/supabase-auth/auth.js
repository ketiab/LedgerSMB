
window.__AUTH_LOADED__ = true;
let supaClient = null;
const SUPABASE_URL = "https://dzirtfvyvvxiftbyjynw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6aXJ0ZnZ5dnZ4aWZ0YnlqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDg2MTEsImV4cCI6MjA4NDk4NDYxMX0.v4VP9um8liVDR2m5Aojtus8dxWz4G5qskbU__DNLDj0";



window.getClient = function () {
  if (!supaClient) {
    supaClient = supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }
  return supaClient;
}



window.session = {
  accessToken: null,
  _userId: null,
  _email: null
};

async function initAuth() {
  const { data } = await getClient().auth.getSession();
  const s = data.session;

  if (s) {
    session.accessToken = s.access_token;
    session._userId = s.user.id;
    session._email = s.user.email;
  }
}

/*async function signUp(email, password) {
  return await getClient().auth.signUp({ email, password });
}*/
window.signUpWithCallback = function (email, password, cb) {
  getClient().auth
    .signUp({ email, password })
    .then(({ data, error }) => {
      if (error) {
        cb({ error });
        return;
      }

      // If email confirmation is ON, session may be null
      if (!data.session) {
        cb({
          needsEmailConfirmation: true,
          email: data.user?.email
        });
        return;
      }

      // Immediate session (email confirmation OFF)
      cb({
        token: data.session.access_token,
        _userId: data.session.user.id,
        _email: data.session.user.email
      });
    })
    .catch(err => {
      cb({ error: { message: err.message } });
    });
};



window.supabaseRestUrl = (pathAndQuery) =>
  SUPABASE_URL + "/rest/v1/" + pathAndQuery;

window.supabaseHeaders = (token) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + (token || SUPABASE_ANON_KEY),
  "Content-Type": "application/json",
});

window.restoreSessionWithCallback = function (cb) {
  getClient().auth.getSession()
    .then(({ data, error }) => {
      if (error) return cb({ error });
      const s = data?.session;
      if (!s) return cb(null);
      cb({
        token: s.access_token,
        _userId: s.user.id,
        _email: s.user.email
      });
    })
    .catch(err => cb({ error: { message: err.message } }));
};




async function signOut() {
  await getClient().auth.signOut();
  session.accessToken = null;
  session._userId = null;
  session._email = null;
}
async function getAuthStatus() {
  await initAuth();

  return {
    authenticated: !!session.accessToken,
    email: session._email,
    userId: session._userId
  };
}




// window.Auth = { initAuth, signUp, signIn, signOut }; // Commented out - these functions don't exist

window.sendOtpWithCallback = function (email, cb) {
  getClient().auth.signInWithOtp({email })
    .then(({ error }) => {
    if (error) return cb({ error });
      cb({ ok: true });
    })
    .catch(err => {
    cb({ error: { message: err.message } });
    });
};


