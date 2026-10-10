// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — FESTER FIKTIVER EREIGNISBESTAND, ECHTER DRAHT, ECHTE RECHTE.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Alle Personen, Titel, Fragen und Zeitpunkte sind
// erfunden. Zwei Wege:
//   · Der Rechenkern `ladeWissenskennzahlen` mit einem FESTEN Frageprotokoll (bekannte Nenner, zwei
//     Zeiträume, unvollständige Abdeckung, ausgefallene Quelle) und fester Uhr.
//   · Die vollständige App (`buildApp`) über HTTP mit echten Anmeldungen für Rechte, Detailliste
//     und Fragebedarf.
//
//   W1  Bedeutung/Nenner/Zeitraum/Datenstand: jede Zahl trägt Lage, Zähler/Nenner, Erhebungsbeginn;
//       Null, unbekannt und unvollständig erhoben sind verschiedene Lagen (K1).
//   W2  Trend nur bei vollständig erhobenem Vorzeitraum gleicher Länge (K3).
//   W3  Space-/Teamfilter gelten für Zahl UND Detailliste; Quellen ohne Space sind dann „nicht
//       erhoben“, nicht ungefiltert (K3).
//   W4  Handlungsbedarf = Vorgänge aus ADMIN-10, Weg in die Arbeitsliste mit derselben Auswahl;
//       Fragebedarf führt auf die vorhandene Lücke, ohne eine zweite anzulegen (K4).
//   W5  Rechte: nur Verwaltung; fremde Spaces fehlen in Zahl und Detail; kein Fragetext, keine
//       Kontodaten (K5).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ladeQualitaetsaufgaben } from "../../services/app/src/qualitaetsaufgaben";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import type { SpaceFassung } from "../../services/app/src/spaces";
import type { TeamFassung } from "../../services/app/src/teams";
import {
  type Kennzahl,
  type KennzahlAnfrage,
  type KennzahlDeps,
  KennzahlFilterFehler,
  type Wissenskennzahlen,
  anfrageAus,
  ladeWissenskennzahlen,
} from "../../services/app/src/wissenskennzahlen";
import type { Gap } from "../../services/ask";
import type { AuditEntry } from "../../services/audit";

type App = ReturnType<typeof buildApp>;
type Services = ReturnType<typeof buildServices>;
type Konto = { headers: { authorization: string }; id: string };

// Fiktives Testkennwort eines isolierten Speicheraufbaus — kein echtes Geheimnis.
const KENNWORT = "fiktiv-12345";
const TITEL_A = "Fiktiv: Ventil V-11 vor dem Spülen schließen";
const TITEL_B = "Fiktiv: Filter F-22 nach 200 Stunden wechseln";
const TITEL_GESPERRT = "Fiktiv: Kessel K-33 nur mit Schutzbrille öffnen";
const FRAGE_BEDARF = "Fiktiv: Welches Drehmoment gilt für Flansch Z-404?";

/** Die feste Uhr: 9. Oktober 2026, 12:00 UTC. */
const JETZT = new Date("2026-10-09T12:00:00.000Z");

async function login(app: App, email: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const headers = { authorization: `Bearer ${res.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Verwaltung", email: "ada@admin11.test", password: KENNWORT },
  });
  const admin = await login(app, "ada@admin11.test");
  for (const [name, email, role] of [
    ["Alex Autorin", "autorin@admin11.test", "experte"],
    ["Fritz Fragend", "frager@admin11.test", "experte"],
    ["Cora Controller", "controller@admin11.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  return {
    services,
    app,
    admin,
    autorin: await login(app, "autorin@admin11.test"),
    frager: await login(app, "frager@admin11.test"),
    controller: await login(app, "controller@admin11.test"),
  };
}

async function anlegen(app: App, wer: Konto, title: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer.headers,
    payload: {
      confidentiality: "intern",
      title,
      statement: `${title}. Ein erfundener Satz nur für diese Prüfung.`,
      type: "best_practice",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/** Ein fiktiver Eintrag „Frage gestellt“ — dieselbe Feldmenge wie `AskService` (ohne Fragetext). */
function frage(at: string, answered: boolean, seq: number): AuditEntry {
  return {
    seq,
    at,
    actor: "fiktiv-nutzer",
    action: "ask.query",
    target: answered ? "ko-fiktiv" : "-",
    payload: { answered, retrievalMode: "prefilter" },
    prevHash: "fiktiv",
    hash: "fiktiv",
  };
}

/**
 * Der feste Ereignisbestand. Bei 7 Tagen ist der Zeitraum 02.10. 12:00 – 09.10. 12:00 und der
 * Vorzeitraum 25.09. 12:00 – 02.10. 12:00.
 *   vor beiden Zeiträumen: 1 Frage (20.09.) — sie belegt den Erhebungsbeginn
 *   Vorzeitraum:           2 Fragen, davon 1 beantwortet  → 50 %
 *   Zeitraum:              4 Fragen, davon 3 beantwortet  → 75 %
 */
const BESTAND: AuditEntry[] = [
  frage("2026-09-20T08:00:00.000Z", true, 1),
  frage("2026-09-26T08:00:00.000Z", true, 2),
  frage("2026-09-30T08:00:00.000Z", false, 3),
  frage("2026-10-03T08:00:00.000Z", true, 4),
  frage("2026-10-05T08:00:00.000Z", true, 5),
  frage("2026-10-07T08:00:00.000Z", false, 6),
  frage("2026-10-09T11:59:00.000Z", true, 7),
];

function space(id: string, name: string, teams: string[] = []): SpaceFassung {
  return {
    id,
    name,
    zweck: "Fiktiver Space nur für diese Prüfung.",
    verantwortlich: "fiktiv-verantwortlich",
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
    teams: teams.map((team) => ({ team, recht: "lesen" as const })),
    version: 1,
    angelegtVon: "fiktiv",
    angelegtAm: "2026-09-01T00:00:00.000Z",
    geaendertVon: "fiktiv",
    geaendertAm: "2026-09-01T00:00:00.000Z",
  };
}

function team(id: string, name: string, archiviert = false): TeamFassung {
  return {
    id,
    name,
    zweck: "Fiktives Team nur für diese Prüfung.",
    verantwortlich: "fiktiv-verantwortlich",
    mitglieder: [],
    version: 1,
    archiviert,
    vorgang: archiviert ? "archiviert" : "angelegt",
    angelegtVon: "fiktiv",
    angelegtAm: "2026-09-01T00:00:00.000Z",
    geaendertVon: "fiktiv",
    geaendertAm: "2026-09-01T00:00:00.000Z",
  };
}

/** Die Abhängigkeiten wie in der Kompositionswurzel — Frageprotokoll und Uhr wahlweise fest. */
function depsVon(
  services: Services,
  opts: {
    fragen?: AuditEntry[] | "fehler";
    spaces?: SpaceFassung[];
    teams?: TeamFassung[];
    luecken?: Gap[];
  } = {},
): KennzahlDeps {
  return {
    ko: services.ko,
    validation: services.validation,
    lifecycle: services.lifecycle,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
    ask: opts.luecken ? { listGaps: async () => opts.luecken ?? [] } : services.ask,
    audit: {
      recordOnce: (id, input) => services.audit.recordOnce(id, input),
      list: async (filter) => {
        if (filter?.action === "ask.query" && opts.fragen !== undefined) {
          if (opts.fragen === "fehler") {
            throw new Error("Fiktiv: Prüfprotokoll nicht erreichbar");
          }
          return opts.fragen;
        }
        return services.audit.list(filter);
      },
    },
    konten: () => services.auth.listUsers(),
    spaces: opts.spaces ? { aktuelle: async () => opts.spaces ?? [] } : services.spaces,
    teams: { aktuelle: async () => opts.teams ?? [] },
    jetzt: () => JETZT,
  };
}

const anfrage = (teil: Partial<KennzahlAnfrage> = {}): KennzahlAnfrage => ({
  tage: 7,
  space: null,
  team: null,
  ...teil,
});

function zahl(k: Wissenskennzahlen, schluessel: string): Kennzahl {
  const gefunden = [...k.handlungsbedarf, ...k.nutzung].find((x) => x.schluessel === schluessel);
  if (!gefunden) {
    throw new Error(`Kennzahl ${schluessel} fehlt`);
  }
  return gefunden;
}

describe("ADMIN-11 · W1/W2 · fester Ereignisbestand: Nenner, Zeiträume, Lage und Trend", () => {
  it("vollständig erhobene Zeiträume: bekannte Nenner, Quote und Trend gegen den Vorzeitraum", async () => {
    const a = await setup();
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const k = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: BESTAND }),
      betrachter,
      sichtbarkeitsfilterFuer(betrachter),
      anfrage(),
    );
    // Datenstand und Zeitraum stehen in der Antwort — nicht „jetzt“ im Browser.
    expect(k.stand).toBe(JETZT.toISOString());
    expect(k.zeitraum).toEqual({
      von: "2026-10-02T12:00:00.000Z",
      bis: "2026-10-09T12:00:00.000Z",
    });
    expect(k.vorperiode).toEqual({
      von: "2026-09-25T12:00:00.000Z",
      bis: "2026-10-02T12:00:00.000Z",
    });

    expect(zahl(k, "fragen")).toMatchObject({
      art: "zeitraum",
      wert: 4,
      lage: "gemessen",
      erhobenSeit: "2026-09-20T08:00:00.000Z",
      trend: { vorher: 2, differenz: 2 },
      trendGrund: "verglichen",
    });
    expect(zahl(k, "beantwortet")).toMatchObject({ wert: 3, trend: { vorher: 1, differenz: 2 } });
    expect(zahl(k, "antwortquote")).toMatchObject({
      einheit: "prozent",
      wert: 75,
      zaehler: 3,
      nenner: 4,
      lage: "gemessen",
      trend: { vorher: 50, differenz: 25 },
    });
    // Momentaufnahmen tragen nie einen Verlauf — es gibt keine gespeicherten früheren Stände.
    for (const h of k.handlungsbedarf) {
      expect(h.art).toBe("momentaufnahme");
      expect(h.trend).toBeNull();
      expect(["momentaufnahme", "unbekannt", "nicht_erhoben"]).toContain(h.trendGrund);
    }
    // Ohne Leseweg der eigenen Suchen ist die Suche „nicht erhoben“ — ausdrücklich, nicht als 0.
    expect(k.suche).toEqual({
      lage: "nicht_erhoben",
      deckel: 20,
      zuordnung: "bekannt",
      eintraege: [],
    });
  });

  it("Zeitraum beginnt vor dem ersten belegten Ereignis: „unvollständig“, ohne Trend", async () => {
    const a = await setup();
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);
    // 30 Tage: der Zeitraum beginnt am 09.09., das erste Ereignis liegt am 20.09.
    const k30 = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: BESTAND }),
      betrachter,
      filter,
      anfrage({ tage: 30 }),
    );
    expect(zahl(k30, "fragen")).toMatchObject({
      wert: 7,
      lage: "unvollstaendig",
      erhobenSeit: "2026-09-20T08:00:00.000Z",
      trend: null,
      trendGrund: "vorperiode_unvollstaendig",
    });
    // 7 Tage, aber erst seit dem 28.09. erhoben: der Zeitraum ist vollständig, der Vorzeitraum nicht.
    const spaet = BESTAND.filter((f) => f.at >= "2026-09-28");
    const k7 = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: spaet }),
      betrachter,
      filter,
      anfrage(),
    );
    expect(zahl(k7, "fragen")).toMatchObject({
      wert: 4,
      lage: "gemessen",
      trend: null,
      trendGrund: "vorperiode_unvollstaendig",
    });
  });

  it("Null, unbekannt und nicht protokolliert sind drei verschiedene Lagen", async () => {
    const a = await setup();
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);

    // Gemessene Null: erhoben seit langem, im Zeitraum keine Frage.
    const alt = [frage("2026-08-01T08:00:00.000Z", true, 1)];
    const gemesseneNull = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: alt }),
      betrachter,
      filter,
      anfrage(),
    );
    expect(zahl(gemesseneNull, "fragen")).toMatchObject({ wert: 0, lage: "gemessen" });
    // Quote über 0 Fragen ist nicht berechenbar — und kein Trend.
    expect(zahl(gemesseneNull, "antwortquote")).toMatchObject({
      wert: null,
      zaehler: 0,
      nenner: 0,
      lage: "gemessen",
      trendGrund: "nenner_null",
    });

    // Quelle ausgefallen: unbekannt, kein Wert.
    const weg = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: "fehler" }),
      betrachter,
      filter,
      anfrage(),
    );
    expect(zahl(weg, "fragen")).toMatchObject({ wert: null, lage: "unbekannt" });
    expect(zahl(weg, "antwortquote")).toMatchObject({ wert: null, lage: "unbekannt" });
    expect(weg.quellen.fragen).toBe("fehler");

    // Noch nie ein Ereignis: 0 im Zeitraum, aber der Erhebungsbeginn ist nicht belegt.
    const nie = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: [] }),
      betrachter,
      filter,
      anfrage(),
    );
    expect(zahl(nie, "fragen")).toMatchObject({
      wert: 0,
      lage: "unvollstaendig",
      erhobenSeit: null,
    });
  });

  it("die Anfrage liest nur bekannte Zeiträume; ein fremder Wert fällt auf 30 Tage", () => {
    expect(anfrageAus({ tage: "90", space: " s-1 ", team: "" })).toEqual({
      tage: 90,
      space: "s-1",
      team: null,
    });
    expect(anfrageAus({ tage: "365" }).tage).toBe(30);
  });
});

describe("ADMIN-11 · W3/W4 · Filter gelten für Zahl und Detailliste; Wege in die Arbeit", () => {
  it("Handlungsbedarf ist die ADMIN-10-Menge; Space und Team grenzen Zahl und Liste gleich ein", async () => {
    const a = await setup();
    const inA = await anlegen(a.app, a.autorin, TITEL_A);
    const inB = await anlegen(a.app, a.autorin, TITEL_B);
    await a.services.ko.setLeadingSpace(inA, "space-a", a.admin.id, null);
    await a.services.ko.setLeadingSpace(inB, "space-b", a.admin.id, null);
    const spaces = [
      space("space-a", "Fiktiv Montage", ["team-1"]),
      space("space-b", "Fiktiv Wartung", ["team-2"]),
      space("space-c", "Fiktiv Geschlossen", ["team-3"]),
    ];
    const teams = [
      team("team-1", "Fiktiv Team Montage"),
      team("team-2", "Fiktiv Team Wartung"),
      team("team-3", "Fiktiv Team Geschlossen"),
      team("team-4", "Fiktiv Team Archiv", true),
    ];
    const betrachter = {
      id: a.admin.id,
      role: "admin" as const,
      spaceLesbar: new Set(["space-a", "space-b"]),
    };
    const filter = sichtbarkeitsfilterFuer(betrachter);
    const deps = depsVon(a.services, { fragen: BESTAND, spaces, teams });

    const alle = await ladeWissenskennzahlen(deps, betrachter, filter, anfrage());
    // Filterwerte: nur lesbare Spaces; nur aktive Teams, die an einen davon gebunden sind.
    expect(alle.filterwerte.spaces.map((s) => s.id)).toEqual(["space-a", "space-b"]);
    expect(alle.filterwerte.teams.map((x) => x.id)).toEqual(["team-1", "team-2"]);

    // Die Zahl ist die Länge ihrer Detailliste, und beide sind die ADMIN-10-Menge.
    const qa = await ladeQualitaetsaufgaben(deps, betrachter, filter);
    const pruefung = zahl(alle, "pruefung");
    expect(pruefung.wert).toBe(pruefung.eintraege?.length);
    const ausQa = qa.vorgaenge.filter((v) => v.typ === "pruefung").map((v) => v.schluessel);
    expect(pruefung.eintraege?.map((e) => e.schluessel).sort()).toEqual(ausQa.sort());
    expect(pruefung.eintraege?.map((e) => e.schluessel)).toEqual(
      expect.arrayContaining([`pruefung:${inA}`, `pruefung:${inB}`]),
    );
    expect(pruefung.arbeitsliste).toBe("/qualitaetsaufgaben?typ=pruefung");
    expect(zahl(alle, "rueckmeldung").arbeitsliste).toBe(
      "/qualitaetsaufgaben?typ=rueckmeldung&zustand=offen",
    );
    const eintragA = pruefung.eintraege?.find((e) => e.schluessel === `pruefung:${inA}`);
    expect(eintragA?.arbeitsweg).toBe(`/wissen/${inA}`);

    // Space-Filter: Zahl UND Liste nur noch aus space-a; Arbeitsliste mit derselben Auswahl.
    const nurA = await ladeWissenskennzahlen(
      deps,
      betrachter,
      filter,
      anfrage({ space: "space-a" }),
    );
    const pruefungA = zahl(nurA, "pruefung");
    expect(pruefungA.eintraege?.map((e) => e.schluessel)).toEqual([`pruefung:${inA}`]);
    expect(pruefungA.wert).toBe(1);
    expect(pruefungA.arbeitsliste).toBe("/qualitaetsaufgaben?typ=pruefung&space=space-a");
    // Quellen ohne Space werden nicht ungefiltert gezeigt: „nicht erhoben“, kein Wert, kein Weg.
    for (const schluessel of ["luecke", "fragen", "beantwortet", "antwortquote", "neue_luecken"]) {
      expect(zahl(nurA, schluessel)).toMatchObject({
        wert: null,
        lage: "nicht_erhoben",
        arbeitsliste: null,
      });
    }
    expect(nurA.bedarf).toMatchObject({ lage: "nicht_erhoben", offen: null, eintraege: [] });

    // Team-Filter: die Spaces des Teams; die Liste steht hier, weil die Arbeitsliste kein Team kennt.
    const team2 = await ladeWissenskennzahlen(
      deps,
      betrachter,
      filter,
      anfrage({ team: "team-2" }),
    );
    const pruefungT2 = zahl(team2, "pruefung");
    expect(pruefungT2.eintraege?.map((e) => e.schluessel)).toEqual([`pruefung:${inB}`]);
    expect(pruefungT2.arbeitsliste).toBeNull();
    // Space UND Team: der Schnitt — hier leer, und zwar als gemessene Null.
    const schnitt = await ladeWissenskennzahlen(
      deps,
      betrachter,
      filter,
      anfrage({ space: "space-a", team: "team-2" }),
    );
    expect(zahl(schnitt, "pruefung")).toMatchObject({ wert: 0, lage: "gemessen", eintraege: [] });

    // Nicht wählbar: ein fremder Space, ein Team ohne lesbaren Space, ein archiviertes Team.
    for (const falsch of [
      anfrage({ space: "space-c" }),
      anfrage({ space: "space-unbekannt" }),
      anfrage({ team: "team-3" }),
      anfrage({ team: "team-4" }),
    ]) {
      const versuch = ladeWissenskennzahlen(deps, betrachter, filter, falsch);
      await expect(versuch).rejects.toBeInstanceOf(KennzahlFilterFehler);
    }
  });

  it("häufiger Fragebedarf führt auf die EINE vorhandene Lücke — keine Doppelaufgabe", async () => {
    const a = await setup();
    for (let i = 0; i < 2; i += 1) {
      await a.app.inject({
        method: "POST",
        url: "/api/ask",
        headers: a.frager.headers,
        payload: { question: FRAGE_BEDARF },
      });
    }
    const offen = (await a.services.ask.listGaps()).filter((g) => g.status === "offen");
    expect(offen, "Kalibrierung: dieselbe Frage ist EINE Lücke").toHaveLength(1);
    const luecke = offen[0];

    const res = await a.app.inject({
      method: "GET",
      url: "/api/wissenskennzahlen?tage=7",
      headers: a.admin.headers,
    });
    expect(res.statusCode, res.body).toBe(200);
    const k = res.json() as Wissenskennzahlen;
    expect(k.bedarf.lage).toBe("gemessen");
    expect(k.bedarf.offen).toBe(1);
    expect(k.bedarf.eintraege).toEqual([
      expect.objectContaining({
        lueckeId: luecke?.id,
        haeufigkeit: 2,
        zugeordnet: false,
        vorgang: `luecke:${luecke?.id}`,
        arbeitsweg: `/risiko?fall=${luecke?.id}`,
        // R-0585: die Verwaltung ist nicht zuständig — kein Fragetext.
        frage: null,
      }),
    ]);
    // Die Zahl der offenen Lücken und die ADMIN-10-Liste zählen denselben einen Vorgang.
    expect(zahl(k, "luecke")).toMatchObject({ wert: 1 });
    const lueckenZeilen = zahl(k, "luecke").eintraege?.map((e) => e.schluessel);
    expect(lueckenZeilen).toEqual([`luecke:${luecke?.id}`]);
    const qa = await a.app.inject({
      method: "GET",
      url: "/api/qualitaetsaufgaben",
      headers: a.admin.headers,
    });
    const vorgaengeInQa = qa.json().vorgaenge as { typ: string }[];
    expect(vorgaengeInQa.filter((v) => v.typ === "luecke")).toHaveLength(1);
    // Datensparsam: weder Fragetext noch Konto der fragenden Person stehen in der Auswertung.
    expect(res.body).not.toContain("Drehmoment");
    expect(res.body).not.toContain(a.frager.id);
    expect(res.body).not.toContain("frager@admin11.test");
    expect(res.body).not.toContain("Fritz");
    // Zweimal gefragt, EINE Lücke entstanden — auch die Zeitraumzahl zählt sie einmal.
    expect(zahl(k, "neue_luecken").wert).toBe(1);
  });
});

function luecke(id: string, createdAt: string, status: Gap["status"]): Gap {
  return {
    id,
    question: `Fiktiv: Frage ${id}`,
    status,
    assignee: null,
    priority: "mittel",
    createdAt,
  };
}

describe("ADMIN-11 · Nacharbeit 3 · Detailmenge und eigene Suchen", () => {
  it("„Neue Wissenslücken“: die Detailliste ist genau die gezählte Zeitraum- und Statusmenge", async () => {
    const a = await setup();
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const bestand = [
      luecke("gap-alt", "2026-09-20T08:00:00.000Z", "offen"),
      luecke("gap-vorher", "2026-09-28T08:00:00.000Z", "geschlossen"),
      luecke("gap-offen", "2026-10-03T08:00:00.000Z", "offen"),
      luecke("gap-zu", "2026-10-05T08:00:00.000Z", "geschlossen"),
    ];
    const k = await ladeWissenskennzahlen(
      depsVon(a.services, { fragen: BESTAND, luecken: bestand }),
      betrachter,
      sichtbarkeitsfilterFuer(betrachter),
      anfrage(),
    );
    const neu = zahl(k, "neue_luecken");
    // Offen UND geschlossen, nur aus dem Zeitraum — und die Liste ist genau diese Menge.
    expect(neu).toMatchObject({ wert: 2, lage: "gemessen", trend: { vorher: 1, differenz: 1 } });
    expect(neu.eintraege?.map((e) => [e.schluessel, e.zustand])).toEqual([
      ["luecke:gap-offen", "offen"],
      ["luecke:gap-zu", "erledigt"],
    ]);
    expect(neu.eintraege?.length).toBe(neu.wert);
    // Jeder Eintrag öffnet die Lücke im vorhandenen Risikobereich; Fragetext nur für Berechtigte.
    expect(neu.eintraege?.map((e) => e.arbeitsweg)).toEqual([
      "/risiko?fall=gap-offen",
      "/risiko?fall=gap-zu",
    ]);
    expect(neu.eintraege?.every((e) => e.titel === null)).toBe(true);
    // Kein Weg in eine Arbeitsliste, die weder Zeitraum noch geschlossene Lücken kennt.
    expect(neu.arbeitsliste).toBeNull();
  });

  it("eigene Suchen ohne Treffer: nur die eigenen, kumuliert, zugeordnet nur bei sichtbarem Fragetext", async () => {
    const a = await setup();
    const eigen = "Fiktiv Anzugswert Mutter M-77";
    const geschwaerzt = "Fiktiv Drehzahl Lüfter L-12";
    const fremd = "Fiktiv Spannung Relais R-5";
    // Eigene erfolglose Suchen über den vorhandenen Weg, dazu eine fremde.
    for (const [wer, q] of [
      [a.admin, eigen],
      [a.admin, eigen],
      [a.admin, geschwaerzt],
      [a.frager, fremd],
    ] as const) {
      const res = await a.app.inject({
        method: "GET",
        url: `/api/library/search?q=${encodeURIComponent(q)}`,
        headers: wer.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
    }
    // Zwei Lücken mit denselben Fragen: eine der Verwaltung selbst (Fragetext sichtbar), eine der
    // fragenden Person (für die Verwaltung geschwärzt, R-0585).
    for (const [wer, q] of [
      [a.admin, eigen],
      [a.frager, geschwaerzt],
    ] as const) {
      await a.app.inject({
        method: "POST",
        url: "/api/ask",
        headers: wer.headers,
        payload: { question: q },
      });
    }
    const offen = (await a.services.ask.listGaps()).filter((g) => g.status === "offen");
    expect(offen, "Kalibrierung: beide Fragen haben eine Lücke angelegt").toHaveLength(2);
    const eigeneLuecke = offen.find((g) => g.createdBy === a.admin.id);
    const fremdeLuecke = offen.find((g) => g.createdBy === a.frager.id);
    expect(eigeneLuecke, "Kalibrierung: Lücke der Verwaltung").toBeDefined();
    expect(fremdeLuecke, "Kalibrierung: Lücke der fragenden Person").toBeDefined();

    const res = await a.app.inject({
      method: "GET",
      url: "/api/wissenskennzahlen?tage=7",
      headers: a.admin.headers,
    });
    expect(res.statusCode, res.body).toBe(200);
    const k = res.json() as Wissenskennzahlen;
    expect(k.suche).toMatchObject({ lage: "gemessen", deckel: 20, zuordnung: "bekannt" });
    const zeile = (b: string) => k.suche.eintraege.find((e) => e.begriff === b);
    // Berechtigt: die eigene Lücke derselben Frage ist der vorhandene Vorgang.
    expect(zeile(eigen)).toMatchObject({
      anzahl: 2,
      eingrenzung: {},
      vorgang: {
        schluessel: `luecke:${eigeneLuecke?.id}`,
        arbeitsweg: `/risiko?fall=${eigeneLuecke?.id}`,
      },
    });
    // Negativfall (Ben, Nacharbeit 4): die Lücke der fragenden Person ist für die Verwaltung
    // geschwärzt — der eigene Suchbegriff darf ihren Fragetext nicht über die Zuordnung bestätigen.
    expect(zeile(geschwaerzt)).toMatchObject({ anzahl: 1, vorgang: null });
    // Die Suche einer anderen Person steht nirgends in der Auswertung der Verwaltung.
    expect(res.body).not.toContain("Relais");

    // Mit Space- oder Teamfilter: Suchen tragen keinen Space — „nicht erhoben“, keine Begriffe.
    const lesbar = new Set(["space-a"]);
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: lesbar };
    const mitSpace = depsVon(a.services, { spaces: [space("space-a", "Fiktiv Montage")] });
    const gefiltert = await ladeWissenskennzahlen(
      { ...mitSpace, nulltreffer: a.services.nulltreffer },
      betrachter,
      sichtbarkeitsfilterFuer(betrachter),
      anfrage({ space: "space-a" }),
    );
    expect(gefiltert.suche).toMatchObject({ lage: "nicht_erhoben", deckel: 20, eintraege: [] });

    // Die eigene Liste der fragenden Person: ihr Begriff, nicht der der Verwaltung.
    const fragende = { id: a.frager.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const ihre = await ladeWissenskennzahlen(
      { ...depsVon(a.services), nulltreffer: a.services.nulltreffer },
      fragende,
      sichtbarkeitsfilterFuer(fragende),
      anfrage(),
    );
    expect(ihre.suche.eintraege.map((e) => e.begriff)).toEqual([fremd]);
  });

  it("Ausfall der Suchablage: „unbekannt“, keine erfundene Leere", async () => {
    const a = await setup();
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const k = await ladeWissenskennzahlen(
      {
        ...depsVon(a.services),
        nulltreffer: {
          fuer: async () => {
            throw new Error("Fiktiv: Suchablage nicht erreichbar");
          },
        },
      },
      betrachter,
      sichtbarkeitsfilterFuer(betrachter),
      anfrage(),
    );
    expect(k.suche).toEqual({ lage: "unbekannt", deckel: 20, zuordnung: "bekannt", eintraege: [] });
  });

  it("Ausfall der Lückenquelle: Suchen bleiben, die Zuordnung ist „unbekannt“ — kein Nichttreffer", async () => {
    const a = await setup();
    const begriff = "Fiktiv Anzugswert Mutter M-77";
    await a.app.inject({
      method: "GET",
      url: `/api/library/search?q=${encodeURIComponent(begriff)}`,
      headers: a.admin.headers,
    });
    // Gegenstück mit gelieferter Quelle: dieselbe Suche ohne passende Lücke ist ein belegter
    // Nichttreffer (zuordnung „bekannt“, vorgang null).
    const betrachter = { id: a.admin.id, role: "admin" as const, spaceLesbar: new Set<string>() };
    const filter = sichtbarkeitsfilterFuer(betrachter);
    const mitQuelle = await ladeWissenskennzahlen(
      { ...depsVon(a.services), nulltreffer: a.services.nulltreffer },
      betrachter,
      filter,
      anfrage(),
    );
    expect(mitQuelle.suche).toMatchObject({ lage: "gemessen", zuordnung: "bekannt" });
    expect(mitQuelle.suche.eintraege).toEqual([
      expect.objectContaining({ begriff, anzahl: 1, vorgang: null }),
    ]);

    const ohneQuelle = await ladeWissenskennzahlen(
      {
        ...depsVon(a.services),
        ask: {
          listGaps: async () => {
            throw new Error("Fiktiv: Lückenablage nicht erreichbar");
          },
        },
        nulltreffer: a.services.nulltreffer,
      },
      betrachter,
      filter,
      anfrage(),
    );
    expect(ohneQuelle.quellen.luecken).toBe("fehler");
    // Häufigkeit und letzter Zeitpunkt bleiben; nur die Zuordnung ist unbekannt.
    expect(ohneQuelle.suche).toMatchObject({ lage: "gemessen", zuordnung: "unbekannt" });
    expect(ohneQuelle.suche.eintraege).toEqual([
      expect.objectContaining({
        begriff,
        anzahl: 1,
        zuletzt: mitQuelle.suche.eintraege[0]?.zuletzt,
        vorgang: null,
      }),
    ]);
  });
});

describe("ADMIN-11 · W5 · Rechte an Tür, Zahl und Detail", () => {
  it("nur die Verwaltung; ein Objekt in fremdem Space fehlt in Zahl und Liste; 400 für fremden Filter", async () => {
    const a = await setup();
    for (const wer of [a.controller, a.autorin, a.frager]) {
      const res = await a.app.inject({
        method: "GET",
        url: "/api/wissenskennzahlen",
        headers: wer.headers,
      });
      expect(res.statusCode).toBe(403);
    }
    const anonym = await a.app.inject({ method: "GET", url: "/api/wissenskennzahlen" });
    expect(anonym.statusCode).toBe(401);

    const offen = await anlegen(a.app, a.autorin, TITEL_A);
    const gesperrt = await anlegen(a.app, a.autorin, TITEL_GESPERRT);
    const lies = async (): Promise<Wissenskennzahlen> => {
      const res = await a.app.inject({
        method: "GET",
        url: "/api/wissenskennzahlen?tage=30",
        headers: a.admin.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as Wissenskennzahlen;
    };
    const vorher = await lies();
    const vorherZahl = zahl(vorher, "pruefung").wert ?? 0;
    expect(JSON.stringify(vorher)).toContain(TITEL_GESPERRT);

    // Das Objekt wandert in einen Space, den die Verwaltung nicht lesen darf (kein Durchgriff).
    await a.services.ko.setLeadingSpace(gesperrt, "space-fiktiv-geschlossen", a.admin.id, null);
    const nachher = await lies();
    const p = zahl(nachher, "pruefung");
    expect(p.wert).toBe(vorherZahl - 1);
    expect(p.eintraege?.map((e) => e.schluessel)).toContain(`pruefung:${offen}`);
    expect(p.eintraege?.map((e) => e.schluessel)).not.toContain(`pruefung:${gesperrt}`);
    expect(JSON.stringify(nachher)).not.toContain(TITEL_GESPERRT);
    // Der fremde Space ist nicht wählbar — und die Antwort verrät nicht, ob es ihn gibt.
    const fremd = await a.app.inject({
      method: "GET",
      url: "/api/wissenskennzahlen?space=space-fiktiv-geschlossen",
      headers: a.admin.headers,
    });
    const unbekannt = await a.app.inject({
      method: "GET",
      url: "/api/wissenskennzahlen?space=space-gibt-es-nicht",
      headers: a.admin.headers,
    });
    expect(fremd.statusCode).toBe(400);
    expect(unbekannt.statusCode).toBe(400);
    expect(fremd.json()).toEqual(unbekannt.json());
    expect(nachher.filterwerte.spaces.map((s) => s.id)).not.toContain("space-fiktiv-geschlossen");
  });

  it("die Antwort trägt keine Wirkungs- oder Ersparnisgröße", async () => {
    const a = await setup();
    const res = await a.app.inject({
      method: "GET",
      url: "/api/wissenskennzahlen",
      headers: a.admin.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toMatch(/ersparnis|gespart|saving|stunden|euro|roi/i);
  });
});
