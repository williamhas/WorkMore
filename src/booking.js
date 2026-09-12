// Meeting booking: which times are free, and the choices made on the way through
// the booking pages. For now the signed-in person books into their own calendar;
// letting outside visitors book will need a public, server-side way in (see the
// note in BookingPage.vue).

import { reactive } from 'vue';
import { activitiesOn, dateKey, parseKey, weekdayIndex } from './planner.js';

// Bookable hours and days. Change these to adjust availability.
export const DURATIONS = [15, 30, 45, 60]; // minutes
export const DAY_START = 9 * 60; // 09:00
export const DAY_END = 17 * 60; // 17:00, the latest a meeting may end
export const WORKDAYS = [0, 1, 2, 3, 4]; // Monday to Friday (0 = Monday)
export const BOOKING_DAYS = 14; // how far ahead, counting today

// Short meetings start every 15 minutes, longer ones on the half hour.
const stepFor = (duration) => Math.min(duration, 30);

const pad = (n) => String(n).padStart(2, '0');
export const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};
export const toHHMM = (min) => pad(Math.floor(min / 60)) + ':' + pad(min % 60);

// Start times on one day where a meeting of `duration` minutes overlaps nothing timed
// in the calendar (added activities and module occurrences). All-day entries do not
// block, and on today only times still ahead count.
export const freeSlots = (key, duration, planner, now = new Date()) => {
    if (!WORKDAYS.includes(weekdayIndex(parseKey(key)))) return [];

    const busy = activitiesOn(key, planner)
        .filter((a) => a.start)
        .map((a) => [toMinutes(a.start), a.end ? toMinutes(a.end) : toMinutes(a.start) + 60]);

    const earliest = key === dateKey(now) ? now.getHours() * 60 + now.getMinutes() : -1;
    const slots = [];
    for (let t = DAY_START; t + duration <= DAY_END; t += stepFor(duration)) {
        if (t <= earliest) continue;
        if (busy.some(([start, end]) => t < end && t + duration > start)) continue;
        slots.push(toHHMM(t));
    }
    return slots;
};

// The bookable days from today on, each with its free start times.
export const bookableDays = (duration, planner, now = new Date()) => {
    const days = [];
    for (let i = 0; i < BOOKING_DAYS; i++) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (!WORKDAYS.includes(weekdayIndex(date))) continue;
        const key = dateKey(date);
        days.push({ key, date, slots: freeSlots(key, duration, planner, now) });
    }
    return days;
};

/* ---------- choices made across the booking pages ---------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_ABOUT_LENGTH = 1000;

// `about` is the visitor's optional note on what the meeting is for.
const blank = () => ({ duration: 30, name: '', email: '', about: '', date: '', start: '', confirmed: null });

export const booking = reactive(blank());

export const resetBooking = () => Object.assign(booking, blank());

export const detailsProblem = () => {
    if (!DURATIONS.includes(booking.duration)) return 'Choose how long the meeting should be.';
    if (!booking.name.trim()) return 'Enter your name.';
    if (!EMAIL.test(booking.email.trim())) return 'Enter a valid email address.';
    return '';
};
