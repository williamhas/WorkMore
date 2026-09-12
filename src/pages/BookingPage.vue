<template>
    <div class="public">
        <main class="booking-card">
            <p v-if="configError" class="state error">{{ configError }}</p>
            <p v-else-if="state === 'loading'" class="state">Loading…</p>

            <div v-else-if="state === 'missing'" class="intro missing">
                <span class="missing-icon" aria-hidden="true"><i class="pi pi-link"></i></span>
                <h1>This booking link does not work</h1>
                <p class="lead">It may have been replaced. Ask the person who sent it for a new link.</p>
            </div>

            <p v-else-if="state === 'error'" class="state error">{{ loadError }}</p>

            <section v-else class="booking">
                <!-- Landing -->
                <div v-if="step === 'start'" class="intro">
                    <span class="host-avatar" aria-hidden="true">
                        <img v-if="host.avatar_url" :src="host.avatar_url" alt="" />
                        <i v-else-if="!host.name" class="pi pi-calendar"></i>
                        <span v-else>{{ host.name[0].toUpperCase() }}</span>
                    </span>
                    <p class="kicker">{{ host.name ? 'Book a meeting with' : 'Book a meeting' }}</p>
                    <h1 v-if="host.name">{{ host.name }}</h1>
                    <p class="lead">Choose how long you need and a time that suits you.</p>
                    <ul class="facts">
                        <li><i class="pi pi-clock" aria-hidden="true"></i>{{ lengthsLabel }}</li>
                        <li><i class="pi pi-calendar" aria-hidden="true"></i>{{ hoursLabel }}</li>
                        <li><i class="pi pi-globe" aria-hidden="true"></i>{{ hostZone }}</li>
                    </ul>
                    <button type="button" class="btn-primary big" @click="begin">Book a meeting</button>
                </div>

                <template v-else>
                    <header class="flow-head">
                        <p class="kicker">{{ host.name ? 'Meeting with ' + host.name : 'Book a meeting' }}</p>
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
                                <option v-for="d in host.durations" :key="d" :value="d">{{ d }} minutes</option>
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
                            <RouterLink :to="{ name: 'book', params: { code } }" class="btn-secondary">Back</RouterLink>
                            <button type="submit" class="btn-primary">Next</button>
                        </div>
                    </form>

                    <!-- Step 2: date and time -->
                    <div v-else-if="step === 'time'" class="flow-body">
                        <p class="summary">
                            <i class="pi pi-clock" aria-hidden="true"></i>{{ booking.duration }} minutes
                            <span class="dot">&middot;</span>{{ booking.name.trim() }}
                        </p>

                        <p v-if="busyState === 'loading' || busyState === 'idle'" class="hint">Finding free times…</p>
                        <p v-else-if="busyState === 'error'" class="form-error" role="alert">
                            Could not load the free times. Reload the page to try again.
                        </p>
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
                                {{ days.some((d) => d.slots.length) ? 'Pick a date to see its free times.' : 'No free times in the next ' + host.booking_days + ' days.' }}
                            </p>

                            <p class="tz">
                                <i class="pi pi-globe" aria-hidden="true"></i>
                                Times are in {{ hostZone }}{{ firstName ? ', ' + firstName + '’s time zone' : '' }}.
                                <template v-if="zonesDiffer">You are in {{ visitorZone }}.</template>
                            </p>
                            <p v-if="booking.start && zonesDiffer" class="your-time">
                                {{ booking.start }} there is <strong>{{ inVisitorZone(booking.date, booking.start) }}</strong>
                                where you are.
                            </p>
                        </template>

                        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

                        <div class="flow-actions">
                            <RouterLink :to="{ name: 'book-details', params: { code } }" class="btn-secondary">Back</RouterLink>
                            <button type="button" class="btn-primary" :disabled="!booking.start || submitting" @click="book">
                                {{ submitting ? 'Booking…' : booking.start ? 'Book meeting at ' + booking.start : 'Book meeting' }}
                            </button>
                        </div>
                    </div>

                    <!-- Confirmation -->
                    <div v-else-if="step === 'confirmed' && booking.confirmed" class="flow-body confirmed">
                        <span class="check" aria-hidden="true"><i class="pi pi-check"></i></span>
                        <h2>Meeting booked</h2>
                        <p class="lead">
                            {{ host.name ? 'It is in ' + firstName + '’s calendar.' : 'It is in the calendar.' }}
                        </p>
                        <dl class="details">
                            <div><dt>What</dt><dd>Meeting with {{ host.name || 'the host' }}</dd></div>
                            <div>
                                <dt>When</dt>
                                <dd>
                                    {{ longFmt.format(parseKey(booking.confirmed.date)) }},
                                    {{ booking.confirmed.start }}–{{ booking.confirmed.end }}
                                    <span class="zone">{{ booking.confirmed.time_zone }}</span>
                                </dd>
                            </div>
                            <div v-if="zonesDiffer">
                                <dt>Your time</dt>
                                <dd>
                                    {{ inVisitorZone(booking.confirmed.date, booking.confirmed.start) }}–{{ inVisitorZone(booking.confirmed.date, booking.confirmed.end, false) }}
                                    <span class="zone">{{ visitorZone }}</span>
                                </dd>
                            </div>
                            <div><dt>Length</dt><dd>{{ booking.confirmed.duration }} minutes</dd></div>
                            <div><dt>Name</dt><dd>{{ booking.confirmed.name }}</dd></div>
                            <div><dt>Email</dt><dd>{{ booking.confirmed.email }}</dd></div>
                            <div v-if="booking.confirmed.about"><dt>About</dt><dd class="about">{{ booking.confirmed.about }}</dd></div>
                        </dl>
                        <div class="flow-actions center">
                            <button type="button" class="btn-secondary" @click="bookAnother">Book another meeting</button>
                        </div>
                    </div>
                </template>
            </section>
        </main>
        <p class="powered">Scheduling by <strong>WorkMore</strong></p>
    </div>
</template>

<script setup>
// The page behind a person's booking link (/#/book/<code>), for visitors who are not
// signed in. Everything goes through the database's public booking functions in
// supabase/schema.sql: booking_page (name, picture, time zone, rules), booking_busy
// (busy times only) and book_meeting (checks and saves the booking).

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { configError, supabase } from '../supabase.js';
import { parseKey } from '../planner.js';
import { localZone, nowIn, zonedInstant } from '../timezone.js';
import {
    MAX_ABOUT_LENGTH,
    booking,
    bookableDays,
    bookingWindow,
    detailsProblem,
    resetBooking,
    toHHMM,
} from '../booking.js';

const route = useRoute();
const router = useRouter();

const code = computed(() => String(route.params.code ?? '').toLowerCase());

const STEPS = [
    { id: 'details', label: 'Details' },
    { id: 'time', label: 'Date & time' },
    { id: 'confirmed', label: 'Confirmed' },
];

const step = computed(
    () => ({ 'book-details': 'details', 'book-time': 'time', 'book-confirmed': 'confirmed' })[route.name] ?? 'start'
);
const stepIndex = computed(() => STEPS.findIndex((s) => s.id === step.value));

/* ---------- the host behind the link ---------- */

const state = ref('loading'); // loading | ready | missing | error
const loadError = ref('');
const host = ref(null);

const loadHost = async () => {
    if (!supabase) return;
    state.value = 'loading';
    const { data, error } = await supabase.rpc('booking_page', { p_code: code.value });
    if (error) {
        loadError.value = /booking_page/.test(error.message)
            ? 'Booking is not set up yet: the latest supabase/schema.sql has not been run.'
            : 'Could not load this booking page. Try again in a moment.';
        state.value = 'error';
        return;
    }
    if (!data) {
        state.value = 'missing';
        return;
    }
    host.value = data;
    if (!data.durations.includes(booking.duration)) {
        booking.duration = data.durations.includes(30) ? 30 : data.durations[0];
    }
    state.value = 'ready';
};

// Another link (or the first visit) starts a fresh booking.
watch(
    code,
    (current) => {
        if (booking.code !== current) resetBooking(current);
        loadHost();
    },
    { immediate: true }
);

const firstName = computed(() => host.value?.name?.split(' ')[0] ?? '');
const hostZone = computed(() => host.value?.time_zone ?? 'UTC');
const visitorZone = localZone();
const zonesDiffer = computed(() => visitorZone !== hostZone.value);

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const lengthsLabel = computed(() => {
    const d = host.value.durations;
    return d.length === 1 ? d[0] + ' minutes' : d[0] + '–' + d[d.length - 1] + ' minutes';
});
const hoursLabel = computed(() => {
    const w = host.value.workdays;
    const days = w.join() === '0,1,2,3,4' ? 'Mon–Fri' : w.map((i) => WEEKDAY_NAMES[i]).join(', ');
    return days + ', ' + toHHMM(host.value.day_start) + '–' + toHHMM(host.value.day_end);
});

const dowFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// A host date and time, as it is in the visitor's own time zone ("Tue 04:00").
const inVisitorZone = (key, hhmm, withDay = true) => {
    const [y, mo, d] = key.split('-').map(Number);
    const [h, mi] = hhmm.split(':').map(Number);
    const instant = zonedInstant(y, mo, d, h, mi, hostZone.value);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: visitorZone,
        ...(withDay ? { weekday: 'short' } : {}),
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(instant);
};

/* ---------- free times ---------- */

// Ticks each minute, so a time that has just passed (in the host's zone) drops out.
const now = ref(new Date());
let clock = null;
onMounted(() => {
    clock = setInterval(() => (now.value = new Date()), 60000);
});
onBeforeUnmount(() => clearInterval(clock));
const hostNow = computed(() => nowIn(hostZone.value, now.value));

const busy = ref([]);
const busyState = ref('idle'); // idle | loading | ready | error

const loadBusy = async () => {
    if (!host.value) return;
    busyState.value = 'loading';
    const { from, to } = bookingWindow(host.value, hostNow.value);
    const { data, error } = await supabase.rpc('booking_busy', { p_code: code.value, p_from: from, p_to: to });
    if (error) {
        busyState.value = 'error';
        return;
    }
    busy.value = data ?? [];
    busyState.value = 'ready';
};

const days = computed(() => (host.value ? bookableDays(booking.duration, host.value, busy.value, hostNow.value) : []));
const selectedDay = computed(() => days.value.find((d) => d.key === booking.date) ?? null);

// Keep the chosen date if it still has free times; otherwise take the first that does.
const preselect = () => {
    if (!selectedDay.value?.slots.length) {
        booking.date = days.value.find((d) => d.slots.length)?.key ?? '';
        booking.start = '';
    }
};

const nameInput = ref(null);
const detailsError = ref('');
const error = ref('');
const submitting = ref(false);

watch(
    [step, state],
    ([current, loaded]) => {
        error.value = '';
        if (loaded !== 'ready') return;
        if (current === 'details') nextTick(() => nameInput.value?.focus());
        if (current === 'time') loadBusy();
    },
    { immediate: true }
);

watch(busyState, (s) => s === 'ready' && step.value === 'time' && preselect());

// A different length means different free times: start the date and time over.
watch(
    () => booking.duration,
    () => {
        booking.date = '';
        booking.start = '';
        if (busyState.value === 'ready') preselect();
    }
);

const begin = () => {
    resetBooking(code.value);
    if (host.value && !host.value.durations.includes(booking.duration)) booking.duration = host.value.durations[0];
    router.push({ name: 'book-details', params: { code: code.value } });
};

const toTime = () => {
    detailsError.value = detailsProblem(host.value.durations);
    if (!detailsError.value) router.push({ name: 'book-time', params: { code: code.value } });
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

// The server checks everything again (and refuses a time taken meanwhile).
const book = async () => {
    if (!booking.start || submitting.value) return;
    error.value = '';
    submitting.value = true;
    const { data, error: failed } = await supabase.rpc('book_meeting', {
        p_code: code.value,
        p_name: booking.name.trim(),
        p_email: booking.email.trim(),
        p_about: booking.about.trim(),
        p_date: booking.date,
        p_start: booking.start,
        p_duration: booking.duration,
    });
    submitting.value = false;

    if (failed) {
        error.value = failed.message || 'Could not book the meeting. Try again.';
        if (/no longer free|already passed/i.test(failed.message)) {
            booking.start = '';
            loadBusy();
        }
        return;
    }

    booking.confirmed = data;
    // Going back from the confirmation must not offer the same booking again.
    booking.start = '';
    router.push({ name: 'book-confirmed', params: { code: code.value } });
};

const bookAnother = () => {
    resetBooking(code.value);
    router.push({ name: 'book', params: { code: code.value } });
};
</script>

<style scoped>
/* ---------- page ---------- */

.public {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 40px 16px 24px;
    background:
        radial-gradient(1200px 500px at 50% -10%, var(--accent-soft), transparent 70%),
        var(--bg);
}

.booking-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 640px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-md);
}

.state {
    margin: 0;
    padding: 40px 24px;
    color: var(--text-muted);
    text-align: center;
}

.state.error {
    color: var(--danger-text);
}

.missing {
    padding: 40px 24px;
}

.missing-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin-bottom: 14px;
    border-radius: 50%;
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: 1.4rem;
}

.missing h1 {
    margin: 0;
    font-size: 1.3rem;
}

.powered {
    margin: 18px 0 0;
    font-size: 0.8rem;
    color: var(--text-faint);
}

.booking {
    box-sizing: border-box;
    padding: 32px 24px 32px;
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    margin: -4px 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
}

.tz .pi {
    font-size: 0.8rem;
}

/* Shown when the visitor is in another time zone than the host. */
.your-time {
    margin: -6px 0 0;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--accent-soft);
    font-size: 0.88rem;
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
    grid-template-columns: 80px 1fr;
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

.details .zone {
    display: block;
    font-size: 0.78rem;
    font-weight: 400;
    color: var(--text-muted);
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
