import { sendEmail } from './email';
import { sendSMS } from './twilio';
import { features } from '../config/features';

type NotificationEvent = 
  | 'RegistrationSuccess'
  | 'WalletCreated'
  | 'MoneyAdded'
  | 'WalletTransfer'
  | 'TransactionSuccess'
  | 'TransactionFailed'
  | 'PasswordReset'
  | 'LoginAlert';

interface NotificationPayload {
  toEmail?: string | null;
  toPhone?: string | null;
  subject: string;
  message: string;
  event: NotificationEvent;
}

export async function dispatchNotification(payload: NotificationPayload) {
  try {
    if (features.EMAIL_ENABLED && payload.toEmail) {
      await sendEmail(payload.toEmail, payload.subject, `<p>${payload.message}</p>`);
    }

    if (features.SMS_ENABLED && payload.toPhone) {
      await sendSMS(payload.toPhone, payload.message);
    }
  } catch (error) {
    console.error(`Failed to dispatch notification for event: ${payload.event}`, error);
    // Don't throw to prevent interrupting the main business logic flow
  }
}
