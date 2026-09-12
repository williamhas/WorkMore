<template>
    <div class="container panel">
        <div class="panel-head">
            <div>
                <h1>Types</h1>
                <p class="panel-sub">
                    Fixed labels with a color. Activities with a type are highlighted in that color.
                    Click a type to edit or delete it.
                </p>
            </div>
            <button type="button" class="btn-new" @click="openNew">+ New type</button>
        </div>

        <ul v-if="types.length" class="type-list">
            <li v-for="t in types" :key="t.id">
                <button type="button" class="type-item" :style="{ '--type': t.color }" :title="'Edit ' + t.name"
                    @click="openEdit(t)">
                    <span class="swatch"></span>
                    <span class="type-name">{{ t.name }}</span>
                </button>
            </li>
        </ul>
        <p v-else class="empty">No types yet. Create one, for example "Intervals" in green.</p>

        <ModalDialog :open="showDialog" :title="editing ? 'Edit type' : 'New type'" @close="closeDialog">
            <form class="modal-form" novalidate @submit.prevent="save">
                <label class="field">
                    <span>Name</span>
                    <input v-model="form.name" type="text" maxlength="40" placeholder="e.g. Intervals" />
                </label>

                <div class="field">
                    <span>Color</span>
                    <div class="palette">
                        <button v-for="c in PALETTE" :key="c" type="button" class="palette-swatch"
                            :class="{ on: form.color === c }" :style="{ '--type': c }" :aria-label="'Color ' + c"
                            :aria-pressed="form.color === c" @click="form.color = c"></button>
                        <label class="custom-color" :class="{ on: isCustom }" title="Pick any color">
                            <input v-model="form.color" type="color" aria-label="Custom color" />
                        </label>
                    </div>
                </div>

                <div class="preview">
                    <span class="preview-label">Preview</span>
                    <span class="preview-chip" :style="{ '--type': form.color }">{{ form.name.trim() || 'Type name' }}</span>
                </div>

                <p v-if="error" class="form-error" role="alert">{{ error }}</p>

                <div v-if="confirmingDelete" class="confirm-delete" role="alert">
                    <p><strong>Delete "{{ editing.name }}"?</strong> {{ usageText }}</p>
                    <div class="confirm-actions">
                        <button ref="keepButton" type="button" class="btn-secondary" @click="confirmingDelete = false">
                            Keep it
                        </button>
                        <button type="button" class="btn-danger" @click="removeType">Delete type</button>
                    </div>
                </div>
                <div v-else class="modal-actions">
                    <button v-if="editing" type="button" class="btn-danger-ghost" @click="askDelete">Delete</button>
                    <button type="button" class="btn-secondary" @click="closeDialog">Cancel</button>
                    <button type="submit" class="btn-primary">{{ editing ? 'Save changes' : 'Create type' }}</button>
                </div>
            </form>
        </ModalDialog>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import ModalDialog from './ModalDialog.vue';
import { TYPE_PALETTE as PALETTE, newId } from '../planner.js';

const props = defineProps({
    types: { type: Array, default: () => [] },
    // Only read, to tell the user what deleting a type would affect.
    modules: { type: Array, default: () => [] },
    addedEvents: { type: Array, default: () => [] },
});
const emit = defineEmits(['addType', 'updateType', 'deleteType']);

const showDialog = ref(false);
const editing = ref(null); // the type being edited; null while creating
const confirmingDelete = ref(false);
const keepButton = ref(null);
const error = ref('');
const form = reactive({ name: '', color: PALETTE[0] });

const isCustom = computed(() => !PALETTE.includes(form.color.toLowerCase()));

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

const usageText = computed(() => {
    if (!editing.value) return '';
    const id = editing.value.id;
    const moduleCount = props.modules.filter((m) => m.typeId === id).length;
    const activityCount = props.addedEvents.filter((e) => e.typeId === id).length;
    if (!moduleCount && !activityCount) return 'Nothing uses it yet.';

    const parts = [
        moduleCount && plural(moduleCount, 'module', 'modules'),
        activityCount && plural(activityCount, 'activity', 'activities'),
    ].filter(Boolean);
    return 'Used by ' + parts.join(' and ') + ', which will lose ' +
        (moduleCount + activityCount === 1 ? 'its' : 'their') + ' color.';
});

const openDialog = (type) => {
    editing.value = type;
    if (type) {
        Object.assign(form, { name: type.name, color: type.color });
    } else {
        // Start on the first palette color no existing type is using.
        const used = new Set(props.types.map((t) => t.color.toLowerCase()));
        Object.assign(form, { name: '', color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[0] });
    }
    error.value = '';
    confirmingDelete.value = false;
    showDialog.value = true;
};

const openNew = () => openDialog(null);
const openEdit = (type) => openDialog(type);

const closeDialog = () => {
    showDialog.value = false;
};

const askDelete = () => {
    confirmingDelete.value = true;
    // Land on the safe choice, so a stray Enter keeps the type.
    nextTick(() => keepButton.value?.focus());
};

const save = () => {
    const name = form.name.trim();
    const clash = props.types.some(
        (t) => t.id !== editing.value?.id && t.name.toLowerCase() === name.toLowerCase()
    );

    if (!name) error.value = 'Give the type a name.';
    else if (clash) error.value = 'There is already a type called "' + name + '".';
    else error.value = '';

    if (error.value) return;

    const type = { id: editing.value?.id ?? newId(), name, color: form.color.toLowerCase() };
    emit(editing.value ? 'updateType' : 'addType', type);
    closeDialog();
};

const removeType = () => {
    emit('deleteType', editing.value.id);
    closeDialog();
};
</script>

<style scoped>
.panel {
    padding: 16px;
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    text-align: left;
}

.panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
}

.panel-head h1 {
    margin: 0;
    font-size: 1.4rem;
}

.panel-sub {
    margin: 4px 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
}

.btn-new {
    flex: none;
    padding: 8px 14px;
    border: 1px solid var(--accent-hover);
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.btn-new:hover {
    background: var(--accent-hover);
}

.empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-align: center;
}

.type-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.type-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px 6px 8px;
    border: 1px solid color-mix(in srgb, var(--type) 40%, var(--surface));
    border-radius: 999px;
    background: color-mix(in srgb, var(--type) 14%, var(--surface));
    color: var(--text);
    font: inherit;
    cursor: pointer;
    transition: background 0.12s, box-shadow 0.12s;
}

.type-item:hover {
    background: color-mix(in srgb, var(--type) 24%, var(--surface));
    box-shadow: 0 2px 6px rgba(16, 24, 40, 0.08);
}

.type-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--type);
}

.type-name {
    font-weight: 600;
}

/* form */
.palette {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.palette-swatch,
.custom-color {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-strong);
    cursor: pointer;
}

.palette-swatch {
    padding: 0;
    border: 2px solid var(--surface);
    background: var(--type);
}

.palette-swatch.on,
.custom-color.on {
    box-shadow: 0 0 0 2px var(--text);
}

.custom-color {
    position: relative;
    overflow: hidden;
    border: 2px solid var(--surface);
    background: conic-gradient(#ef4444, #eab308, #22c55e, #14b8a6, #3b82f6, #a855f7, #ef4444);
}

.custom-color input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    opacity: 0;
    cursor: pointer;
}

.preview {
    display: flex;
    align-items: center;
    gap: 10px;
}

.preview-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.preview-chip {
    padding: 4px 10px;
    border-left: 3px solid var(--type);
    border-radius: 6px;
    background: color-mix(in srgb, var(--type) 20%, var(--surface));
    font-size: 0.85rem;
    font-weight: 600;
}
</style>
