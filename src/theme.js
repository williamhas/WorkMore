// Light/dark mode. Follows the operating system until the user picks one with the
// header toggle; that choice is remembered. The palette itself lives in style.css.

import { ref, watchEffect } from 'vue';

const STORAGE_KEY = 'workmore:theme';

const readChoice = () => {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        return null;
    }
};

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let chosen = readChoice();

export const theme = ref(chosen ?? (systemDark.matches ? 'dark' : 'light'));

systemDark.addEventListener('change', (event) => {
    if (!chosen) theme.value = event.matches ? 'dark' : 'light';
});

watchEffect(() => {
    document.documentElement.dataset.theme = theme.value;
});

export const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    chosen = theme.value;
    try {
        localStorage.setItem(STORAGE_KEY, chosen);
    } catch {
        // Not remembered, but the switch still applies for this session.
    }
};
