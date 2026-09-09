<template>
    <div class="container calendar">
        <div class="cal-head">
            <h1>Calendar</h1>
            <span class="week-label">{{ rangeLabel }} &middot; program week {{ weekNumber }}</span>
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
                    <div v-for="(ev, i) in day.allDay" :key="i" class="chip" :title="ev.title">{{ ev.title }}</div>
                </div>

                <!-- hour labels -->
                <div class="gutter">
                    <div v-for="h in hours" :key="h" class="hour-label"><span>{{ hourLabel(h) }}</span></div>
                </div>

                <!-- day columns -->
                <div v-for="day in days" :key="'c-' + day.key" class="day-col" :class="{ today: day.isToday }">
                    <div v-for="h in hours" :key="h" class="hour-cell"></div>

                    <div v-for="(ev, i) in day.timed" :key="i" class="event" :style="eventStyle(ev)"
                        :title="ev.timeLabel + ' ' + ev.title">
                        <span class="event-time">{{ ev.timeLabel }}</span>
                        <span class="event-title">{{ ev.title }}</span>
                    </div>

                    <div v-if="day.isToday && nowOffset !== null" class="now-line" :style="{ top: nowOffset + 'px' }">
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
    weekNumber: Number,
    // Accepts plain strings (one per day, starting today - what Importcal emits)
    // or objects: { title, date|day, start, end }
    events: { type: Array, default: () => [] },
    startHour: { type: Number, default: 6 },
    endHour: { type: Number, default: 22 },
});

const hourHeight = 52;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_DURATION = 60;

/* ---------- the Monday..Sunday window ---------- */

const today = new Date();
const todayIndex = (today.getDay() + 6) % 7; // 0 = Monday

const startOfWeek = computed(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - todayIndex);
    return d;
});

const dateForIndex = (index) => {
    const d = new Date(startOfWeek.value);
    d.setDate(d.getDate() + index);
    return d;
};

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

const dayIndexOf = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date) return (value.getDay() + 6) % 7;
    if (typeof value === 'number') return value >= 0 && value < 7 ? value : null;
    const name = String(value).trim().toLowerCase();
    if (name.length >= 3) {
        const byName = WEEKDAYS.findIndex((d) => d.startsWith(name.slice(0, 3)));
        if (byName !== -1) return byName;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : (parsed.getDay() + 6) % 7;
};

const normalized = computed(() => {
    const out = [];

    props.events.forEach((raw, index) => {
        if (raw == null) return;

        if (typeof raw === 'object') {
            const dayIndex = dayIndexOf(raw.date ?? raw.day ?? raw.dayIndex);
            if (dayIndex === null) return;
            const title = String(raw.title ?? raw.text ?? raw.name ?? '').trim();
            if (!title) return;

            const startMin = minutesOf(raw.start ?? raw.startTime ?? raw.from);
            if (startMin === null) {
                out.push({ dayIndex, title, allDay: true });
                return;
            }
            const endMin = minutesOf(raw.end ?? raw.endTime ?? raw.to);
            out.push({
                dayIndex,
                title,
                startMin,
                endMin:
                    endMin !== null && endMin > startMin
                        ? endMin
                        : Math.min(MINUTES_PER_DAY, startMin + DEFAULT_DURATION),
            });
            return;
        }

        const text = String(raw).trim();
        if (!text || text === '...') return; // App.vue's pre-import placeholder

        // Importcal emits one entry per day, starting with today.
        const dayIndex = (todayIndex + index) % 7;
        for (const line of text.split(/\s*[\n;]+\s*/)) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            for (const part of splitByTimes(trimmed)) out.push({ dayIndex, ...part });
        }
    });

    return out;
});

const timedEvents = computed(() => normalized.value.filter((e) => !e.allDay));

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
        const mine = normalized.value.filter((e) => e.dayIndex === index);
        return {
            key: index,
            name: dayNameFmt.format(date),
            dateLabel: dateFmt.format(date),
            isToday: index === todayIndex,
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
</script>

<style scoped>
.calendar {
    background: #fff;
    border-radius: 10px;
    padding: 16px;
    color: #1f2328;
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
    color: #6b7280;
    font-size: 0.9rem;
}

.cal-scroll {
    overflow-x: auto;
}

.cal {
    display: grid;
    grid-template-columns: 58px repeat(7, minmax(120px, 1fr));
    grid-template-rows: auto auto 1fr;
    min-width: 760px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

/* header row */
.corner {
    background: #fafafa;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
}

.allday-corner {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 4px 6px;
    font-size: 0.7rem;
    color: #9ca3af;
}

.day-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    background: #fafafa;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #f1f2f4;
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
    color: #6b7280;
}

.day-head.today .day-name,
.day-head.today .day-date {
    color: #1d4ed8;
}

/* untimed strip */
.allday-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 30px;
    padding: 4px;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #f1f2f4;
}

.allday-cell:last-of-type {
    border-right: none;
}

.allday-cell.today {
    background: #f8faff;
}

.chip {
    background: #eef2ff;
    color: #3730a3;
    border-left: 3px solid #6366f1;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 0.75rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
}

/* time gutter */
.gutter {
    background: #fafafa;
    border-right: 1px solid #e5e7eb;
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
    color: #9ca3af;
}

.hour-label:first-child span {
    top: 2px;
}

/* day columns */
.day-col {
    position: relative;
    border-right: 1px solid #f1f2f4;
}

.day-col:last-of-type {
    border-right: none;
}

.day-col.today {
    background: #f8faff;
}

.hour-cell {
    height: var(--hour-height);
    border-top: 1px solid #f1f2f4;
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
    border-left: 3px solid #2563eb;
    background: #dbeafe;
    color: #1e3a8a;
    font-size: 0.75rem;
    line-height: 1.2;
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
    background: #ef4444;
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
    background: #ef4444;
}
</style>
