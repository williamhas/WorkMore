import { createApp } from 'vue'
import PrimeVue from 'primevue/config';
import Button from "primevue/button"

import 'primeicons/primeicons.css'
import './style.css'
// Imported before mounting so the saved light/dark choice applies on first paint.
import './theme.js'
import App from './App.vue'
import { router } from './router.js'

const app = createApp(App);
app.use(PrimeVue);
app.use(router);
app.component('Button', Button);
// Wait for the first navigation (and its sign-in redirect) so the home page never
// flashes on screen before a signed-out visitor is sent to sign in.
router.isReady().then(() => app.mount('#app'));
