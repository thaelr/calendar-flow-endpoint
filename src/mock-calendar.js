import crypto from 'crypto';
import { config, hasGoogleCalendarConfig } from './config.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

const tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatYmd(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function parseYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseMonthId(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayIndex(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
}

function addDays(parts, offset) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  date.setUTCDate(date.getUTCDate() + offset);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addMonths(parts, offset) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1, 12));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  };
}

function todayInTimezone(timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const result = {};
  for (const part of parts) {
    if (part.type === 'year') result.year = Number(part.value);
    if (part.type === 'month') result.month = Number(part.value);
    if (part.type === 'day') result.day = Number(part.value);
  }
  return result;
}

function monthTitle(year, month, timeZone) {
  const date = new Date(Date.UTC(year, month - 1, 1, 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function dateTitle(parts, timeZone) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function timeRangeTitle(parts, timeLabel) {
  const bounds = slotBounds(parts, timeLabel);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.calendarTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(bounds.start);
}

function absoluteDay(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function isInsideBookingWindow(parts) {
  const today = todayInTimezone(config.calendarTimezone);
  const maxDay = absoluteDay(addDays(today, config.bookingHorizonDays));
  const currentDay = absoluteDay(parts);
  return currentDay >= absoluteDay(today) && currentDay <= maxDay;
}

function isConsultationDay(parts) {
  const weekday = weekdayIndex(parts);
  return weekday >= 1 && weekday <= 5;
}

function buildMonthOption(year, month) {
  return {
    id: `${year}-${pad(month)}`,
    title: monthTitle(year, month, config.calendarTimezone),
  };
}

function buildDateOption(parts, enabled) {
  return {
    id: formatYmd(parts),
    title: dateTitle(parts, config.calendarTimezone),
    enabled,
  };
}

function baseTimeSlots() {
  const result = [];
  const startMinutes = config.workdayStartHour * 60;
  const endMinutes = config.workdayEndHour * 60;
  const duration = config.consultationDurationMinutes;
  const step = config.slotIntervalMinutes;

  for (let minute = startMinutes; minute + duration <= endMinutes; minute += step) {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    result.push(`${pad(hours)}:${pad(mins)}`);
  }

  return result;
}

function slotSeed(parts, slotIndex) {
  return (parts.year * 10000) + (parts.month * 100) + parts.day + slotIndex;
}

function mockTimeOptionsForDate(parts) {
  const openDay = isInsideBookingWindow(parts) && isConsultationDay(parts);
  const rawSlots = baseTimeSlots().map((time, index) => ({
    id: time,
    title: time,
    enabled: openDay && (slotSeed(parts, index) % 4 !== 0),
  }));

  if (openDay && !rawSlots.some((slot) => slot.enabled)) {
    return rawSlots.map((slot, index) => ({
      ...slot,
      enabled: index < 2,
    }));
  }

  return rawSlots;
}

function buildMockDateOptions(monthId) {
  const month = parseMonthId(monthId);
  if (!month) return [];

  const result = [];
  const totalDays = daysInMonth(month.year, month.month);

  for (let day = 1; day <= totalDays; day += 1) {
    const parts = { year: month.year, month: month.month, day };
    const enabled = isInsideBookingWindow(parts) && isConsultationDay(parts);
    result.push(buildDateOption(parts, enabled));
  }

  return result;
}

function buildMockTimeOptions(dateId) {
  const parts = parseYmd(dateId);
  if (!parts) return [];
  return mockTimeOptionsForDate(parts);
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createServiceAccountAssertion() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: config.googleClientEmail,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: expiresAt,
    iat: issuedAt,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedToken)
    .sign(config.googlePrivateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${unsignedToken}.${signature}`;
}

async function getGoogleAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: createServiceAccountAssertion(),
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  tokenCache.accessToken = payload.access_token;
  tokenCache.expiresAt = now + (Number(payload.expires_in || 3600) * 1000);
  return tokenCache.accessToken;
}

function getOffsetMillisecondsAtInstant(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const rawParts = formatter.formatToParts(date);
  const parts = {};
  for (const part of rawParts) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

function zonedDateToUtcDate(year, month, day, hour, minute, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getOffsetMillisecondsAtInstant(new Date(guess), timeZone);
    const nextGuess = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
    if (Math.abs(nextGuess - guess) < 1000) {
      guess = nextGuess;
      break;
    }
    guess = nextGuess;
  }

  return new Date(guess);
}

function slotBounds(dateParts, timeLabel) {
  const [hourRaw, minuteRaw] = String(timeLabel).split(':');
  const start = zonedDateToUtcDate(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    Number(hourRaw),
    Number(minuteRaw),
    config.calendarTimezone,
  );

  const end = new Date(start.getTime() + (config.consultationDurationMinutes * 60000));
  return {
    start,
    end,
  };
}

async function fetchBusyIntervals(timeMin, timeMax) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: config.calendarTimezone,
      items: [
        {
          id: config.googleCalendarId,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google freeBusy failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const busy = payload?.calendars?.[config.googleCalendarId]?.busy ?? [];
  return busy.map((item) => ({
    start: Date.parse(item.start),
    end: Date.parse(item.end),
  }));
}

async function insertCalendarEvent(event) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.googleCalendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google events.insert failed: ${response.status} ${text}`);
  }

  return response.json();
}

function slotIsFree(slotStart, slotEnd, busyIntervals) {
  return !busyIntervals.some((busy) => busy.start < slotEnd && busy.end > slotStart);
}

function buildLiveTimeOptions(dateParts, busyIntervals) {
  if (!isInsideBookingWindow(dateParts) || !isConsultationDay(dateParts)) {
    return baseTimeSlots().map((time) => ({
      id: time,
      title: time,
      enabled: false,
    }));
  }

  return baseTimeSlots().map((time) => {
    const bounds = slotBounds(dateParts, time);
    return {
      id: time,
      title: time,
      enabled: slotIsFree(bounds.start.getTime(), bounds.end.getTime(), busyIntervals),
    };
  });
}

async function buildLiveDateOptions(monthId) {
  const month = parseMonthId(monthId);
  if (!month) return [];

  const monthStart = zonedDateToUtcDate(month.year, month.month, 1, 0, 0, config.calendarTimezone);
  const nextMonth = addMonths({ year: month.year, month: month.month, day: 1 }, 1);
  const monthEnd = zonedDateToUtcDate(nextMonth.year, nextMonth.month, 1, 0, 0, config.calendarTimezone);
  const busyIntervals = await fetchBusyIntervals(monthStart.toISOString(), monthEnd.toISOString());

  const result = [];
  const totalDays = daysInMonth(month.year, month.month);

  for (let day = 1; day <= totalDays; day += 1) {
    const parts = { year: month.year, month: month.month, day };
    let enabled = false;

    if (isInsideBookingWindow(parts) && isConsultationDay(parts)) {
      const slots = buildLiveTimeOptions(parts, busyIntervals);
      enabled = slots.some((slot) => slot.enabled);
    }

    result.push(buildDateOption(parts, enabled));
  }

  return result;
}

async function buildLiveTimeOptionsForDate(dateId) {
  const parts = parseYmd(dateId);
  if (!parts) return [];

  const dayStart = zonedDateToUtcDate(parts.year, parts.month, parts.day, 0, 0, config.calendarTimezone);
  const nextDay = addDays(parts, 1);
  const dayEnd = zonedDateToUtcDate(nextDay.year, nextDay.month, nextDay.day, 0, 0, config.calendarTimezone);
  const busyIntervals = await fetchBusyIntervals(dayStart.toISOString(), dayEnd.toISOString());

  return buildLiveTimeOptions(parts, busyIntervals);
}

export function listMonthOptions() {
  const today = todayInTimezone(config.calendarTimezone);
  const result = [];

  for (let offset = 0; offset < config.calendarMonthCount; offset += 1) {
    const absoluteMonth = (today.month - 1) + offset;
    const year = today.year + Math.floor(absoluteMonth / 12);
    const month = (absoluteMonth % 12) + 1;
    result.push(buildMonthOption(year, month));
  }

  return result;
}

export async function listDateOptions(monthId) {
  if (!hasGoogleCalendarConfig()) {
    return buildMockDateOptions(monthId);
  }

  try {
    return await buildLiveDateOptions(monthId);
  } catch (error) {
    console.error('[calendar] falling back to mock dates', error.message);
    return buildMockDateOptions(monthId);
  }
}

export async function listTimeOptions(dateId) {
  if (!hasGoogleCalendarConfig()) {
    return buildMockTimeOptions(dateId);
  }

  try {
    return await buildLiveTimeOptionsForDate(dateId);
  } catch (error) {
    console.error('[calendar] falling back to mock times', error.message);
    return buildMockTimeOptions(dateId);
  }
}

export async function buildAppointmentScreen({ selectedMonth = '', selectedDate = '' } = {}) {
  const months = listMonthOptions();
  const dates = selectedMonth ? await listDateOptions(selectedMonth) : [];
  const times = selectedDate ? await listTimeOptions(selectedDate) : [];

  return {
    screen: 'APPOINTMENT',
    data: {
      studio_address: config.studioAddress,
      month: months,
      date: dates,
      is_date_enabled: Boolean(selectedMonth),
      time: times,
      is_time_enabled: Boolean(selectedDate),
    },
  };
}

export function buildSummaryPayload(payload) {
  const parsedDate = parseYmd(payload.date);
  const dateLabel = parsedDate
    ? dateTitle(parsedDate, config.calendarTimezone)
    : payload.date;

  const appointment = `Consultation at ${config.studioAddress}\n${dateLabel} at ${payload.time}.`;
  const details = [
    `Name: ${payload.name || ''}`,
    `Email: ${payload.email || ''}`,
    `Phone: ${payload.phone || ''}`,
    '',
    payload.more_details || 'No additional details.',
  ].join('\n');

  return {
    screen: 'SUMMARY',
    data: {
      appointment,
      details,
      studio_address: config.studioAddress,
      month: payload.month,
      date: payload.date,
      time: payload.time,
      name: payload.name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      more_details: payload.more_details || '',
    },
  };
}

export async function confirmConsultationBooking(payload, flowToken) {
  const parsedDate = parseYmd(payload.date);
  if (!parsedDate) {
    return {
      status: 'invalid_date',
    };
  }

  if (!hasGoogleCalendarConfig()) {
    return {
      status: 'google_not_configured',
    };
  }

  const slot = slotBounds(parsedDate, payload.time);
  const busyIntervals = await fetchBusyIntervals(slot.start.toISOString(), slot.end.toISOString());

  if (!slotIsFree(slot.start.getTime(), slot.end.getTime(), busyIntervals)) {
    return {
      status: 'slot_unavailable',
      refreshedScreen: await buildAppointmentScreen({
        selectedMonth: payload.month,
        selectedDate: payload.date,
      }),
    };
  }

  const dateLabel = dateTitle(parsedDate, config.calendarTimezone);
  const timeLabel = timeRangeTitle(parsedDate, payload.time);
  const summary = `Consultation - ${payload.name || 'Client'} - WhatsApp`;
  const description = [
    'Source: WhatsApp Flow',
    `Flow token: ${flowToken || ''}`,
    `Name: ${payload.name || ''}`,
    `Email: ${payload.email || ''}`,
    `Phone: ${payload.phone || ''}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    '',
    payload.more_details || 'No additional details.',
  ].join('\n');

  const event = await insertCalendarEvent({
    summary,
    description,
    start: {
      dateTime: slot.start.toISOString(),
      timeZone: config.calendarTimezone,
    },
    end: {
      dateTime: slot.end.toISOString(),
      timeZone: config.calendarTimezone,
    },
    visibility: 'private',
  });

  return {
    status: 'booked',
    eventId: event.id || null,
    eventLink: event.htmlLink || null,
  };
}
