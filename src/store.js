// The planning data every page shares. Types, modules and added activities belong
// to the signed-in account and are stored in Supabase (tables in supabase/schema.sql,
// app-side shapes in planner.js). Row Level Security keeps each account's rows private.

import { reactive, watch } from 'vue';
import { supabase } from './supabase.js';
import { session } from './auth.js';
import { newId } from './planner.js';

// The planner used to be saved in this browser. Accounts replace that, starting
// fresh, so drop the old copy.
try {
    localStorage.removeItem('workmore:planner:v1');
} catch {
    // Nothing stored to clear.
}

export const store = reactive({
    // Imported training program text, one entry per day starting today. Filled by
    // the file import (Importcal), which is switched off for now; '...' means empty.
    upComingData: ['...', '...', '...', '...', '...'],
    currentWeekNumber: 32,

    addedEvents: [],
    types: [],
    modules: [],

    loading: false,
    error: '',
});

/* ---------- app shape <-> table row ---------- */

// The app uses '' for "none" and 'HH:MM' times; the tables use null and 'HH:MM:SS'.
const orNull = (value) => (value === '' || value === undefined ? null : value);
const hhmm = (time) => (time ? String(time).slice(0, 5) : '');

const typeFromRow = (r) => ({ id: r.id, name: r.name, color: r.color });
const typeToRow = (t) => ({ id: t.id, name: t.name, color: t.color });

const moduleFromRow = (r) => ({
    id: r.id,
    title: r.title,
    typeId: r.type_id ?? '',
    description: r.description ?? '',
    days: r.days ?? [],
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    repeat: r.repeat,
    weekStart: r.week_start ?? '',
});
const moduleToRow = (m) => ({
    id: m.id,
    title: m.title,
    type_id: orNull(m.typeId),
    description: m.description ?? '',
    days: m.days,
    start_time: orNull(m.start),
    end_time: orNull(m.end),
    repeat: m.repeat,
    week_start: m.repeat ? null : orNull(m.weekStart),
});

const activityFromRow = (r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    description: r.description ?? '',
    typeId: r.type_id ?? '',
    moduleId: r.module_id ?? '',
});
const activityToRow = (e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    start_time: orNull(e.start),
    end_time: orNull(e.end),
    description: e.description ?? '',
    type_id: orNull(e.typeId),
    module_id: orNull(e.moduleId),
});

// For updates: everything but the id, which is what selects the row.
const withoutId = ({ id, ...fields }) => fields;

/* ---------- loading ---------- */

const clear = () => {
    store.types = [];
    store.modules = [];
    store.addedEvents = [];
    store.loading = false;
    store.error = '';
};

// Each load gets a number; a load that finishes after a newer one started (or after
// signing out) is ignored, so a slow response can never show the wrong account.
let latestLoad = 0;

export const loadPlanner = async () => {
    const load = ++latestLoad;
    if (!supabase || !session.value) {
        clear();
        return;
    }

    store.loading = true;
    const [types, modules, activities] = await Promise.all([
        supabase.from('types').select('*').order('created_at'),
        supabase.from('modules').select('*').order('created_at'),
        supabase.from('activities').select('*').order('date').order('created_at'),
    ]);
    if (load !== latestLoad) return;

    const failed = [types, modules, activities].find((result) => result.error);
    if (failed) {
        store.error = 'Could not load your planner: ' + failed.error.message;
    } else {
        store.types = types.data.map(typeFromRow);
        store.modules = modules.data.map(moduleFromRow);
        store.addedEvents = activities.data.map(activityFromRow);
        store.error = '';
    }
    store.loading = false;
};

// Load on sign-in (and on page load with a saved session); clear on sign-out.
// Keyed on the user id, so routine token refreshes do not reload anything.
watch(
    () => session.value?.userId,
    (userId) => {
        if (userId) {
            loadPlanner();
        } else {
            latestLoad++;
            clear();
        }
    },
    { immediate: true }
);

/* ---------- saving ---------- */

// Every change shows on screen at once and is then saved. If saving fails, the
// planner is reloaded from the account so the screen matches what is really stored.
const send = async (request, what) => {
    if (!supabase) return;
    const { error } = await request();
    if (!error) return;
    const message = 'Could not save ' + what + ': ' + error.message + '. Showing what is saved in your account.';
    await loadPlanner();
    store.error = message;
};

// Saves go out one at a time, in the order they were made. Otherwise a module that
// uses a just-created type could reach the database before the type does, and be
// rejected for pointing at a type that does not exist yet.
let queue = Promise.resolve();
const save = (request, what) => {
    queue = queue.then(() => send(request, what)).catch(() => {});
    return queue;
};

export const dismissError = () => {
    store.error = '';
};

export const fileData = (newData) => {
    store.upComingData = newData;
};

export const addEvent = (entry) => {
    const event = { ...entry, id: entry.id ?? newId() };
    store.addedEvents.push(event);
    save(() => supabase.from('activities').insert(activityToRow(event)), 'the activity');
};

export const addType = (type) => {
    store.types.push(type);
    save(() => supabase.from('types').insert(typeToRow(type)), 'the type');
};

export const addModule = (module) => {
    store.modules.push(module);
    save(() => supabase.from('modules').insert(moduleToRow(module)), 'the module');
};

const replaceById = (list, item) => {
    const index = list.findIndex((existing) => existing.id === item.id);
    if (index !== -1) list[index] = item;
};

// An imported calendar, planned by ical.js. Saved as one request per table, types
// first, so modules and activities never point at a type the database lacks yet.
export const importPlanner = ({ types = [], modules = [], activities = [] }) => {
    store.types.push(...types);
    store.modules.push(...modules);
    store.addedEvents.push(...activities);
    if (types.length) save(() => supabase.from('types').insert(types.map(typeToRow)), 'the imported types');
    if (modules.length) save(() => supabase.from('modules').insert(modules.map(moduleToRow)), 'the imported modules');
    if (activities.length) save(() => supabase.from('activities').insert(activities.map(activityToRow)), 'the imported activities');
};

export const updateEvent = (entry) => {
    replaceById(store.addedEvents, entry);
    save(() => supabase.from('activities').update(withoutId(activityToRow(entry))).eq('id', entry.id), 'the activity');
};

export const deleteEvent = (id) => {
    store.addedEvents = store.addedEvents.filter((e) => e.id !== id);
    save(() => supabase.from('activities').delete().eq('id', id), 'the deletion');
};

export const updateType = (type) => {
    replaceById(store.types, type);
    save(() => supabase.from('types').update(withoutId(typeToRow(type))).eq('id', type.id), 'the type');
};

// Clear references on screen too; the database does the same through its
// ON DELETE SET NULL foreign keys.
export const deleteType = (id) => {
    store.types = store.types.filter((t) => t.id !== id);
    for (const m of store.modules) if (m.typeId === id) m.typeId = '';
    for (const e of store.addedEvents) if (e.typeId === id) e.typeId = '';
    save(() => supabase.from('types').delete().eq('id', id), 'the deletion');
};

export const updateModule = (module) => {
    replaceById(store.modules, module);
    save(() => supabase.from('modules').update(withoutId(moduleToRow(module))).eq('id', module.id), 'the module');
};

// Meetings booked through a booking link are created by the database's book_meeting
// function (supabase/schema.sql) and show up here on the next load.

// A module's own days disappear with it; activities linked to it are unlinked.
export const deleteModule = (id) => {
    store.modules = store.modules.filter((m) => m.id !== id);
    for (const e of store.addedEvents) if (e.moduleId === id) e.moduleId = '';
    save(() => supabase.from('modules').delete().eq('id', id), 'the deletion');
};
