<template>
  <!-- Public pages (sign in) bring their own full-page layout, without the header. -->
  <RouterView v-if="route.meta.public" />
  <template v-else>
    <AppHeader />
    <main class="page">
      <RouterView />
    </main>
  </template>
</template>

<script setup>
import { RouterView, useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';

const route = useRoute();
</script>
