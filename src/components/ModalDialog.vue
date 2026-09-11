<template>
    <Teleport to="body">
        <div v-if="open" class="wm-modal" @click.self="$emit('close')" @keydown.esc="$emit('close')">
            <section ref="panel" class="wm-modal-panel" role="dialog" aria-modal="true" :aria-labelledby="headingId">
                <header class="wm-modal-head">
                    <h2 :id="headingId">{{ title }}</h2>
                    <button type="button" class="wm-modal-close" aria-label="Close" @click="$emit('close')">&times;</button>
                </header>
                <div class="wm-modal-body">
                    <slot />
                </div>
            </section>
        </div>
    </Teleport>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
    open: Boolean,
    title: String,
});
defineEmits(['close']);

const panel = ref(null);
const headingId = 'wm-modal-' + Math.random().toString(36).slice(2, 8);
let returnFocusTo = null;

// Focus the first field on open, and hand focus back to whatever opened it on close.
watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            returnFocusTo = document.activeElement;
            nextTick(() =>
                panel.value?.querySelector('input, select, textarea, button:not(.wm-modal-close)')?.focus()
            );
        } else {
            returnFocusTo?.focus?.();
            returnFocusTo = null;
        }
    }
);
</script>

<style>
/* Unscoped so it reaches the form passed in through the slot; every rule is
   namespaced under .wm-modal so nothing leaks into the rest of the page. */
.wm-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--overlay);
}

.wm-modal-panel {
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    max-height: calc(100vh - 32px);
    overflow-x: hidden;
    overflow-y: auto;
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    text-align: left;
    box-shadow: var(--shadow-lg);
}

.wm-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border-faint);
}

.wm-modal-head h2 {
    margin: 0;
    font-size: 1.2rem;
}

.wm-modal-close {
    flex: none;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: var(--surface-sunken);
    color: var(--text);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
}

.wm-modal-close:hover {
    background: var(--surface-hover);
}

.wm-modal-body {
    padding: 16px 20px 20px;
}

.wm-modal .modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.wm-modal .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
}

.wm-modal .field > span {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.wm-modal .field input[type='text'],
.wm-modal .field input[type='time'],
.wm-modal .field select,
.wm-modal .field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
}

.wm-modal .field textarea {
    resize: vertical;
    min-height: 70px;
    overflow-x: hidden;
}

.wm-modal .field input:focus,
.wm-modal .field select:focus,
.wm-modal .field textarea:focus {
    outline: 2px solid var(--focus);
    outline-offset: 0;
    border-color: var(--accent);
}

.wm-modal .field-row {
    display: flex;
    gap: 12px;
}

.wm-modal .hint {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.wm-modal .form-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.85rem;
}

.wm-modal .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}

.wm-modal .btn-primary,
.wm-modal .btn-secondary {
    padding: 8px 14px;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.wm-modal .btn-primary {
    border: 1px solid var(--accent-hover);
    background: var(--accent);
    color: #fff;
}

.wm-modal .btn-primary:hover {
    background: var(--accent-hover);
}

.wm-modal .btn-secondary {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font-weight: 400;
}

.wm-modal .btn-secondary:hover {
    background: var(--surface-hover);
}

/* Delete sits apart on the left, so it is not hit on the way to Save. */
.wm-modal .btn-danger-ghost {
    margin-right: auto;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--danger-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.wm-modal .btn-danger-ghost:hover {
    background: var(--danger-bg);
}

.wm-modal .btn-danger {
    padding: 8px 14px;
    border: 1px solid var(--danger-hover);
    border-radius: 8px;
    background: var(--danger);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.wm-modal .btn-danger:hover {
    background: var(--danger-hover);
}

.wm-modal .confirm-delete {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--danger-border);
    border-radius: 10px;
    background: var(--danger-bg);
    color: var(--danger-text);
}

.wm-modal .confirm-delete p {
    margin: 0;
    font-size: 0.9rem;
}

.wm-modal .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
</style>
