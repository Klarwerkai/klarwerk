// ================================================================================================
// JOB 4156 · A7 — DER DESKTOP-JOURNALBETRIEB BESTÄTIGT NICHTS, WAS ER NICHT HALTEN KANN.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT, ist BENs eigene Messung an Runde 2, wörtlich:
//
//     „BEN WIEDERANLAUF: Anlage 201, Lesen vorher 200, erneute Anmeldung 200, Lesen nachher 404"
//
// Der Server hat eine Gesamtanweisung mit 201 BESTÄTIGT und sie beim Wiederanlauf verloren — ohne
// Meldung, ohne Spur. Das ist keine fehlende Funktion, sondern eine falsche Auskunft: der Mensch
// hat gesehen, dass es geklappt hat, und es hatte nicht geklappt.
//
// DIE STELLE, AN DER DAS ENTSTEHT, ist die Kompositionswurzel. `buildDevPersistServices`
// (`services/app/src/dev-persist.ts:309`) baut die Dienste OHNE `opts.anweisungen`, also mit dem
// flüchtigen Rückfall — dasselbe Programm, das Pedis Desktop-App fährt (`server.ts:150`), und dort
// ist Haltbarkeit ausdrücklich zugesagt: das Journal ist genau dafür da.
//
// WAS DIESE DATEI MISST — und was ausdrücklich nicht:
//   · Sie misst, dass der Schreibweg im JOURNALBETRIEB ABLEHNT statt falsch zu bestätigen, und
//     zwar auf BEIDEN Schreibmethoden des Ports (`anlegen` UND `schreiben`) — eine halbe Absage
//     wäre dieselbe Lüge, nur später.
//   · Sie misst, dass der LESEWEG unverändert antwortet. Eine Fehlerwand über einem Bestand, den
//     es wahrheitsgemäss nicht gibt, wäre die nächste falsche Auskunft.
//   · Sie misst die Gegenprobe zur Enge: im reinen Speicherbetrieb (Tests, `buildServices()`)
//     bleibt der Weg unverändert offen. Dort überlebt ohnehin NICHTS einen Neustart — auch kein
//     Konto, auch kein Wissenseintrag —, und eine Absage wäre dort keine Ehrlichkeit, sondern eine
//     Abschaltung des halben Prüfstands (A1 und die Rollenabnahme bauen auf diesem Betrieb auf).
//   · Sie misst NICHT, dass eine Gesamtanweisung den Desktop-Neustart übersteht. Das tut sie
//     heute nicht und kann es nicht: Journalschreiber und Wiedereinspieler kennen ausschliesslich
//     die Schlüssel von `AppRepos` (`MUTATING_METHODS`, `dev-persist.ts:35`), und `dev-persist.ts`
//     liegt ausserhalb der Zielpfade dieses Auftrags. Diese Lücke ist in der RUECKGABE als
//     Bestellung benannt — sie ist ab hier eine SICHTBARE Absage und kein stiller Verlust.
//
// GEGENPROBE (gefahren, siehe RUECKGABE): in `services/app/src/build-app.ts` das Argument der
// `FluechtigeAnweisungsablage` auf `false` festnageln (der Stand vor Runde 3). Dann antwortet die
// Anlage im Journalbetrieb wieder mit 201, und die beiden ersten Fälle dieser Datei werden
// namentlich rot — mit genau BENs Zahlenfolge.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../../apps/web/src/api/client";
import { fehlerSchluessel } from "../../apps/web/src/components/gesamtanweisung/api";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import type {
  Anweisung,
  AnweisungStandAufnahme,
} from "../../services/knowledge-object/src/gesamtanweisung-types";

/** Der Code, unter dem die Absage nach aussen geht. Wörtlich wie in `build-app.ts`. */
const ABSAGE = "ANWEISUNG_ABLAGE_FLUECHTIG";

const ADMIN = { name: "Pedi", email: "pedi@example.com", password: "geheim-123" };

function tmpJournal(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-4156-a7-")), "state.jsonl");
}

/**
 * Anmeldung wie im Betrieb: über die echten Auth-Routen der gebauten App, nicht über den Dienst.
 * Der erste angemeldete Mensch wird Admin und trägt damit `ko.create` — genau die Berechtigung,
 * die `POST /api/gesamtanweisungen` fordert (`gesamtanweisung-routes.ts:275`).
 */
async function angemeldet(app: ReturnType<typeof buildApp>): Promise<string> {
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token;
  expect(typeof token, "die Anmeldung selbst muss gelingen — sonst misst der Fall nichts").toBe(
    "string",
  );
  return token as string;
}

/** Eine formal vollständige Anweisung — nur Form, keine Fachaussage. */
function anweisung(id: string, version: number): Anweisung {
  return {
    id,
    titel: "Anlage anfahren",
    zweck: "",
    geltungsbereich: "Werk 1",
    voraussetzungen: "",
    bausteine: [],
    stand: "entwurf",
    version,
    urheber: "pedi",
    erstelltAm: "2026-09-17T10:00:00.000Z",
    geaendertAm: "2026-09-17T10:00:00.000Z",
  };
}

function aufnahme(id: string, version: number): AnweisungStandAufnahme {
  return {
    anweisungId: id,
    version,
    aufgenommenAm: "2026-09-17T10:00:00.000Z",
    titel: "Anlage anfahren",
    zweck: "",
    geltungsbereich: "Werk 1",
    voraussetzungen: "",
    bausteine: [],
  };
}

describe("A7 · im Desktop-Journalbetrieb gibt es keine still verlorene Gesamtanweisung", () => {
  const vorher = process.env.KLARWERK_DEV_PERSIST;

  // GENAU DER SCHALTER, den `server.ts:73` liest, und genau dieser Vergleich. Der Journalbetrieb
  // ist keine Vermutung dieses Tests: er ist die Lage, die dieser eine Wert herstellt.
  beforeAll(() => {
    process.env.KLARWERK_DEV_PERSIST = "1";
  });

  afterAll(() => {
    if (vorher === undefined) {
      delete process.env.KLARWERK_DEV_PERSIST;
    } else {
      process.env.KLARWERK_DEV_PERSIST = vorher;
    }
  });

  it("BENs Zahlenfolge kommt nicht mehr zustande: die Anlage wird abgelehnt, nicht bestätigt", async () => {
    const datei = tmpJournal();
    const dienste = await buildDevPersistServices(datei);
    const app = buildApp(dienste);
    const token = await angemeldet(app);

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/gesamtanweisungen",
      headers: { authorization: `Bearer ${token}` },
      payload: { titel: "Anlage anfahren", geltungsbereich: "Werk 1" },
    });

    // DAS IST DER KERN: kein 201. Der Server bestätigt nichts, was er beim nächsten Start nicht
    // mehr hätte.
    expect(angelegt.statusCode).not.toBe(201);
    const koerper = angelegt.json() as { error: string; message: string };
    expect(koerper.error).toBe(ABSAGE);
    // Ein Code ohne Satz wäre keine nachvollziehbare Ablehnung, sondern eine Abkürzung.
    expect(koerper.message.length).toBeGreaterThan(0);
    // KEINE ERFUNDENE KENNUNG in der Antwort: sonst hielte die Fläche etwas in der Hand, das es
    // nirgends gibt.
    expect(Object.keys(koerper).sort()).toEqual(["error", "message"]);

    // Und im Journal steht nichts, was eine Anweisung verspräche.
    expect(readFileSync(datei, "utf8")).not.toContain("gesamtanweisung");

    await app.close();
  });

  it("nach dem Wiederanlauf aus derselben Journaldatei fehlt nichts, was bestätigt worden wäre", async () => {
    const datei = tmpJournal();
    const ersterLauf = await buildDevPersistServices(datei);
    const app1 = buildApp(ersterLauf);
    const token1 = await angemeldet(app1);
    const versuch = await app1.inject({
      method: "POST",
      url: "/api/gesamtanweisungen",
      headers: { authorization: `Bearer ${token1}` },
      payload: { titel: "Anlage anfahren", geltungsbereich: "Werk 1" },
    });
    expect((versuch.json() as { error: string }).error).toBe(ABSAGE);
    await app1.close();

    // Der Wiederanlauf: frische Komposition, dieselbe Journaldatei — wie ein zweiter Programmstart.
    const zweiterLauf = await buildDevPersistServices(datei);
    const app2 = buildApp(zweiterLauf);
    // Das Konto ist da (das Journal trägt es) — der Wiederanlauf ist also echt und nicht leer.
    const login = await app2.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ADMIN.email, password: ADMIN.password },
    });
    expect(login.statusCode).toBe(200);
    const token2 = (login.json() as { token: string }).token;

    // DER LESEWEG ANTWORTET UNVERÄNDERT — 404 für eine Anweisung, die es nie gab. Kein Serverfehler,
    // keine Fehlerwand: genau die Auskunft, die dem Bestand entspricht.
    const gelesen = await app2.inject({
      method: "GET",
      url: "/api/gesamtanweisungen/gibt-es-nicht",
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(gelesen.statusCode).toBe(404);
    expect((gelesen.json() as { error: string }).error).toBe("NOT_FOUND");
    await app2.close();
  });

  it("die Absage gilt für BEIDE Schreibmethoden des Ports — eine halbe Absage wäre dieselbe Lüge", async () => {
    const dienste = await buildDevPersistServices(tmpJournal());

    await expect(
      dienste.anweisungen.anlegen(anweisung("ga-1", 1), aufnahme("ga-1", 1)),
    ).rejects.toMatchObject({ code: ABSAGE });
    await expect(
      dienste.anweisungen.schreiben(anweisung("ga-1", 2), 1, aufnahme("ga-1", 2)),
    ).rejects.toMatchObject({ code: ABSAGE });

    // Lesen bleibt Lesen: leer ist eine Antwort, kein Fehler.
    await expect(dienste.anweisungen.get("ga-1")).resolves.toBeUndefined();
    await expect(dienste.anweisungen.standLesen("ga-1", 1)).resolves.toBeUndefined();
    await expect(dienste.anweisungen.staende("ga-1")).resolves.toEqual([]);
  });

  it("die Fläche macht daraus einen eigenen Satz in de/en/nl — nicht 'Fehleingabe', nicht 'offline'", () => {
    // Der Draht, wie er wirklich ankommt: Status 400 (die Statustabelle in `http.ts` lässt
    // unbekannte Codes dorthin fallen), Code eigen. Genau diese Kombination muss die Fläche
    // auseinanderhalten — `VALIDATION` und `INVALID` kommen mit demselben Status.
    const schluessel = fehlerSchluessel(
      new ApiError(400, ABSAGE, "Diese Instanz kann Gesamtanweisungen nicht dauerhaft ablegen."),
    );
    expect(schluessel).toBe("ga.ablageFluechtig");
    // Gegenstück: eine echte Fehleingabe bleibt eine Fehleingabe.
    expect(fehlerSchluessel(new ApiError(400, "VALIDATION", "unbrauchbar"))).toBe("ga.fehler");

    for (const sprache of ["de", "en", "nl"] as const) {
      const satz = String(i18n.getResource(sprache, "translation", schluessel) ?? "");
      expect(satz.length, `Sprache ${sprache}: kein Satz hinterlegt`).toBeGreaterThan(20);
      // Anwendersprache: keine internen Begriffe aus Betrieb und Bau (TEST-A18, HINWEIS.md).
      for (const intern of ["Journal", "journal", "Repo", "repo", "In-Memory", "in-memory"]) {
        expect(
          satz,
          `Sprache ${sprache}: interner Begriff „${intern}" im Nutzertext`,
        ).not.toContain(intern);
      }
    }
  });

  it("GEGENPROBE zur Enge: ohne den Journalschalter bleibt der Weg unverändert offen", async () => {
    // Derselbe Prozess, nur die Betriebslage anders — der Schalter ist die EINZIGE Stellschraube.
    delete process.env.KLARWERK_DEV_PERSIST;
    try {
      const app = buildApp(buildServices());
      const token = await angemeldet(app);
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/gesamtanweisungen",
        headers: { authorization: `Bearer ${token}` },
        payload: { titel: "Anlage anfahren", geltungsbereich: "Werk 1" },
      });
      expect(angelegt.statusCode).toBe(201);
      expect((angelegt.json() as { id: string }).id.length).toBeGreaterThan(0);
      await app.close();
    } finally {
      process.env.KLARWERK_DEV_PERSIST = "1";
    }
  });
});
