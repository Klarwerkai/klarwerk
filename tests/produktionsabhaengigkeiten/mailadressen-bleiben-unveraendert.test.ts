// ================================================================================================
// JOB 4272 · 6d — DIE EMPFÄNGERADRESSE GEHT UNVERÄNDERT IN NODEMAILER.
// ================================================================================================
//
// DIE MELDUNG: `nodemailer` 6.10.1 trägt unter anderem GHSA-2x7j-588g-ccc2 („quadratic time
// complexity in addressparser", high, <9.1.0) und GHSA-cc9r-2j5m-2m83 („recipient-domain validation
// bypass via RFC 5322 comment mis-parsing", moderate, >=6.9.16 <9.1.0). Beide sitzen im
// ADRESSPARSER — und genau dorthin reicht Klarwerk die Empfängeradresse:
// `services/notifications/src/smtp.ts:16` `createTransport`, `:24-26` `sendMail({ to: message.to })`.
//
// KEIN ECHTER VERSAND, KEIN ECHTER SERVER, KEINE ECHTE ADRESSE. Gemessen wird gegen nodemailers
// EIGENES Transport-Doppel (`jsonTransport`): es durchläuft den vollständigen echten Adressparser
// und legt das Ergebnis als JSON hin, statt eine Verbindung zu öffnen. Alle Adressen unten sind
// synthetisch und enden auf `.invalid` (RFC 2606 — eine Domain, die es nie geben wird).
//
// ZWEI VERSCHIEDENE FRAGEN, ZWEI VERSCHIEDENE FÄLLE, und sie werden nicht vermischt:
//   (A) KLARWERKS EIGENE KETTE: reicht `smtpMailer` die Adresse UNVERÄNDERT durch? Das ist die
//       Zusage, die Klarwerk gibt, und sie gilt unabhängig von jeder Paketversion.
//   (B) NODEMAILERS PARSER: was macht der gebundene Stand mit geformten Eingaben? Das ist eine
//       MESSUNG des Fremdverhaltens, kein Qualitätsurteil — s. den Block bei Fall (B).
import { describe, expect, it, vi } from "vitest";
import { adressBefund } from "./waechter";

// Das Transport-Doppel für Fall (A). Es ersetzt NUR den Verbindungsaufbau; gemessen wird, was
// `smtpMailer` ihm übergibt. Fall (B) umgeht dieses Doppel bewusst über `importActual` — dort soll
// ja gerade der ECHTE Parser laufen.
const gesendet: Record<string, unknown>[] = [];
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (nachricht: Record<string, unknown>) => {
        gesendet.push(nachricht);
        return { messageId: "doppel" };
      },
    }),
  },
}));

const { smtpMailer } = await import("../../services/notifications/src/smtp");

/**
 * Nur der Ausschnitt von nodemailer, den Fall (B) wirklich benutzt.
 *
 * Bewusst KEIN `typeof import("nodemailer").default`: `@types/nodemailer` ist eine CJS-Deklaration
 * ohne exportiertes `default`, und der Wurzel-tsc bricht daran ab (TS2694, gemessen im Cloud-Lauf
 * 7ddff7179521c9e3c4942b3b). Eine schmale eigene Form ist hier auch die ehrlichere: sie sagt, was
 * dieser Test von der Fremdbibliothek erwartet, statt deren ganze Oberfläche zu behaupten.
 */
interface JsonTransport {
  sendMail(nachricht: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ envelope?: { to?: string[] } }>;
}

const echterNodemailer = (
  await vi.importActual<{
    default: { createTransport(opts: { jsonTransport: boolean }): JsonTransport };
  }>("nodemailer")
).default;

/** Synthetische Adressen. Keine davon existiert; `.invalid` ist per RFC 2606 unauflösbar. */
const GEWOEHNLICH = "klara.pruefung@beispiel.invalid";

describe("JOB 4272 · 6d (A) — Klarwerk reicht die Adresse unverändert durch", () => {
  it("smtpMailer übergibt genau die Empfängeradresse, die es bekommen hat", async () => {
    gesendet.length = 0;
    const mailer = smtpMailer({
      host: "smtp.beispiel.invalid",
      port: 587,
      from: "absender@beispiel.invalid",
    });
    await mailer.send({ to: GEWOEHNLICH, subject: "Einladung", text: "Bitte anmelden." });
    expect(gesendet).toHaveLength(1);
    // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine VERFÄLSCHENDE Weitergabe; dort muss
    // sie reden, hier muss sie schweigen.
    expect(adressBefund(GEWOEHNLICH, gesendet[0]?.to)).toBeNull();
    expect(gesendet[0]?.from).toBe("absender@beispiel.invalid");
    expect(gesendet[0]?.subject).toBe("Einladung");
  });

  it("auch eine Adresse mit ungewöhnlicher, aber zulässiger Form geht unverfälscht hinein", async () => {
    gesendet.length = 0;
    const mailer = smtpMailer({
      host: "smtp.beispiel.invalid",
      port: 587,
      from: "absender@beispiel.invalid",
    });
    for (const to of [
      "vorname.nachname+etikett@teil.beispiel.invalid",
      "UPPER.Case@Beispiel.Invalid",
      '"seltsam, name"@beispiel.invalid',
    ]) {
      await mailer.send({ to, subject: "s", text: "t" });
      expect(gesendet.at(-1)?.to, `Adresse verändert: ${to}`).toBe(to);
    }
  });
});

// ================================================================================================
// FALL (B) — WAS DER GEBUNDENE PARSER TUT. EINE MESSUNG, KEINE BILLIGUNG.
// ================================================================================================
//
// Die Zusicherungen hier halten fest, was `nodemailer` 6.10.1 in dieser Runde nachweislich getan
// hat. Sie sagen NICHT, dass dieses Verhalten richtig ist — bei zwei der Eingaben ist es das
// erkennbar nicht (s. die Kommentare an den Fällen). Sie sind ein STOLPERDRAHT: wird einer rot, hat
// sich der Adressparser geändert, und die Einordnung von `nodemailer` gehört neu gemacht.
// Das ist dann kein Defekt — es ist der Anlass zur Neubewertung.
describe("JOB 4272 · 6d (B) — der gebundene Adressparser, gemessen", () => {
  const transport = echterNodemailer.createTransport({ jsonTransport: true });

  async function envelopeVon(to: string): Promise<{ to: string[]; ms: number }> {
    const t0 = Date.now();
    const info = await transport.sendMail({
      from: "absender@beispiel.invalid",
      to,
      subject: "Messung",
      text: "Messung",
    });
    return { to: (info.envelope?.to ?? []) as string[], ms: Date.now() - t0 };
  }

  it("eine gewöhnliche Adresse überlebt den Parser unverändert", async () => {
    const { to } = await envelopeVon(GEWOEHNLICH);
    expect(to).toEqual([GEWOEHNLICH]);
  });

  it("MESSPUNKT: eine zitierte lokale Teiladresse überlebt NICHT unverändert", async () => {
    // RFC 5322 erlaubt `"seltsam, name"@…` als EINE Adresse. Der gebundene Parser zerlegt sie am
    // Komma und liefert `name@beispiel.invalid` — eine ANDERE Adresse als die übergebene.
    // Klarwerk trifft das heute nicht (die Empfänger sind Kontoadressen aus dem eigenen Bestand),
    // aber es ist genau die Klasse, die GHSA-cc9r-2j5m-2m83 beschreibt.
    const { to } = await envelopeVon('"seltsam, name"@beispiel.invalid');
    expect(to).toEqual(["name@beispiel.invalid"]);
  });

  it("MESSPUNKT: eine Adresse in RFC-5322-Kommentarklammern verliert ihren Empfänger ganz", async () => {
    // Vierzig Klammerpaare um eine gültige Adresse: der Parser liefert GAR KEINEN Empfänger mehr.
    // Eine so gebaute Nachricht ginge an niemanden — still.
    const { to } = await envelopeVon(`${"(".repeat(40)}${GEWOEHNLICH}${")".repeat(40)}`);
    expect(to).toEqual([]);
  });

  it("die Verarbeitung TERMINIERT auch bei langen, geformten Eingaben", async () => {
    // GHSA-2x7j-588g-ccc2 beschreibt quadratische Laufzeit im Adressparser. Mit diesen Eingaben ist
    // sie NICHT reproduziert worden (gemessen: 12.800 Trennzeichen in 157 ms, Cloud-Lauf
    // 2eaa6532017b3edae58ef27b) — das ist eine Fehlanzeige für DIESE Eingabeformen und kein Beweis
    // der Abwesenheit. Was hier gehalten wird, ist die schwächere, wahre Aussage: es terminiert.
    for (const n of [200, 3200, 12_800]) {
      const { ms } = await envelopeVon(`${"a,".repeat(n)}${GEWOEHNLICH}`);
      expect(ms, `Adressliste mit ${n} Trennzeichen brauchte ${ms} ms`).toBeLessThan(5_000);
    }
    for (const n of [200, 3200]) {
      const { ms } = await envelopeVon(`${"(".repeat(n)}${")".repeat(n)}${GEWOEHNLICH}`);
      expect(ms, `${n} Klammerpaare brauchten ${ms} ms`).toBeLessThan(5_000);
    }
  });
});
