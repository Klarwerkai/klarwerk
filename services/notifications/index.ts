// Öffentliche API des Moduls notifications.
export { ConsoleMailer, type Mailer, type MailMessage } from "./src/mailer";
export { smtpMailer, createMailerFromEnv, type SmtpConfig } from "./src/smtp";
// Audit-P3 (SCRUM-397): Gelesen-Status der Glocke — Datenhoheit hier im Modul.
export {
  InMemoryNotificationSeenRepo,
  NOTIFICATION_SEEN_SCHEMA,
  type NotificationSeenRepo,
  PgNotificationSeenRepo,
} from "./src/seen";
