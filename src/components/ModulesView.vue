<template>
    <div class="container panel">
        <div class="panel-head">
            <div>
                <h1>Modules</h1>
                <p class="panel-sub">
                    Reusable activities placed on chosen weekdays, for one week or every week.
                    Click a module to edit or delete it.
                </p>
            </div>
            <button type="button" class="btn-new" @click="openNew">+ New module</button>
        </div>

        <ul v-if="rows.length" class="module-list">
            <li v-for="m in rows" :key="m.id">
                <button type="button" class="module-item" :class="{ typed: m.color }"
                    :style="m.color ? { '--type': m.color } : null" :title="'Edit ' + m.title" @click="openEdit(m.id)">
                    <span class="module-top">
                        <span class="module-title">{{ m.title }}</span>
                        <span v-if="m.typeName" class="type-pill">{{ m.typeName }}</span>
                    </span>
                    <span class="module-meta">
                        <span>{{ m.daysLabel }}</span>
                        <span class="sep">&middot;</span>
                        <span>{{ m.timeLabel }}</span>
                        <span class="sep">&middot;</span>
                        <span :class="{ repeat: m.repeat }">{{ m.repeatLabel }}</span>
                    </span>
                    <span v-if="m.description" class="module-desc">{{ m.description }}</span>
                </button>
            </li>
        </ul>
        <p v-else class="empty">No modules yet.</p>

        <ModalDialog :open="showDialog" :title="editing ? 'Edit module' : 'New module'" @close="closeDialog">
            <form class="modal-form" novalidate @submit.prevent="save">
                <label class="field">
                    <span>Header</span>
                    <input v-model="form.title" type="text" placeholder="e.g. Tempo run" />
                </label>

                <label class="field">
                    <span>Type</span>
                    <select v-model="form.typeId">
                        <option value="">No type</option>
                        <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                    <small v-if="!types.length" class="hint">Create types in the Types view to color-code modules.</small>
                </label>

                <label class="field">
                    <span>Description</span>
                    <textarea v-model="form.description" rows="3" placeholder="What the session contains..."></textarea>
                </label>

                <div class="field">
                    <span>Days</span>
                    <div class="day-picks" role="group" aria-label="Days">
                        <button v-for="(d, i) in WEEKDAY_SHORT" :key="d" type="button" class="day-pick"
                            :class="{ on: form.days.includes(i) }" :aria-pressed="form.days.includes(i)"
                            @click="toggleDay(i)">{{ d }}</button>
                    </div>
                </div>

                <div class="option">
                    <button type="button" role="switch" class="switch" :aria-checked="form.timed"
                        @click="form.timed = !form.timed">
                        <span class="switch-track"><span class="switch-knob"></span></span>
                        <span>Specific time</span>
                    </button>
                    <span class="option-hint">{{ form.timed ? 'Same time on every chosen day' : 'Shown as all day' }}</span>
                </div>
                <div v-if="form.timed" class="field-row">
                    <label class="field">
                        <span>From</span>
                        <input v-model="form.start" type="time" />
                    </label>
                    <label class="field">
                        <span>To</span>
                        <input v-model="form.end" type="time" />
                    </label>
                </div>

                <div class="option">
                    <button type="button" role="switch" class="switch" :aria-checked="form.repeat"
                        @click="form.repeat = !form.repeat">
                        <span class="switch-track"><span class="switch-knob"></span></span>
                        <span>Repeat every week</span>
                    </button>
                    <span class="option-hint">{{ form.repeat ? 'Applied to all weeks' : 'Applied to one week' }}</span>
                </div>
                <div v-if="!form.repeat" class="week-pick">
                    <span class="week-pick-label">Week</span>
                    <button type="button" class="arrow" aria-label="Previous week" @click="form.weekOffset--">&lsaquo;</button>
                    <span class="week-pick-range">{{ formWeekLabel }}</span>
                    <button type="button" class="arrow" aria-label="Next week" @click="form.weekOffset++">&rsaquo;</button>
                </div>

                <p v-if="error" class="form-error" role="alert">{{ error }}</p>

                <div v-if="confirmingDelete" class="confirm-delete" role="alert">
                    <p><strong>Delete "{{ editing.title }}"?</strong> {{ usageText }}</p>
                    <div class="confirm-actions">
                        <button ref="keepButton" type="button" class="btn-secondary" @click="confirmingDelete = false">
                            Keep it
                        </button>
                        <button type="button" class="btn-danger" @click="removeModule">Delete module</button>
                    </div>
                </div>
                <div v-else class="modal-actions">
                    <button v-if="editing" type="button" class="btn-danger-ghost" @click="askDelete">Delete</button>
                    <button type="button" class="btn-secondary" @click="closeDialog">Cancel</button>
                    <button type="submit" class="btn-primary">{{ editing ? 'Save changes' : 'Create module' }}</button>
                </div>
            </form>
        </ModalDialog>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import ModalDialog from './ModalDialog.vue';
import { WEEKDAY_SHORT, dateKey, mondayOf, newId, parseKey } from '../planner.js';

const props = defineProps({
    modules: { type: Array, default: () => [] },
    types: { type: Array, default: () => [] },
    // Only read, to tell the user what deleting a module would affect.
    addedEvents: { type: Array, default: () => [] },
});
const emit = defineEmits(['addModule', 'updateModule', 'deleteModule']);

const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const thisMonday = mondayOf(new Date());
const mondayPlus = (weeks) =>
    new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + weeks * 7);

const weekRange = (monday) => {
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return shortDateFmt.format(monday) + ' – ' + shortDateFmt.format(sunday);
};

const daysLabel = (days) => {
    const key = [...days].sort((a, b) => a - b).join();
    if (days.length === 7) return 'Every day';
    if (key === '0,1,2,3,4') return 'Weekdays';
    if (key === '5,6') return 'Weekends';
    return [...days].sort((a, b) => a - b).map((i) => WEEKDAY_SHORT[i]).join(', ');
};

const rows = computed(() =>
    props.modules.map((m) => {
        const type = props.types.find((t) => t.id === m.typeId);
        return {
            ...m,
            color: type?.color ?? '',
            typeName: type?.name ?? '',
            daysLabel: daysLabel(m.days),
            timeLabel: m.start ? m.start + '–' + m.end : 'All day',
            repeatLabel: m.repeat ? 'Every week' : 'Week of ' + shortDateFmt.format(parseKey(m.weekStart)),
        };
    })
);

/* ---------- create / edit dialog ---------- */

const blankForm = () => ({
    title: '',
    typeId: '',
    description: '',
    days: [],
    timed: false,
    start: '18:00',
    end: '19:00',
    repeat: false,
    weekOffset: 0,
});

// Whole days via UTC so a DST change in between cannot skew the count.
const dayNumber = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
const weeksFromThisMonday = (key) => Math.round((dayNumber(parseKey(key)) - dayNumber(thisMonday)) / 7);

const formFrom = (m) => ({
    title: m.title,
    typeId: m.typeId,
    description: m.description,
    days: [...m.days],
    timed: Boolean(m.start),
    start: m.start || '18:00',
    end: m.end || '19:00',
    repeat: m.repeat,
    weekOffset: m.repeat ? 0 : weeksFromThisMonday(m.weekStart),
});

const showDialog = ref(false);
const editing = ref(null); // the module being edited; null while creating
const confirmingDelete = ref(false);
const keepButton = ref(null);
const error = ref('');
const form = reactive(blankForm());

const formWeekLabel = computed(
    () => weekRange(mondayPlus(form.weekOffset)) + (form.weekOffset === 0 ? ' (this week)' : '')
);

const usageText = computed(() => {
    if (!editing.value) return '';
    const linked = props.addedEvents.filter((e) => e.moduleId === editing.value.id).length;
    return 'It will be removed from every day it is placed on.' +
        (linked ? ' ' + linked + (linked === 1 ? ' activity' : ' activities') + ' linked to it will be unlinked.' : '');
});

const openDialog = (module) => {
    editing.value = module;
    Object.assign(form, module ? formFrom(module) : blankForm());
    error.value = '';
    confirmingDelete.value = false;
    showDialog.value = true;
};

const openNew = () => openDialog(null);
const openEdit = (id) => openDialog(props.modules.find((m) => m.id === id) ?? null);

const closeDialog = () => {
    showDialog.value = false;
};

const askDelete = () => {
    confirmingDelete.value = true;
    // Land on the safe choice, so a stray Enter keeps the module.
    nextTick(() => keepButton.value?.focus());
};

const removeModule = () => {
    emit('deleteModule', editing.value.id);
    closeDialog();
};

const toggleDay = (i) => {
    form.days = form.days.includes(i) ? form.days.filter((d) => d !== i) : [...form.days, i].sort((a, b) => a - b);
};

const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const save = () => {
    const title = form.title.trim();
    const startMin = toMinutes(form.start);
    const endMin = toMinutes(form.end);

    if (!title) error.value = 'Give the module a header.';
    else if (!form.days.length) error.value = 'Pick at least one day.';
    else if (form.timed && (startMin === null || endMin === null))
        error.value = 'Set both a from and a to time, or turn off specific time.';
    else if (form.timed && endMin <= startMin) error.value = 'The to time has to be after the from time.';
    else error.value = '';

    if (error.value) return;

    emit(editing.value ? 'updateModule' : 'addModule', {
        id: editing.value?.id ?? newId(),
        title,
        typeId: form.typeId,
        description: form.description.trim(),
        days: [...form.days],
        start: form.timed ? form.start : '',
        end: form.timed ? form.end : '',
        repeat: form.repeat,
        weekStart: form.repeat ? '' : dateKey(mondayPlus(form.weekOffset)),
    });
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

/* list */
.module-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.module-list li {
    display: flex;
}

.module-item {
    box-sizing: border-box;
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-left: 4px solid var(--chip-border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: box-shadow 0.12s, border-color 0.12s;
}

.module-item:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
}

.module-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

/* Repeated so hover's border-color does not repaint the colored left edge. */
.module-item.typed,
.module-item.typed:hover {
    border-left-color: var(--type);
}

.module-item:not(.typed):hover {
    border-left-color: var(--chip-border);
}

.module-top {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.module-title {
    font-weight: 700;
    overflow-wrap: anywhere;
}

.type-pill {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--type) 18%, var(--surface));
    font-size: 0.72rem;
    font-weight: 600;
}

.type-pill::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--type);
}

.module-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.8rem;
    color: var(--text-muted);
}

.module-meta .repeat {
    font-weight: 600;
    color: var(--accent-text);
}

.module-desc {
    display: -webkit-box;
    margin: 6px 0 0;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-size: 0.85rem;
    color: var(--text-label);
    white-space: pre-line;
}

/* form */
.day-picks {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
}

.day-pick {
    padding: 10px 0;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.day-pick:hover {
    border-color: var(--text-faint);
}

.day-pick.on {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
}

.option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.option-hint {
    font-size: 0.78rem;
    color: var(--text-muted);
}

.switch {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
}

.switch-track {
    position: relative;
    flex: none;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: var(--border-strong);
    transition: background 0.15s;
}

.switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s;
}

.switch[aria-checked='true'] .switch-track {
    background: var(--accent);
}

.switch[aria-checked='true'] .switch-knob {
    transform: translateX(16px);
}

.switch:focus-visible .switch-track {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

.week-pick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface-muted);
}

.week-pick-label {
    margin-right: auto;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.week-pick-range {
    min-width: 170px;
    font-size: 0.9rem;
    text-align: center;
}

.arrow {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
}

.arrow:hover {
    background: var(--surface-hover);
}
</style>
