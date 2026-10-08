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

// ================================================================================================
// R-0679 — OHNE MAILSERVER LANDET DIE NACHRICHT ERSATZWEISE IM PROTOKOLL.
// ================================================================================================
//
// Bis hierher sammelte der Fallback nur im Speicher: im Betrieb ohne `SMTP_HOST` verschwand jede
// Benachrichtigung spurlos, und niemand konnte nachlesen, dass eine hätte rausgehen sollen.
//
// WAS INS PROTOKOLL GEHT, IST BEWUSST SCHMAL: das Ereignis und der Betreff. NICHT Empfänger und
// NICHT Text. Der Text der Passwort-Zurücksetzen-Mail trägt einen gültigen Link — im Protokoll
// wäre er ein Zugang für jeden Leser des Logs; Empfänger und Anrede sind Personendaten, die die
// Logregel des Hauses ausdrücklich fernhält (`build-app.ts`, Logserialisierer). Beide Betreffzeilen
// des Produkts sind feste Sätze ohne Personenbezug (`auth/src/routes.ts`, `app/src/notify.ts`).
export interface ErsatzzustellungLogzeile {
  event: "mail_ersatzzustellung";
  betreff: string;
}

// Dev/Test-Fallback: sammelt Nachrichten statt sie zu versenden (kein SMTP konfiguriert) und
// meldet jede einzelne an die Logsenke, sobald die App sie verbunden hat (`logAn`).
export class ConsoleMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  private log: ((zeile: ErsatzzustellungLogzeile) => void) | undefined;

  /** Die Logsenke entsteht erst mit der App (Fastify-Logger) — deshalb nachträglich verbunden. */
  logAn(log: (zeile: ErsatzzustellungLogzeile) => void): void {
    this.log = log;
  }

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    this.log?.({ event: "mail_ersatzzustellung", betreff: message.subject });
  }
}
