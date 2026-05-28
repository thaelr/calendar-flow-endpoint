import { config } from './config.js';

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

function slotSeed(parts, slotIndex) {
  return (parts.year * 10000) + (parts.month * 100) + parts.day + slotIndex;
}

function buildMonthOption(year, month) {
  return {
    id: `${year}-${pad(month)}`,
    title: monthTitle(year, month, config.calendarTimezone),
  };
}

function buildDateOption(parts) {
  const enabled = isInsideBookingWindow(parts) && isConsultationDay(parts);
  return {
    id: formatYmd(parts),
    title: dateTitle(parts, config.calendarTimezone),
    enabled,
  };
}

function baseTimeSlots() {
  const items = [];
  for (let hour = 12; hour <= 17; hour += 1) {
    items.push(`${pad(hour)}:00`);
    items.push(`${pad(hour)}:30`);
  }
  return items;
}

function buildTimeOptions(dateId) {
  const parts = parseYmd(dateId);
  if (!parts) return [];

  const openDay = isInsideBookingWindow(parts) && isConsultationDay(parts);
  const rawSlots = baseTimeSlots().map((time, index) => {
    const busy = slotSeed(parts, index) % 4 === 0;
    return {
      id: time,
      title: time,
      enabled: openDay && !busy,
    };
  });

  if (openDay && !rawSlots.some((slot) => slot.enabled)) {
    return rawSlots.map((slot, index) => ({
      ...slot,
      enabled: index < 2,
    }));
  }

  return rawSlots;
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

export function listDateOptions(monthId) {
  const month = parseMonthId(monthId);
  if (!month) return [];

  const result = [];
  const totalDays = daysInMonth(month.year, month.month);

  for (let day = 1; day <= totalDays; day += 1) {
    result.push(buildDateOption({
      year: month.year,
      month: month.month,
      day,
    }));
  }

  return result;
}

export function listTimeOptions(dateId) {
  return buildTimeOptions(dateId);
}

export function buildAppointmentScreen({ selectedMonth = '', selectedDate = '' } = {}) {
  return {
    screen: 'APPOINTMENT',
    data: {
      studio_address: config.studioAddress,
      month: listMonthOptions(),
      date: selectedMonth ? listDateOptions(selectedMonth) : [],
      is_date_enabled: Boolean(selectedMonth),
      time: selectedDate ? listTimeOptions(selectedDate) : [],
      is_time_enabled: Boolean(selectedDate),
    },
  };
}

export function buildSummaryPayload(payload) {
  const dateTitleValue = listDateOptions(payload.month).find((item) => item.id === payload.date)?.title || payload.date;

  const appointment = `Consultation at ${config.studioAddress}\n${dateTitleValue} at ${payload.time}.`;
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
