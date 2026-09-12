// Booking a meeting through a person's public link (/#/book/<code>). The visitor is
// not signed in, so everything comes from the database's public booking functions
// (see supabase/schema.sql): the rules and the host's name with the page, busy
// times for the bookable days, and the booking itself, which the server checks
// again before saving.

import { reactive } from 'vue';
import { dateKey, parseKey, weekdayIndex } from './planner.js';

const pad = (n) => String(n).padStart(2, '0');
export const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};
export const toHHMM = (min) => pad(Math.floor(min / 60)) + ':' + pad(min % 60);

// Short meetings start every 15 minutes, longer ones on the half hour. The server
// uses the same grid when it checks a booking.
const stepFor = (duration) => Math.min(duration, 30);

// Start times on one day (in the host's time zone) where a meeting of `duration`
// minutes overlaps nothing in `busy` ([{ day, start_min, end_min }]). On the host's
// today, only times still ahead count.
export const freeSlots = (key, duration, rules, busy, hostNow) => {
    if (!rules.workdays.includes(weekdayIndex(parseKey(key)))) return [];
    const taken = busy.filter((b) => b.day === key);
    const earliest = key === hostNow.dateKey ? hostNow.minutes : -1;

    const slots = [];
    for (let t = rules.day_start; t + duration <= rules.day_end; t += stepFor(duration)) {
        if (t <= earliest) continue;
        if (taken.some((b) => t < b.end_min && t + duration > b.start_min)) continue;
        slots.push(toHHMM(t));
    }
    return slots;
};

// The bookable days from the host's today on, each with its free start times.
export const bookableDays = (duration, rules, busy, hostNow) => {
    const today = parseKey(hostNow.dateKey);
    const days = [];
    for (let i = 0; i < rules.booking_days; i++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        if (!rules.workdays.includes(weekdayIndex(date))) continue;
        const key = dateKey(date);
        days.push({ key, date, slots: freeSlots(key, duration, rules, busy, hostNow) });
    }
    return days;
};

// First and last bookable date, for asking the server about busy times.
export const bookingWindow = (rules, hostNow) => {
    const today = parseKey(hostNow.dateKey);
    return {
        from: hostNow.dateKey,
        to: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + rules.booking_days - 1)),
    };
};

/* ---------- choices made across the booking pages ---------- */

export const MAX_ABOUT_LENGTH = 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `code` is the link being booked through; `about` is the visitor's optional note.
const blank = () => ({ code: '', duration: 30, name: '', email: '', about: '', date: '', start: '', confirmed: null });

export const booking = reactive(blank());

export const resetBooking = (code = '') => Object.assign(booking, blank(), { code });

// `durations` comes with the page; without it (in the router) any length passes here
// and the page checks it against the real list.
export const detailsProblem = (durations = null) => {
    if (durations ? !durations.includes(booking.duration) : !(booking.duration > 0)) {
        return 'Choose how long the meeting should be.';
    }
    if (!booking.name.trim()) return 'Enter your name.';
    if (!EMAIL.test(booking.email.trim())) return 'Enter a valid email address.';
    return '';
};
