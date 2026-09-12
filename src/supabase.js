// The one Supabase client the app uses. The URL and public key come from .env.local
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), which is kept out of git.

import { createClient } from '@supabase/supabase-js';

// The library appends /rest/v1 and /auth/v1 itself, so drop them if the address was
// copied from the API docs rather than the project settings.
const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Without these the app still loads, and the sign-in page says what is missing.
// Vite writes them into the site when it is built, so a hosted site needs them in
// the host's settings, followed by a new build.
const missingConfig = import.meta.env.DEV
    ? 'Supabase is not set up yet: fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart the dev server.'
    : 'Supabase is not set up for this site: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the hosting environment variables (Netlify: Site configuration → Environment variables), then deploy again.';

export const configError =
    !url || !key
        ? missingConfig
        : key.startsWith('sb_secret_')
            ? 'The key in .env.local is the secret key. Use the publishable (or anon) key instead; the secret key must never be in the app.'
            : '';

const REMEMBER_KEY = 'workmore:remember';

export const setRemember = (remember) => {
    try {
        localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    } catch {
        // Falls back to remembering.
    }
};

const remembers = () => {
    try {
        return localStorage.getItem(REMEMBER_KEY) !== 'false';
    } catch {
        return true;
    }
};

// Where Supabase keeps the session. "Keep me signed in" -> localStorage; otherwise
// sessionStorage, which the browser clears when it closes. The PKCE code verifier
// always goes to localStorage, because the email confirmation link may open in a
// new tab, and sessionStorage is per tab.
const authStorage = {
    getItem: (name) => {
        try {
            return sessionStorage.getItem(name) ?? localStorage.getItem(name);
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            const keep = remembers() || name.endsWith('-code-verifier');
            (keep ? localStorage : sessionStorage).setItem(name, value);
            (keep ? sessionStorage : localStorage).removeItem(name);
        } catch {
            // Storage blocked: the session lasts for this page load only.
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name);
            sessionStorage.removeItem(name);
        } catch {
            // Nothing stored to clear.
        }
    },
};

export const supabase = configError
    ? null
    : createClient(url, key, {
        auth: {
            storage: authStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // PKCE returns from email links with ?code= in the query string, which
            // leaves the router's #/ hash alone. The implicit flow would put tokens
            // in the hash and collide with the hash-based routes.
            flowType: 'pkce',
        },
    });
