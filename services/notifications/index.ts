// Öffentliche API des Moduls notifications.
export { ConsoleMailer, type Mailer, type MailMessage } from "./src/mailer";
export { smtpMailer, createMailerFromEnv, type SmtpConfig } from "./src/smtp";
