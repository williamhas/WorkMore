<template>
    <div class="transfer">
        <button type="button" class="btn-quiet" title="Add events from an .ics calendar file" @click="pickFile">
            <i class="pi pi-upload" aria-hidden="true"></i>Import
        </button>
        <button type="button" class="btn-quiet" :disabled="!hasContent"
            :title="hasContent ? 'Download the calendar as an .ics file' : 'Nothing to export yet'" @click="exportIcs">
            <i class="pi pi-download" aria-hidden="true"></i>Export
        </button>
        <input ref="fileInput" type="file" accept=".ics,text/calendar" hidden @change="onFile" />

        <ModalDialog :open="dialogOpen" :title="done ? 'Calendar imported' : 'Import calendar'" @close="close">
            <div class="modal-form">
                <p v-if="fileName" class="file"><i class="pi pi-file" aria-hidden="true"></i>{{ fileName }}</p>

                <p v-if="readError" class="form-error" role="alert">{{ readError }}</p>

                <template v-else-if="plan">
                    <p v-if="done" class="done" role="status">
                        <i class="pi pi-check-circle" aria-hidden="true"></i>
                        Added {{ summaryParts.join(' and ') }} to your calendar.
                    </p>
                    <template v-else>
                        <ul v-if="total" class="summary">
                            <li v-if="plan.activities.length">
                                <strong>{{ plural(plan.activities.length, 'activity', 'activities') }}</strong>
                                <span v-if="plan.firstDate" class="muted">{{ dateRange }}</span>
                            </li>
                            <li v-if="plan.modules.length">
                                <strong>{{ plural(plan.modules.length, 'weekly module', 'weekly modules') }}</strong>
                                <span class="muted">{{ plan.modules.map((m) => m.title).join(', ') }}</span>
                            </li>
                            <li v-if="plan.types.length">
                                <strong>{{ plural(plan.types.length, 'new type', 'new types') }}</strong>
                                <span class="type-chips">
                                    <span v-for="t in plan.types" :key="t.id" class="type-chip" :style="{ '--type': t.color }">{{ t.name }}</span>
                                </span>
                            </li>
                        </ul>
                        <p v-else class="empty">Nothing new to import.</p>

                        <ul v-if="notes.length" class="notes">
                            <li v-for="n in notes" :key="n">{{ n }}</li>
                        </ul>
                        <p v-if="total" class="tz">Times are shown in {{ timeZone }}.</p>
                    </template>
                </template>

                <div class="modal-actions">
                    <template v-if="plan && !done && !readError && total">
                        <button type="button" class="btn-secondary" @click="close">Cancel</button>
                        <button type="button" class="btn-primary" @click="confirm">Import {{ plural(total, 'item', 'items') }}</button>
                    </template>
                    <button v-else type="button" class="btn-primary" @click="close">Close</button>
                </div>
            </div>
        </ModalDialog>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ModalDialog from './ModalDialog.vue';
import { MAX_IMPORT, buildIcs, icsEventCount, planImport } from '../ical.js';
import { dateKey, parseKey } from '../planner.js';

const props = defineProps({
    addedEvents: { type: Array, default: () => [] },
    modules: { type: Array, default: () => [] },
    types: { type: Array, default: () => [] },
});
const emit = defineEmits(['import']);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const fileInput = ref(null);
const dialogOpen = ref(false);
const fileName = ref('');
const readError = ref('');
const plan = ref(null);
const done = ref(false);

const planner = () => ({ addedEvents: props.addedEvents, modules: props.modules, types: props.types });
const hasContent = computed(() => icsEventCount(planner()) > 0);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your time zone';

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/* ---------- export ---------- */

const exportIcs = () => {
    const blob = new Blob([buildIcs(planner())], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workmore-' + dateKey(new Date()) + '.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ---------- import ---------- */

const total = computed(() => (plan.value ? plan.value.activities.length + plan.value.modules.length : 0));

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateRange = computed(() => {
    const { firstDate, lastDate } = plan.value;
    const first = dateFmt.format(parseKey(firstDate));
    return firstDate === lastDate ? first : first + ' – ' + dateFmt.format(parseKey(lastDate));
});

const summaryParts = computed(() =>
    [
        plan.value.activities.length && plural(plan.value.activities.length, 'activity', 'activities'),
        plan.value.modules.length && plural(plan.value.modules.length, 'weekly module', 'weekly modules'),
    ].filter(Boolean)
);

// What will not come in exactly as it was, so nothing is dropped silently.
const notes = computed(() => {
    const c = plan.value?.counts;
    if (!c) return [];
    return [
        c.duplicates && plural(c.duplicates, 'entry is', 'entries are') + ' already in your calendar and will be skipped.',
        c.firstOnly && plural(c.firstOnly, 'repeating event repeats', 'repeating events repeat') + ' in a way WorkMore cannot (for example every other week), so only the first date is imported.',
        c.clamped && plural(c.clamped, 'event runs', 'events run') + ' past midnight and will end at 23:59.',
        c.unreadable && plural(c.unreadable, 'event has', 'events have') + ' no readable date and will be skipped.',
        c.overLimit && plural(c.overLimit, 'entry is', 'entries are') + ' over the limit of ' + MAX_IMPORT + ' per import and will be skipped.',
    ].filter(Boolean);
});

const pickFile = () => fileInput.value?.click();

const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still works
    if (!file) return;

    fileName.value = file.name;
    readError.value = '';
    plan.value = null;
    done.value = false;
    dialogOpen.value = true;

    if (file.size > MAX_FILE_BYTES) {
        readError.value = 'That file is over 5 MB. Export a shorter date range from your other calendar.';
        return;
    }
    try {
        plan.value = planImport(await file.text(), planner());
    } catch (e) {
        readError.value = e.message || 'Could not read that file.';
    }
};

const confirm = () => {
    emit('import', { types: plan.value.types, modules: plan.value.modules, activities: plan.value.activities });
    done.value = true;
};

const close = () => {
    dialogOpen.value = false;
};
</script>

<style scoped>
.transfer {
    display: flex;
    gap: 6px;
}

.btn-quiet {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
}

.btn-quiet .pi {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.btn-quiet:hover:not(:disabled) {
    background: var(--surface-hover);
}

.btn-quiet:disabled {
    opacity: 0.5;
    cursor: default;
}

.btn-quiet:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

/* dialog content (the dialog frame and buttons come from ModalDialog) */
.file {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
    overflow-wrap: anywhere;
}

.summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.summary li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
}

.muted {
    font-size: 0.85rem;
    color: var(--text-muted);
    overflow-wrap: anywhere;
}

.type-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.type-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--type) 18%, var(--surface));
    font-size: 0.78rem;
    font-weight: 600;
}

.type-chip::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--type);
}

.notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 10px 12px 10px 28px;
    border-radius: 8px;
    background: var(--surface-muted);
    font-size: 0.85rem;
    color: var(--text-label);
}

.empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    color: var(--text-muted);
    text-align: center;
}

.tz {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-faint);
}

.done {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 12px;
    border-radius: 10px;
    background: color-mix(in srgb, #22c55e 14%, var(--surface));
    font-weight: 600;
}

.done .pi {
    color: #16a34a;
    font-size: 1.2rem;
}
</style>
