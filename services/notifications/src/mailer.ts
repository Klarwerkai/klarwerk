// Anbieteragnostische E-Mail-Schnittstelle. Konkrete Adapter (SMTP) liegen daneben;
// der Schlüssel/Zugang lebt nur serverseitig im Adapter (FR-AUTH-08, FR-VAL-07).
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// Dev/Test-Fallback: sammelt Nachrichten statt sie zu versenden (kein SMTP konfiguriert).
export class ConsoleMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}
