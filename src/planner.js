// Shared planning helpers for CalendarView, Upcoming and ModulesView.
//
// Shapes (all owned by App.vue):
//   type:       { id, name, color: '#rrggbb' }
//   module:     { id, title, typeId, description, days: [0-6, 0 = Monday],
//                 start: 'HH:MM' | '', end: 'HH:MM' | '', repeat: boolean,
//                 weekStart: 'YYYY-MM-DD' (Monday; only used when repeat is off) }
//   addedEvent: { id, title, date: 'YYYY-MM-DD', start, end, description, typeId, moduleId }
// Stored per account in Supabase (see store.js and supabase/schema.sql).

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Colors offered for types, also used to color types created by an import.
export const TYPE_PALETTE = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#eab308', '#64748b'];

const pad = (n) => String(n).padStart(2, '0');

export const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

// Local midnight. new Date('YYYY-MM-DD') would be UTC midnight, a day early west of UTC.
export const parseKey = (key) => {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const weekdayIndex = (d) => (d.getDay() + 6) % 7; // 0 = Monday

export const mondayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d));

// Always a UUID: the database's id columns accept nothing else.
export const newId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    // RFC 4122 version 4 from random bytes, for browsers without randomUUID.
    const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
};

export const moduleOccursOn = (module, key) => {
    const date = parseKey(key);
    if (!module.days.includes(weekdayIndex(date))) return false;
    return module.repeat || dateKey(mondayOf(date)) === module.weekStart;
};

const findById = (list, id) => (id ? list.find((item) => item.id === id) ?? null : null);

// Everything planned on one day apart from imported program text: added activities
// plus module occurrences, sorted by start time with untimed entries first.
// An activity without its own type falls back to its module's type.
export const activitiesOn = (key, { addedEvents = [], modules = [], types = [] } = {}) => {
    const list = [];

    for (const e of addedEvents) {
        if (e.date !== key) continue;
        const module = findById(modules, e.moduleId);
        list.push({
            source: 'added',
            id: e.id,
            moduleId: module?.id ?? '',
            title: e.title,
            start: e.start || '',
            end: e.end || '',
            description: e.description || '',
            moduleName: module?.title ?? '',
            type: findById(types, e.typeId) ?? findById(types, module?.typeId),
        });
    }

    for (const m of modules) {
        if (!moduleOccursOn(m, key)) continue;
        list.push({
            source: 'module',
            moduleId: m.id,
            title: m.title,
            start: m.start || '',
            end: m.end || '',
            description: m.description || '',
            moduleName: m.title,
            repeat: m.repeat,
            type: findById(types, m.typeId),
        });
    }

    // 'HH:MM' strings sort chronologically as plain text; '' sorts first.
    return list.sort((a, b) => a.start.localeCompare(b.start));
};
