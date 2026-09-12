<template>
    <div ref="root" class="profile">
        <button ref="trigger" type="button" class="icon-btn" :class="{ 'has-avatar': profile.avatarUrl }"
            aria-haspopup="true" :aria-expanded="open" aria-controls="profile-menu" aria-label="Account"
            title="Account" @click="toggle">
            <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" class="avatar-sm" />
            <i v-else class="pi pi-user" aria-hidden="true"></i>
        </button>

        <div v-if="open" id="profile-menu" class="menu">
            <div class="who">
                <button type="button" class="avatar-lg" :disabled="busy"
                    :aria-label="profile.avatarUrl ? 'Change profile picture' : 'Add a profile picture'"
                    :title="profile.avatarUrl ? 'Change picture' : 'Add a picture'" @click="pickFile">
                    <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" />
                    <span v-else class="initial">{{ initial }}</span>
                    <span class="camera" aria-hidden="true"><i class="pi pi-camera"></i></span>
                </button>
                <div class="who-text">
                    <!-- The name edits in place: Enter or leaving the field saves, Esc cancels. -->
                    <input v-if="editingName" ref="nameInput" v-model="nameDraft" class="name-input" type="text"
                        :maxlength="MAX_NAME_LENGTH" placeholder="Your name" aria-label="Your name"
                        @keydown.enter.prevent="saveName" @keydown.esc.stop.prevent="editingName = false"
                        @blur="saveName" />
                    <button v-else type="button" class="name-btn" :disabled="busy"
                        :title="profile.displayName ? 'Edit your name' : 'Add your name'" @click="editName">
                        <span class="name-text" :class="{ placeholder: !profile.displayName }">
                            {{ profile.displayName || 'Add your name' }}
                        </span>
                        <i class="pi pi-pencil" aria-hidden="true"></i>
                    </button>
                    <span class="who-email" :title="'Signed in as ' + email">{{ email }}</span>
                </div>
            </div>

            <div class="pic-actions">
                <button type="button" class="link-btn" :disabled="busy" @click="pickFile">
                    {{ busy ? 'Saving…' : profile.avatarUrl ? 'Change picture' : 'Add picture' }}
                </button>
                <button v-if="profile.avatarUrl && !busy" type="button" class="link-btn quiet" @click="remove">
                    Remove
                </button>
            </div>
            <p v-if="error" class="menu-error" role="alert">{{ error }}</p>
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />

            <div class="divider"></div>
            <div class="share">
                <div class="share-head">
                    <label class="share-label" for="booking-link">Your booking link</label>
                    <button v-if="profile.bookingCode && !confirmingReplace" type="button" class="link-btn quiet small"
                        :disabled="busy" title="Make a new link; the current one stops working"
                        @click="confirmingReplace = true">Replace</button>
                </div>

                <template v-if="profile.bookingCode">
                    <div class="share-row">
                        <input id="booking-link" ref="linkInput" class="share-input" type="text" readonly
                            :value="bookingLink" @focus="$event.target.select()" />
                        <button type="button" class="copy-btn" :class="{ copied }"
                            :aria-label="copied ? 'Copied' : 'Copy booking link'" :title="copied ? 'Copied' : 'Copy link'"
                            @click="copyLink">
                            <i class="pi" :class="copied ? 'pi-check' : 'pi-copy'" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div v-if="confirmingReplace" class="replace-confirm" role="alert">
                        <p>The current link stops working. Anyone who has it will need the new one.</p>
                        <div class="replace-actions">
                            <button ref="keepLinkButton" type="button" class="small-btn" @click="confirmingReplace = false">
                                Keep it
                            </button>
                            <button type="button" class="small-btn danger" @click="replaceLink">Replace link</button>
                        </div>
                    </div>
                    <span class="copy-status" role="status">{{ copied ? 'Copied to the clipboard' : copyError }}</span>
                    <span v-if="!profile.displayName" class="share-hint">
                        Add your name above, so visitors see who they are booking.
                    </span>
                </template>
                <p v-else class="share-hint">Run the latest supabase/schema.sql in Supabase to get your personal link.</p>
            </div>

            <div class="divider"></div>
            <button type="button" class="menu-item" @click="logOut">
                <i class="pi pi-sign-out" aria-hidden="true"></i>
                <span>Log out</span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { session, signOut } from '../auth.js';
import { MAX_NAME_LENGTH, profile, removeAvatar, replaceBookingCode, saveDisplayName, uploadAvatar } from '../profile.js';

const router = useRouter();

const root = ref(null);
const trigger = ref(null);
const fileInput = ref(null);
const nameInput = ref(null);
const open = ref(false);
const busy = ref(false);
const error = ref('');
const editingName = ref(false);
const nameDraft = ref('');

const email = computed(() => session.value?.email ?? '');

// Built from where the app is running plus this account's code, so it follows the
// app to wherever it is hosted (http://localhost:5173/#/book/<code> in development).
const linkInput = ref(null);
const keepLinkButton = ref(null);
const bookingLink = computed(() =>
    profile.bookingCode
        ? window.location.origin + window.location.pathname + router.resolve({ name: 'book', params: { code: profile.bookingCode } }).href
        : ''
);
const copied = ref(false);
const copyError = ref('');
const confirmingReplace = ref(false);
let copiedTimer = null;

// Land on "Keep it", so a stray Enter does not break a link that is in use.
watch(confirmingReplace, (asking) => asking && nextTick(() => keepLinkButton.value?.focus()));

const replaceLink = async () => {
    confirmingReplace.value = false;
    copied.value = false;
    await run(replaceBookingCode);
};

const copyLink = async () => {
    copyError.value = '';
    try {
        await navigator.clipboard.writeText(bookingLink.value);
    } catch {
        // Clipboard access can be refused; fall back to copying the selected text.
        linkInput.value?.select();
        if (!document.execCommand?.('copy')) {
            copyError.value = 'Could not copy. Select the link and press Ctrl+C.';
            return;
        }
    }
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 2000);
};
const initial = computed(() => ((profile.displayName || email.value)[0] ?? '?').toUpperCase());

const close = (refocus = false) => {
    open.value = false;
    editingName.value = false;
    error.value = '';
    copied.value = false;
    copyError.value = '';
    confirmingReplace.value = false;
    if (refocus) trigger.value?.focus();
};

const editName = () => {
    nameDraft.value = profile.displayName;
    editingName.value = true;
    nextTick(() => nameInput.value?.focus());
};

// Called by Enter and by leaving the field; the first call wins, so the blur that
// follows Enter (or Esc) does not save twice.
const saveName = () => {
    if (!editingName.value) return;
    editingName.value = false;
    if (nameDraft.value.trim() === profile.displayName) return;
    run(() => saveDisplayName(nameDraft.value));
};

const toggle = () => (open.value ? close() : (open.value = true));

// While open: a click outside closes it, and so does Esc (returning focus to the button).
const onPointerDown = (event) => {
    if (!root.value?.contains(event.target)) close();
};
const onKeyDown = (event) => {
    if (event.key === 'Escape') close(true);
};

watch(open, (isOpen) => {
    const method = isOpen ? 'addEventListener' : 'removeEventListener';
    document[method]('pointerdown', onPointerDown);
    document[method]('keydown', onKeyDown);
});

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKeyDown);
    clearTimeout(copiedTimer);
});

const pickFile = () => fileInput.value?.click();

const run = async (action) => {
    busy.value = true;
    error.value = '';
    try {
        await action();
    } catch (e) {
        error.value = e.message;
    } finally {
        busy.value = false;
    }
};

const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still fires
    if (file) run(() => uploadAvatar(file));
};

const remove = () => run(removeAvatar);

const logOut = async () => {
    close();
    await signOut();
    router.replace({ name: 'signin' });
};
</script>

<style scoped>
.profile {
    position: relative;
}

.icon-btn.has-avatar {
    padding: 0;
}

.avatar-sm {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
}

.menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 200;
    box-sizing: border-box;
    width: 250px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-md);
}

.who {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar-lg {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
}

.avatar-lg img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.avatar-lg:disabled {
    cursor: default;
    opacity: 0.7;
}

.avatar-lg:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

.initial {
    font-size: 1.2rem;
    font-weight: 700;
}

/* Small camera badge, so the picture reads as something to click. */
.camera {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 2px solid var(--surface);
    border-radius: 50%;
    background: var(--surface-sunken);
    color: var(--text);
    font-size: 0.6rem;
}

.who-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.name-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.name-text {
    overflow: hidden;
    font-size: 0.92rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.name-text.placeholder {
    color: var(--accent-text);
    font-weight: 600;
}

/* The pencil only shows on hover or focus, to keep the menu quiet. */
.name-btn .pi-pencil {
    flex: none;
    font-size: 0.7rem;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.12s;
}

.name-btn:hover .pi-pencil,
.name-btn:focus-visible .pi-pencil,
.name-text.placeholder + .pi-pencil {
    opacity: 1;
}

.name-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
}

.name-input {
    box-sizing: border-box;
    width: 100%;
    margin: -3px 0 1px;
    padding: 3px 6px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    outline: 2px solid var(--focus);
}

.who-email {
    overflow: hidden;
    font-size: 0.78rem;
    color: var(--text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pic-actions {
    display: flex;
    gap: 14px;
    margin-top: 10px;
    padding-left: 60px;
}

.link-btn {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
}

.link-btn.quiet {
    color: var(--text-muted);
}

.link-btn:hover:not(:disabled) {
    text-decoration: underline;
}

.link-btn:disabled {
    cursor: default;
    opacity: 0.7;
}

.link-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
}

.menu-error {
    margin: 10px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.8rem;
}

/* booking link */
.share {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.share-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
}

.link-btn.small {
    font-size: 0.75rem;
}

.share-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.replace-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--danger-border);
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.78rem;
}

.replace-confirm p {
    margin: 0;
}

.replace-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
}

.small-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.small-btn.danger {
    border-color: var(--danger-hover);
    background: var(--danger);
    color: #fff;
}

.small-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

.share-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.share-row {
    display: flex;
    gap: 6px;
}

.share-input {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-muted);
    color: var(--text);
    font: inherit;
    font-size: 0.78rem;
    text-overflow: ellipsis;
}

.share-input:focus {
    outline: 2px solid var(--focus);
    outline-offset: 0;
}

.copy-btn {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.copy-btn:hover {
    background: var(--surface-hover);
}

.copy-btn.copied {
    border-color: #16a34a;
    background: color-mix(in srgb, #22c55e 16%, var(--surface));
    color: #16a34a;
}

.copy-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

/* Empty until something happens, so it takes no room. */
.copy-status {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.copy-status:empty {
    display: none;
}

.divider {
    height: 1px;
    margin: 12px -14px 8px;
    background: var(--border);
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
}

.menu-item:hover {
    background: var(--surface-hover);
}

.menu-item:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
}
</style>
