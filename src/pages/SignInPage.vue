<template>
    <div class="signin">
        <div class="signin-card">
            <div class="brand-block">
                <span class="logo" aria-hidden="true">W</span>
                <h1>Sign in to WorkMore</h1>
                <p class="sub">Welcome back. Sign in to see your week.</p>
            </div>

            <form class="signin-form" novalidate @submit.prevent="submit">
                <div class="field">
                    <label for="signin-email">Email</label>
                    <input id="signin-email" ref="emailInput" v-model="email" type="email" autocomplete="email"
                        inputmode="email" placeholder="you@example.com" />
                </div>

                <div class="field">
                    <label for="signin-password">Password</label>
                    <div class="password">
                        <input id="signin-password" v-model="password" :type="showPassword ? 'text' : 'password'"
                            autocomplete="current-password" />
                        <button type="button" class="reveal" :aria-label="showPassword ? 'Hide password' : 'Show password'"
                            :aria-pressed="showPassword" @click="showPassword = !showPassword">
                            <i class="pi" :class="showPassword ? 'pi-eye-slash' : 'pi-eye'" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>

                <label class="remember">
                    <input v-model="remember" type="checkbox" />
                    <span>Keep me signed in</span>
                </label>

                <p v-if="error" class="form-error" role="alert">{{ error }}</p>

                <button type="submit" class="btn-primary" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
            </form>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeRedirect, signIn } from '../auth.js';

const route = useRoute();
const router = useRouter();

const emailInput = ref(null);
const email = ref('');
const password = ref('');
const remember = ref(true);
const showPassword = ref(false);
const error = ref('');
const busy = ref(false);

onMounted(() => emailInput.value?.focus());

const submit = async () => {
    error.value = '';
    busy.value = true;
    try {
        await signIn({ email: email.value, password: password.value, remember: remember.value });
        // Back to the page they tried to open, or the overview.
        await router.replace(safeRedirect(route.query.redirect));
    } catch (e) {
        error.value = e.message;
    } finally {
        busy.value = false;
    }
};
</script>

<style scoped>
.signin {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 24px 16px;
    background:
        radial-gradient(1200px 500px at 50% -10%, var(--accent-soft), transparent 70%),
        var(--bg);
}

.signin-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 400px;
    padding: 32px 28px 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-md);
}

.brand-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 24px;
    text-align: center;
}

/* Same rounded square as the header's icon buttons. */
.logo {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 8px;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font-size: 1.3rem;
    font-weight: 800;
}

.brand-block h1 {
    margin: 0;
    font-size: 1.35rem;
}

.sub {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted);
}

.signin-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.field input {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
}

.field input:focus {
    outline: 2px solid var(--focus);
    outline-offset: 0;
    border-color: var(--accent);
}

.password {
    position: relative;
}

.password input {
    padding-right: 44px;
}

.reveal {
    position: absolute;
    top: 50%;
    right: 6px;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transform: translateY(-50%);
}

.reveal:hover {
    background: var(--surface-hover);
    color: var(--text);
}

.reveal:focus-visible {
    outline: 2px solid var(--focus);
}

.remember {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    color: var(--text-label);
    cursor: pointer;
}

.remember input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
}

.form-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.85rem;
}

.btn-primary {
    padding: 11px 14px;
    border: 1px solid var(--accent-hover);
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: default;
}

.btn-primary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}
</style>
