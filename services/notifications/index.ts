// Öffentliche API des Moduls notifications.
export {
  ConsoleMailer,
  type ErsatzzustellungLogzeile,
  type Mailer,
  type MailMessage,
} from "./src/mailer";
export { smtpMailer, createMailerFromEnv, type SmtpConfig } from "./src/smtp";
// R-0679 / FR-VAL-07: Geräte-Push (VAPID, ohne Nutzlast) als zweiter Versandweg.
export {
  createPushFromEnv,
  InMemoryPushAboRepo,
  PgPushAboRepo,
  PUSH_ABO_SCHEMA,
  PUSH_DIENSTE,
  type PushAbo,
  type PushAboRepo,
  type PushConfig,
  type PushErgebnis,
  type PushFetch,
  PushKonfigurationError,
  type PushSender,
  pushEndpunktErlaubt,
  vapidJwt,
  vapidPushSender,
} from "./src/push";
// Audit-P3 (SCRUM-397): Gelesen-Status der Glocke — Datenhoheit hier im Modul.
export {
  InMemoryNotificationSeenRepo,
  NOTIFICATION_SEEN_SCHEMA,
  type NotificationSeenRepo,
  PgNotificationSeenRepo,
} from "./src/seen";
