const DEFAULT_PORT = 3000;
const DEFAULT_ENDPOINT_PATH = '/whatsapp-flow';
const DEFAULT_TIMEZONE = 'Europe/Berlin';
const DEFAULT_STUDIO_ADDRESS = 'Brückenstraße 54, Frankfurt am Main';
const DEFAULT_BOOKING_HORIZON_DAYS = 180;
const DEFAULT_CALENDAR_MONTH_COUNT = 6;
const DEFAULT_CONSULTATION_DURATION_MINUTES = 30;
const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_WORKDAY_START_HOUR = 12;
const DEFAULT_WORKDAY_END_HOUR = 18;

function readInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readMultilineSecret(name) {
  const raw = process.env[name];
  if (!raw) return '';
  return raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
}

function normalizePath(value) {
  if (!value) return DEFAULT_ENDPOINT_PATH;
  return value.startsWith('/') ? value : `/${value}`;
}

export const config = {
  port: readInteger('PORT', DEFAULT_PORT),
  endpointPath: normalizePath(process.env.FLOW_ENDPOINT_PATH),
  appSecret: process.env.APP_SECRET?.trim() || '',
  privateKey: readMultilineSecret('PRIVATE_KEY'),
  passphrase: process.env.PASSPHRASE || '',
  studioAddress: process.env.STUDIO_ADDRESS?.trim() || DEFAULT_STUDIO_ADDRESS,
  calendarTimezone: process.env.CALENDAR_TIMEZONE?.trim() || DEFAULT_TIMEZONE,
  bookingHorizonDays: readInteger('BOOKING_HORIZON_DAYS', DEFAULT_BOOKING_HORIZON_DAYS),
  calendarMonthCount: readInteger('CALENDAR_MONTH_COUNT', DEFAULT_CALENDAR_MONTH_COUNT),
  consultationDurationMinutes: readInteger('CONSULTATION_DURATION_MINUTES', DEFAULT_CONSULTATION_DURATION_MINUTES),
  slotIntervalMinutes: readInteger('SLOT_INTERVAL_MINUTES', DEFAULT_SLOT_INTERVAL_MINUTES),
  workdayStartHour: readInteger('WORKDAY_START_HOUR', DEFAULT_WORKDAY_START_HOUR),
  workdayEndHour: readInteger('WORKDAY_END_HOUR', DEFAULT_WORKDAY_END_HOUR),
  googleProjectId: process.env.GOOGLE_PROJECT_ID?.trim() || '',
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL?.trim() || '',
  googlePrivateKey: readMultilineSecret('GOOGLE_PRIVATE_KEY'),
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || '',
};

export function hasEncryptionConfig() {
  return Boolean(config.privateKey && config.passphrase);
}

export function hasGoogleCalendarConfig() {
  return Boolean(
    config.googleClientEmail &&
    config.googlePrivateKey &&
    config.googleCalendarId,
  );
}
