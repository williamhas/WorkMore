<template>
    <div class="card">
        <section class="booking">
            <!-- Landing -->
            <div v-if="step === 'start'" class="intro">
                <span class="host-avatar" aria-hidden="true">
                    <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" />
                    <span v-else>{{ hostInitial }}</span>
                </span>
                <p class="kicker">Book a meeting with</p>
                <h1>{{ hostName }}</h1>
                <p class="lead">Choose how long you need and a time that suits you.</p>
                <ul class="facts">
                    <li><i class="pi pi-clock" aria-hidden="true"></i>{{ DURATIONS[0] }}–{{ DURATIONS[DURATIONS.length - 1] }} minutes</li>
                    <li><i class="pi pi-calendar" aria-hidden="true"></i>{{ hoursLabel }}</li>
                </ul>
                <button type="button" class="btn-primary big" @click="begin">Book a meeting</button>
            </div>

            <template v-else>
                <header class="flow-head">
                    <p class="kicker">Meeting with {{ hostName }}</p>
                    <ol class="steps" aria-label="Progress">
                        <li v-for="(s, i) in STEPS" :key="s.id"
                            :class="{ current: s.id === step, done: i < stepIndex }"
                            :aria-current="s.id === step ? 'step' : undefined">
                            <span class="step-dot">
                                <i v-if="i < stepIndex" class="pi pi-check" aria-hidden="true"></i>
                                <template v-else>{{ i + 1 }}</template>
                            </span>
                            {{ s.label }}
                        </li>
                    </ol>
                </header>

                <!-- Step 1: details -->
                <form v-if="step === 'details'" class="flow-body" novalidate @submit.prevent="toTime">
                    <label class="field">
                        <span>How long should the meeting be?</span>
                        <select v-model.number="booking.duration">
                            <option v-for="d in DURATIONS" :key="d" :value="d">{{ d }} minutes</option>
                        </select>
                    </label>
                    <label class="field">
                        <span>Your name</span>
                        <input ref="nameInput" v-model="booking.name" type="text" autocomplete="name" maxlength="80"
                            placeholder="First and last name" />
                    </label>
                    <label class="field">
                        <span>Your email</span>
                        <input v-model="booking.email" type="email" autocomplete="email" inputmode="email"
                            placeholder="you@example.com" />
                    </label>
                    <label class="field">
                        <span>What is the meeting about? <em class="optional">Optional</em></span>
                        <textarea v-model="booking.about" rows="4" :maxlength="MAX_ABOUT_LENGTH"
                            placeholder="A few words so the meeting can be prepared"></textarea>
                    </label>

                    <p v-if="detailsError" class="form-error" role="alert">{{ detailsError }}</p>

                    <div class="flow-actions">
                        <RouterLink :to="{ name: 'booking' }" class="btn-secondary">Back</RouterLink>
                        <button type="submit" class="btn-primary">Next</button>
                    </div>
                </form>

                <!-- Step 2: date and time -->
                <div v-else-if="step === 'time'" class="flow-body">
                    <p class="summary">
                        <i class="pi pi-clock" aria-hidden="true"></i>{{ booking.duration }} minutes
                        <span class="dot">&middot;</span>{{ booking.name.trim() }}
                    </p>

                    <p v-if="store.loading" class="hint">Loading the calendar…</p>
                    <template v-else>
                        <h2 class="label">Choose a date</h2>
                        <div class="dates">
                            <button v-for="d in days" :key="d.key" type="button" class="date-btn"
                                :class="{ on: booking.date === d.key }" :disabled="!d.slots.length"
                                :aria-pressed="booking.date === d.key"
                                :title="d.slots.length ? d.slots.length + ' free times' : 'No free times'"
                                @click="pickDate(d.key)">
                                <span class="dow">{{ dowFmt.format(d.date) }}</span>
                                <span class="dom">{{ d.date.getDate() }}</span>
                                <span class="mon">{{ monFmt.format(d.date) }}</span>
                            </button>
                        </div>

                        <h2 class="label">Choose a time</h2>
                        <div v-if="selectedDay?.slots.length" class="slots">
                            <button v-for="s in selectedDay.slots" :key="s" type="button" class="slot-btn"
                                :class="{ on: booking.start === s }" :aria-pressed="booking.start === s"
                                @click="pickTime(s)">{{ s }}</button>
                        </div>
                        <p v-else class="hint">
                            {{ days.some((d) => d.slots.length) ? 'Pick a date to see its free times.' : 'No free times in the next two weeks.' }}
                        </p>
                        <p class="tz">Times are in {{ timeZone }}.</p>
                    </template>

                    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

                    <div class="flow-actions">
                        <RouterLink :to="{ name: 'booking-details' }" class="btn-secondary">Back</RouterLink>
                        <button type="button" class="btn-primary" :disabled="!booking.start" @click="book">
                            {{ booking.start ? 'Book meeting at ' + booking.start : 'Book meeting' }}
                        </button>
                    </div>
                </div>

                <!-- Confirmation -->
                <div v-else-if="step === 'confirmed' && booking.confirmed" class="flow-body confirmed">
                    <span class="check" aria-hidden="true"><i class="pi pi-check"></i></span>
                    <h2>Meeting booked</h2>
                    <p class="lead">It is in the calendar, marked as a meeting.</p>
                    <dl class="details">
                        <div><dt>What</dt><dd>Meeting with {{ booking.confirmed.name }}</dd></div>
                        <div><dt>When</dt><dd>{{ longFmt.format(parseKey(booking.confirmed.date)) }}, {{ booking.confirmed.start }}–{{ booking.confirmed.end }}</dd></div>
                        <div><dt>Length</dt><dd>{{ booking.confirmed.duration }} minutes</dd></div>
                        <div><dt>Email</dt><dd>{{ booking.confirmed.email }}</dd></div>
                        <div v-if="booking.confirmed.about"><dt>About</dt><dd class="about">{{ booking.confirmed.about }}</dd></div>
                    </dl>
                    <div class="flow-actions center">
                        <RouterLink to="/" class="btn-secondary">Go to calendar</RouterLink>
                        <button type="button" class="btn-primary" @click="bookAnother">Book another</button>
                    </div>
                </div>
            </template>
        </section>
    </div>
</template>

<script setup>
// For now the signed-in person books into their own calendar, standing in for a
// visitor. Letting people outside the app book will need a public entry point on the
// server (for example a Supabase Edge Function) that shows only free/busy times and
// inserts the meeting, since a visitor cannot sign in to someone else's account.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { session } from '../auth.js';
import { profile } from '../profile.js';
import { bookMeeting, store } from '../store.js';
import { parseKey } from '../planner.js';
import {
    DAY_END,
    DAY_START,
    DURATIONS,
    MAX_ABOUT_LENGTH,
    WORKDAYS,
    booking,
    bookableDays,
    detailsProblem,
    freeSlots,
    resetBooking,
    toHHMM,
    toMinutes,
} from '../booking.js';

const route = useRoute();
const router = useRouter();

const STEPS = [
    { id: 'details', label: 'Details' },
    { id: 'time', label: 'Date & time' },
    { id: 'confirmed', label: 'Confirmed' },
];

const step = computed(
    () => ({ 'booking-details': 'details', 'booking-time': 'time', 'booking-confirmed': 'confirmed' })[route.name] ?? 'start'
);
const stepIndex = computed(() => STEPS.findIndex((s) => s.id === step.value));

const hostName = computed(() => profile.displayName || session.value?.email || '');
const hostInitial = computed(() => (hostName.value[0] ?? '?').toUpperCase());

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hoursLabel = computed(() => {
    const days = WORKDAYS.length === 5 && WORKDAYS.join() === '0,1,2,3,4'
        ? 'Mon–Fri'
        : WORKDAYS.map((i) => WEEKDAY_NAMES[i]).join(', ');
    return days + ', ' + toHHMM(DAY_START) + '–' + toHHMM(DAY_END);
});

const dowFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your time zone';

const planner = computed(() => ({ addedEvents: store.addedEvents, modules: store.modules, types: store.types }));

// Ticks each minute, so a time that has just passed drops out of today's list.
const now = ref(new Date());
let clock = null;
onMounted(() => {
    clock = setInterval(() => (now.value = new Date()), 60000);
});
onBeforeUnmount(() => clearInterval(clock));

// Worked out from the calendar, so anything booked or added meanwhile is excluded.
const days = computed(() => bookableDays(booking.duration, planner.value, now.value));
const selectedDay = computed(() => days.value.find((d) => d.key === booking.date) ?? null);

const nameInput = ref(null);
const detailsError = ref('');
const error = ref('');

// A different length means different free times: start the date and time over.
watch(
    () => booking.duration,
    () => {
        booking.date = '';
        booking.start = '';
    }
);

// On reaching the time step, preselect the first date that has free times.
watch(
    [step, () => store.loading],
    ([current]) => {
        error.value = '';
        if (current === 'details') nextTick(() => nameInput.value?.focus());
        if (current !== 'time' || store.loading) return;
        if (!selectedDay.value?.slots.length) {
            booking.date = days.value.find((d) => d.slots.length)?.key ?? '';
            booking.start = '';
        }
    },
    { immediate: true }
);

const begin = () => {
    resetBooking();
    router.push({ name: 'booking-details' });
};

const toTime = () => {
    detailsError.value = detailsProblem();
    if (!detailsError.value) router.push({ name: 'booking-time' });
};

const pickDate = (key) => {
    booking.date = key;
    booking.start = '';
    error.value = '';
};

const pickTime = (start) => {
    booking.start = start;
    error.value = '';
};

const book = () => {
    error.value = '';
    // Check once more against the calendar as it is right now.
    if (!freeSlots(booking.date, booking.duration, planner.value, new Date()).includes(booking.start)) {
        booking.start = '';
        error.value = 'That time is no longer free. Choose another.';
        return;
    }

    const name = booking.name.trim();
    const email = booking.email.trim().toLowerCase();
    const about = booking.about.trim().slice(0, MAX_ABOUT_LENGTH);
    const end = toHHMM(toMinutes(booking.start) + booking.duration);
    bookMeeting({ name, email, date: booking.date, start: booking.start, end, about });

    booking.confirmed = { name, email, about, date: booking.date, start: booking.start, end, duration: booking.duration };
    // Going back from the confirmation must not offer the same booking again.
    booking.start = '';
    router.push({ name: 'booking-confirmed' });
};

const bookAnother = () => {
    resetBooking();
    router.push({ name: 'booking' });
};
</script>

<style scoped>
.booking {
    box-sizing: border-box;
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 20px 36px;
    color: var(--text);
}

.kicker {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent-text);
}

.lead {
    margin: 6px 0 0;
    color: var(--text-muted);
}

/* ---------- landing ---------- */

.intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.host-avatar {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin-bottom: 14px;
    overflow: hidden;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 1.8rem;
    font-weight: 700;
}

.host-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.intro h1 {
    margin: 4px 0 0;
    font-size: 1.6rem;
    overflow-wrap: anywhere;
}

.facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 18px;
    margin: 18px 0 24px;
    padding: 0;
    list-style: none;
    font-size: 0.88rem;
    color: var(--text-label);
}

.facts li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.facts .pi {
    color: var(--text-muted);
}

/* ---------- step header ---------- */

.flow-head {
    margin-bottom: 22px;
}

.steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
}

.steps li {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.86rem;
    color: var(--text-muted);
}

.steps li.current {
    color: var(--text);
    font-weight: 600;
}

.step-dot {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--border-strong);
    border-radius: 50%;
    font-size: 0.72rem;
    font-weight: 700;
}

.steps li.current .step-dot {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
}

.steps li.done .step-dot {
    border-color: var(--accent-border);
    background: var(--accent-soft);
    color: var(--accent-text);
}

/* ---------- step body ---------- */

.flow-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field > span {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-label);
}

.optional {
    margin-left: 4px;
    font-style: normal;
    font-weight: 400;
    color: var(--text-faint);
}

.field textarea {
    resize: vertical;
    min-height: 90px;
    overflow-x: hidden;
}

.details dd.about {
    font-weight: 400;
    white-space: pre-wrap;
}

.field input,
.field select,
.field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
    outline: 2px solid var(--focus);
    outline-offset: 0;
    border-color: var(--accent);
}

.summary {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--surface-muted);
    font-size: 0.9rem;
}

.summary .pi {
    color: var(--text-muted);
}

.summary .dot {
    color: var(--text-faint);
}

.label {
    margin: 4px 0 -6px;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.dates {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
    gap: 8px;
}

.date-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 8px 4px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
}

.date-btn .dow,
.date-btn .mon {
    font-size: 0.72rem;
    color: var(--text-muted);
}

.date-btn .dom {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.2;
}

.slots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
    gap: 8px;
}

.slot-btn {
    padding: 10px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
}

.date-btn:hover:not(:disabled),
.slot-btn:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
}

.date-btn.on,
.slot-btn.on {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
}

.date-btn.on .dow,
.date-btn.on .mon {
    color: rgba(255, 255, 255, 0.85);
}

.date-btn:disabled {
    opacity: 0.4;
    cursor: default;
}

.date-btn:focus-visible,
.slot-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

.hint {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-align: center;
}

.tz {
    margin: -4px 0 0;
    font-size: 0.78rem;
    color: var(--text-faint);
}

.form-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--danger-bg);
    color: var(--danger-text);
    font-size: 0.85rem;
}

.flow-actions {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
}

.flow-actions.center {
    justify-content: center;
}

/* ---------- confirmation ---------- */

.confirmed {
    align-items: center;
    text-align: center;
}

.check {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: color-mix(in srgb, #22c55e 18%, var(--surface));
    color: #16a34a;
    font-size: 1.5rem;
}

.confirmed h2 {
    margin: 0;
    font-size: 1.4rem;
}

.confirmed .lead {
    margin-top: -10px;
}

.details {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: 4px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    text-align: left;
}

.details div {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 12px;
    padding: 10px 0;
}

.details div + div {
    border-top: 1px solid var(--border-faint);
}

.details dt {
    font-size: 0.82rem;
    color: var(--text-muted);
}

.details dd {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
}

/* ---------- buttons ---------- */

.btn-primary,
.btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
}

.btn-primary {
    border: 1px solid var(--accent-hover);
    background: var(--accent);
    color: #fff;
}

.btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
}

.btn-primary.big {
    padding: 12px 26px;
    font-size: 1rem;
}

.btn-secondary {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
}

.btn-secondary:hover {
    background: var(--surface-hover);
}

.btn-primary:focus-visible,
.btn-secondary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}
</style>
