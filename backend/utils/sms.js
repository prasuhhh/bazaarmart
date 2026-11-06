import { ApiError } from './response.js';

// textbee sends each message from the SIM of an Android phone running its app.
const TEXTBEE_SEND_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';
const SEND_TIMEOUT_MS = 10_000;

export const isSmsMock = () => process.env.OTP_MOCK === 'true';

export const isSmsConfigured = () => isSmsMock() || Boolean(process.env.TEXTBEE_API_KEY);

const sendFailed = reason => {
  console.error(`SMS send failed: ${reason}`);
  return new ApiError(503, 'We could not send the SMS. Please try again.');
};

// A resolved send means textbee queued the message for the phone, not that it arrived.
export async function sendSms(phone, message) {
  if (isSmsMock()) {
    console.log(`[mock SMS] to ${phone}: ${message}`);
    return;
  }

  let response;
  try {
    response = await fetch(TEXTBEE_SEND_URL, {
      method: 'POST',
      headers: { 'x-api-key': process.env.TEXTBEE_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: [phone], message }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
  } catch (error) {
    throw sendFailed(error.message);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw sendFailed(`textbee ${response.status} ${body.error ?? body.message ?? ''}`.trim());
  if (body.data?.failureCount > 0) throw sendFailed('textbee could not reach the phone');
  if (body.data?.warning) console.warn(`SMS warning: ${body.data.warning.code}`);
}
