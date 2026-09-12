<template>
  <!-- Public pages (sign in) bring their own full-page layout, without the header. -->
  <RouterView v-if="route.meta.public" />
  <template v-else>
    <AppHeader />
    <main class="page">
      <div v-if="store.error" class="sync-error" role="alert">
        <span>{{ store.error }}</span>
        <button type="button" class="dismiss" aria-label="Dismiss" @click="dismissError">&times;</button>
      </div>
      <p v-else-if="store.loading" class="sync-loading" role="status">Loading your planner…</p>
      <RouterView />
    </main>
  </template>
</template>

<script setup>
import { watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import { isSignedIn } from './auth.js';
import { dismissError, store } from './store.js';

const route = useRoute();
const router = useRouter();

// Signed out while on a page (another tab signed out, or the session expired):
// go to sign in, and come back here afterwards.
watch(isSignedIn, (signedIn) => {
  if (!signedIn && !route.meta.public) {
    router.replace({ name: 'signin', query: route.fullPath === '/' ? {} : { redirect: route.fullPath } });
  }
});
</script>

<style scoped>
.sync-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid var(--danger-border);
  border-radius: 10px;
  background: var(--danger-bg);
  color: var(--danger-text);
  font-size: 0.9rem;
}

.sync-error span {
  flex: 1;
}

.dismiss {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.dismiss:hover {
  background: var(--surface-hover);
}

.sync-loading {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
