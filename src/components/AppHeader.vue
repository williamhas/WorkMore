<template>
    <header class="app-header">
        <div class="header-inner">
            <RouterLink to="/" class="brand">WorkMore</RouterLink>

            <nav class="tabs" aria-label="Main">
                <RouterLink to="/" class="tab" exact-active-class="active">Overview</RouterLink>
                <RouterLink to="/library" class="tab" active-class="active">Types &amp; Modules</RouterLink>
            </nav>

            <div class="actions">
                <button type="button" class="icon-btn" :aria-label="themeLabel" :title="themeLabel" @click="toggleTheme">
                    <i class="pi" :class="theme === 'dark' ? 'pi-sun' : 'pi-moon'" aria-hidden="true"></i>
                </button>
                <ProfileMenu />
            </div>
        </div>
    </header>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import ProfileMenu from './ProfileMenu.vue';
import { theme, toggleTheme } from '../theme.js';

const themeLabel = computed(() => (theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
</script>

<style scoped>
.app-header {
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
}

.header-inner {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 24px;
    max-width: 1200px;
    height: 56px;
    margin: 0 auto;
    padding: 0 16px;
}

.brand {
    flex: none;
    color: var(--text);
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    text-decoration: none;
}

.tabs {
    display: flex;
    align-self: stretch;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
}

/* An underline along the header's bottom edge marks the current tab. */
.tab {
    display: flex;
    align-items: center;
    padding: 0 12px;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 0.92rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.12s, border-color 0.12s;
}

.tab:hover {
    color: var(--text);
}

.tab.active {
    border-bottom-color: var(--accent);
    color: var(--text);
}

.tab:focus-visible,
.brand:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
}

.actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}

@media (max-width: 560px) {
    .header-inner {
        gap: 12px;
    }

    .tab {
        padding: 0 8px;
    }
}
</style>
