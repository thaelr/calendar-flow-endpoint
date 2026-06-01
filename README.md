# Woof WhatsApp Flow Endpoint

## What This Project Is

Backend for a `WhatsApp Flow` that lets clients book a consultation directly inside WhatsApp.

The service shows available slots, collects contact details, confirms the booking, and creates the appointment in Google Calendar.

## Booking Flow in 4 Steps

1. The client selects a month, date, and available time slot.
2. They enter their name, phone number, email, and optional notes.
3. They review the booking details before confirming.
4. After confirmation, the appointment summary stays available in the chat.

## Tech Highlights

- `WhatsApp Flow endpoint` for the booking experience
- Secure request handling for `Meta`
- Multi-step booking logic
- `Google Calendar` integration
- Double-booking protection
- Booking details returned back to the WhatsApp chat

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Integration Notes

The project requires `Meta WhatsApp Flow` configuration, encryption keys, and calendar settings.

If `Google Calendar` is not connected, the flow can still run in test mode with mock time slots.
