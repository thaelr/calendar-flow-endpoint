const DEFAULT_PORT = 3000;
const DEFAULT_ENDPOINT_PATH = '/whatsapp-flow';
const DEFAULT_TIMEZONE = 'Europe/Berlin';
const DEFAULT_STUDIO_ADDRESS = 'Brückenstraße 54, Frankfurt am Main';
const DEFAULT_BOOKING_HORIZON_DAYS = 180;
const DEFAULT_CALENDAR_MONTH_COUNT = 6;

function readInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizePath(value) {
  if (!value) return DEFAULT_ENDPOINT_PATH;
  return value.startsWith('/') ? value : `/${value}`;
}

export const config = {
  port: readInteger('PORT', DEFAULT_PORT),
  endpointPath: normalizePath(process.env.FLOW_ENDPOINT_PATH),
  appSecret: process.env.APP_SECRET?.trim() || '',
  privateKey: process.env.PRIVATE_KEY || '',
  passphrase: process.env.PASSPHRASE || '',
  studioAddress: process.env.STUDIO_ADDRESS?.trim() || DEFAULT_STUDIO_ADDRESS,
  calendarTimezone: process.env.CALENDAR_TIMEZONE?.trim() || DEFAULT_TIMEZONE,
  bookingHorizonDays: readInteger('BOOKING_HORIZON_DAYS', DEFAULT_BOOKING_HORIZON_DAYS),
  calendarMonthCount: readInteger('CALENDAR_MONTH_COUNT', DEFAULT_CALENDAR_MONTH_COUNT),
};

export function hasEncryptionConfig() {
  return Boolean(config.privateKey && config.passphrase);
}
