import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS(to: string, message: string) {
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured in environment variables');
  }

  const client = twilio(accountSid, authToken);

  try {
    const response = await client.messages.create({
      body: message,
      from: fromPhone,
      to: to
    });
    console.log(`Real SMS sent via Twilio to ${to}: SID ${response.sid}`);
    return response;
  } catch (error) {
    console.error('Twilio Integration Error:', error);
    throw error;
  }
}
