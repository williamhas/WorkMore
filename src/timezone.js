// Time zone helpers built on the browser's Intl support, used by the calendar import
// and by the booking page (which shows the host's times to visitors anywhere).

export const zoneExists = (tz) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const partsIn = (instant, tz) =>
    Object.fromEntries(
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

// Minutes a time zone is ahead of UTC at a given instant.
export const zoneOffset = (instant, tz) => {
    const p = partsIn(instant, tz);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return (asUtc - instant.getTime()) / 60000;
};

// The instant a wall-clock time in `tz` refers to. The second pass settles times
// near a daylight-saving change.
export const zonedInstant = (y, mo, d, h, mi, tz) => {
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    let guess = wall - zoneOffset(new Date(wall), tz) * 60000;
    guess = wall - zoneOffset(new Date(guess), tz) * 60000;
    return new Date(guess);
};

// Today's date and the minutes past midnight, as they are in `tz` right now.
export const nowIn = (tz, now = new Date()) => {
    const p = partsIn(now, tz);
    return { dateKey: p.year + '-' + p.month + '-' + p.day, minutes: +p.hour * 60 + +p.minute };
};
