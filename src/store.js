// The planning data every page shares. Types, modules and added activities are
// saved to localStorage so they survive a reload; shapes are documented in planner.js.

import { reactive, watch } from 'vue';

const STORAGE_KEY = 'workmore:planner:v1';

const loadSaved = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        // Unreadable or blocked storage: start empty rather than fail to load the app.
        return {};
    }
};

const saved = loadSaved();
const listOr = (value) => (Array.isArray(value) ? value : []);

export const store = reactive({
    // Imported training program text, one entry per day starting today. Filled by
    // the file import (Importcal), which is switched off for now; '...' means empty.
    upComingData: ['...', '...', '...', '...', '...'],
    currentWeekNumber: 32,

    addedEvents: listOr(saved.addedEvents),
    types: listOr(saved.types),
    modules: listOr(saved.modules),
});

watch(
    () => ({ addedEvents: store.addedEvents, types: store.types, modules: store.modules }),
    (data) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // Storage full or blocked; the data still lives for this session.
        }
    },
    { deep: true }
);

export const fileData = (newData) => {
    store.upComingData = newData;
};

export const addEvent = (entry) => {
    store.addedEvents.push(entry);
};

export const addType = (type) => {
    store.types.push(type);
};

export const addModule = (module) => {
    store.modules.push(module);
};

const replaceById = (list, item) => {
    const index = list.findIndex((existing) => existing.id === item.id);
    if (index !== -1) list[index] = item;
};

export const updateType = (type) => {
    replaceById(store.types, type);
};

// Clear references too, so nothing keeps pointing at a type that no longer exists.
export const deleteType = (id) => {
    store.types = store.types.filter((t) => t.id !== id);
    for (const m of store.modules) if (m.typeId === id) m.typeId = '';
    for (const e of store.addedEvents) if (e.typeId === id) e.typeId = '';
};

export const updateModule = (module) => {
    replaceById(store.modules, module);
};

// A module's own days disappear with it; activities linked to it are unlinked.
export const deleteModule = (id) => {
    store.modules = store.modules.filter((m) => m.id !== id);
    for (const e of store.addedEvents) if (e.moduleId === id) e.moduleId = '';
};
