<template>
    <div class="signin">
        <div class="signin-card">
            <div class="brand-block">
                <span class="logo" aria-hidden="true">W</span>
                <h1>{{ creating ? 'Create your account' : 'Sign in to WorkMore' }}</h1>
                <p class="sub">{{ creating ? 'One account keeps your week on every device.' : 'Welcome back. Sign in to see your week.' }}</p>
            </div>

            <p v-if="configError" class="config-error" role="alert">{{ configError }}</p>
            <p v-if="linkNotice?.kind === 'error'" class="config-error" role="alert">{{ linkNotice.text }}</p>
            <p v-if="notice || linkNotice?.kind === 'info'" class="notice" role="status">{{ notice || linkNotice.text }}</p>

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
                            :autocomplete="creating ? 'new-password' : 'current-password'"
                            :placeholder="creating ? 'At least 6 characters' : ''" />
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

                <button type="submit" class="btn-primary" :disabled="busy || Boolean(configError)">
                    {{ busy ? (creating ? 'Creating account…' : 'Signing in…') : (creating ? 'Create account' : 'Sign in') }}
                </button>
            </form>

            <p class="switch-mode">
                {{ creating ? 'Already have an account?' : 'No account yet?' }}
                <button type="button" class="link-btn" @click="setMode(creating ? 'signin' : 'signup')">
                    {{ creating ? 'Sign in' : 'Create one' }}
                </button>
            </p>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { configError, linkNotice, safeRedirect, signIn, signUp } from '../auth.js';

const route = useRoute();
const router = useRouter();

const mode = ref('signin'); // 'signin' | 'signup'
const creating = computed(() => mode.value === 'signup');

const emailInput = ref(null);
const email = ref('');
const password = ref('');
const remember = ref(true);
const showPassword = ref(false);
const error = ref('');
const notice = ref('');
const busy = ref(false);

onMounted(() => emailInput.value?.focus());

// The email carries over between the two modes; the password does not.
const setMode = (next) => {
    mode.value = next;
    password.value = '';
    error.value = '';
    notice.value = '';
    linkNotice.value = null;
    nextTick(() => emailInput.value?.focus());
};

const submit = async () => {
    error.value = '';
    busy.value = true;
    try {
        const credentials = { email: email.value, password: password.value, remember: remember.value };
        if (creating.value) {
            const { needsConfirmation } = await signUp(credentials);
            if (needsConfirmation) {
                setMode('signin');
                notice.value = 'Almost done: we sent a confirmation link to ' + email.value.trim().toLowerCase() +
                    '. Open it, and you will be signed in.';
                return;
            }
        } else {
            await signIn(credentials);
        }
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

.config-error,
.notice {
    margin: 0 0 16px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.4;
}

.config-error {
    border: 1px solid var(--danger-border);
    background: var(--danger-bg);
    color: var(--danger-text);
}

.notice {
    border: 1px solid var(--accent-border);
    background: var(--accent-soft);
    color: var(--text);
}

.switch-mode {
    margin: 18px 0 0;
    font-size: 0.88rem;
    color: var(--text-muted);
    text-align: center;
}

.link-btn {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.link-btn:hover {
    text-decoration: underline;
}

.link-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
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
