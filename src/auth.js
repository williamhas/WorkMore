// Who is signed in, and the sign-in / create-account / sign-out actions the rest of
// the app uses. Accounts live in Supabase Auth (see supabase.js).

import { computed, ref } from 'vue';
import { configError, setRemember, supabase } from './supabase.js';

export { configError };

// The earlier placeholder kept a fake session under this key; clear it once.
try {
    localStorage.removeItem('workmore:session');
    sessionStorage.removeItem('workmore:session');
} catch {
    // Nothing to clear.
}

const toSession = (s) => (s?.user ? { email: s.user.email ?? '', userId: s.user.id } : null);

export const session = ref(null);
export const isSignedIn = computed(() => session.value !== null);

// A confirmation email link returns as /?code=... once Supabase has confirmed the
// address, or as /?error_description=... if the link was expired or invalid.
const landing = new URLSearchParams(window.location.search);
const arrivedWithCode = landing.has('code');
const linkError = landing.get('error_description');

// Shown on the sign-in page after following an email link that could not sign the
// visitor in by itself, e.g. opened on a phone or in another browser.
export const linkNotice = ref(null); // { kind: 'info' | 'error', text }

// Resolves once the saved session (or an email-confirmation ?code=) has been read,
// so the router can wait for it before deciding where a visitor may go.
export const authReady = supabase
    ? supabase.auth
        .getSession()
        .then(({ data }) => {
            session.value = toSession(data.session);
        })
        .catch(() => {
            session.value = null;
        })
        .then(() => {
            // Supabase has used the one-time code by now. Take it out of the address
            // bar: a reload would otherwise try the spent code again, fail, and sign
            // the user out. The router only rewrites the #/ part, so it is done here.
            if (arrivedWithCode || linkError) {
                const clean = new URL(window.location.href);
                for (const name of ['code', 'error', 'error_code', 'error_description']) clean.searchParams.delete(name);
                window.history.replaceState(window.history.state, '', clean.pathname + clean.search + clean.hash);
            }

            if (linkError) {
                linkNotice.value = { kind: 'error', text: 'That link did not work: ' + linkError + '. Sign in, or create the account again for a new link.' };
            } else if (arrivedWithCode && !session.value) {
                // The address is confirmed, but the link was opened in a different
                // browser than the one used to sign up, so it could not sign in by itself.
                linkNotice.value = { kind: 'info', text: 'Your email is confirmed. Sign in to continue.' };
            }
        })
    : Promise.resolve();

// Keeps `session` current when a token refreshes, or someone signs out in another tab.
supabase?.auth.onAuthStateChange((_event, s) => {
    session.value = toSession(s);
});

// Where to go after signing in. Only in-app paths are followed, so a crafted
// ?redirect= cannot send anyone to another site.
export const safeRedirect = (target) =>
    typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkInput = (email, password) => {
    if (!supabase) throw new Error(configError);
    const address = String(email ?? '').trim().toLowerCase();
    if (!EMAIL.test(address)) throw new Error('Enter a valid email address.');
    if (!password) throw new Error('Enter your password.');
    return address;
};

const friendly = (error) => {
    const message = error?.message ?? '';
    if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you, then sign in.';
    if (/already (been )?registered/i.test(message)) return 'There is already an account with that email. Sign in instead.';
    if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
    return message || 'Something went wrong. Try again.';
};

export const signIn = async ({ email, password, remember }) => {
    const address = checkInput(email, password);
    setRemember(remember);
    const { data, error } = await supabase.auth.signInWithPassword({ email: address, password });
    if (error) throw new Error(friendly(error));
    session.value = toSession(data.session);
    return session.value;
};

// Resolves to { needsConfirmation: true } when the Supabase project confirms emails
// before the first sign-in (the default); the user then gets a link by email.
export const signUp = async ({ email, password, remember }) => {
    const address = checkInput(email, password);
    if (password.length < 6) throw new Error('Use at least 6 characters for the password.');
    setRemember(remember);
    const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        // The confirmation link comes back to this app. The address must be listed
        // under Authentication -> URL Configuration -> Redirect URLs in Supabase.
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(friendly(error));
    if (!data.session) return { needsConfirmation: true };
    session.value = toSession(data.session);
    return { needsConfirmation: false };
};

export const signOut = async () => {
    session.value = null;
    if (supabase) await supabase.auth.signOut().catch(() => {});
};
