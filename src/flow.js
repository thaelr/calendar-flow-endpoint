import {
  buildAppointmentScreen,
  buildSummaryPayload,
  confirmConsultationBooking,
} from './mock-calendar.js';

function buildDetailsScreen(data = {}) {
  return {
    screen: 'DETAILS',
    data: {
      studio_address: data.studio_address,
      month: data.month,
      date: data.date,
      time: data.time,
    },
  };
}

function buildExtensionMessageResponse(flowToken, data = {}, bookingResult = {}) {
  return {
    screen: 'SUCCESS',
    data: {
      extension_message_response: {
        params: {
          flow_token: flowToken,
          flow_result: 'consultation_requested',
          studio_address: data.studio_address,
          month: data.month,
          date: data.date,
          time: data.time,
          name: data.name,
          email: data.email,
          phone: data.phone,
          more_details: data.more_details || '',
          booking_status: bookingResult.status || 'unknown',
          google_event_id: bookingResult.eventId || '',
        },
      },
    },
  };
}

export async function getNextScreen(payload) {
  const action = payload?.action;
  const screen = payload?.screen;
  const data = payload?.data ?? {};
  const flowToken = payload?.flow_token ?? null;

  if (action === 'ping') {
    return {
      data: {
        status: 'active',
      },
    };
  }

  if (data?.error) {
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  if (action === 'INIT') {
    return buildAppointmentScreen();
  }

  if (screen === 'APPOINTMENT' && action === 'data_exchange') {
    if (data.trigger === 'month_selected') {
      return buildAppointmentScreen({
        selectedMonth: data.month || '',
      });
    }

    if (data.trigger === 'date_selected') {
      return buildAppointmentScreen({
        selectedMonth: data.month || '',
        selectedDate: data.date || '',
      });
    }
  }

  if (screen === 'DETAILS' && action === 'data_exchange') {
    const requiredFields = ['month', 'date', 'time', 'name', 'email', 'phone'];
    const missing = requiredFields.find((field) => !String(data[field] || '').trim());
    if (missing) {
      return buildDetailsScreen(data);
    }

    return buildSummaryPayload(data);
  }

  if (screen === 'SUMMARY' && action === 'data_exchange') {
    const bookingResult = await confirmConsultationBooking(data, flowToken);
    console.log('[flow] booking result', {
      status: bookingResult.status,
      eventId: bookingResult.eventId || null,
      date: data.date || null,
      time: data.time || null,
      email: data.email || null,
      phone: data.phone || null,
    });

    if (bookingResult.status === 'slot_unavailable' && bookingResult.refreshedScreen) {
      return bookingResult.refreshedScreen;
    }

    return buildExtensionMessageResponse(flowToken, data, bookingResult);
  }

  return {
    screen: 'APPOINTMENT',
    data: {
      studio_address: data.studio_address,
      month: [],
      date: [],
      is_date_enabled: false,
      time: [],
      is_time_enabled: false,
    },
  };
}
