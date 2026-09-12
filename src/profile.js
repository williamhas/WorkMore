// The signed-in account's profile: its name, picture, booking link code and time
// zone. Pictures live in the Supabase Storage bucket "avatars" under
// <user id>/avatar.jpg; the profiles table keeps the rest. Set up in supabase/schema.sql.

import { reactive, watch } from 'vue';
import { supabase } from './supabase.js';
import { session } from './auth.js';
import { localZone } from './timezone.js';

// bookingCode is '' until the booking-link part of schema.sql has been run.
export const profile = reactive({ avatarUrl: '', displayName: '', bookingCode: '' });

export const MAX_NAME_LENGTH = 60;

const BUCKET = 'avatars';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // what may be picked; it is shrunk before upload
const SIZE = 256; // px, square

const avatarPath = (userId) => userId + '/avatar.jpg';

// Each load gets a number, so a slow response never shows another account's picture.
let latestLoad = 0;

watch(
    () => session.value?.userId,
    async (userId) => {
        const load = ++latestLoad;
        profile.avatarUrl = '';
        profile.displayName = '';
        profile.bookingCode = '';
        if (!supabase || !userId) return;
        // All columns, so this still works before newer columns exist.
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (load !== latestLoad) return;
        profile.avatarUrl = data?.avatar_url ?? '';
        profile.displayName = data?.display_name ?? '';
        profile.bookingCode = data?.booking_code ?? '';

        // Visitors see booking times in the host's time zone, so keep it current.
        const zone = localZone();
        if (data && 'time_zone' in data && data.time_zone !== zone) {
            supabase.from('profiles').update({ time_zone: zone }).eq('id', userId).then(() => {});
        }
    },
    { immediate: true }
);

const friendly = (error) => {
    const message = error?.message ?? '';
    if (/bucket not found|row-level security/i.test(message)) {
        return 'Profile pictures are not set up in Supabase yet: run supabase/schema.sql again in the SQL Editor.';
    }
    return message || 'Something went wrong. Try again.';
};

// Center-crop to a square and scale to SIZE px, so every picture is small and square
// whatever was picked. JPEG has no transparency, so transparent areas turn white.
const toSquareJpeg = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const side = Math.min(img.naturalWidth, img.naturalHeight);
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.88);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That file is not an image this browser can open.'));
        };
        img.src = url;
    });

export const uploadAvatar = async (file) => {
    const userId = session.value?.userId;
    if (!supabase || !userId) throw new Error('Sign in first.');
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file, such as JPG or PNG.');
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Choose an image under 10 MB.');

    const blob = await toSquareJpeg(file);
    const path = avatarPath(userId);
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) throw new Error(friendly(uploadError));

    // The file name never changes, so a version number makes browsers fetch the new one.
    const avatarUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const { error } = await supabase.from('profiles').upsert({ id: userId, avatar_url: avatarUrl });
    if (error) throw new Error(friendly(error));
    profile.avatarUrl = avatarUrl;
};

// A new random code for the booking link; the old link stops working at once.
export const replaceBookingCode = async () => {
    const userId = session.value?.userId;
    if (!supabase || !userId) throw new Error('Sign in first.');
    for (let attempt = 0; attempt < 3; attempt++) {
        const code = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
        const { error } = await supabase.from('profiles').update({ booking_code: code }).eq('id', userId);
        if (!error) {
            profile.bookingCode = code;
            return code;
        }
        // 23505: that code is taken (very unlikely); try another.
        if (error.code !== '23505') throw new Error(friendly(error));
    }
    throw new Error('Could not make a new link. Try again.');
};

// An empty name clears it; the app then shows the email where the name would go.
export const saveDisplayName = async (name) => {
    const userId = session.value?.userId;
    if (!supabase || !userId) throw new Error('Sign in first.');
    const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
    const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: clean || null });
    if (error) throw new Error(friendly(error));
    profile.displayName = clean;
};

export const removeAvatar = async () => {
    const userId = session.value?.userId;
    if (!supabase || !userId) throw new Error('Sign in first.');

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([avatarPath(userId)]);
    if (removeError) throw new Error(friendly(removeError));
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (error) throw new Error(friendly(error));
    profile.avatarUrl = '';
};
