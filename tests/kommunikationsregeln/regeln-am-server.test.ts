// ================================================================================================
// ADMIN-12 · KOMMUNIKATIONSREGELN UND VERÖFFENTLICHUNGSWIRKUNG · SERVER
// (produkt:20261007:veroeffentlichungsoptionen:admin-20261009).
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`, `app.inject`).
// Nur die Vorbereitung der Fassungen (Gültigsetzen, Einstufen) läuft über die vorhandenen Dienste;
// jeder Schritt der Regeln, der Veröffentlichung, der Kenntnisnahme und der Glocke geht über HTTP.
// Fiktive Beispielkonten (`*@kommunikation.test`), keine produktiven Daten.
//
// MAIL NUR IM ISOLIERTEN TESTKANAL: wo Mail eingerichtet sein soll, ersetzt ein `Testpostfach` den
// Mailer der Instanz VOR `buildApp`. Es nimmt Nachrichten an oder lehnt eine bestimmte fiktive
// Adresse ab; es verschickt nichts. Ohne Testpostfach steht der eingebaute sammelnde Ersatz
// (`ConsoleMailer`) da — das ist „Mail nicht eingerichtet".
//
// Die Uhr läuft mit der echten Zeit und wird nur VORGESTELLT (`versatz`): Konten werden mit der
// echten Zeit angelegt; die Zusammenfassung wird am Folgetag (UTC) abgerufen.
//
// Originalkriterien:
//   K1  Ein Administrator erkennt für ein Ereignis Zielgruppe, zulässige Kanäle und Häufigkeit;
//       persönliche Abwahl und verbindliche Kenntnisnahme sind mit ihrer jeweiligen Wirkung erklärt.
//   K2  Still, normal und hervorgehoben zeigen vor Veröffentlichung die erwarteten Empfänger und
//       Meldungen. Sichtbarkeit und fachliche Freigabe bleiben davon unabhängig.
//   K3  Still unterdrückt übliche Meldungen, aber keine ausdrücklich erforderliche Kenntnisnahme.
//       Hervorheben erweitert keine Zugriffsrechte.
//   K4  Nicht konfigurierte Mail-/Pushwege sind nicht als aktiv auswählbar. Ein fiktiver Versand
//       unterscheidet angelegt, zugestellt soweit belegt, fehlgeschlagen und gelesen bzw. bestätigt.
//   K5  Wiederholung und Wiederaufnahme erzeugen keine doppelten Meldungen. Zusammenfassungen
//       respektieren Rechte zum Versandzeitpunkt und persönliche Regeln.
//   K6  Regeländerungen gelten nach Reload und werden protokolliert. Nur berechtigte Administratoren
//       können unternehmensweite Kommunikationsregeln verändern.
//
// GEGENPROBEN (benannt, nicht gefahren):
//   · In `meldungsregelnAnwenden` die Abwahlprüfung entfernen → K1/K5 „abgewählt" werden rot.
//   · In `mailsVersenden` `darfLesen` weglassen → K5 „Wiederaufnahme: Rechte zum Versandzeitpunkt"
//     wird rot (eine Mail ginge an ein Konto ohne Zugriff).
//   · In `KommunikationDienst.speichern` die Prüfung `mailEingerichtet` entfernen → K4 „nicht
//     eingerichtete Mail" wird rot.
//   · In `kommunikation-routes.ts` `users.manage` durch `requireUser` ersetzen → K6 wird rot.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { MailMessage, Mailer } from "../../services/notifications";

type App = ReturnType<typeof buildApp>;

const STUNDE = 3_600_000;
const TAG = 24 * STUNDE;
const PASSWORT = "secret123";

/** Der isolierte Testkanal: nimmt an oder lehnt eine fiktive Adresse ab — verschickt nichts. */
class Testpostfach implements Mailer {
  readonly angenommen: MailMessage[] = [];
  readonly versuche: string[] = [];
  constructor(private readonly abgelehnt: ReadonlySet<string> = new Set()) {}
  async send(nachricht: MailMessage): Promise<void> {
    this.versuche.push(nachricht.to);
    if (this.abgelehnt.has(nachricht.to)) {
      throw new Error("550 Postfach nicht verfügbar (Testkanal)");
    }
    this.angenommen.push(nachricht);
  }
  /** Nur Veröffentlichungsmails — andere Wege der Instanz zählen hier nicht. */
  veroeffentlichungen(): MailMessage[] {
    return this.angenommen.filter((m) => m.subject.includes("Veröffentlichung"));
  }
}

interface Konto {
  id: string;
  token: string;
  email: string;
}

let versatz = 0;
let services: AppServices;
let app: App;
let ada: Konto;
let clara: Konto;
let erik: Konto;
let vera: Konto;
let fiona: Konto;

const auf = (wer: string, methode: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string): Promise<Konto> {
  const angelegt = await auf(ada.token, "POST", "/api/users", {
    name,
    email,
    password: PASSWORT,
    role: rolle,
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email), email };
}

/** Baut die Instanz neu auf — wahlweise mit eingerichtetem Mailversand (Testpostfach). */
async function aufbauen(postfach?: Testpostfach): Promise<void> {
  versatz = 0;
  services = assembleServices(inMemoryRepos(), { kenntnisnahmeUhr: () => Date.now() + versatz });
  if (postfach) {
    services.mailer = postfach;
  }
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@kommunikation.test", password: PASSWORT },
  });
  ada = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@kommunikation.test"),
    email: "ada@kommunikation.test",
  };
  clara = await konto("controller", "clara@kommunikation.test", "Clara Controller");
  erik = await konto("experte", "erik@kommunikation.test", "Erik Experte");
  vera = await konto("viewer", "vera@kommunikation.test", "Vera Viewer");
  fiona = await konto("experte", "fiona@kommunikation.test", "Fiona Fachkraft");
  // Die Veröffentlichungen liegen zeitlich NACH der Kontoanlage.
  versatz = STUNDE;
}

/** Ein Eintrag mit GÜLTIGER Fassung V1. */
async function gueltigerEintrag(titel: string): Promise<string> {
  const angelegt = await auf(ada.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: `${titel}: Prüfschritt mit fiktiven Beispielwerten.`,
    type: "best_practice",
    category: "Anlage Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  return id;
}

interface Kanal {
  kanal: string;
  zustand: string;
  einstellbar: boolean;
}
interface Ereignis {
  id: string;
  zielgruppe: string;
  verbindlich: boolean;
  erinnerung: boolean;
  kanaele: Kanal[];
  haeufigkeit: string;
  abwaehlbar: boolean;
  vorgabe: { abwaehlbar: boolean; haeufigkeit: string; mail: boolean };
}
interface Regeln {
  darfAendern: boolean;
  version: number;
  geaendertVon: { id: string; name: string } | null;
  mailEingerichtet: boolean;
  ereignisse: Ereignis[];
}
interface MeineZeile {
  ereignis: string;
  abwaehlbar: boolean;
  abgewaehlt: boolean;
  wirksam: boolean;
  verbindlich: boolean;
}
interface Wirkung {
  glocke: number;
  sofort: number;
  zusammenfassung: number;
  abgewaehlt: number;
  mail: number;
}
interface Vorschau {
  empfaenger: Array<{ id: string; name: string }>;
  sichtbarkeit: { stufe: string | null; spaceId: string | null; leser: number };
  gueltig: boolean;
  meldungswirkung: Record<"still" | "normal" | "hervorgehoben", Wirkung>;
  mailEingerichtet: boolean;
  verlauf: Array<{ id: string; meldung: string }>;
}
interface Person {
  id: string;
  name: string;
  glocke: string | null;
  hinweis: string | null;
  mail: { status: string; grund: string | null } | null;
  kenntnisnahme: string | null;
}
interface Zustellung {
  vermerkId: string;
  erfasst: boolean;
  mailEingerichtet: boolean;
  zaehlung: {
    glocke: { angelegt: number; zugestellt: number; gelesen: number };
    mail: { angelegt: number; zugestellt: number; fehlgeschlagen: number; entfallen: number };
    kenntnisnahme: { offen: number; bestaetigt: number };
  };
  empfaenger: Person[];
}
interface Meldung {
  id: string;
  kind: string;
  koId?: string;
  title: string;
  hervorgehoben?: boolean;
  zusammenfassung?: { tag: string; anzahl: number; eintraege: Array<{ koId: string }> };
  seen: boolean;
}

const regeln = async (wer: string): Promise<Regeln> => {
  const r = await auf(wer, "GET", "/api/kommunikation/regeln");
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Regeln;
};
const ereignis = (r: Regeln, id: string): Ereignis => {
  const e = r.ereignisse.find((x) => x.id === id);
  if (!e) {
    throw new Error(`Ereignis ${id} fehlt`);
  }
  return e;
};
const kanal = (e: Ereignis, k: string): Kanal | undefined => e.kanaele.find((x) => x.kanal === k);
const meine = async (wer: string): Promise<MeineZeile[]> => {
  const r = await auf(wer, "GET", "/api/meldungsregeln/meine");
  expect(r.statusCode).toBe(200);
  return (r.json() as { zeilen: MeineZeile[] }).zeilen;
};
const meineZeile = async (wer: string, id: string): Promise<MeineZeile | undefined> =>
  (await meine(wer)).find((z) => z.ereignis === id);
const abwaehlen = (wer: string, id: string, abgewaehlt = true) =>
  auf(wer, "PUT", "/api/meldungsregeln/meine", { ereignis: id, abgewaehlt });
const vorgeben = (wer: string, version: number, vorgaben: Record<string, unknown>) =>
  auf(wer, "PUT", "/api/admin/kommunikation/regeln", { version, vorgaben });
/** Die Verwaltung setzt eine Vorgabe, ausgehend von der gerade geltenden Fassung. */
async function vorgabe(vorgaben: Record<string, unknown>): Promise<void> {
  const r = await vorgeben(ada.token, (await regeln(ada.token)).version, vorgaben);
  expect(r.statusCode, r.body).toBe(200);
}
const zustellPfad = (koId: string, vermerkId: string): string =>
  `/api/kos/${koId}/veroeffentlichung/zustellung/${vermerkId}`;
const vorschau = async (wer: string, koId: string): Promise<Vorschau> => {
  const r = await auf(wer, "GET", `/api/kos/${koId}/veroeffentlichung`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Vorschau;
};
const veroeffentlichen = (wer: string, koId: string, meldung: string, fassung = 1) =>
  auf(wer, "POST", `/api/kos/${koId}/veroeffentlichung`, { fassung, meldung });
const glocke = async (wer: string): Promise<Meldung[]> => {
  const r = await auf(wer, "GET", "/api/notifications");
  expect(r.statusCode).toBe(200);
  return r.json() as Meldung[];
};
const pubMeldungen = async (wer: string): Promise<Meldung[]> =>
  (await glocke(wer)).filter((m) => m.kind === "veroeffentlichung");
const zustellung = async (wer: string, koId: string, vermerkId: string): Promise<Zustellung> => {
  const r = await auf(wer, "GET", zustellPfad(koId, vermerkId));
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Zustellung;
};
const person = (z: Zustellung, k: Konto): Person | undefined =>
  z.empfaenger.find((p) => p.id === k.id);
/** Veröffentlicht und gibt die Kennung des Vermerks zurück. */
async function veroeffentlicht(koId: string, meldung: string): Promise<string> {
  const r = await veroeffentlichen(clara.token, koId, meldung);
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { vermerk: { id: string } }).vermerk.id;
}
/** Stellt die Uhr auf den Beginn (plus eine Stunde) des nächsten UTC-Tages. */
function naechsterTag(): void {
  const jetzt = Date.now() + versatz;
  const morgen = Date.parse(`${new Date(jetzt).toISOString().slice(0, 10)}T00:00:00.000Z`) + TAG;
  versatz = morgen + STUNDE - Date.now();
}

beforeEach(async () => {
  await aufbauen();
});

describe("K1 · Ereignis → Zielgruppe, Kanäle, Häufigkeit; Abwahl und Kenntnisnahme erklärt", () => {
  it("die zentrale Übersicht nennt je Ereignis Zielgruppe, Kanalzustand, Häufigkeit und Abwahl", async () => {
    const r = await regeln(ada.token);
    expect(r).toMatchObject({ darfAendern: true, version: 0, mailEingerichtet: false });
    expect(r.ereignisse.map((e) => e.id)).toEqual([
      "veroeffentlichung",
      "veroeffentlichung_hervorgehoben",
      "kenntnisnahme",
      "zuweisung",
      "frische",
      "reklamation",
      "wirkung",
      "loeschantrag",
      "qualitaet",
    ]);
    const normal = ereignis(r, "veroeffentlichung");
    expect(normal).toMatchObject({
      zielgruppe: "leser_ohne_veroeffentlicher",
      haeufigkeit: "sofort",
      abwaehlbar: true,
      verbindlich: false,
    });
    expect(normal.kanaele).toEqual([
      { kanal: "glocke", zustand: "aktiv", einstellbar: false },
      { kanal: "mail", zustand: "nicht_eingerichtet", einstellbar: false },
      { kanal: "push", zustand: "nicht_angeschlossen", einstellbar: false },
    ]);
    // Hervorgehoben: derselbe Kreis, sofort, nicht abwählbar.
    expect(ereignis(r, "veroeffentlichung_hervorgehoben")).toMatchObject({
      zielgruppe: "leser_ohne_veroeffentlicher",
      haeufigkeit: "sofort",
      abwaehlbar: false,
    });
    // Die verbindliche Kenntnisnahme: ausgewählte Empfänger, mit Erinnerung, nicht abwählbar.
    const kn = ereignis(r, "kenntnisnahme");
    expect(kn).toMatchObject({
      zielgruppe: "ausgewaehlte_empfaenger",
      verbindlich: true,
      erinnerung: true,
      abwaehlbar: false,
      haeufigkeit: "sofort",
    });
    expect(kanal(kn, "push")?.zustand).toBe("nicht_angeschlossen");
    // Jedes Konto darf die Regeln lesen, aber nicht ändern.
    expect(await regeln(vera.token)).toMatchObject({ darfAendern: false, version: 0 });
  });

  it("persönliche Abwahl nur, wo die Vorgabe sie erlaubt — die verbindliche Kenntnisnahme nie", async () => {
    const vorher = await meine(erik.token);
    expect(vorher.find((z) => z.ereignis === "veroeffentlichung")).toEqual({
      ereignis: "veroeffentlichung",
      abwaehlbar: true,
      abgewaehlt: false,
      wirksam: false,
      verbindlich: false,
    });
    expect(vorher.find((z) => z.ereignis === "kenntnisnahme")).toMatchObject({
      abwaehlbar: false,
      verbindlich: true,
    });
    const kn = await abwaehlen(erik.token, "kenntnisnahme");
    expect(kn.statusCode).toBe(409);
    expect(kn.json()).toMatchObject({ error: "NICHT_ABWAEHLBAR" });
    expect((await abwaehlen(erik.token, "veroeffentlichung_hervorgehoben")).statusCode).toBe(409);
    expect((await abwaehlen(erik.token, "gibt-es-nicht")).statusCode).toBe(400);
    const ok = await abwaehlen(erik.token, "veroeffentlichung");
    expect(ok.statusCode).toBe(200);
    expect(await meineZeile(erik.token, "veroeffentlichung")).toMatchObject({
      abgewaehlt: true,
      wirksam: true,
    });
    // Nur für sich selbst: Veras Einstellungen bleiben unberührt.
    expect((await meineZeile(vera.token, "veroeffentlichung"))?.wirksam).toBe(false);
  });
});

describe("K2 · Vorschau je Wahl — Sichtbarkeit und Freigabe bleiben unabhängig", () => {
  it("still, normal, hervorgehoben zeigen Empfänger und Meldungen nach den geltenden Regeln", async () => {
    expect((await abwaehlen(erik.token, "veroeffentlichung")).statusCode).toBe(200);
    const id = await gueltigerEintrag("Druckprobe Leitung 7");
    const v = await vorschau(clara.token, id);
    expect(v.empfaenger.map((k) => k.name)).toEqual([
      "Ada Admin",
      "Erik Experte",
      "Fiona Fachkraft",
      "Vera Viewer",
    ]);
    expect(v.meldungswirkung).toEqual({
      still: { glocke: 0, sofort: 0, zusammenfassung: 0, abgewaehlt: 0, mail: 0 },
      normal: { glocke: 3, sofort: 3, zusammenfassung: 0, abgewaehlt: 1, mail: 0 },
      hervorgehoben: { glocke: 4, sofort: 4, zusammenfassung: 0, abgewaehlt: 0, mail: 0 },
    });
    expect(v.mailEingerichtet).toBe(false);

    // Die Verwaltung stellt auf tägliche Zusammenfassung um: „normal" bündelt, „hervorgehoben" nicht.
    await vorgabe({ veroeffentlichung: { haeufigkeit: "taeglich" } });
    const w = await vorschau(clara.token, id);
    expect(w.meldungswirkung.normal).toEqual({
      glocke: 3,
      sofort: 0,
      zusammenfassung: 3,
      abgewaehlt: 1,
      mail: 0,
    });
    expect(w.meldungswirkung.hervorgehoben.sofort).toBe(4);
    // Sichtbarkeit und Empfängerkreis sind dieselben — die Regeln ändern nur die Meldungen.
    expect(w.sichtbarkeit).toEqual(v.sichtbarkeit);
    expect(w.sichtbarkeit).toEqual({ stufe: "intern", spaceId: null, leser: 5 });
    expect(w.empfaenger).toEqual(v.empfaenger);

    // Veröffentlichen ändert weder Freigabe noch Einstufung.
    await veroeffentlicht(id, "normal");
    const ko = await services.ko.get(id);
    expect(ko?.status).toBe("validiert");
    expect(ko?.confidentiality).toBe("intern");
  });
});

describe("K3 · still unterdrückt keine Kenntnisnahme; hervorheben erweitert keine Rechte", () => {
  it("still: keine übliche Meldung — die angeforderte Kenntnisnahme kommt, auch trotz Abwahl und Zusammenfassung", async () => {
    expect((await abwaehlen(erik.token, "veroeffentlichung")).statusCode).toBe(200);
    await vorgabe({ veroeffentlichung: { haeufigkeit: "taeglich" } });
    const id = await gueltigerEintrag("Not-Aus Halle 2");
    const anforderung = await auf(clara.token, "POST", `/api/kos/${id}/kenntnisnahmen`, {
      fassung: 1,
      empfaenger: [erik.id, vera.id],
    });
    expect(anforderung.statusCode, anforderung.body).toBe(201);
    await veroeffentlicht(id, "still");
    for (const wer of [erik, vera]) {
      const feed = await glocke(wer.token);
      expect(feed.filter((m) => m.kind === "kenntnisnahme").map((m) => m.koId)).toEqual([id]);
      expect(feed.filter((m) => m.kind === "veroeffentlichung")).toEqual([]);
    }
    expect(await pubMeldungen(fiona.token)).toEqual([]);
  });

  it("hervorgehoben erreicht auf einem vertraulichen Eintrag nur Berechtigte — trotz Abwahl, ohne neue Rechte", async () => {
    expect((await abwaehlen(ada.token, "veroeffentlichung")).statusCode).toBe(200);
    const id = await gueltigerEintrag("Vertrauliche Störfallanweisung");
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    const v = await vorschau(clara.token, id);
    expect(v.empfaenger.map((k) => k.id)).toEqual([ada.id]);
    expect(v.meldungswirkung.hervorgehoben.glocke).toBe(1);
    const vermerk = await veroeffentlicht(id, "hervorgehoben");
    // Die persönliche Abwahl gilt für „normal" — eine hervorgehobene Meldung kommt trotzdem.
    expect((await pubMeldungen(ada.token)).map((m) => m.koId)).toEqual([id]);
    for (const wer of [erik, vera, fiona]) {
      expect(await pubMeldungen(wer.token)).toEqual([]);
      expect((await auf(wer.token, "GET", `/api/kos/${id}`)).statusCode).not.toBe(200);
    }
    const z = await zustellung(clara.token, id, vermerk);
    expect(z.empfaenger.map((p) => p.id)).toEqual([ada.id]);
  });
});

describe("K4 · nur angeschlossene Kanäle; fiktiver Versand mit nachvollziehbarem Status", () => {
  it("ohne eingerichteten Mailversand ist Mail nicht aktivierbar; Push gibt es nicht", async () => {
    const mail = await vorgeben(ada.token, 0, { veroeffentlichung: { mail: true } });
    expect(mail.statusCode).toBe(409);
    expect(mail.json()).toMatchObject({ error: "KANAL_NICHT_EINGERICHTET" });
    const push = await vorgeben(ada.token, 0, { veroeffentlichung: { push: true } });
    expect(push.statusCode).toBe(400);
    expect(push.json()).toMatchObject({ error: "NICHT_EINSTELLBAR" });
    // Nichts wurde gespeichert.
    expect((await regeln(ada.token)).version).toBe(0);
    const fassungen = await auf(ada.token, "GET", "/api/admin/kommunikation/fassungen");
    expect(fassungen.json()).toEqual({ fassungen: [] });
  });

  it("Testpostfach: angelegt, zugestellt (soweit belegt), fehlgeschlagen, gelesen und bestätigt", async () => {
    const postfach = new Testpostfach(new Set(["vera@kommunikation.test"]));
    await aufbauen(postfach);
    const r = await regeln(ada.token);
    expect(r.mailEingerichtet).toBe(true);
    expect(kanal(ereignis(r, "veroeffentlichung"), "mail")).toEqual({
      kanal: "mail",
      zustand: "aus",
      einstellbar: true,
    });
    expect(kanal(ereignis(r, "veroeffentlichung"), "push")?.zustand).toBe("nicht_angeschlossen");
    const ein = await vorgeben(ada.token, 0, { veroeffentlichung: { mail: true } });
    expect(ein.statusCode, ein.body).toBe(200);
    const nachEin = ereignis(ein.json() as Regeln, "veroeffentlichung");
    expect(kanal(nachEin, "mail")?.zustand).toBe("aktiv");

    const id = await gueltigerEintrag("Kalibrierung Messschieber");
    const anforderung = await auf(clara.token, "POST", `/api/kos/${id}/kenntnisnahmen`, {
      fassung: 1,
      empfaenger: [erik.id],
    });
    expect(anforderung.statusCode).toBe(201);
    const anforderungId = (anforderung.json() as { anforderungId: string }).anforderungId;
    expect((await vorschau(clara.token, id)).meldungswirkung.normal.mail).toBe(4);

    const antwort = await veroeffentlichen(clara.token, id, "normal");
    expect(antwort.statusCode, antwort.body).toBe(201);
    const ergebnis = antwort.json() as { vermerk: { id: string }; zustellung: Zustellung };
    const vermerk = ergebnis.vermerk.id;
    expect(ergebnis.zustellung.zaehlung).toEqual({
      glocke: { angelegt: 4, zugestellt: 0, gelesen: 0 },
      mail: { angelegt: 0, zugestellt: 3, fehlgeschlagen: 1, entfallen: 0 },
      kenntnisnahme: { offen: 1, bestaetigt: 0 },
    });
    // Der Testkanal hat genau drei Mails angenommen und eine Zustellung abgelehnt.
    expect(
      postfach
        .veroeffentlichungen()
        .map((m) => m.to)
        .sort(),
    ).toEqual(["ada@kommunikation.test", "erik@kommunikation.test", "fiona@kommunikation.test"]);
    expect(postfach.versuche.filter((a) => a === "vera@kommunikation.test")).toHaveLength(1);
    // Die Mail nennt weder Titel noch Inhalt — nur den Weg in die Anwendung.
    for (const m of postfach.veroeffentlichungen()) {
      expect(m.text).not.toContain("Kalibrierung");
      expect(m.text).toContain(`/wissen/${id}`);
    }

    // Glocke: abgerufen → zugestellt; als gelesen markiert → gelesen. Kenntnisnahme: bestätigt.
    const feed = await pubMeldungen(erik.token);
    expect(feed.map((m) => m.id)).toEqual([`pub-${vermerk}`]);
    expect(person(await zustellung(clara.token, id, vermerk), erik)?.glocke).toBe("zugestellt");
    const gesehen = await auf(erik.token, "POST", "/api/notifications/seen", {
      ids: [`pub-${vermerk}`],
    });
    expect(gesehen.statusCode).toBe(200);
    const bestaetigenPfad = `/api/kenntnisnahmen/${anforderungId}/bestaetigen`;
    const bestaetigt = await auf(erik.token, "POST", bestaetigenPfad, { fassung: 1 });
    expect(bestaetigt.statusCode, bestaetigt.body).toBeLessThan(300);

    const z = await zustellung(clara.token, id, vermerk);
    expect(person(z, erik)).toEqual({
      id: erik.id,
      name: "Erik Experte",
      glocke: "gelesen",
      hinweis: null,
      mail: { status: "zugestellt", grund: null },
      kenntnisnahme: "bestaetigt",
    });
    expect(person(z, vera)).toMatchObject({
      glocke: "angelegt",
      mail: { status: "fehlgeschlagen", grund: "mailserver_abgelehnt" },
      kenntnisnahme: null,
    });
    expect(z.zaehlung.glocke).toEqual({ angelegt: 3, zugestellt: 0, gelesen: 1 });
    expect(z.zaehlung.kenntnisnahme).toEqual({ offen: 0, bestaetigt: 1 });
    // Keine Mailadresse und keine Servermeldung im Zustellstatus.
    expect(JSON.stringify(z)).not.toContain("@");
    expect(JSON.stringify(z)).not.toContain("550");
    // Den Zustellstatus sieht nur, wer veröffentlichen darf.
    expect((await auf(erik.token, "GET", zustellPfad(id, vermerk))).statusCode).toBe(403);
    expect((await auf(clara.token, "GET", zustellPfad(id, "x"))).statusCode).toBe(404);
  });
});

describe("K5 · keine doppelten Meldungen; Zusammenfassung nach Rechten und Regeln zum Versandzeitpunkt", () => {
  it("Wiederholung: zweites Veröffentlichen und erneutes Fortsetzen schicken nichts doppelt", async () => {
    const postfach = new Testpostfach();
    await aufbauen(postfach);
    await vorgabe({ veroeffentlichung_hervorgehoben: { mail: true } });
    const id = await gueltigerEintrag("Schieber sichern");
    const vermerk = await veroeffentlicht(id, "hervorgehoben");
    expect(postfach.veroeffentlichungen()).toHaveLength(4);
    expect((await veroeffentlichen(clara.token, id, "hervorgehoben")).statusCode).toBe(409);
    for (let i = 0; i < 2; i += 1) {
      const weiter = await auf(clara.token, "POST", `${zustellPfad(id, vermerk)}/fortsetzen`);
      expect(weiter.statusCode).toBe(200);
    }
    expect(postfach.veroeffentlichungen()).toHaveLength(4);
    // Die Glocke liefert dieselbe Meldung bei jedem Abruf genau einmal.
    for (let i = 0; i < 3; i += 1) {
      expect((await pubMeldungen(erik.token)).map((m) => m.id)).toEqual([`pub-${vermerk}`]);
    }
  });

  // SIMULATION einer Unterbrechung: der Prozess endet nach dem Festhalten, bevor die Mails
  // rausgehen. Nachgestellt, indem für eine still verbreitete Glockenmeldung die Mailzeilen so
  // angelegt werden, wie der Belegschritt sie anlegt — ohne den anschließenden Versand.
  it("Wiederaufnahme: nur nie versuchte Mails gehen raus, mit den Rechten zum Versandzeitpunkt", async () => {
    const postfach = new Testpostfach();
    await aufbauen(postfach);
    const id = await gueltigerEintrag("Leckage melden");
    const vermerk = await veroeffentlicht(id, "normal");
    expect(postfach.veroeffentlichungen()).toEqual([]);
    const angelegtAm = new Date(Date.now() + versatz).toISOString();
    await services.kommunikation.statusAnlegen(
      [erik, vera].map((k) => ({
        vermerkId: vermerk,
        koId: id,
        empfaengerId: k.id,
        kanal: "mail" as const,
        status: "angelegt" as const,
        angelegtAm,
        versuchAm: null,
        ergebnisAm: null,
        grund: null,
      })),
    );
    // Zwischen Festhalten und Versand wird der Eintrag vertraulich: Erik (Experte) und Vera
    // (Leserin) dürfen ihn nicht mehr lesen — beide Mails entfallen, keine geht raus.
    await services.ko.setConfidentiality(id, "vertraulich", ada.id);
    const erst = await auf(clara.token, "POST", `${zustellPfad(id, vermerk)}/fortsetzen`);
    expect(erst.statusCode).toBe(200);
    expect(postfach.veroeffentlichungen()).toEqual([]);
    const z = erst.json() as Zustellung;
    expect(person(z, erik)?.mail).toEqual({ status: "entfallen", grund: "kein_zugriff" });
    expect(person(z, vera)?.mail).toEqual({ status: "entfallen", grund: "kein_zugriff" });

    // Ein zweiter Eintrag, Zugriff bleibt: die Wiederaufnahme schickt genau einmal.
    const zweiter = await gueltigerEintrag("Leckage dokumentieren");
    const v2 = await veroeffentlicht(zweiter, "normal");
    await services.kommunikation.statusAnlegen([
      {
        vermerkId: v2,
        koId: zweiter,
        empfaengerId: fiona.id,
        kanal: "mail",
        status: "angelegt",
        angelegtAm,
        versuchAm: null,
        ergebnisAm: null,
        grund: null,
      },
    ]);
    const pfad = `${zustellPfad(zweiter, v2)}/fortsetzen`;
    expect((await auf(clara.token, "POST", pfad)).statusCode).toBe(200);
    expect((await auf(clara.token, "POST", pfad)).statusCode).toBe(200);
    expect(postfach.veroeffentlichungen().map((m) => m.to)).toEqual(["fiona@kommunikation.test"]);
  });

  it("Zusammenfassung: eine Meldung am Folgetag, nur sichtbare Einträge, persönliche Abwahl respektiert", async () => {
    await vorgabe({ veroeffentlichung: { haeufigkeit: "taeglich" } });
    const a = await gueltigerEintrag("Ventil A prüfen");
    const b = await gueltigerEintrag("Ventil B prüfen");
    const vermerkA = await veroeffentlicht(a, "normal");
    await veroeffentlicht(b, "normal");
    // Am selben Tag: nichts einzeln, noch keine Zusammenfassung.
    expect(await pubMeldungen(erik.token)).toEqual([]);
    // Bis zum Versandzeitpunkt verliert Erik den Zugriff auf B; Fiona wählt ab.
    await services.ko.setConfidentiality(b, "vertraulich", ada.id);
    expect((await abwaehlen(fiona.token, "veroeffentlichung")).statusCode).toBe(200);
    naechsterTag();

    const erikFeed = await pubMeldungen(erik.token);
    expect(erikFeed).toHaveLength(1);
    expect(erikFeed[0]?.id).toMatch(/^sum-veroeffentlichung-\d{4}-\d{2}-\d{2}$/);
    expect(erikFeed[0]?.zusammenfassung?.anzahl).toBe(1);
    expect(erikFeed[0]?.zusammenfassung?.eintraege.map((e) => e.koId)).toEqual([a]);
    expect(erikFeed[0]?.title).toBe("Ventil A prüfen");
    // Ein zweiter Abruf erzeugt keine zweite Zusammenfassung.
    expect((await pubMeldungen(erik.token)).map((m) => m.id)).toEqual([erikFeed[0]?.id]);
    // Die Verwaltung darf B sehen: ihre Zusammenfassung trägt beide.
    expect((await pubMeldungen(ada.token))[0]?.zusammenfassung?.anzahl).toBe(2);
    // Fiona hat abgewählt: keine Zusammenfassung.
    expect(await pubMeldungen(fiona.token)).toEqual([]);

    const z = await zustellung(clara.token, a, vermerkA);
    expect(person(z, erik)?.glocke).toBe("zugestellt");
    expect(person(z, fiona)).toMatchObject({ glocke: "angelegt", hinweis: "abgewaehlt" });
    expect(person(z, vera)).toMatchObject({ glocke: "angelegt", hinweis: "zusammenfassung" });
  });
});

describe("K6 · Regeländerungen gelten nach Reload, sind protokolliert und nur der Verwaltung erlaubt", () => {
  it("nur users.manage ändert Vorgaben; jede Änderung ist Fassung und Prüfprotokolleintrag", async () => {
    expect((await abwaehlen(erik.token, "veroeffentlichung")).statusCode).toBe(200);
    for (const wer of [clara, erik, vera]) {
      const versuch = await vorgeben(wer.token, 0, { veroeffentlichung: { abwaehlbar: false } });
      expect(versuch.statusCode).toBe(403);
      const lesen = await auf(wer.token, "GET", "/api/admin/kommunikation/fassungen");
      expect(lesen.statusCode).toBe(403);
    }
    const ohne = await app.inject({
      method: "PUT",
      url: "/api/admin/kommunikation/regeln",
      payload: {},
    });
    expect(ohne.statusCode).toBe(401);

    const geaendert = await vorgeben(ada.token, 0, { veroeffentlichung: { abwaehlbar: false } });
    expect(geaendert.statusCode).toBe(200);
    expect(geaendert.json()).toMatchObject({ geaendert: true, version: 1 });

    // Neu geladen (frischer Abruf, auch durch ein anderes Konto): die Änderung gilt.
    const neu = await regeln(vera.token);
    expect(neu.version).toBe(1);
    expect(neu.geaendertVon).toEqual({ id: ada.id, name: "Ada Admin" });
    expect(ereignis(neu, "veroeffentlichung").abwaehlbar).toBe(false);
    // Eriks Abwahl bleibt gespeichert, wirkt aber nicht mehr — die Meldung kommt wieder.
    expect(await meineZeile(erik.token, "veroeffentlichung")).toMatchObject({
      abgewaehlt: true,
      wirksam: false,
    });
    const id = await gueltigerEintrag("Filter tauschen");
    await veroeffentlicht(id, "normal");
    expect((await pubMeldungen(erik.token)).map((m) => m.koId)).toEqual([id]);

    // Protokoll: Fassung und Prüfprotokolleintrag mit Ereignis, Feld und Werten.
    const protokoll = await services.audit.list({ action: "kommunikationsregeln.geaendert" });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0]).toMatchObject({
      actor: ada.id,
      target: "kommunikationsregeln",
      payload: {
        vorherVersion: 0,
        version: 1,
        aenderungen: [
          { ereignis: "veroeffentlichung", feld: "abwaehlbar", vorher: true, nachher: false },
        ],
      },
    });
    const fassungen = await auf(ada.token, "GET", "/api/admin/kommunikation/fassungen");
    expect(fassungen.json()).toMatchObject({ fassungen: [{ version: 1, name: "Ada Admin" }] });
    const persoenlich = await services.audit.list({ action: "meldungsregel.persoenlich" });
    expect(persoenlich.map((e) => e.actor)).toEqual([erik.id]);

    // Mehrbenutzerfall: eine veraltete Fassung überschreibt nichts; ohne Änderung keine Fassung.
    const veraltet = await vorgeben(ada.token, 0, { veroeffentlichung: { abwaehlbar: true } });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ error: "VERALTET", aktuelleVersion: 1 });
    const gleich = await vorgeben(ada.token, 1, { veroeffentlichung: { abwaehlbar: false } });
    expect(gleich.json()).toMatchObject({ geaendert: false, version: 1 });
    expect(await services.audit.list({ action: "kommunikationsregeln.geaendert" })).toHaveLength(1);
  });

  it("die Verwaltung kann eine Kenntnisnahme nicht abwählbar oder „hervorgehoben“ bündelbar machen", async () => {
    const kn = await vorgeben(ada.token, 0, { kenntnisnahme: { abwaehlbar: true } });
    expect(kn.statusCode).toBe(400);
    expect(kn.json()).toMatchObject({ error: "NICHT_EINSTELLBAR" });
    const hv = await vorgeben(ada.token, 0, {
      veroeffentlichung_hervorgehoben: { haeufigkeit: "taeglich" },
    });
    expect(hv.statusCode).toBe(400);
    expect((await regeln(ada.token)).version).toBe(0);
  });
});
