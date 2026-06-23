import nodemailer from "nodemailer";
import type { MailMessage, Mailer } from "./mailer";

// Anbieteragnostischer SMTP-Versand: funktioniert mit jedem SMTP-Server
// (Firmen-Mailserver, Postmark, SendGrid, Mailgun …). Zugang nur per env.
export interface SmtpConfig {
  host: string;
  port: number;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
  secure?: boolean | undefined;
}

export function smtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(message: MailMessage): Promise<void> {
      await transport.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}

// Baut den Mailer aus der Umgebung. Ohne SMTP_HOST → undefined (kein Versand).
export function createMailerFromEnv(
  env: Record<string, string | undefined> = process.env,
): Mailer | undefined {
  if (!env.SMTP_HOST) {
    return undefined;
  }
  return smtpMailer({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM ?? "noreply@klarwerk.local",
    secure: env.SMTP_SECURE === "true",
  });
}
