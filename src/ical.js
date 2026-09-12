// Calendar export and import as iCalendar (.ics, RFC 5545), the format Google
// Calendar, Outlook and Apple Calendar all read and write.
//
// Times are written as local wall-clock ("floating") times, exactly as the planner
// stores them. On import, times given in UTC or a named time zone are converted to
// this browser's local time.

import { TYPE_PALETTE, dateKey, mondayOf, moduleOccursOn, newId, parseKey, weekdayIndex } from './planner.js';

const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; // index 0 = Monday, as in the planner
const MINUTES_PER_DAY = 24 * 60;

const pad = (n) => String(n).padStart(2, '0');
const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};
const toHHMM = (min) => pad(Math.floor(min / 60)) + ':' + pad(min % 60);
const addDays = (key, days) => {
    const d = parseKey(key);
    d.setDate(d.getDate() + days);
    return dateKey(d);
};
const daysBetween = (fromKey, toKey) => {
    const a = parseKey(fromKey);
    const b = parseKey(toKey);
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
};

/* ======================= export ======================= */

const escapeText = (s) =>
    String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');

// Lines over 75 bytes continue on lines starting with a space, without splitting a
// multi-byte character such as å, ä or ö.
const encoder = new TextEncoder();
const fold = (line) => {
    if (encoder.encode(line).length <= 75) return line;
    const parts = [];
    let current = '';
    let bytes = 0;
    for (const ch of line) {
        const size = encoder.encode(ch).length;
        const limit = parts.length ? 74 : 75; // continuation lines spend one byte on the space
        if (bytes + size > limit) {
            parts.push(current);
            current = '';
            bytes = 0;
        }
        current += ch;
        bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
};

const compactDate = (key) => key.replaceAll('-', ''); // 2026-09-15 -> 20260915
const compactTime = (hhmm) => hhmm.replace(':', '') + '00'; // 18:00 -> 180000
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const eventLines = (ev, stamp) => {
    const lines = ['BEGIN:VEVENT', 'UID:' + ev.uid, 'DTSTAMP:' + stamp, 'SUMMARY:' + escapeText(ev.title)];
    if (ev.start) {
        const end = ev.end || toHHMM(Math.min(MINUTES_PER_DAY - 1, toMinutes(ev.start) + 60));
        lines.push('DTSTART:' + compactDate(ev.date) + 'T' + compactTime(ev.start));
        lines.push('DTEND:' + compactDate(ev.date) + 'T' + compactTime(end));
    } else {
        lines.push('DTSTART;VALUE=DATE:' + compactDate(ev.date));
        lines.push('DTEND;VALUE=DATE:' + compactDate(addDays(ev.date, 1)));
    }
    if (ev.rrule) lines.push('RRULE:' + ev.rrule);
    if (ev.description) lines.push('DESCRIPTION:' + escapeText(ev.description));
    if (ev.type) {
        lines.push('CATEGORIES:' + escapeText(ev.type.name));
        // Not standard; lets a WorkMore import bring the type's color back.
        lines.push('X-WORKMORE-COLOR:' + ev.type.color);
    }
    lines.push('END:VEVENT');
    return lines;
};

// The whole planner as one .ics file: every activity, weekly modules as repeating
// events from this week on, and one-week modules as an event on each of their days.
export const buildIcs = ({ addedEvents = [], modules = [], types = [] }, now = new Date()) => {
    const typeById = (id) => types.find((t) => t.id === id) ?? null;
    const moduleById = (id) => modules.find((m) => m.id === id) ?? null;
    const events = [];

    for (const e of addedEvents) {
        const type = typeById(e.typeId) ?? typeById(moduleById(e.moduleId)?.typeId);
        events.push({ uid: e.id + '@workmore', title: e.title, date: e.date, start: e.start, end: e.end, description: e.description, type });
    }

    const thisMonday = mondayOf(now);
    for (const m of modules) {
        const type = typeById(m.typeId);
        const days = [...m.days].sort((a, b) => a - b);
        const base = { title: m.title, start: m.start, end: m.end, description: m.description, type };
        if (m.repeat) {
            // The first chosen day of this week anchors the rule, as RFC 5545 expects.
            events.push({
                ...base,
                uid: m.id + '@workmore',
                date: dateKey(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + days[0])),
                rrule: 'FREQ=WEEKLY;BYDAY=' + days.map((i) => ICS_DAYS[i]).join(','),
            });
        } else {
            for (const i of days) {
                const date = addDays(m.weekStart, i);
                events.push({ ...base, uid: m.id + '-' + date + '@workmore', date });
            }
        }
    }

    const stamp = utcStamp(now);
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//WorkMore//Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:WorkMore',
        ...events.flatMap((ev) => eventLines(ev, stamp)),
        'END:VCALENDAR',
    ];
    return lines.map(fold).join('\r\n') + '\r\n';
};

export const icsEventCount = ({ addedEvents = [], modules = [] }) => addedEvents.length + modules.length;

/* ======================= import: reading the file ======================= */

const unescapeText = (s) => s.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

// NAME;PARAM=value;PARAM="quoted:value":the value
const parseLine = (line) => {
    let i = 0;
    let quoted = false;
    for (; i < line.length; i++) {
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === ':' && !quoted) break;
    }
    const [name, ...rawParams] = line.slice(0, i).split(';');
    const params = {};
    for (const p of rawParams) {
        const eq = p.indexOf('=');
        if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
    }
    return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
};

// Every VEVENT's properties, by name. Nested blocks (alarms) and time zone
// definitions are skipped.
const readEvents = (text) => {
    const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const events = [];
    let current = null;
    let depth = 0;
    for (const raw of lines) {
        if (!raw) continue;
        const line = parseLine(raw);
        if (line.name === 'BEGIN') {
            if (line.value.toUpperCase() === 'VEVENT' && depth === 0) current = {};
            else if (current) depth++;
            continue;
        }
        if (line.name === 'END') {
            if (depth > 0) depth--;
            else if (line.value.toUpperCase() === 'VEVENT' && current) {
                events.push(current);
                current = null;
            }
            continue;
        }
        if (current && depth === 0 && !(line.name in current)) current[line.name] = line;
    }
    return events;
};

const zoneExists = (tz) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

// Minutes a time zone is ahead of UTC at a given instant.
const zoneOffset = (instant, tz) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
            .formatToParts(instant)
            .map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return (asUtc - instant.getTime()) / 60000;
};

// The instant a wall-clock time in `tz` refers to. The second pass settles times
// near a daylight-saving change.
const zonedInstant = (y, mo, d, h, mi, tz) => {
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    let guess = wall - zoneOffset(new Date(wall), tz) * 60000;
    guess = wall - zoneOffset(new Date(guess), tz) * 60000;
    return new Date(guess);
};

// DTSTART / DTEND -> { date: 'YYYY-MM-DD', time: 'HH:MM' | '' } in local time, or null.
const readDateTime = (prop) => {
    if (!prop) return null;
    const value = prop.value.trim();
    const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (dateOnly || prop.params.VALUE === 'DATE') {
        const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
        return m ? { date: m[1] + '-' + m[2] + '-' + m[3], time: '' } : null;
    }
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
    if (!m) return null;
    const [, y, mo, d, h, mi, , utc] = m;
    const tz = prop.params.TZID?.replace(/^\//, '');

    let instant = null;
    if (utc) instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    else if (tz && zoneExists(tz)) instant = zonedInstant(+y, +mo, +d, +h, +mi, tz);
    // Floating times, and zones this browser does not know (such as Outlook's
    // "W. Europe Standard Time"), are taken as written.
    if (!instant) return { date: y + '-' + mo + '-' + d, time: h + ':' + mi };
    return { date: dateKey(instant), time: pad(instant.getHours()) + ':' + pad(instant.getMinutes()) };
};

const readDuration = (prop) => {
    const m = prop && /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/.exec(prop.value.trim());
    if (!m) return null;
    const [, w = 0, d = 0, h = 0, mi = 0] = m;
    return ((+w * 7 + +d) * 24 + +h) * 60 + +mi;
};

const readRule = (prop) =>
    prop
        ? Object.fromEntries(
            prop.value
                .split(';')
                .map((part) => part.split('='))
                .filter(([k, v]) => k && v)
                .map(([k, v]) => [k.toUpperCase(), v.toUpperCase()])
        )
        : null;

/* ======================= import: planning what to add ======================= */

export const MAX_IMPORT = 2000;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_ALL_DAY_SPAN = 31; // days a multi-day all-day event is spread over

const activityKey = (a) => [a.title.toLowerCase(), a.date, a.start, a.end].join('|');
const moduleKey = (m) => [m.title.toLowerCase(), [...m.days].sort((a, b) => a - b).join(','), m.start, m.end, m.repeat].join('|');

// Reads an .ics file and works out what to add, without adding anything yet:
// { types, modules, activities } ready for the store, plus counts for the preview.
export const planImport = (text, { addedEvents = [], modules = [], types = [] } = {}) => {
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That file is not a calendar (.ics) file.');

    const plan = { types: [], modules: [], activities: [] };
    const counts = { duplicates: 0, unreadable: 0, firstOnly: 0, clamped: 0, overLimit: 0 };
    const seenActivities = new Set(addedEvents.map(activityKey));
    const seenModules = new Set(modules.map(moduleKey));
    const allTypes = [...types];

    // Reuse a type by name (any capitalisation); otherwise plan a new one.
    const typeFor = (name, color) => {
        const clean = String(name ?? '').trim().slice(0, 40);
        if (!clean) return '';
        const existing = allTypes.find((t) => t.name.toLowerCase() === clean.toLowerCase());
        if (existing) return existing.id;
        const used = new Set(allTypes.map((t) => t.color.toLowerCase()));
        const pick = /^#[0-9a-f]{6}$/i.test(color ?? '')
            ? color.toLowerCase()
            : TYPE_PALETTE.find((c) => !used.has(c)) ?? TYPE_PALETTE[allTypes.length % TYPE_PALETTE.length];
        const type = { id: newId(), name: clean, color: pick };
        allTypes.push(type);
        plan.types.push(type);
        return type.id;
    };

    const room = () => plan.activities.length + plan.modules.length < MAX_IMPORT;

    // A day a module already puts on the calendar counts as "already there" too, so
    // re-importing an export does not turn a module's days into extra activities.
    const coveredByModule = (a) =>
        modules.some(
            (m) =>
                m.title.toLowerCase() === a.title.toLowerCase() &&
                (m.start || '') === a.start &&
                (m.end || '') === a.end &&
                moduleOccursOn(m, a.date)
        );

    for (const ev of readEvents(text)) {
        if (ev.STATUS?.value.toUpperCase() === 'CANCELLED') continue;
        const start = readDateTime(ev.DTSTART);
        if (!start) {
            counts.unreadable++;
            continue;
        }

        const title = unescapeText(ev.SUMMARY?.value ?? '').trim().slice(0, MAX_TITLE) || '(No title)';
        const description = unescapeText(ev.DESCRIPTION?.value ?? '').trim().slice(0, MAX_DESCRIPTION);
        // Split on unescaped commas first; only then unescape the first category.
        const category = unescapeText((ev.CATEGORIES?.value ?? '').split(/(?<!\\),/)[0]);
        const typeId = () => typeFor(category, ev['X-WORKMORE-COLOR']?.value.trim());

        // Times: an activity lives on one day, so an end after midnight is cut at 23:59
        // (and counted for the preview). Ending exactly at midnight is simply 23:59.
        const startTime = start.time;
        let endTime = '';
        if (startTime) {
            const end = readDateTime(ev.DTEND);
            const duration = readDuration(ev.DURATION);
            let endMin =
                end && end.time
                    ? daysBetween(start.date, end.date) * MINUTES_PER_DAY + toMinutes(end.time)
                    : toMinutes(startTime) + (duration ?? 60);
            if (endMin > MINUTES_PER_DAY) counts.clamped++;
            endMin = Math.min(endMin, MINUTES_PER_DAY - 1);
            endTime = endMin > toMinutes(startTime) ? toHHMM(endMin) : '';
        }

        const rule = readRule(ev.RRULE);
        const byDay = rule?.BYDAY?.split(',') ?? [];
        const plainWeekly =
            rule &&
            rule.FREQ === 'WEEKLY' &&
            !rule.COUNT &&
            !rule.UNTIL &&
            (!rule.INTERVAL || rule.INTERVAL === '1') &&
            !ev.EXDATE &&
            byDay.every((d) => ICS_DAYS.includes(d));

        if (plainWeekly) {
            // A plain "every week on these days" rule is exactly a repeating module.
            const days = byDay.length ? [...new Set(byDay.map((d) => ICS_DAYS.indexOf(d)))] : [weekdayIndex(parseKey(start.date))];
            const module = { id: '', title, typeId: '', description, days: days.sort((a, b) => a - b), start: startTime, end: endTime, repeat: true, weekStart: '' };
            if (seenModules.has(moduleKey(module))) {
                counts.duplicates++;
                continue;
            }
            if (!room()) {
                counts.overLimit++;
                continue;
            }
            seenModules.add(moduleKey(module));
            plan.modules.push({ ...module, id: newId(), typeId: typeId() });
            continue;
        }
        // All-day events spanning several days become one entry per day.
        let span = 1;
        if (!startTime) {
            const end = readDateTime(ev.DTEND);
            if (end && !end.time) span = Math.min(MAX_ALL_DAY_SPAN, Math.max(1, daysBetween(start.date, end.date)));
        }

        let added = false;
        for (let i = 0; i < span; i++) {
            const activity = { id: '', title, date: addDays(start.date, i), start: startTime, end: startTime ? endTime : '', description, typeId: '', moduleId: '' };
            if (seenActivities.has(activityKey(activity)) || coveredByModule(activity)) {
                counts.duplicates++;
                continue;
            }
            if (!room()) {
                counts.overLimit++;
                continue;
            }
            seenActivities.add(activityKey(activity));
            plan.activities.push({ ...activity, id: newId(), typeId: typeId() });
            added = true;
        }
        // Only mention the simplified repeat if that event is actually coming in.
        if (rule && added) counts.firstOnly++;
    }

    // Types only matter if something planned uses them.
    const usedTypeIds = new Set([...plan.modules, ...plan.activities].map((x) => x.typeId));
    plan.types = plan.types.filter((t) => usedTypeIds.has(t.id));

    const dates = plan.activities.map((a) => a.date).sort();
    return { ...plan, counts, firstDate: dates[0] ?? '', lastDate: dates.at(-1) ?? '' };
};
