import { config, hasBookingCallbackConfig } from './config.js';

function parseFlowToken(flowToken) {
  const normalized = String(flowToken || '').trim();
  const match = /^waba-flow-(\d+)-(\d+)-(\d+)$/.exec(normalized);
  if (!match) {
    return {
      chatwootConversationId: null,
      sourceTurnNo: null,
      issuedAtMs: null,
    };
  }

  return {
    chatwootConversationId: Number.parseInt(match[1], 10),
    sourceTurnNo: Number.parseInt(match[2], 10),
    issuedAtMs: Number.parseInt(match[3], 10),
  };
}

function buildCallbackHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.bookingCallbackSecret) {
    headers['X-Booking-Callback-Secret'] = config.bookingCallbackSecret;
  }

  return headers;
}

export async function sendBookedStatusCallback(payload, bookingResult, flowToken) {
  if (!hasBookingCallbackConfig()) {
    return {
      skipped: true,
      reason: 'missing_callback_url',
    };
  }

  const parsedFlowToken = parseFlowToken(flowToken);

  const callbackPayload = {
    source: 'WhatsApp Flow',
    stage_key: 'consultation_booked',
    consultation_status: 'booked',
    booking_status: bookingResult?.status || 'unknown',
    flow_token: flowToken || '',
    chatwoot_conversation_id: parsedFlowToken.chatwootConversationId,
    source_turn_no: parsedFlowToken.sourceTurnNo,
    google_event_id: bookingResult?.eventId || '',
    google_event_link: bookingResult?.eventLink || '',
    studio_address: config.studioAddress,
    month: payload?.month || '',
    date: payload?.date || '',
    time: payload?.time || '',
    name: payload?.name || '',
    email: payload?.email || '',
    phone: payload?.phone || '',
    more_details: payload?.more_details || '',
    booked_at: new Date().toISOString(),
  };

  const response = await fetch(config.bookingCallbackUrl, {
    method: 'POST',
    headers: buildCallbackHeaders(),
    body: JSON.stringify(callbackPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Booking callback failed: ${response.status} ${text}`);
  }

  return {
    skipped: false,
    statusCode: response.status,
  };
}
