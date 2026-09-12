<template>
    <div class="container calendar">
        <div class="cal-head">
            <h1>Calendar</h1>
            <span class="week-label">{{ rangeLabel }} &middot; program week {{ shownWeekNumber }}</span>
            <div class="nav">
                <button class="arrow" type="button" aria-label="Previous week" @click="shiftWeek(-1)">&lsaquo;</button>
                <button class="arrow" type="button" aria-label="Next week" @click="shiftWeek(1)">&rsaquo;</button>
            </div>
        </div>

        <div class="cal-scroll">
            <div class="cal" :style="{ '--hour-height': hourHeight + 'px' }">
                <!-- header row -->
                <div class="corner"></div>
                <div v-for="day in days" :key="'h-' + day.key" class="day-head" :class="{ today: day.isToday }">
                    <span class="day-name">{{ day.name }}</span>
                    <span class="day-date">{{ day.dateLabel }}</span>
                </div>

                <!-- untimed row -->
                <div class="corner allday-corner">all day</div>
                <div v-for="day in days" :key="'a-' + day.key" class="allday-cell" :class="{ today: day.isToday }">
                    <div v-for="(ev, i) in day.allDay" :key="i" class="chip"
                        :class="{ typed: ev.color, clickable: ev.source }"
                        :style="ev.color ? { '--type': ev.color } : null" :title="eventTooltip(ev)"
                        :role="ev.source ? 'button' : undefined" :tabindex="ev.source ? 0 : undefined"
                        @click="openEntry(ev)" @keydown.enter.prevent="openEntry(ev)"
                        @keydown.space.prevent="openEntry(ev)">{{ ev.title }}</div>
                </div>

                <!-- hour labels -->
                <div class="gutter">
                    <div v-for="h in hours" :key="h" class="hour-label"><span>{{ hourLabel(h) }}</span></div>
                </div>

                <!-- day columns -->
                <div v-for="day in days" :key="'c-' + day.key" class="day-col" :class="{ today: day.isToday }">
                    <div v-for="h in hours" :key="h" class="hour-cell"></div>

                    <!-- Imported program text has no source and stays read-only; everything else opens. -->
                    <div v-for="(ev, i) in day.timed" :key="i" class="event"
                        :class="{ typed: ev.color, clickable: ev.source }" :style="eventStyle(ev)"
                        :title="eventTooltip(ev)" :role="ev.source ? 'button' : undefined"
                        :tabindex="ev.source ? 0 : undefined" @click="openEntry(ev)"
                        @keydown.enter.prevent="openEntry(ev)" @keydown.space.prevent="openEntry(ev)">
                        <span class="event-time">{{ ev.timeLabel }}</span>
                        <span class="event-title">{{ ev.title }}</span>
                    </div>

                    <div v-if="day.isToday && nowOffset !== null" class="now-line" :style="{ top: nowOffset + 'px' }">
                    </div>
                </div>
            </div>
        </div>

        <div class="cal-foot">
            <CalendarTransfer :addedEvents="addedEvents" :modules="modules" :types="types"
                @import="emit('importItems', $event)" />
            <button class="add-btn" type="button" @click="openAdd">+ Add to calendar</button>
        </div>

        <Teleport to="body">
            <div v-if="showAdd" class="overlay" @click.self="closeAdd" @keydown.esc="closeAdd">
                <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-event-heading" novalidate
                    @submit.prevent="submitAdd">
                    <h2 id="add-event-heading">{{ form.editingId ? 'Edit activity' : 'Add to calendar' }}</h2>

                    <!-- Editing keeps an entry's kind, so the tabs are only for adding. -->
                    <div v-if="!form.editingId" class="mode-tabs" role="tablist" aria-label="What to add">
                        <button type="button" role="tab" class="mode-tab" :class="{ on: form.mode === 'new' }"
                            :aria-selected="form.mode === 'new'" @click="setMode('new')">New activity</button>
                        <button type="button" role="tab" class="mode-tab" :class="{ on: form.mode === 'module' }"
                            :aria-selected="form.mode === 'module'" @click="setMode('module')">From module</button>
                    </div>

                    <!-- A module placement starts from the module; nothing else is shown until one is picked. -->
                    <template v-if="form.mode === 'module'">
                        <p v-if="!modules.length" class="mode-empty">
                            No modules yet. Create one in the Modules view, then place it from here.
                        </p>

                        <template v-else>
                            <label v-if="!form.editingId" class="field">
                                <span>Module</span>
                                <select ref="moduleSelect" v-model="form.moduleId" @change="applyModule">
                                    <option value="" disabled>Choose a module</option>
                                    <option v-for="m in modules" :key="m.id" :value="m.id">{{ m.title }}</option>
                                </select>
                            </label>

                            <div v-if="chosenModule" class="module-summary">
                                <template v-if="form.editingId">
                                    <span class="summary-label">Module</span>
                                    <span class="summary-module">{{ chosenModule.title }}</span>
                                </template>
                                <span class="summary-label">Type</span>
                                <span v-if="chosenModuleType" class="type-pill"
                                    :style="{ '--type': chosenModuleType.color }">{{ chosenModuleType.name }}</span>
                                <span v-else class="summary-none">No type</span>
                                <span class="summary-note">set by the module</span>
                            </div>
                        </template>
                    </template>

                    <template v-if="form.mode === 'new' || chosenModule">
                        <label class="field">
                            <span>Header</span>
                            <input ref="titleInput" v-model="form.title" type="text" placeholder="e.g. Intervaller 6x800m" />
                        </label>

                        <label class="field">
                            <span>Date</span>
                            <input v-model="form.date" type="date" />
                        </label>

                        <div v-if="timeOptional" class="option">
                            <button type="button" role="switch" class="switch" :aria-checked="form.timed"
                                @click="form.timed = !form.timed">
                                <span class="switch-track"><span class="switch-knob"></span></span>
                                <span>Specific time</span>
                            </button>
                            <span class="option-hint">{{ form.timed ? 'Only for this day' : 'Shown as all day' }}</span>
                        </div>

                        <div v-if="!timeOptional || form.timed" class="field-row">
                            <label class="field">
                                <span>From</span>
                                <input v-model="form.start" type="time" />
                            </label>
                            <label class="field">
                                <span>To</span>
                                <input v-model="form.end" type="time" />
                            </label>
                        </div>

                        <label v-if="form.mode === 'new'" class="field">
                            <span>
                                Type
                                <i v-if="formTypeColor" class="swatch" :style="{ background: formTypeColor }"></i>
                            </span>
                            <select v-model="form.typeId">
                                <option value="">No type</option>
                                <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
                            </select>
                        </label>

                        <label class="field">
                            <span>Description</span>
                            <textarea v-model="form.description" rows="4" placeholder="Details, notes, links..."></textarea>
                        </label>
                    </template>

                    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

                    <div v-if="confirmingDelete" class="confirm-delete" role="alert">
                        <p><strong>Delete "{{ form.title.trim() || 'this activity' }}"?</strong> It is removed from the calendar.</p>
                        <div class="confirm-actions">
                            <button ref="keepButton" type="button" class="btn-secondary" @click="confirmingDelete = false">
                                Keep it
                            </button>
                            <button type="button" class="btn-danger" @click="removeEntry">Delete</button>
                        </div>
                    </div>
                    <div v-else class="dialog-actions">
                        <button v-if="form.editingId" type="button" class="btn-danger-ghost" @click="askDelete">Delete</button>
                        <button type="button" class="btn-secondary" @click="closeAdd">Cancel</button>
                        <button type="submit" class="btn-primary" :disabled="form.mode === 'module' && !modules.length">
                            {{ form.editingId ? 'Save changes' : 'Add' }}
                        </button>
                    </div>
                </form>
            </div>

            <!-- A module's days are generated from the module, so they are changed there. -->
            <div v-if="moduleInfo" class="overlay" @click.self="moduleInfo = null" @keydown.esc="moduleInfo = null">
                <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="module-info-heading">
                    <h2 id="module-info-heading">{{ moduleInfo.title }}</h2>
                    <div class="info-meta">
                        <span v-if="moduleInfo.type" class="type-pill" :style="{ '--type': moduleInfo.type.color }">
                            {{ moduleInfo.type.name }}
                        </span>
                        <span>{{ moduleInfo.when }}</span>
                    </div>
                    <p v-if="moduleInfo.description" class="info-desc">{{ moduleInfo.description }}</p>
                    <p class="info-note">
                        <i class="pi pi-info-circle" aria-hidden="true"></i>
                        This comes from a module, so it appears on every day the module is placed. Edit the module to
                        change it.
                    </p>
                    <div class="dialog-actions">
                        <button ref="infoCloseButton" type="button" class="btn-secondary" @click="moduleInfo = null">Close</button>
                        <button type="button" class="btn-primary" @click="editModule">Edit module</button>
                    </div>
                </section>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import CalendarTransfer from './CalendarTransfer.vue';
import { WEEKDAY_SHORT, activitiesOn, parseKey } from '../planner.js';

const props = defineProps({
    weekNumber: Number,
    // Accepts plain strings (one per day, starting today - what Importcal emits)
    // or objects: { title, date|day, start, end, description, module }
    events: { type: Array, default: () => [] },
    // Entries from the "Add to calendar" dialog, owned by App.vue. Kept apart from
    // `events` because string events there are placed by their array index.
    addedEvents: { type: Array, default: () => [] },
    types: { type: Array, default: () => [] },
    modules: { type: Array, default: () => [] },
    startHour: { type: Number, default: 6 },
    endHour: { type: Number, default: 22 },
});

const emit = defineEmits(['addEvent', 'updateEvent', 'deleteEvent', 'importItems']);

const router = useRouter();

const hourHeight = 52;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_DURATION = 60;

/* ---------- the Monday..Sunday window ---------- */

const today = new Date();
const todayIndex = (today.getDay() + 6) % 7; // 0 = Monday
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const currentWeekMonday = (() => {
    const d = new Date(todayMidnight);
    d.setDate(d.getDate() - todayIndex);
    return d;
})();

// Whole weeks away from the current one; the arrows move this.
const weekOffset = ref(0);
const shiftWeek = (delta) => {
    weekOffset.value += delta;
};

const startOfWeek = computed(() => {
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + weekOffset.value * 7);
    return d;
});

const dateForIndex = (index) => {
    const d = new Date(startOfWeek.value);
    d.setDate(d.getDate() + index);
    return d;
};

const dateKey = (d) =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');

const todayKey = dateKey(todayMidnight);

const dateFromOffset = (offset) => {
    const d = new Date(todayMidnight);
    d.setDate(d.getDate() + offset);
    return d;
};

// A training program advances one week per calendar week.
const shownWeekNumber = computed(() => (props.weekNumber ?? 0) + weekOffset.value);

const dayNameFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const rangeLabel = computed(
    () => dateFmt.format(dateForIndex(0)) + ' - ' + dateFmt.format(dateForIndex(6))
);

/* ---------- turning raw input into placeable events ---------- */

// A time needs explicit minutes ("18:30") or a "kl" prefix, so a training line
// like "10-15 km" is never read as 10:00-15:00.
const TIME_PATTERNS = [
    { re: /(\d{1,2})[:.](\d{2})\s*(?:[-–—]|till|to)\s*(\d{1,2})(?:[:.](\d{2}))?/i, range: true },
    { re: /\bkl\.?\s*(\d{1,2})(?:[:.](\d{2}))?/i, range: false },
    { re: /(\d{1,2})[:.](\d{2})/, range: false },
];

// "3.30 min/km" is a pace, not a start time.
const PACE_SUFFIX = /^\s*(?:min\b|\/\s*km\b|min\s*\/\s*km\b)/i;

const toMinutes = (h, m) => Number(h) * 60 + Number(m || 0);
const inDay = (min) => Number.isFinite(min) && min >= 0 && min < MINUTES_PER_DAY;

// Earliest time reference in `text`, preferring the longest match at that
// position so "18:00-19:30" wins over the bare "18:00" inside it.
const findTime = (text) => {
    let best = null;

    for (const { re, range } of TIME_PATTERNS) {
        const m = text.match(re);
        if (!m) continue;

        const startMin = toMinutes(m[1], m[2]);
        if (!inDay(startMin)) continue;
        if (PACE_SUFFIX.test(text.slice(m.index + m[0].length))) continue;

        let endMin = range ? toMinutes(m[3], m[4]) : startMin + DEFAULT_DURATION;
        if (!Number.isFinite(endMin) || endMin <= startMin || endMin > MINUTES_PER_DAY) {
            endMin = Math.min(MINUTES_PER_DAY, startMin + DEFAULT_DURATION);
        }

        const better =
            !best || m.index < best.index || (m.index === best.index && m[0].length > best.length);
        if (better) best = { index: m.index, length: m[0].length, startMin, endMin };
    }

    return best;
};

const clean = (text) =>
    text
        .replace(/\s+/g, ' ')
        .replace(/^[\s,;:.·–—-]+|[\s,;:·–—-]+$/g, '')
        .trim();

// One spreadsheet cell can hold several sessions ("09:00 Styrka, 09:30 Simning"),
// so cut the line at every time reference after the first.
const splitByTimes = (line) => {
    const marks = [];
    let pos = 0;

    while (pos < line.length) {
        const found = findTime(line.slice(pos));
        if (!found) break;
        marks.push({
            start: pos + found.index,
            end: pos + found.index + found.length,
            startMin: found.startMin,
            endMin: found.endMin,
        });
        pos = pos + found.index + found.length;
    }

    if (!marks.length) return [{ title: clean(line) || line, allDay: true }];

    const prefix = line.slice(0, marks[0].start);
    return marks.map((mark, i) => {
        const bodyEnd = i + 1 < marks.length ? marks[i + 1].start : line.length;
        const body = line.slice(mark.end, bodyEnd);
        const title = clean(i === 0 ? prefix + ' ' + body : body);
        return { title: title || clean(line), startMin: mark.startMin, endMin: mark.endMin };
    });
};

// "18:30" | 1110 | Date -> minutes past midnight
const minutesOf = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
    if (typeof value === 'number') return inDay(value) ? value : null;
    const m = String(value).match(/(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const min = toMinutes(m[1], m[2]);
    return inDay(min) ? min : null;
};

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Every event gets a real date, so the week arrows can only ever surface the
// events that actually belong to the week on screen. A bare weekday name has no
// year attached, so it resolves within the current week.
const weekdayDate = (index) => {
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + index);
    return d;
};

const dateKeyOf = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : dateKey(value);
    if (typeof value === 'number') return value >= 0 && value < 7 ? dateKey(weekdayDate(value)) : null;

    // "2026-09-10" is already a key. Passing it through new Date() would parse it
    // as UTC midnight, which lands on the previous day anywhere west of UTC.
    if (ISO_DATE.test(String(value).trim())) return String(value).trim();

    const name = String(value).trim().toLowerCase();
    if (name.length >= 3) {
        const byName = WEEKDAYS.findIndex((d) => d.startsWith(name.slice(0, 3)));
        if (byName !== -1) return dateKey(weekdayDate(byName));
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : dateKey(parsed);
};

const normalizeObject = (raw) => {
    const key = dateKeyOf(raw.date ?? raw.day ?? raw.dayIndex);
    if (key === null) return null;
    const title = String(raw.title ?? raw.text ?? raw.name ?? '').trim();
    if (!title) return null;

    const details = {
        description: String(raw.description ?? '').trim(),
        module: String(raw.module ?? '').trim(),
    };

    const startMin = minutesOf(raw.start ?? raw.startTime ?? raw.from);
    if (startMin === null) return { key, title, allDay: true, ...details };

    const endMin = minutesOf(raw.end ?? raw.endTime ?? raw.to);
    return {
        key,
        title,
        startMin,
        endMin:
            endMin !== null && endMin > startMin
                ? endMin
                : Math.min(MINUTES_PER_DAY, startMin + DEFAULT_DURATION),
        ...details,
    };
};

const normalized = computed(() => {
    const out = [];

    props.events.forEach((raw, index) => {
        if (raw == null) return;

        if (typeof raw === 'object') {
            const ev = normalizeObject(raw);
            if (ev) out.push(ev);
            return;
        }

        const text = String(raw).trim();
        if (!text || text === '...') return; // App.vue's pre-import placeholder

        // Importcal emits one entry per day, starting with today.
        const key = dateKey(dateFromOffset(index));
        for (const line of text.split(/\s*[\n;]+\s*/)) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            for (const part of splitByTimes(trimmed)) out.push({ key, ...part });
        }
    });

    return out;
});

// Only the week on screen, so a late session in another week cannot stretch this
// week's hour range.
const weekKeys = computed(() => Array.from({ length: 7 }, (_, i) => dateKey(dateForIndex(i))));

// Added activities and module occurrences for the week on screen. Weekly modules
// never end, so they are expanded per visible day rather than stored as a list.
const plannedEvents = computed(() =>
    weekKeys.value.flatMap((key) =>
        activitiesOn(key, { addedEvents: props.addedEvents, modules: props.modules, types: props.types })
            .map((a) => {
                const ev = normalizeObject({
                    date: key,
                    title: a.title,
                    start: a.start,
                    end: a.end,
                    description: a.description,
                    module: a.moduleName,
                });
                // source/activityId/moduleId say what a click on the box should open.
                return ev && {
                    ...ev,
                    typeName: a.type?.name ?? '',
                    color: a.type?.color ?? '',
                    source: a.source,
                    activityId: a.id ?? '',
                    moduleId: a.moduleId ?? '',
                };
            })
            .filter(Boolean)
    )
);

const visibleEvents = computed(() => {
    const keys = weekKeys.value;
    return [...normalized.value.filter((e) => keys.includes(e.key)), ...plannedEvents.value];
});

const timedEvents = computed(() => visibleEvents.value.filter((e) => !e.allDay));

/* ---------- visible hour range ---------- */

const clampHour = (h) => Math.min(24, Math.max(0, Math.floor(Number(h) || 0)));

// Grows past startHour/endHour when an event falls outside them, so nothing is hidden.
const range = computed(() => {
    let start = clampHour(props.startHour);
    let end = clampHour(props.endHour);
    if (end <= start) {
        start = 0;
        end = 24;
    }
    for (const ev of timedEvents.value) {
        start = Math.min(start, Math.floor(ev.startMin / 60));
        end = Math.max(end, Math.ceil(ev.endMin / 60));
    }
    return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
});

const hours = computed(() => {
    const list = [];
    for (let h = range.value.start; h < range.value.end; h++) list.push(h);
    return list;
});

const pad = (n) => String(n).padStart(2, '0');
const hourLabel = (h) => pad(h) + ':00';
const timeLabel = (min) => pad(Math.floor(min / 60)) + ':' + pad(min % 60);

/* ---------- side-by-side placement for overlapping events ---------- */

// Groups events into clusters of overlap, then splits each cluster's width across
// the lanes it needs, so two sessions at the same hour sit next to each other.
const layout = (events) => {
    const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const placed = [];
    let cluster = [];
    let lanes = [];
    let clusterEnd = -1;

    const flush = () => {
        for (const ev of cluster) ev.lanes = lanes.length;
        placed.push(...cluster);
        cluster = [];
        lanes = [];
        clusterEnd = -1;
    };

    for (const ev of sorted) {
        if (cluster.length && ev.startMin >= clusterEnd) flush();

        let lane = lanes.findIndex((end) => end <= ev.startMin);
        if (lane === -1) {
            lane = lanes.length;
            lanes.push(ev.endMin);
        } else {
            lanes[lane] = ev.endMin;
        }

        cluster.push({
            ...ev,
            lane,
            timeLabel: timeLabel(ev.startMin) + ' - ' + timeLabel(ev.endMin),
        });
        clusterEnd = Math.max(clusterEnd, ev.endMin);
    }
    if (cluster.length) flush();

    return placed;
};

const days = computed(() =>
    Array.from({ length: 7 }, (_, index) => {
        const date = dateForIndex(index);
        const key = dateKey(date);
        const mine = visibleEvents.value.filter((e) => e.key === key);
        return {
            key,
            name: dayNameFmt.format(date),
            dateLabel: dateFmt.format(date),
            isToday: key === todayKey,
            allDay: mine.filter((e) => e.allDay),
            timed: layout(mine.filter((e) => !e.allDay)),
        };
    })
);

const eventStyle = (ev) => ({
    top: ((ev.startMin - range.value.start * 60) / 60) * hourHeight + 'px',
    height: Math.max(24, ((ev.endMin - ev.startMin) / 60) * hourHeight - 3) + 'px',
    left: 'calc(' + (ev.lane / ev.lanes) * 100 + '% + 2px)',
    width: 'calc(' + (1 / ev.lanes) * 100 + '% - 4px)',
    ...(ev.color ? { '--type': ev.color } : {}),
});

/* ---------- "now" marker ---------- */

const nowMinutes = ref(today.getHours() * 60 + today.getMinutes());
let timer = null;

onMounted(() => {
    timer = setInterval(() => {
        const d = new Date();
        nowMinutes.value = d.getHours() * 60 + d.getMinutes();
    }, 60000);
});
onBeforeUnmount(() => clearInterval(timer));

const nowOffset = computed(() => {
    const { start, end } = range.value;
    if (nowMinutes.value < start * 60 || nowMinutes.value > end * 60) return null;
    return ((nowMinutes.value - start * 60) / 60) * hourHeight;
});

const eventTooltip = (ev) =>
    [
        ev.timeLabel ? ev.timeLabel + ' ' + ev.title : ev.title,
        ev.typeName && 'Type: ' + ev.typeName,
        ev.module && ev.module !== ev.title && 'Module: ' + ev.module,
        ev.description,
    ]
        .filter(Boolean)
        .join('\n');

/* ---------- "Add to calendar" / "Edit activity" dialog ---------- */

const showAdd = ref(false);
const titleInput = ref(null);
const moduleSelect = ref(null);
const keepButton = ref(null);
const formError = ref('');
const confirmingDelete = ref(false);
// mode 'new' is a one-off activity; 'module' places an existing module on a day.
// editingId is set when an existing activity was opened from the calendar.
const form = reactive({
    editingId: '',
    mode: 'new',
    title: '',
    date: '',
    start: '',
    end: '',
    timed: true,
    description: '',
    typeId: '',
    moduleId: '',
});

const formTypeColor = computed(() => props.types.find((t) => t.id === form.typeId)?.color ?? '');

// New activities need a time. Module placements, and anything being edited, may be
// all day instead, so they get the "Specific time" switch.
const timeOptional = computed(() => form.mode === 'module' || Boolean(form.editingId));

const chosenModule = computed(() => props.modules.find((m) => m.id === form.moduleId) ?? null);
const chosenModuleType = computed(() => props.types.find((t) => t.id === chosenModule.value?.typeId) ?? null);

const focusFirstField = () =>
    nextTick(() => (form.mode === 'module' && moduleSelect.value ? moduleSelect.value : titleInput.value)?.focus());

// Each tab starts clean; only the date and times carry across.
const setMode = (mode) => {
    if (form.mode === mode) return;
    Object.assign(form, { mode, title: '', description: '', typeId: '', moduleId: '', timed: true });
    formError.value = '';
    focusFirstField();
};

// Picking a module fills in its details. Header, description and time stay editable.
const applyModule = () => {
    const m = chosenModule.value;
    if (!m) return;
    form.title = m.title;
    form.description = m.description;
    form.timed = Boolean(m.start);
    if (m.start) {
        form.start = m.start;
        form.end = m.end;
    }
};

const openAdd = () => {
    // Default to today when it is on screen, otherwise the Monday being viewed.
    const onToday = weekKeys.value.includes(todayKey);
    const hour = onToday ? Math.min(22, new Date().getHours() + 1) : 9;

    Object.assign(form, {
        editingId: '',
        mode: 'new',
        title: '',
        date: onToday ? todayKey : weekKeys.value[0],
        start: pad(hour) + ':00',
        end: pad(hour + 1) + ':00',
        timed: true,
        description: '',
        typeId: '',
        moduleId: '',
    });
    formError.value = '';
    confirmingDelete.value = false;
    showAdd.value = true;
    focusFirstField();
};

const closeAdd = () => {
    showAdd.value = false;
    confirmingDelete.value = false;
};

// Opens a saved activity (a booking, a one-off, or a module placement) for editing.
const openEdit = (id) => {
    const entry = props.addedEvents.find((e) => e.id === id);
    if (!entry) return;
    const linked = props.modules.some((m) => m.id === entry.moduleId);

    Object.assign(form, {
        editingId: entry.id,
        mode: linked ? 'module' : 'new',
        title: entry.title,
        date: entry.date,
        start: entry.start || '09:00',
        end: entry.end || '10:00',
        timed: Boolean(entry.start),
        description: entry.description ?? '',
        typeId: entry.typeId ?? '',
        moduleId: linked ? entry.moduleId : '',
    });
    formError.value = '';
    confirmingDelete.value = false;
    showAdd.value = true;
    focusFirstField();
};

const askDelete = () => {
    confirmingDelete.value = true;
    // Land on the safe choice, so a stray Enter keeps the activity.
    nextTick(() => keepButton.value?.focus());
};

const removeEntry = () => {
    emit('deleteEvent', form.editingId);
    closeAdd();
};

/* ---------- clicking a box in the calendar ---------- */

const moduleInfo = ref(null);
const infoCloseButton = ref(null);
const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const openModuleInfo = (moduleId) => {
    const m = props.modules.find((x) => x.id === moduleId);
    if (!m) return;
    const days = [...m.days].sort((a, b) => a - b).map((i) => WEEKDAY_SHORT[i]).join(', ');
    const time = m.start ? m.start + '–' + m.end : 'All day';
    const repeat = m.repeat ? 'every week' : 'week of ' + shortDateFmt.format(parseKey(m.weekStart));
    moduleInfo.value = {
        id: m.id,
        title: m.title,
        type: props.types.find((t) => t.id === m.typeId) ?? null,
        when: days + ' · ' + time + ' · ' + repeat,
        description: m.description,
    };
    nextTick(() => infoCloseButton.value?.focus());
};

const openEntry = (ev) => {
    if (ev.source === 'added') openEdit(ev.activityId);
    else if (ev.source === 'module') openModuleInfo(ev.moduleId);
};

// Opens that module's editor on the Types & Modules page.
const editModule = () => {
    const id = moduleInfo.value?.id;
    moduleInfo.value = null;
    if (id) router.push({ name: 'library', query: { editModule: id } });
};

const localDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Whole days via UTC so a DST change between the two dates cannot skew the count.
const dayNumber = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;

const submitAdd = () => {
    const fromModule = form.mode === 'module';
    const timed = !timeOptional.value || form.timed;
    const title = form.title.trim();
    const startMin = minutesOf(form.start);
    const endMin = minutesOf(form.end);

    if (fromModule && !chosenModule.value) formError.value = 'Choose a module.';
    else if (!title) formError.value = 'Give it a header.';
    else if (!ISO_DATE.test(form.date)) formError.value = 'Pick a date.';
    else if (timed && (startMin === null || endMin === null)) formError.value = 'Set both a from and a to time.';
    else if (timed && endMin <= startMin) formError.value = 'The to time has to be after the from time.';
    else formError.value = '';

    if (formError.value) return;

    const fields = {
        title,
        date: form.date,
        start: timed ? form.start : '',
        end: timed ? form.end : '',
        description: form.description.trim(),
        // A module placement keeps no type of its own, so it follows the module's
        // type even if that is changed later (see activitiesOn in planner.js).
        typeId: fromModule ? '' : form.typeId,
        moduleId: fromModule ? form.moduleId : '',
    };
    if (form.editingId) emit('updateEvent', { id: form.editingId, ...fields });
    else emit('addEvent', fields);

    // Jump to the entry's week, so a new or moved entry does not vanish off screen.
    const date = localDate(form.date);
    const monday = dayNumber(date) - ((date.getDay() + 6) % 7);
    weekOffset.value = Math.round((monday - dayNumber(currentWeekMonday)) / 7);

    closeAdd();
};
</script>

<style scoped>
.calendar {
    background: var(--surface);
    border-radius: 10px;
    padding: 16px;
    color: var(--text);
    text-align: left;
}

.cal-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 12px;
}

.cal-head h1 {
    margin: 0;
    font-size: 1.4rem;
}

.week-label {
    color: var(--text-muted);
    font-size: 0.9rem;
}

.nav {
    display: flex;
    gap: 6px;
    margin-left: auto;
}

.arrow {
    width: 30px;
    height: 30px;
    padding: 0;
    line-height: 1;
    font-size: 1.1rem;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
}

.arrow:hover {
    background: var(--surface-hover);
}

.cal-scroll {
    overflow-x: auto;
}

.cal {
    display: grid;
    grid-template-columns: 58px repeat(7, minmax(120px, 1fr));
    grid-template-rows: auto auto 1fr;
    min-width: 760px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
}

/* header row */
.corner {
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
}

.allday-corner {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 4px 6px;
    font-size: 0.7rem;
    color: var(--text-faint);
}

.day-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border-faint);
}

.day-head:last-of-type {
    border-right: none;
}

.day-name {
    font-weight: 600;
    font-size: 0.85rem;
}

.day-date {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.day-head.today .day-name,
.day-head.today .day-date {
    color: var(--accent-text);
}

/* untimed strip */
.allday-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 30px;
    padding: 4px;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border-faint);
}

.allday-cell:last-of-type {
    border-right: none;
}

.allday-cell.today {
    background: var(--today-col);
}

.chip {
    background: var(--chip-bg);
    color: var(--chip-text);
    border-left: 3px solid var(--chip-accent);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 0.75rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
}

/* time gutter */
.gutter {
    background: var(--surface-muted);
    border-right: 1px solid var(--border);
}

.hour-label {
    position: relative;
    height: var(--hour-height);
}

.hour-label span {
    position: absolute;
    top: -7px;
    right: 6px;
    font-size: 0.7rem;
    color: var(--text-faint);
}

.hour-label:first-child span {
    top: 2px;
}

/* day columns */
.day-col {
    position: relative;
    border-right: 1px solid var(--border-faint);
}

.day-col:last-of-type {
    border-right: none;
}

.day-col.today {
    background: var(--today-col);
}

.hour-cell {
    height: var(--hour-height);
    border-top: 1px solid var(--border-faint);
}

.hour-cell:first-child {
    border-top: none;
}

.event {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    padding: 3px 5px;
    border-radius: 5px;
    border-left: 3px solid var(--accent);
    background: var(--event-bg);
    color: var(--event-text);
    font-size: 0.75rem;
    line-height: 1.2;
}

/* Activities with a type take its color; the text stays dark so any color reads. */
.event.typed,
.chip.typed {
    border-left-color: var(--type);
    background: color-mix(in srgb, var(--type) 22%, var(--surface));
    color: var(--text);
}

.swatch {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-left: 4px;
    border-radius: 50%;
    vertical-align: middle;
}

.event-time {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
}

.event-title {
    font-weight: 600;
    overflow-wrap: anywhere;
}

.now-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--now);
    pointer-events: none;
}

.now-line::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--now);
}

/* add button */
/* Import / Export on the left, "Add to calendar" on the right. */
.cal-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
}

.add-btn,
.btn-primary {
    padding: 8px 14px;
    border: 1px solid var(--accent-hover);
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.add-btn:hover,
.btn-primary:hover {
    background: var(--accent-hover);
}

.btn-secondary {
    padding: 8px 14px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    cursor: pointer;
}

.btn-secondary:hover {
    background: var(--surface-hover);
}

/* overlay */
.overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--overlay);
}

.dialog {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 460px;
    max-height: calc(100vh - 32px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 20px;
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    text-align: left;
    box-shadow: var(--shadow-lg);
}

.dialog h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
}

.field > span {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.field input,
.field select,
.field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
}

.field textarea {
    resize: vertical;
    min-height: 80px;
    overflow-x: hidden;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
    outline: 2px solid var(--focus);
    outline-offset: 0;
    border-color: var(--accent);
}

.field-row {
    display: flex;
    gap: 12px;
}

.form-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.85rem;
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
}

/* New activity | From module */
.mode-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: var(--surface-sunken);
}

.mode-tab {
    padding: 8px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-label);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.mode-tab:hover:not(.on) {
    color: var(--text);
}

.mode-tab.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.12);
}

.mode-tab:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
}

.mode-empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-align: center;
}

.module-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface-muted);
    font-size: 0.85rem;
}

.summary-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-label);
}

.summary-none {
    color: var(--text-muted);
}

.summary-note {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-faint);
}

.type-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--type) 18%, var(--surface));
    color: var(--text);
    font-size: 0.75rem;
    font-weight: 600;
}

.type-pill::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--type);
}

/* on/off switch, matching the one in the module dialog */
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

/* Boxes that open when clicked (not imported program text). */
.event.clickable,
.chip.clickable {
    cursor: pointer;
    transition: box-shadow 0.12s, filter 0.12s;
}

.event.clickable:hover,
.chip.clickable:hover {
    box-shadow: var(--shadow-md);
    filter: brightness(1.04);
}

.event.clickable:focus-visible,
.chip.clickable:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
}

.summary-module {
    margin-right: 8px;
    font-weight: 600;
}

/* Delete sits apart on the left, so it is not hit on the way to Save. */
.btn-danger-ghost {
    margin-right: auto;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: var(--danger-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.btn-danger-ghost:hover {
    background: var(--danger-bg);
}

.btn-danger {
    padding: 8px 14px;
    border: 1px solid var(--danger-hover);
    border-radius: 6px;
    background: var(--danger);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.btn-danger:hover {
    background: var(--danger-hover);
}

.confirm-delete {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--danger-border);
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
}

.confirm-delete p {
    margin: 0;
    font-size: 0.9rem;
}

.confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

/* module info dialog */
.info-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    color: var(--text-muted);
}

.info-desc {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.info-note {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--surface-muted);
    color: var(--text-muted);
    font-size: 0.85rem;
}

.info-note .pi {
    margin-top: 2px;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}
</style>
