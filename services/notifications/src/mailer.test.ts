import { describe, expect, it } from "vitest";
import { ConsoleMailer } from "./mailer";
import { createMailerFromEnv } from "./smtp";

describe("notifications", () => {
  it("ConsoleMailer sammelt Nachrichten statt sie zu versenden", async () => {
    const mailer = new ConsoleMailer();
    await mailer.send({ to: "a@x.de", subject: "Hi", text: "Test" });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("a@x.de");
  });

  // R-0679: ohne Mailserver landet die Nachricht ersatzweise im Protokoll — Ereignis und Betreff,
  // nie Empfänger oder Text (der Text der Zurücksetzen-Mail trägt einen gültigen Link).
  it("R-0679: ConsoleMailer meldet jede Nachricht an die Logsenke — ohne Empfänger und Text", async () => {
    const mailer = new ConsoleMailer();
    const zeilen: unknown[] = [];
    await mailer.send({ to: "vorher@x.de", subject: "Vorher", text: "ohne Senke" });
    mailer.logAn((zeile) => zeilen.push(zeile));
    await mailer.send({
      to: "a@x.de",
      subject: "KLARWERK: Passwort zurücksetzen",
      text: "https://klarwerk.local/reset?token=GEHEIM",
    });
    expect(zeilen).toEqual([
      { event: "mail_ersatzzustellung", betreff: "KLARWERK: Passwort zurücksetzen" },
    ]);
    expect(JSON.stringify(zeilen)).not.toMatch(/a@x\.de|GEHEIM/);
    expect(mailer.sent).toHaveLength(2);
  });

  it("createMailerFromEnv: ohne SMTP_HOST undefined, mit Host definiert", () => {
    expect(createMailerFromEnv({})).toBeUndefined();
    expect(createMailerFromEnv({ SMTP_HOST: "smtp.example.com" })).toBeDefined();
  });
});
