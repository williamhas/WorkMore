// Who is signed in, and the sign-in / sign-out actions the rest of the app uses.
//
// PLACEHOLDER: there is no account service yet, so signIn accepts any well-formed
// email with any non-empty password and verifies nothing. It never stores the
// password. To add real accounts (Supabase, Firebase Auth, Auth0, ...), replace
// the body of signIn/signOut; callers only rely on signIn resolving to a session
// or rejecting with a user-facing message, and on `session` / `isSignedIn`.

import { computed, ref } from 'vue';

const STORAGE_KEY = 'workmore:session';

const readFrom = (storage) => {
    try {
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
        return parsed && typeof parsed.email === 'string' ? parsed : null;
    } catch {
        return null;
    }
};

// "Keep me signed in" sessions live in localStorage; the rest in sessionStorage,
// which the browser clears when it closes.
export const session = ref(readFrom(localStorage) ?? readFrom(sessionStorage));
export const isSignedIn = computed(() => session.value !== null);

// Where to go after signing in. Only in-app paths are followed, so a crafted
// ?redirect= cannot send anyone to another site.
export const safeRedirect = (target) =>
    typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signIn = async ({ email, password, remember }) => {
    const address = String(email ?? '').trim().toLowerCase();
    if (!EMAIL.test(address)) throw new Error('Enter a valid email address.');
    if (!password) throw new Error('Enter your password.');

    const next = { email: address, signedInAt: new Date().toISOString() };
    try {
        (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
        (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Storage blocked: stay signed in for this page load only.
    }
    session.value = next;
    return next;
};

export const signOut = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing stored to clear.
    }
    session.value = null;
};
