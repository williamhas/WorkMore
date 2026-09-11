<template>
  <div class="container">
    <div class="header-text">
      <h1>Upcoming days</h1>
      <div class="nav">
        <button class="arrow" type="button" :disabled="shift <= 0" aria-label="Show earlier days"
          @click="shiftBy(-1)">&lsaquo;</button>
        <button class="arrow" type="button" :disabled="shift >= maxShift" aria-label="Show later days"
          @click="shiftBy(1)">&rsaquo;</button>
      </div>
    </div>

    <div class="days-container">
      <div v-for="day in days" :key="day.offset" class="day-card" :class="{ today: day.isToday }" role="button"
        tabindex="0" :aria-label="'Show details for ' + day.header" @click="openDay(day, $event)"
        @keydown.enter.prevent="openDay(day, $event)" @keydown.space.prevent="openDay(day, $event)">
        <div class="card-head">
          <span class="day-label">{{ day.header }}</span>
          <span class="day-date">{{ day.dateLabel }}</span>
        </div>

        <ul v-if="day.rows.length" class="rows">
          <li v-for="(row, i) in day.rows.slice(0, MAX_ROWS)" :key="i" class="row"
            :class="[row.kind, { typed: row.color }]" :style="row.color ? { '--type': row.color } : null">
            <span class="dot"></span>
            <span v-if="row.time" class="row-time">{{ row.time }}</span>
            <span class="row-title">{{ row.title }}</span>
          </li>
        </ul>
        <p v-else class="nothing">Nothing planned</p>

        <span v-if="day.rows.length > MAX_ROWS" class="more">+{{ day.rows.length - MAX_ROWS }} more</span>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="openDayItem" class="day-overlay" @click.self="closeDay" @keydown.esc="closeDay">
        <section class="day-sheet" role="dialog" aria-modal="true" aria-labelledby="day-sheet-title">
          <header class="sheet-head">
            <div>
              <p class="sheet-kicker">{{ openDayItem.header }}</p>
              <h2 id="day-sheet-title">{{ openDayItem.longDate }}</h2>
            </div>
            <button ref="closeButton" type="button" class="sheet-close" aria-label="Close" @click="closeDay">&times;</button>
          </header>

          <div v-if="openDayItem.program" class="sheet-section">
            <h3>Training program</h3>
            <p class="program-text">{{ openDayItem.program }}</p>
          </div>

          <div class="sheet-section">
            <h3>
              Activities
              <span v-if="openDayItem.entries.length" class="count">{{ openDayItem.entries.length }}</span>
            </h3>

            <ol v-if="openDayItem.entries.length" class="timeline">
              <li v-for="(entry, i) in openDayItem.entries" :key="i" :class="{ typed: entry.type }"
                :style="entry.type ? { '--type': entry.type.color } : null">
                <div class="tl-time">
                  <span>{{ entry.start || 'All day' }}</span>
                  <span v-if="entry.end" class="tl-end">{{ entry.end }}</span>
                </div>
                <div class="tl-body">
                  <div class="tl-title">
                    {{ entry.title }}
                    <span v-if="entry.type" class="type-pill">{{ entry.type.name }}</span>
                    <span v-if="entry.source === 'module'" class="pill">{{ entry.repeat ? 'Weekly module' : 'Module' }}</span>
                    <span v-else-if="entry.moduleName" class="pill">{{ entry.moduleName }}</span>
                  </div>
                  <p v-if="entry.description" class="tl-desc">{{ entry.description }}</p>
                </div>
              </li>
            </ol>
            <p v-else class="nothing">No activities added for this day.</p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { activitiesOn } from '../planner.js';

const props = defineProps({
  upComingData: Array,
  // Entries from the calendar's "Add to calendar" dialog: { title, date, start, end, ... }
  addedEvents: { type: Array, default: () => [] },
  types: { type: Array, default: () => [] },
  modules: { type: Array, default: () => [] },
});

// Days shown beside the stationary "Today" card.
const SLOTS = 4;
// Rows a card shows before collapsing the rest into "+N more".
const MAX_ROWS = 3;
// How far ahead a weekly module lets the arrows go; it would otherwise never end.
const MAX_LOOKAHEAD = 27;

const shift = ref(0);

const today = new Date();

const dateFor = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);

const dateKeyFor = (offset) => {
  const d = dateFor(offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// Whole days via UTC so a DST change in between cannot skew the count.
const daysFromToday = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
};

// Stop shifting once the window would hold nothing planned at all.
const maxShift = computed(() => {
  const lastImported = (props.upComingData?.length ?? 0) - 1;
  const lastAdded = Math.max(-1, ...props.addedEvents.map((e) => daysFromToday(e.date)).filter(Number.isFinite));
  const lastModule = Math.max(
    -1,
    ...props.modules
      .map((m) => (m.repeat ? MAX_LOOKAHEAD : daysFromToday(m.weekStart) + Math.max(...m.days)))
      .filter(Number.isFinite)
  );
  return Math.max(0, Math.max(lastImported, lastAdded, lastModule) - 1);
});

const shiftBy = (delta) => {
  shift.value = Math.min(maxShift.value, Math.max(0, shift.value + delta));
};

const getDayOfWeek = (date) => {
  const options = { weekday: 'long' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const headerFor = (offset) => {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return getDayOfWeek(dateFor(offset));
};

const entriesOn = (key) =>
  activitiesOn(key, { addedEvents: props.addedEvents, modules: props.modules, types: props.types });

// upComingData is indexed by days from today, so the offset is the lookup key.
const buildDay = (offset) => {
  const date = dateFor(offset);
  const entries = entriesOn(dateKeyFor(offset));
  const imported = String(props.upComingData?.[offset] ?? '').trim();
  // '...' is App.vue's "nothing imported yet" filler, not a session.
  const program = imported === '...' ? '' : imported;

  return {
    offset,
    isToday: offset === 0,
    header: headerFor(offset),
    dateLabel: shortDateFmt.format(date),
    longDate: longDateFmt.format(date),
    program,
    entries,
    rows: [
      ...(program ? [{ kind: 'program', time: '', title: program }] : []),
      ...entries.map((e) => ({ kind: 'entry', time: e.start, title: e.title, color: e.type?.color ?? '' })),
    ],
  };
};

// Card 0 stays on today; the rest slide together as the arrows are pressed.
const days = computed(() => {
  const offsets = [0];
  for (let slot = 1; slot <= SLOTS; slot++) offsets.push(shift.value + slot);
  return offsets.map(buildDay);
});

/* ---------- day detail overlay ---------- */

// Held as an offset rather than a snapshot, so the sheet stays live if data changes.
const openOffset = ref(null);
const openDayItem = computed(() => (openOffset.value === null ? null : buildDay(openOffset.value)));
const closeButton = ref(null);
let returnFocusTo = null;

const openDay = (day, event) => {
  returnFocusTo = event?.currentTarget ?? null;
  openOffset.value = day.offset;
  nextTick(() => closeButton.value?.focus());
};

const closeDay = () => {
  openOffset.value = null;
  returnFocusTo?.focus();
  returnFocusTo = null;
};
</script>

<style scoped>
.container {
  padding: 16px;
  text-align: left;
}

.header-text {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.header-text h1 {
  margin: 0;
  font-size: 1.4rem;
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

.arrow:hover:not(:disabled) {
  background: var(--surface-hover);
}

.arrow:disabled {
  opacity: 0.4;
  cursor: default;
}

.days-container {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* day cards */
.day-card {
  flex: 1 1 0;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.day-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.day-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-card.today {
  border-color: var(--accent-border);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--surface) 70%);
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.day-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.day-card.today .day-label {
  color: var(--accent-text);
}

.day-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* The negative margin lets a typed row's tint bleed past the text, which stays
   aligned with the card header either way. */
.row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0 -6px;
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.3;
  color: var(--text);
}

.row.typed {
  background: color-mix(in srgb, var(--type) 18%, transparent);
}

.row.typed .dot {
  background: var(--type);
}

.dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 0.45em;
  border-radius: 50%;
  background: var(--chip-accent);
}

.row.program .dot {
  background: var(--program-accent);
}

.row-time {
  flex: none;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

/* One line, wrapping to a second at most. */
.row-title {
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.nothing {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-faint);
}

.more {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

/* day detail overlay */
.day-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--overlay);
}

.day-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 32px);
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
  box-shadow: var(--shadow-lg);
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border-faint);
}

.sheet-kicker {
  margin: 0 0 2px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-text);
}

.sheet-head h2 {
  margin: 0;
  font-size: 1.25rem;
}

.sheet-close {
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

.sheet-close:hover {
  background: var(--surface-hover);
}

.sheet-section {
  padding: 16px 20px;
}

.sheet-section + .sheet-section {
  border-top: 1px solid var(--border-faint);
}

.sheet-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--chip-text);
  font-size: 0.7rem;
  letter-spacing: 0;
}

.program-text {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--program-bg);
  color: var(--program-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.timeline li {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 12px;
  padding: 10px 0;
}

.timeline li + li {
  border-top: 1px solid var(--border-faint);
}

.tl-time {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.tl-end {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-faint);
}

.tl-body {
  min-width: 0;
}

.tl-title {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.pill {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--chip-text);
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}

.timeline li.typed .tl-time {
  padding-left: 8px;
  border-left: 3px solid var(--type);
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--type) 18%, var(--surface));
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}

.type-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--type);
}

.tl-desc {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: var(--text-label);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
