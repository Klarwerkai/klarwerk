// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · ERINNERUNGEN AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()), …)`, `app.inject`).
// Die Steuerung ist DIESELBE Instanz, die `server.ts` im Takt startet — der Test bekommt ihren Lauf
// über die Option `klaraErinnerungen` und ruft ihn zum gewählten Zeitpunkt. Die Uhr ist gestellt
// (`vi.useFakeTimers({ toFake: ["Date"] })`); Zeitgeber laufen echt. „Gespräch geschlossen" heißt:
// nach dem Anlegen geschieht im Gespräch nichts mehr, keine Sitzung von Klara ist offen.
// Postgres, Neustart und Mehrprozess misst `erinnerung-pg.integration.test.ts`. Daten fiktiv.
//
//   H1 (K1, AW18-K01/K02) „Morgen um neun erinnern" → Klärung; danach zeigt die Vorschau Datum,
//      lokale Uhrzeit, IANA-Zone mit Versatz, Ziel und Ergebnis; Serie, Frist und Sommerzeit ebenso.
//      Ohne eindeutigen Zeitplan entsteht nichts.
//   H2 (K2)  Anzeigen, ändern, pausieren, fortsetzen, erledigen, löschen — persistent über erneute
//      Anmeldung; veraltete Fassung überschreibt nicht; das Protokoll trägt keinen Inhalt.
//   H3 (K3, K5, AW18-K12) Fällige Erinnerung (aus einer Gesprächsnachricht, Gespräch geschlossen)
//      kommt in DIE Glocke der Person — einmal; pausierte und erledigte nicht; andere Personen und
//      Administratoren sehen nichts; Löschen entfernt auch die Meldung.
//   H4 (AW18-K11) Die Überwachung nennt Rückstau, Läufe und den letzten Takt der Steuerung.
//   H5 (AW18-K08, Nacharbeit 2) Bewusste Übergabe: Zuständige bekommt Meldung, sieht nur Titel und
//      Termine; nach ihrem Ausscheiden (vorhandener Weg) stoppt die Wirkung; Rücknahme.
//   H6 (P07, Nacharbeit 2) Einrichtungsassistent: Vorgaben lesen/speichern/erneut speichern.
//   H7 (EQF-07) Routine über die echte App: Einrichtung ohne Sofortlauf, Versand abgelehnt,
//      Änderung in Worten (deuten → übernehmen), Bericht in „Meine Notizen“ beim Takt, Ergebnis in
//      Lauf und Glocke, persönlich, Rücknahme.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import {
  KLARA_ERINNERUNG_ANGELEGT,
  KLARA_ERINNERUNG_GEAENDERT,
  KLARA_ERINNERUNG_UEBERGEBEN,
} from "../../services/app/src/routes/klara-erinnerung-routes";

type App = ReturnType<typeof buildApp>;
type Sicht = Record<string, unknown> & {
  id: string;
  fassung: number;
  status: string;
  lage: string;
  titel: string;
  anzeige: {
    naechste: { datum: string; uhrzeit: string; versatz: string; zeitpunkt: string } | null;
    kommende: unknown[];
    serienende: Record<string, unknown>;
    frist: { datum: string; vorlaufTage: number } | null;
    sommerzeitHinweise: { hinweis: string; datum: string; uhrzeit: string }[];
    ziel: string;
    erwartetesErgebnis: string;
  };
};
interface Glocke {
  id: string;
  kind: string;
  title: string;
  seen: boolean;
  erinnerungArt?: string;
  erinnerungId?: string;
}

const BASIS = "/api/me/klara/erinnerungen";
const KENNWORT = "secret123";
const BERLIN = "Europe/Berlin";
/** Unverwechselbare Messmarke — ein Treffer kann aus nichts anderem stammen. */
const WORT = "Mispelhecke";
const BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };

let app: App;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null = null;
let services: ReturnType<typeof assembleServices>;
let ada = { id: "", token: "" };
let erik = { id: "", token: "", email: "" };
let vera = { id: "", token: "", email: "" };
let zaehler = 0;

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const r = await auf("", "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const r = await auf(ada.token, "POST", "/api/users", {
    name,
    email,
    password: KENNWORT,
    role: rolle,
  });
  expect(r.statusCode, r.body).toBe(201);
  return { id: (r.json() as { id: string }).id, token: await anmelden(email), email };
}

const vorgang = (): string => {
  zaehler += 1;
  return `server-erinnerung-${String(zaehler).padStart(4, "0")}`;
};

function stelleUhr(iso: string): void {
  vi.setSystemTime(new Date(iso));
}

async function lege(wer: string, rumpf: Record<string, unknown>): Promise<Sicht> {
  const r = await auf(wer, "POST", BASIS, { vorgang: vorgang(), zeitzone: BERLIN, ...rumpf });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { erinnerung: Sicht }).erinnerung;
}

async function hole(wer: string, id: string): Promise<Sicht> {
  const r = await auf(wer, "GET", `${BASIS}/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { erinnerung: Sicht }).erinnerung;
}

async function glocke(wer: string): Promise<Glocke[]> {
  const r = await auf(wer, "GET", "/api/notifications");
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as Glocke[]).filter((n) => n.kind === "erinnerung");
}

async function takt(): Promise<KlaraErinnerungLaufbericht> {
  if (!lauf) {
    throw new Error("Die App hat ihre Steuerung nicht herausgegeben");
  }
  return lauf();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  stelleUhr("2026-10-12T08:00:00.000Z"); // Montag, 10:00 in Berlin
  lauf = null;
  services = assembleServices(inMemoryRepos());
  app = buildApp(services, {
    klaraErinnerungen: (l) => {
      lauf = l;
      return 60_000;
    },
  });
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@klara-erinnerung-k10.test",
    password: KENNWORT,
  });
  const token = await anmelden("ada@klara-erinnerung-k10.test");
  const ich = await auf(token, "GET", "/api/auth/me");
  ada = { id: (ich.json() as { id: string }).id, token };
  erik = await konto("experte", "erik@klara-erinnerung-k10.test", "Erik Experte");
  vera = await konto("viewer", "vera@klara-erinnerung-k10.test", "Vera Viewer");
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

// ================================================================================================
describe("H1 · K1 / AW18-K01 / AW18-K02 — eindeutig angezeigt, Mehrdeutiges geklärt", () => {
  it("„Morgen um neun erinnern“: erst die Klärung, dann Datum, Uhrzeit, Zone, Ziel und Ergebnis", async () => {
    const frage = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      text: "Morgen um neun erinnern",
      zeitzone: BERLIN,
    });
    expect(frage.statusCode, frage.body).toBe(200);
    expect(frage.json()).toEqual({
      deutung: {
        art: "klaerung",
        grund: "tageszeit_mehrdeutig",
        optionen: [
          { datum: "2026-10-13", uhrzeit: "09:00" },
          { datum: "2026-10-13", uhrzeit: "21:00" },
        ],
      },
      zeitzone: BERLIN,
      zeitplan: null,
      anzeige: null,
    });

    // Ohne eindeutigen Zeitplan entsteht keine Erinnerung.
    const ohne = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      titel: `Bestellung ${WORT}`,
      zeitzone: BERLIN,
    });
    expect(ohne.statusCode).toBe(400);
    expect((await auf(erik.token, "GET", BASIS)).json()).toEqual({
      erinnerungen: [],
      uebernommen: [],
    });

    // Die Person wählt 09:00 — die Vorschau zeigt, was gelten wird.
    const zeitplan = { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" };
    const vorschau = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      zeitplan,
      zeitzone: BERLIN,
    });
    const anzeige = (vorschau.json() as { anzeige: Sicht["anzeige"] }).anzeige;
    expect(anzeige).toMatchObject({
      naechste: {
        datum: "2026-10-13",
        uhrzeit: "09:00",
        versatz: "+02:00",
        zeitpunkt: "2026-10-13T07:00:00.000Z",
      },
      serienende: { art: "einmalig" },
      frist: null,
      ziel: "glocke",
      erwartetesErgebnis: "meldung",
    });

    const e = await lege(erik.token, { titel: `Bestellung ${WORT}`, zeitplan });
    expect(e).toMatchObject({
      zeitzone: BERLIN,
      ziel: "glocke",
      status: "aktiv",
      lage: "geplant",
      bereich: "persoenlich",
      zustaendig: "selbst",
    });
    // Dieselbe Zusage wie in der Vorschau — nur die Vorkommenskennung trägt jetzt die echte Kennung.
    expect(e.anzeige.naechste).toMatchObject({
      datum: "2026-10-13",
      uhrzeit: "09:00",
      versatz: "+02:00",
      zeitpunkt: "2026-10-13T07:00:00.000Z",
      vorkommenId: `${e.id}@2026-10-13T09:00`,
    });
    expect(e).not.toHaveProperty("kontoId");
  });

  it("Serie, Frist mit Vorlauf und Sommerzeit: Serienende, Frist als Datum, Regel sichtbar", async () => {
    const serie = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-19",
        uhrzeit: "08:00",
        wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 4 },
      },
    });
    const s = (serie.json() as { anzeige: Sicht["anzeige"] }).anzeige;
    expect(s.serienende).toEqual({ art: "anzahl", anzahl: 4 });
    expect(s.kommende).toHaveLength(4);
    // Der vierte Termin liegt nach dem Sommerzeitende — lokal weiter 08:00, Versatz +01:00.
    expect((s.kommende[3] as { uhrzeit: string; versatz: string }).versatz).toBe("+01:00");

    const frist = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      zeitzone: BERLIN,
      zeitplan: { art: "frist", fristDatum: "2026-10-30", vorlaufTage: 3, uhrzeit: "09:00" },
    });
    const f = (frist.json() as { anzeige: Sicht["anzeige"] }).anzeige;
    expect(f.frist).toEqual({ datum: "2026-10-30", vorlaufTage: 3 });
    expect(f.naechste).toMatchObject({ datum: "2026-10-27", uhrzeit: "09:00" });

    const doppelt = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      zeitzone: BERLIN,
      sommerzeit: { luecke: "verschieben", doppelt: "zweite" },
      zeitplan: { art: "einmalig", datum: "2026-10-25", uhrzeit: "02:30" },
    });
    const d = (doppelt.json() as { anzeige: Sicht["anzeige"] }).anzeige;
    expect(d.naechste).toMatchObject({ zeitpunkt: "2026-10-25T01:30:00.000Z", versatz: "+01:00" });
    expect(d.sommerzeitHinweise).toEqual([
      expect.objectContaining({ hinweis: "doppelt_zweite", datum: "2026-10-25", uhrzeit: "02:30" }),
    ]);

    const falsch = await auf(erik.token, "POST", `${BASIS}/vorschau`, {
      zeitzone: "MEZ",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    expect(falsch.statusCode).toBe(400);
    const vergangen = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      titel: "Gestern",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-11", uhrzeit: "09:00" },
    });
    expect(vergangen.statusCode).toBe(400);
    expect((vergangen.json() as { grund: string }).grund).toBe("vergangen");
  });
});

// ================================================================================================
describe("H2 · K2 — anzeigen, ändern, pausieren, erledigen, löschen; persistent", () => {
  it("jede Bedienung bleibt nach erneuter Anmeldung; eine veraltete Fassung überschreibt nichts", async () => {
    const e = await lege(erik.token, {
      titel: `Kalibrieren ${WORT}`,
      zeitplan: {
        art: "serie",
        datum: "2026-10-13",
        uhrzeit: "09:00",
        wiederholung: { takt: "taeglich", intervall: 1, anzahl: 10 },
      },
    });
    const geaendert = await auf(erik.token, "PUT", `${BASIS}/${e.id}`, {
      fassung: e.fassung,
      titel: `Kalibrieren ${WORT} (Halle 2)`,
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    const veraltet = await auf(erik.token, "PUT", `${BASIS}/${e.id}`, {
      fassung: e.fassung,
      titel: "Alt",
    });
    expect(veraltet.statusCode).toBe(409);

    const pausiert = await auf(erik.token, "POST", `${BASIS}/${e.id}/status`, {
      fassung: e.fassung + 1,
      aktion: "pausieren",
    });
    expect(pausiert.statusCode, pausiert.body).toBe(200);

    erik.token = await anmelden(erik.email);
    const nachAnmeldung = await hole(erik.token, e.id);
    expect(nachAnmeldung).toMatchObject({
      titel: `Kalibrieren ${WORT} (Halle 2)`,
      status: "pausiert",
      lage: "pausiert",
      fassung: e.fassung + 2,
    });

    for (const aktion of ["fortsetzen", "erledigen"]) {
      const aktuell = await hole(erik.token, e.id);
      const r = await auf(erik.token, "POST", `${BASIS}/${e.id}/status`, {
        fassung: aktuell.fassung,
        aktion,
      });
      expect(r.statusCode, r.body).toBe(200);
    }
    expect(await hole(erik.token, e.id)).toMatchObject({ status: "erledigt", lage: "erledigt" });

    const weg = await auf(erik.token, "DELETE", `${BASIS}/${e.id}`);
    expect(weg.statusCode).toBe(200);
    expect((await auf(erik.token, "GET", `${BASIS}/${e.id}`)).statusCode).toBe(404);

    // Das Prüfprotokoll nennt Vorgänge, nie Titel oder Notiz.
    const protokoll = JSON.stringify([
      ...(await services.audit.list({ action: KLARA_ERINNERUNG_ANGELEGT })),
      ...(await services.audit.list({ action: KLARA_ERINNERUNG_GEAENDERT })),
    ]);
    expect(protokoll).toContain(e.id);
    expect(protokoll).not.toContain(WORT);
  });
});

// ================================================================================================
describe("H3 · K3 / K5 / AW18-K12 — Zustellung in die Glocke, auch bei geschlossenem Gespräch", () => {
  it("aus einer Gesprächsnachricht angelegt, Gespräch zu: zum Termin genau eine Meldung — nur bei Erik", async () => {
    const g = await auf(erik.token, "POST", "/api/me/klara/gespraeche", { objektbezug: BEZUG });
    expect(g.statusCode, g.body).toBe(201);
    const gespraechId = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const n = await auf(erik.token, "POST", `/api/me/klara/gespraeche/${gespraechId}/nachrichten`, {
      von: "klara",
      modus: "hilfetext",
      text: `Denk an die ${WORT} am Tor.`,
      objektbezug: BEZUG,
    });
    expect(n.statusCode, n.body).toBe(201);
    const nachrichtId = (n.json() as { nachricht: { id: string } }).nachricht.id;
    const e = await lege(erik.token, {
      titel: `Schnitt ${WORT}`,
      bezug: { art: "gespraech", gespraechId, nachrichtId },
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    expect(e.bezug).toMatchObject({ art: "gespraech", gespraechId, nachrichtId });
    const pausiert = await lege(erik.token, {
      titel: "Pausiert",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    await auf(erik.token, "POST", `${BASIS}/${pausiert.id}/status`, {
      fassung: 1,
      aktion: "pausieren",
    });
    const erledigt = await lege(erik.token, {
      titel: "Schon erledigt",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    await auf(erik.token, "POST", `${BASIS}/${erledigt.id}/status`, {
      fassung: 1,
      aktion: "erledigen",
    });

    // Vor dem Termin: nichts. Zum Termin: der Takt der Steuerung.
    await takt();
    expect(await glocke(erik.token)).toEqual([]);
    stelleUhr("2026-10-13T07:00:20.000Z");
    expect((await takt()).zugestellt).toBe(1);
    expect((await takt()).zugestellt).toBe(0);

    const eigene = await glocke(erik.token);
    expect(eigene).toEqual([
      expect.objectContaining({
        kind: "erinnerung",
        title: `Schnitt ${WORT}`,
        erinnerungArt: "erinnerung",
        erinnerungId: e.id,
        seen: false,
      }),
    ]);
    expect((await hole(erik.token, e.id)).lage).toBe("abgeschlossen");
    // Persönlich: weder eine andere Person noch die Verwaltung sieht Meldung oder Erinnerung.
    expect(await glocke(vera.token)).toEqual([]);
    expect(await glocke(ada.token)).toEqual([]);
    expect((await auf(ada.token, "GET", `${BASIS}/${e.id}`)).statusCode).toBe(404);
    expect((await auf(vera.token, "DELETE", `${BASIS}/${e.id}`)).statusCode).toBe(404);
    expect(JSON.stringify((await auf(ada.token, "GET", BASIS)).json())).not.toContain(WORT);

    // Gelesen markieren gilt dauerhaft für diese Meldung.
    const id = eigene[0]?.id ?? "";
    expect(
      (await auf(erik.token, "POST", "/api/notifications/seen", { ids: [id] })).statusCode,
    ).toBe(200);
    expect((await glocke(erik.token))[0]?.seen).toBe(true);

    // Löschen entfernt die Erinnerung samt ihrer Meldung.
    await auf(erik.token, "DELETE", `${BASIS}/${e.id}`);
    expect(await glocke(erik.token)).toEqual([]);
  });
});

// ================================================================================================
describe("H4 · AW18-K11 — Überwachung der eigenen Läufe", () => {
  it("Rückstau vor dem Takt, danach Zahlen je Status und der letzte Takt der Steuerung", async () => {
    await lege(erik.token, {
      titel: "Überwacht",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    stelleUhr("2026-10-13T07:03:00.000Z");
    const vorher = (await auf(erik.token, "GET", `${BASIS}/ueberwachung`)).json() as {
      rueckstau: { anzahl: number; aelteste: string | null };
      steuerung: { taktSekunden: number | null; letzterLauf: unknown };
    };
    expect(vorher.rueckstau).toEqual({ anzahl: 1, aelteste: "2026-10-13T07:00:00.000Z" });
    expect(vorher.steuerung.taktSekunden).toBe(60);

    await takt();
    const nachher = (await auf(erik.token, "GET", `${BASIS}/ueberwachung`)).json() as {
      rueckstau: { anzahl: number };
      laeufe: Record<string, number>;
      steuerung: { letzterLauf: { zugestellt: number; beginn: string } | null };
    };
    expect(nachher.rueckstau.anzahl).toBe(0);
    expect(nachher.laeufe.zugestellt).toBe(1);
    expect(nachher.laeufe.fehlgeschlagen).toBe(0);
    expect(nachher.steuerung.letzterLauf).toMatchObject({
      zugestellt: 1,
      beginn: "2026-10-13T07:03:00.000Z",
    });
    // Eine andere Person sieht nur ihre eigenen (keine) Läufe.
    const fremd = (await auf(vera.token, "GET", `${BASIS}/ueberwachung`)).json() as {
      laeufe: Record<string, number>;
    };
    expect(fremd.laeufe.zugestellt).toBe(0);
  });
});

// ================================================================================================
describe("H5 · AW18-K08 — bewusste Übergabe über die echte App: heutige Rechte, reduzierte Sicht", () => {
  it("Vera bekommt Meldung und nur Titel/Termine; nach ihrem Ausscheiden stoppt die Wirkung", async () => {
    const e = await lege(erik.token, {
      titel: `Torschlüssel ${WORT}`,
      notiz: `Privat: Code ${WORT}-4711`,
      zeitplan: {
        art: "serie",
        datum: "2026-10-13",
        uhrzeit: "09:00",
        wiederholung: { takt: "taeglich", intervall: 1, anzahl: 3 },
      },
    });
    const ueber = await auf(erik.token, "POST", `${BASIS}/${e.id}/uebergabe`, {
      fassung: e.fassung,
      an: vera.email.toUpperCase(),
    });
    expect(ueber.statusCode, ueber.body).toBe(200);
    expect((ueber.json() as { erinnerung: Sicht }).erinnerung).toMatchObject({
      zustaendig: "uebergeben",
      uebergabe: { anName: "Vera Viewer" },
    });

    // Vera sieht die Erinnerung NUR in „uebernommen“ — ohne Notiz, Bezug oder Läufe.
    const liste = (await auf(vera.token, "GET", BASIS)).json() as {
      erinnerungen: unknown[];
      uebernommen: Record<string, unknown>[];
    };
    expect(liste.erinnerungen).toEqual([]);
    expect(liste.uebernommen).toEqual([
      expect.objectContaining({
        id: e.id,
        titel: `Torschlüssel ${WORT}`,
        vonName: "Erik Experte",
      }),
    ]);
    expect(Object.keys(liste.uebernommen[0] ?? {}).sort()).toEqual(
      [
        "anzeige",
        "id",
        "lage",
        "seit",
        "status",
        "titel",
        "vonName",
        "zeitplan",
        "zeitzone",
      ].sort(),
    );
    expect(JSON.stringify(liste)).not.toContain("4711");
    // Bearbeiten darf sie die fremde Erinnerung nicht.
    expect((await auf(vera.token, "GET", `${BASIS}/${e.id}`)).statusCode).toBe(404);

    stelleUhr("2026-10-13T07:00:20.000Z");
    expect((await takt()).zugestellt).toBe(1);
    expect(await glocke(erik.token)).toEqual([]);
    expect(await glocke(vera.token)).toEqual([
      expect.objectContaining({ title: `Torschlüssel ${WORT}`, erinnerungId: e.id }),
    ]);

    // Vera scheidet aus (vorhandener Weg, Vertretung Ada): ihr Zugang endet HEUTE.
    const aus = await auf(ada.token, "POST", `/api/users/${vera.id}/ausscheiden`, {
      vertretung: ada.id,
    });
    expect(aus.statusCode, aus.body).toBe(200);
    stelleUhr("2026-10-14T07:00:20.000Z");
    expect((await takt()).gestoppt).toBe(1);
    expect(await glocke(erik.token)).toEqual([]);
    const lauf = (await hole(erik.token, e.id)).laeufe as {
      status: string;
      ergebnis: { grund?: string };
    }[];
    expect(lauf[0]).toMatchObject({ status: "gestoppt", ergebnis: { grund: "konto_gesperrt" } });

    // Erik nimmt die Übergabe zurück — der nächste Termin kommt wieder bei ihm an.
    const aktuell = await hole(erik.token, e.id);
    const zurueck = await auf(erik.token, "POST", `${BASIS}/${e.id}/uebergabe`, {
      fassung: aktuell.fassung,
      an: null,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    stelleUhr("2026-10-15T07:00:20.000Z");
    expect((await takt()).zugestellt).toBe(1);
    expect(await glocke(erik.token)).toHaveLength(1);

    // Das Protokoll nennt Kennungen, nie Titel oder Notiz.
    const protokoll = await services.audit.list({ action: KLARA_ERINNERUNG_UEBERGEBEN });
    expect(protokoll.length).toBeGreaterThan(0);
    expect(JSON.stringify(protokoll)).not.toContain(WORT);
  });

  it("unbekannte, eigene oder nicht aktive Adresse: 409 empfaenger — ohne Auskunft über Konten", async () => {
    const e = await lege(erik.token, {
      titel: "Nicht übergebbar",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    for (const an of ["niemand@klara-erinnerung-k10.test", erik.email]) {
      const r = await auf(erik.token, "POST", `${BASIS}/${e.id}/uebergabe`, {
        fassung: e.fassung,
        an,
      });
      expect(r.statusCode).toBe(409);
      expect((r.json() as { grund: string }).grund).toBe("empfaenger");
    }
    const fremd = await auf(vera.token, "POST", `${BASIS}/${e.id}/uebergabe/zurueckgeben`, {});
    expect(fremd.statusCode).toBe(404);
  });
});

// ================================================================================================
describe("H6 · P07 — Einrichtungsassistent: Vorgaben je Person, erneut aufrufbar", () => {
  it("lesen, speichern, erneut speichern; neue Erinnerung ohne Zone nutzt die Vorgabe", async () => {
    const leer = await auf(erik.token, "GET", `${BASIS}/einstellungen`);
    expect(leer.statusCode, leer.body).toBe(200);
    expect((leer.json() as { einstellungen: Record<string, unknown> }).einstellungen).toMatchObject(
      {
        zeitzone: null,
        eingerichtetAm: null,
        fassung: 0,
      },
    );
    const gesetzt = await auf(erik.token, "PUT", `${BASIS}/einstellungen`, {
      fassung: 0,
      zeitzone: "Europe/London",
      verpasst: { regel: "nur_melden", grenzeMinuten: 15 },
      abschliessen: true,
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    expect(JSON.stringify(gesetzt.json())).not.toContain(erik.id);
    const erneut = await auf(erik.token, "PUT", `${BASIS}/einstellungen`, {
      fassung: 1,
      zeitzone: "Europe/Vienna",
      abschliessen: true,
    });
    expect((erneut.json() as { einstellungen: { fassung: number } }).einstellungen.fassung).toBe(2);
    const veraltet = await auf(erik.token, "PUT", `${BASIS}/einstellungen`, {
      fassung: 1,
      zeitzone: BERLIN,
    });
    expect(veraltet.statusCode).toBe(409);

    const r = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      titel: "Mit Vorgabe",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect((r.json() as { erinnerung: Sicht }).erinnerung).toMatchObject({
      zeitzone: "Europe/Vienna",
      verpasst: { regel: "nur_melden", grenzeMinuten: 15 },
    });
    // Eine andere Person hat ihre eigenen (leeren) Vorgaben.
    const fremd = (await auf(vera.token, "GET", `${BASIS}/einstellungen`)).json() as {
      einstellungen: { zeitzone: string | null };
    };
    expect(fremd.einstellungen.zeitzone).toBeNull();
  });
});

// ================================================================================================
describe("H7 · EQF-07 — Routine über die echte App: einrichten, ändern, ausführen, Ergebnis lesen", () => {
  it("Wochenbericht: nichts beim Einrichten, Änderung in Worten, Bericht in „Meine Notizen“, Glocke mit Ergebnis", async () => {
    const r = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      titel: `Wochenbericht ${WORT}`,
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-19",
        uhrzeit: "09:00",
        wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 4 },
      },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"] },
    });
    expect(r.statusCode, r.body).toBe(201);
    const e = (r.json() as { erinnerung: Sicht & { routine: Record<string, unknown> } }).erinnerung;
    expect(e.routine).toMatchObject({
      fassung: 1,
      ziel: "meine_notizen",
      wirkungen: ["bericht_erstellen"],
      modus: "automatisch",
    });
    expect(e.anzeige.erwartetesErgebnis).toBe("bericht_in_notizen");
    await takt();
    const notizen = async () =>
      (
        (await auf(erik.token, "GET", "/api/me/klara/notizen")).json() as {
          notizen: { id: string; titel: string; inhalt: string }[];
        }
      ).notizen;
    expect(await notizen()).toEqual([]);

    // Versand ist keine Wirkung einer Routine.
    const versand = await auf(erik.token, "POST", BASIS, {
      vorgang: vorgang(),
      titel: "Mit Versand",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-19", uhrzeit: "09:00" },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"], wirkungen: ["versenden"] },
    });
    expect(versand.statusCode).toBe(400);
    expect((versand.json() as { grund: string }).grund).toBe("wirkung_nicht_beauftragt");

    // Änderung in Worten: erst deuten, dann übernehmen.
    const gedeutet = await auf(erik.token, "POST", `${BASIS}/${e.id}/routine`, {
      fassung: e.fassung,
      text: "nimm die erledigten Aufgaben dazu",
    });
    expect(gedeutet.statusCode, gedeutet.body).toBe(200);
    expect(gedeutet.json()).toMatchObject({
      angewendet: false,
      deutung: { art: "abschnitt_dazu", abschnitt: "erledigte_aufgaben" },
    });
    const angewendet = await auf(erik.token, "POST", `${BASIS}/${e.id}/routine`, {
      fassung: e.fassung,
      text: "nimm die erledigten Aufgaben dazu",
      anwenden: true,
    });
    expect(angewendet.statusCode, angewendet.body).toBe(200);
    expect(
      (angewendet.json() as { erinnerung: { routine: { fassung: number; abschnitte: string[] } } })
        .erinnerung.routine,
    ).toMatchObject({ fassung: 2, abschnitte: ["offene_aufgaben", "erledigte_aufgaben"] });

    // Termin: Gespräch zu, der Takt legt den Bericht an.
    stelleUhr("2026-10-19T07:00:20.000Z");
    expect((await takt()).zugestellt).toBe(1);
    const [n, ...rest] = await notizen();
    expect(rest).toEqual([]);
    expect(n?.inhalt).toContain("Funktionsfassung 2.");
    const lauf = (
      (await hole(erik.token, e.id)).laeufe as {
        vorkommenId: string;
        ergebnis: { routine?: { notizId: string; routineFassung: number; status: string } };
      }[]
    )[0];
    expect(lauf?.ergebnis.routine).toMatchObject({
      notizId: n?.id,
      routineFassung: 2,
      status: "erstellt",
    });
    const glocke = (await auf(erik.token, "GET", "/api/notifications")).json() as {
      kind: string;
      erinnerungId?: string;
      erinnerungRoutine?: { status: string; notizId: string; offen: number };
    }[];
    expect(glocke.find((g) => g.erinnerungId === e.id)?.erinnerungRoutine).toEqual({
      status: "erstellt",
      notizId: n?.id,
      offen: 0,
    });
    // Andere Personen sehen weder Bericht noch Routine.
    expect(
      ((await auf(vera.token, "GET", "/api/me/klara/notizen")).json() as { notizen: unknown[] })
        .notizen,
    ).toEqual([]);

    // Rücknahme des unveränderten Berichts — und eine fremde Person kann es nicht.
    const vorkommen = encodeURIComponent(lauf?.vorkommenId ?? "");
    const pfadZurueck = `${BASIS}/${e.id}/laeufe/${vorkommen}/ergebnis-zuruecknehmen`;
    expect((await auf(vera.token, "POST", pfadZurueck, {})).statusCode).toBe(404);
    const zurueck = await auf(erik.token, "POST", pfadZurueck, {});
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(await notizen()).toEqual([]);
  });
});
