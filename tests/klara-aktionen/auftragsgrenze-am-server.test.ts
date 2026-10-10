// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen, AW-10) — DIE AUFTRAGSGRENZE AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`),
// jeder Schritt über HTTP — dieselbe Vorrichtung wie `tests/klara-basis/gespraech-am-server.test.ts`.
// Dazu die reinen Regeln aus `services/app/src/klara-auftrag.ts` dort, wo ein Übergang ohne HTTP
// klarer zu lesen ist. Was hier NICHT gemessen wird: die Ausführung über Entwürfe/Wissensobjekte im
// Browser — die misst `auftrag-am-server.test.tsx`.
//
//   A1 · K7  (AW10-K02) Ziel, erlaubte Quellen/Aktionen, Verantwortliche, Ergebnisanforderung am
//            Auftrag; Teilschritte erben dieselbe Grenze (Aktion, Ziel; Ergebnis eines Vorschritts).
//   A2 · K8  (AW10-K03) eine Korrektur vor dem Schritt verhindert den Beginn unter alter Fassung;
//            kein Ablaufdatum ersetzt die Prüfung je Schritt.
//   A3 · K9  (AW10-K04) Korrektur = neue Fassung, Geschehenes bleibt; Erweiterung abgewiesen.
//   A4 · K3/K4 Abbrechen verhindert weitere Schritte, Gespeichertes bleibt; Rückgängig ist ein
//            eigener Übergang und nur für Rücknehmbares.
//   A5 · K5  Wiederholung mit demselben Schlüssel legt nichts doppelt an; Teilfehler → „teilweise“,
//            nie „abgeschlossen“; ein Fehlschlag braucht seinen Grund.
//   A6 · K6  (AW10-K01) Versand, Einladung, Veröffentlichung sind keine Aktion der Grenze.
//   A7 · K5  Eigentum: fremde Person und unbekannte Kennung 404; Prüfprotokoll ohne Wortlaut.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  KLARA_AKTIONEN,
  type KlaraAuftrag,
  KlaraAuftragFehler,
  auftragsStand,
  brecheAb,
  korrigiere,
  neuerAuftrag,
  setzeSchritt,
} from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };

const BASIS = "/api/me/klara";
const BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };
const GEHEIMER_WORTLAUT = "Lege den Entwurf „Notcode Presse 4“ an";

const NEU_A = {
  art: "neuer_entwurf",
  id: null,
  titel: "Wartung Presse 4",
  stand: null,
  pfad: null,
} as const;
const NEU_B = { ...NEU_A, titel: "Wartung Presse 5" } as const;
const ARTIKEL = {
  art: "wissensobjekt",
  id: "ko-1",
  titel: "Hydraulikfilter H7",
  stand: "3",
  pfad: "/wissen/ko-1",
} as const;

function eingabe(over: Record<string, unknown> = {}) {
  return {
    quelle: "getippt",
    wortlaut: GEHEIMER_WORTLAUT,
    ziel: "Entwürfe „Wartung Presse 4“ und „Wartung Presse 5“ anlegen",
    erlaubteAktionen: ["entwurf_erstellen", "oeffnen"],
    erlaubteZiele: [NEU_A, NEU_B],
    erlaubteQuellen: ["Deine Eingabe (getippt)"],
    ergebnis: "Entwurf gespeichert und am Server nachgelesen",
    geplanteSchritte: 3,
    ...over,
  };
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

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

async function gespraech(wer: string): Promise<string> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche`, { objektbezug: BEZUG });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

async function auftrag(wer: string, gid: string, over: Record<string, unknown> = {}) {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche/${gid}/auftraege`, eingabe(over));
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { auftrag: KlaraAuftrag }).auftrag;
}

function schrittPfad(gid: string, aid: string, schluessel: string): string {
  return `${BASIS}/gespraeche/${gid}/auftraege/${aid}/schritte/${schluessel}`;
}

const ERGEBNIS_A = {
  art: "entwurf",
  id: "d-a",
  titel: "Wartung Presse 4",
  stand: "2026-10-10T10:00:00.000Z",
  pfad: "/erfassen?draft=d-a",
};

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@klara-aktionen.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@klara-aktionen.test");
  ada = { id: "", token: adminToken };
  erik = await konto(adminToken, "experte", "erik@klara-aktionen.test", "Erik Experte");
});

describe("A1 · K7 — der Auftrag trägt seine Grenze; Teilschritte erben sie", () => {
  it("zeigt Ziel, erlaubte Quellen/Aktionen, Verantwortliche und Ergebnis; prüft jeden Schritt", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    expect(a).toMatchObject({
      stand: "vorgeschlagen",
      fassung: 1,
      quelle: "getippt",
      ziel: "Entwürfe „Wartung Presse 4“ und „Wartung Presse 5“ anlegen",
      erlaubteAktionen: ["entwurf_erstellen", "oeffnen"],
      erlaubteQuellen: ["Deine Eingabe (getippt)"],
      ergebnis: "Entwurf gespeichert und am Server nachgelesen",
      geplanteSchritte: 3,
      schritte: [],
    });
    // Verantwortlich ist das Konto der Sitzung — nicht, was der Rumpf behauptet.
    const ich = await auf(erik.token, "GET", "/api/auth/me");
    expect(a.verantwortlich).toBe((ich.json() as { id: string }).id);
    const behauptet = await auf(erik.token, "POST", `${BASIS}/gespraeche/${gid}/auftraege`, {
      ...eingabe(),
      verantwortlich: "jemand-anderes",
    });
    expect((behauptet.json() as { auftrag: KlaraAuftrag }).auftrag.verantwortlich).toBe(
      a.verantwortlich,
    );

    // Eine Aktion ausserhalb der Grenze beginnt nicht.
    const bearbeiten = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-x"), {
      nr: 1,
      aktion: "entwurf_bearbeiten",
      ziel: { ...NEU_A, art: "entwurf", id: "d-fremd" },
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(bearbeiten.statusCode).toBe(409);
    expect((bearbeiten.json() as { grund: string }).grund).toBe("ausserhalb_auftrag");
    // Ein Ziel ausserhalb der Grenze ebenso — auch mit erlaubter Aktion.
    const fremd = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-y"), {
      nr: 1,
      aktion: "oeffnen",
      ziel: ARTIKEL,
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(fremd.statusCode).toBe(409);
    expect((fremd.json() as { grund: string }).grund).toBe("ausserhalb_auftrag");

    // Innerhalb: anlegen, dann das ERGEBNIS öffnen — die Teilaufgabe erbt die Grenze.
    const s1 = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(s1.statusCode, s1.body).toBe(200);
    expect((s1.json() as { auftrag: KlaraAuftrag }).auftrag.stand).toBe("laeuft");
    // Öffnen des noch nicht gespeicherten Ergebnisses: ausserhalb.
    const zuFrueh = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-2"), {
      nr: 2,
      aktion: "oeffnen",
      ziel: { art: "entwurf", id: "d-a", titel: "Wartung Presse 4", stand: null, pfad: null },
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(zuFrueh.statusCode).toBe(409);
    const gespeichert = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 1,
      stand: "gespeichert",
      ergebnis: ERGEBNIS_A,
      ruecknehmbar: true,
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const oeffnen = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-2"), {
      nr: 2,
      aktion: "oeffnen",
      ziel: { art: "entwurf", id: "d-a", titel: "Wartung Presse 4", stand: null, pfad: null },
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(oeffnen.statusCode, oeffnen.body).toBe(200);
  });

  it("eine Ergebnisadresse ausserhalb der Anwendung wird abgewiesen", () => {
    const a = neuerAuftrag(eingabe(), "konto-1", "a-1", "2026-10-10T10:00:00.000Z");
    const b = setzeSchritt(
      a,
      "s-1",
      { nr: 1, aktion: "entwurf_erstellen", ziel: NEU_A, auftragFassung: 1, stand: "begonnen" },
      "2026-10-10T10:00:01.000Z",
    ).auftrag;
    expect(() =>
      setzeSchritt(
        b,
        "s-1",
        {
          nr: 1,
          aktion: "entwurf_erstellen",
          ziel: NEU_A,
          auftragFassung: 1,
          stand: "gespeichert",
          ergebnis: { ...ERGEBNIS_A, pfad: "https://boese.example/x" },
        },
        "2026-10-10T10:00:02.000Z",
      ),
    ).toThrow(KlaraAuftragFehler);
  });
});

describe("A2 · K8 — eine Änderung der Grenze vor dem Schritt verhindert ihn", () => {
  it("ein Schritt unter veralteter Fassung beginnt nicht; der Auftrag kennt kein Ablaufdatum", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    const korr = await auf(
      erik.token,
      "POST",
      `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/fassungen`,
      {
        erlaubteAktionen: ["entwurf_erstellen"],
        erlaubteZiele: [NEU_A],
        geplanteSchritte: 1,
        grund: "Nur noch Presse 4",
      },
    );
    expect(korr.statusCode, korr.body).toBe(200);
    const alt = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 1,
      stand: "begonnen",
    });
    expect(alt.statusCode).toBe(409);
    expect((alt.json() as { grund: string }).grund).toBe("fassung_veraltet");
    // Unter der neuen Fassung: Presse 5 ist nicht mehr erlaubt, Presse 4 schon.
    const presse5 = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-2"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_B,
      auftragFassung: 2,
      stand: "begonnen",
    });
    expect((presse5.json() as { grund: string }).grund).toBe("ausserhalb_auftrag");
    const presse4 = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-3"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 2,
      stand: "begonnen",
    });
    expect(presse4.statusCode, presse4.body).toBe(200);
    // Kein Feld wie „gültig bis“: die Erlaubnis hängt an der Grenze, geprüft je Schritt.
    expect(Object.keys(a)).not.toContain("gueltigBis");
    expect(Object.keys(a)).not.toContain("ablauf");
  });
});

describe("A3 · K9 — Korrektur versioniert, zeigt Geschehenes und erweitert nicht still", () => {
  const T0 = "2026-10-10T10:00:00.000Z";
  function mitEinemGespeicherten(): KlaraAuftrag {
    const a = neuerAuftrag(eingabe(), "konto-1", "a-1", T0);
    const b = setzeSchritt(
      a,
      "s-1",
      { nr: 1, aktion: "entwurf_erstellen", ziel: NEU_A, auftragFassung: 1, stand: "begonnen" },
      T0,
    ).auftrag;
    return setzeSchritt(
      b,
      "s-1",
      {
        nr: 1,
        aktion: "entwurf_erstellen",
        ziel: NEU_A,
        auftragFassung: 1,
        stand: "gespeichert",
        ergebnis: ERGEBNIS_A,
        ruecknehmbar: true,
      },
      T0,
    ).auftrag;
  }

  it("eine engere Grenze wird Fassung 2; die frühere Fassung und der gespeicherte Schritt bleiben", () => {
    const a = mitEinemGespeicherten();
    const k = korrigiere(
      a,
      {
        erlaubteAktionen: ["entwurf_erstellen"],
        erlaubteZiele: [NEU_A],
        geplanteSchritte: 1,
        grund: "Presse 5 weglassen",
      },
      "2026-10-10T10:05:00.000Z",
    );
    expect(k.fassung).toBe(2);
    expect(k.grund).toBe("Presse 5 weglassen");
    expect(k.fassungen).toHaveLength(1);
    expect(k.fassungen[0]).toMatchObject({
      fassung: 1,
      erlaubteAktionen: ["entwurf_erstellen", "oeffnen"],
      geplanteSchritte: 3,
    });
    expect(k.schritte.map((s) => [s.schluessel, s.stand, s.ergebnis?.id])).toEqual([
      ["s-1", "gespeichert", "d-a"],
    ]);
    // Nach der Korrektur ist der einzige geplante Schritt gespeichert: abgeschlossen.
    expect(k.stand).toBe("abgeschlossen");
    expect(k.verlauf.map((v) => v.ereignis)).toContain("korrigiert");
  });

  it("mehr Aktionen, ein neues Ziel oder mehr Schritte sind eine Erweiterung — abgewiesen", () => {
    const a = neuerAuftrag(eingabe(), "konto-1", "a-1", T0);
    const fall = (over: Record<string, unknown>) => () =>
      korrigiere(
        a,
        {
          erlaubteAktionen: ["entwurf_erstellen"],
          erlaubteZiele: [NEU_A],
          geplanteSchritte: 1,
          grund: "Versuch",
          ...over,
        },
        T0,
      );
    for (const over of [
      { erlaubteAktionen: ["entwurf_erstellen", "entwurf_bearbeiten"] },
      { erlaubteZiele: [NEU_A, ARTIKEL] },
      { geplanteSchritte: 4 },
      { erlaubteQuellen: ["Deine Eingabe (getippt)", "Postfach"] },
    ]) {
      try {
        fall(over)();
        throw new Error(`nicht abgewiesen: ${JSON.stringify(over)}`);
      } catch (fehler) {
        expect(fehler).toBeInstanceOf(KlaraAuftragFehler);
        expect((fehler as KlaraAuftragFehler).grund).toBe("erweiterung");
      }
    }
  });

  it("am Server: die Erweiterung antwortet 409, die bisherige Grenze gilt unverändert weiter", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    const r = await auf(
      erik.token,
      "POST",
      `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/fassungen`,
      {
        erlaubteAktionen: ["entwurf_erstellen", "oeffnen", "entwurf_bearbeiten"],
        erlaubteZiele: [NEU_A, NEU_B],
        grund: "Darf ich auch bearbeiten?",
      },
    );
    expect(r.statusCode).toBe(409);
    expect((r.json() as { grund: string }).grund).toBe("erweiterung");
    const liste = await auf(erik.token, "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
    const [gelesen] = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege;
    expect(gelesen?.fassung).toBe(1);
    expect(gelesen?.erlaubteAktionen).toEqual(["entwurf_erstellen", "oeffnen"]);
  });
});

describe("A4 · K3/K4 — Abbrechen ist nicht Rückgängig", () => {
  it("nach dem Abbruch beginnt nichts mehr; der laufende Schritt meldet sein echtes Ergebnis", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    const beginne = (schluessel: string, nr: number, ziel: unknown) =>
      auf(erik.token, "PUT", schrittPfad(gid, a.id, schluessel), {
        nr,
        aktion: "entwurf_erstellen",
        ziel,
        auftragFassung: 1,
        stand: "begonnen",
      });
    expect((await beginne("s-1", 1, NEU_A)).statusCode).toBe(200);
    const abbruch = await auf(
      erik.token,
      "PUT",
      `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/abbruch`,
      {},
    );
    expect(abbruch.statusCode, abbruch.body).toBe(200);
    expect((abbruch.json() as { auftrag: KlaraAuftrag }).auftrag.stand).toBe("abgebrochen");
    // Kein weiterer Schritt.
    const danach = await beginne("s-2", 2, NEU_B);
    expect(danach.statusCode).toBe(409);
    expect((danach.json() as { grund: string }).grund).toBe("abgebrochen");
    // Der schon laufende Schritt meldet, was wirklich geschah — es wird nicht still zurückgenommen.
    const gemeldet = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 1,
      stand: "gespeichert",
      ergebnis: ERGEBNIS_A,
      ruecknehmbar: true,
    });
    expect(gemeldet.statusCode, gemeldet.body).toBe(200);
    const nach = (gemeldet.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(nach.stand).toBe("abgebrochen");
    expect(nach.schritte.map((s) => [s.nr, s.stand, s.ergebnis?.id])).toEqual([
      [1, "gespeichert", "d-a"],
    ]);
    // Abbrechen ist wiederholbar und ändert nichts weiter.
    const nochmal = await auf(
      erik.token,
      "PUT",
      `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/abbruch`,
      {},
    );
    expect((nochmal.json() as { auftrag: KlaraAuftrag }).auftrag.schritte[0]?.stand).toBe(
      "gespeichert",
    );
  });

  it("Rückgängig ist ein eigener Übergang — nur für einen rücknehmbaren, gespeicherten Schritt", () => {
    const T = "2026-10-10T10:00:00.000Z";
    let a = neuerAuftrag(
      eingabe({ erlaubteAktionen: ["entwurf_erstellen", "oeffnen"], geplanteSchritte: 2 }),
      "konto-1",
      "a-1",
      T,
    );
    const s = (stand: string, extra: Record<string, unknown> = {}) =>
      setzeSchritt(
        a,
        "s-1",
        { nr: 1, aktion: "entwurf_erstellen", ziel: NEU_A, auftragFassung: 1, stand, ...extra },
        T,
      ).auftrag;
    a = s("begonnen");
    a = s("gespeichert", { ergebnis: ERGEBNIS_A, ruecknehmbar: true });
    a = s("zurueckgenommen");
    expect(a.schritte[0]).toMatchObject({ stand: "zurueckgenommen", ruecknehmbar: false });
    expect(a.abgebrochenAm).toBeNull();
    expect(a.verlauf.map((v) => v.ereignis)).toContain("zurueckgenommen");

    // Öffnen ist nicht rücknehmbar.
    let b = neuerAuftrag(
      eingabe({ erlaubteAktionen: ["oeffnen"], erlaubteZiele: [ARTIKEL], geplanteSchritte: 1 }),
      "konto-1",
      "a-2",
      T,
    );
    const o = (stand: string, extra: Record<string, unknown> = {}) =>
      setzeSchritt(
        b,
        "o-1",
        { nr: 1, aktion: "oeffnen", ziel: ARTIKEL, auftragFassung: 1, stand, ...extra },
        T,
      ).auftrag;
    b = o("begonnen");
    b = o("abgeschlossen", {
      ergebnis: {
        art: "wissensobjekt",
        id: "ko-1",
        titel: "Hydraulikfilter H7",
        stand: "3",
        pfad: "/wissen/ko-1",
      },
    });
    expect(b.schritte[0]?.ruecknehmbar).toBe(false);
    expect(() => o("zurueckgenommen")).toThrow(/nicht rücknehmbar/);
    expect(b.stand).toBe("abgeschlossen");
    // Abbrechen eines beendeten Auftrags gibt es nicht.
    expect(() => brecheAb(b, T)).toThrow(KlaraAuftragFehler);
  });
});

describe("A5 · K5 — keine Doppelaktion, kein falscher Erfolg", () => {
  it("derselbe Schlüssel ist derselbe Schritt; ein anderer Schritt darf ihn nicht belegen", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    const rumpf = {
      nr: 1,
      aktion: "entwurf_erstellen",
      ziel: NEU_A,
      auftragFassung: 1,
      stand: "begonnen",
    };
    const erst = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), rumpf);
    const wieder = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), rumpf);
    expect(erst.statusCode).toBe(200);
    expect(wieder.statusCode).toBe(200);
    expect((erst.json() as { wiederholt: boolean }).wiederholt).toBe(false);
    expect((wieder.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    expect((wieder.json() as { auftrag: KlaraAuftrag }).auftrag.schritte).toHaveLength(1);
    const belegt = await auf(erik.token, "PUT", schrittPfad(gid, a.id, "s-1"), {
      ...rumpf,
      ziel: NEU_B,
    });
    expect((belegt.json() as { grund: string }).grund).toBe("schluessel_belegt");
    // Die Wiederholung schreibt auch nichts ins Prüfprotokoll.
    const protokoll = await services.audit.list({ action: "klara.auftrag.schritt" });
    expect(protokoll).toHaveLength(1);
  });

  it("ein Teilfehler ergibt „teilweise“, ein Fehlschlag braucht seinen Grund", () => {
    const T = "2026-10-10T10:00:00.000Z";
    let a = neuerAuftrag(eingabe({ geplanteSchritte: 2 }), "konto-1", "a-1", T);
    const s = (schluessel: string, ziel: unknown, stand: string, extra = {}) =>
      setzeSchritt(
        a,
        schluessel,
        { nr: 1, aktion: "entwurf_erstellen", ziel, auftragFassung: 1, stand, ...extra },
        T,
      ).auftrag;
    a = s("s-1", NEU_A, "begonnen");
    a = s("s-1", NEU_A, "gespeichert", { ergebnis: ERGEBNIS_A, ruecknehmbar: true });
    expect(auftragsStand(a)).toBe("laeuft");
    a = s("s-2", NEU_B, "begonnen");
    expect(() => s("s-2", NEU_B, "fehlgeschlagen")).toThrow(/grund/);
    a = s("s-2", NEU_B, "fehlgeschlagen", { grund: "Dir fehlt das Recht dafür." });
    expect(a.stand).toBe("teilweise");
    expect(a.schritte[1]).toMatchObject({
      stand: "fehlgeschlagen",
      grund: "Dir fehlt das Recht dafür.",
    });
    // Ein Erfolg ohne nachgelesenes Ergebnis wird nicht angenommen.
    let b = neuerAuftrag(eingabe({ geplanteSchritte: 1 }), "konto-1", "a-2", T);
    b = setzeSchritt(
      b,
      "s-1",
      { nr: 1, aktion: "entwurf_erstellen", ziel: NEU_A, auftragFassung: 1, stand: "begonnen" },
      T,
    ).auftrag;
    expect(() =>
      setzeSchritt(
        b,
        "s-1",
        {
          nr: 1,
          aktion: "entwurf_erstellen",
          ziel: NEU_A,
          auftragFassung: 1,
          stand: "gespeichert",
        },
        T,
      ),
    ).toThrow(/ergebnis/);
  });
});

describe("A6 · K6 — Versand ist keine Aktion; aus Inhalten entsteht keine Befugnis", () => {
  it("die Grenze kennt genau die vier Produktaktionen; „versenden“ wird abgewiesen", async () => {
    expect([...KLARA_AKTIONEN]).toEqual([
      "oeffnen",
      "entwurf_erstellen",
      "entwurf_bearbeiten",
      "aufgabe_bearbeiten",
    ]);
    const gid = await gespraech(erik.token);
    for (const aktion of ["versenden", "einladen", "veroeffentlichen", "senden"]) {
      const r = await auf(
        erik.token,
        "POST",
        `${BASIS}/gespraeche/${gid}/auftraege`,
        eingabe({ erlaubteAktionen: [aktion] }),
      );
      expect(r.statusCode, aktion).toBe(400);
    }
    const liste = await auf(erik.token, "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
    expect((liste.json() as { auftraege: unknown[] }).auftraege).toEqual([]);
  });
});

describe("A7 · K5 — nur das eigene Konto; Prüfprotokoll ohne Inhalt", () => {
  it("eine fremde Person liest, schreibt und bricht nichts ab; unbekannt antwortet gleich", async () => {
    const gid = await gespraech(erik.token);
    const a = await auftrag(erik.token, gid);
    for (const [methode, url, rumpf] of [
      ["GET", `${BASIS}/gespraeche/${gid}/auftraege`, undefined],
      ["POST", `${BASIS}/gespraeche/${gid}/auftraege`, eingabe()],
      ["PUT", `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/abbruch`, {}],
      [
        "PUT",
        schrittPfad(gid, a.id, "s-1"),
        { nr: 1, aktion: "entwurf_erstellen", ziel: NEU_A, auftragFassung: 1, stand: "begonnen" },
      ],
    ] as const) {
      const fremd = await auf(ada.token, methode, url, rumpf);
      expect(fremd.statusCode, `${methode} ${url}`).toBe(404);
    }
    const unbekannt = await auf(
      erik.token,
      "PUT",
      `${BASIS}/gespraeche/${gid}/auftraege/gibt-es-nicht/abbruch`,
      {},
    );
    expect(unbekannt.statusCode).toBe(404);
    expect((unbekannt.json() as { grund: string }).grund).toBe("auftrag_unbekannt");
    const ohne = await auf("", "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
    expect(ohne.statusCode).toBe(401);

    // Nichts wurde verändert.
    const liste = await auf(erik.token, "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
    const [gelesen] = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege;
    expect(gelesen?.stand).toBe("vorgeschlagen");
    expect(gelesen?.schritte).toEqual([]);

    // Prüfprotokoll: Ereignis, Kennungen, Aktionen — nie Wortlaut oder Titel.
    const angelegt = await services.audit.list({ action: "klara.auftrag.angelegt" });
    expect(angelegt.map((e) => e.target)).toEqual([`klara-auftrag:${a.id}`]);
    const roh = JSON.stringify(angelegt);
    expect(roh).not.toContain("Notcode");
    expect(roh).not.toContain("Wartung Presse");
  });
});
