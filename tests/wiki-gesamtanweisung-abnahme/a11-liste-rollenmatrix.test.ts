// ================================================================================================
// JOB 4357 · A11 — DIE ELFTE TÜR AM DRAHT: ROLLENMATRIX UND SICHTBARKEIT DER BESTANDSLISTE.
// ================================================================================================
//
// DIE FRAGE DIESES FALLS ist nicht „kann man die Route registrieren?" (A1 hat das für die zehn
// älteren Türen beantwortet) und nicht „steht sie in der Tabelle?" (A2). Sie lautet:
//
//     Gibt `GET /api/gesamtanweisungen` jedem Leseberechtigten den Kopf JEDER gespeicherten
//     Anweisung — und je Eintrag GENAU DIE ZAHLEN, die `GET /api/gesamtanweisungen/:id` demselben
//     Betrachter nennt?
//
// DESHALB LÄUFT ER AUF DER BÜHNE DER ROLLENABNAHME (`tests/beta-rollenabnahme/buehne.ts`) und baut
// sich keine eigene App: dieselbe `buildApp`-Wurzel, die der Server fährt, dieselben vier
// Prüfkonten, dieselbe Anmeldung am Draht. Eine zweite Art, die App zu bauen, wäre eine zweite
// Wahrheit darüber, wie das Produkt aussieht — und ausgerechnet dieser Auftrag behauptet „in der App
// erreichbar" (dieselbe Begründung wie `a1-tuer-in-der-gebauten-app.test.ts:11-14`).
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST UND WAS NICHT
// ------------------------------------------------------------------------------------------------
// ECHT: die vollständige App, das echte Rechtetor, echte Sitzungstoken, der echte Wissensbestand
// (zwei über `POST /api/kos` angelegte Einträge samt ihren wirklich vorhandenen Fassungen — die
// Fassungsnummern werden NACHGESEHEN, nicht geraten), der echte Anweisungsdienst und die echte
// `darfSehen`-Entscheidung aus `services/app/src/sichtbarkeit.ts`.
//
// NICHT ECHT: die Haltbarkeit. Die Bühne läuft über `inMemoryRepos()`, also über den flüchtigen
// Rückfall der Kompositionswurzel. Dass der Bestand einen NEUSTART übersteht, belegt dieser Fall
// ausdrücklich NICHT — das tut die Strecke in `tests/gesamtanweisung-nutzerweg/**` gegen echtes
// PostgreSQL und einen echten Prozesswechsel. Und ob ein MENSCH die Liste SIEHT, belegt er auch
// nicht: hier wird der Draht gemessen, nicht der Bildschirm.
//
// ------------------------------------------------------------------------------------------------
// DIE GEGENPROBE ZUR ZÄHLUNG — UND WARUM SIE IN `lesestand` ANSETZT
// ------------------------------------------------------------------------------------------------
// Der Auftrag verlangt: „Gegenprobe: Zählung ohne darfSehen → rot". Die Zählung wohnt NICHT in
// diesem Endpunkt, sondern in `lesestand` (`gesamtanweisung-service.ts`), aus dem
// `listeneintrag` sie ableitet. Entfernt man dort den Filter (`if (!lage || !darf(lage))`), zählen
// verborgene Bausteine als sichtbar — und die Fälle unten werden namentlich rot (gefahren, siehe
// RUECKGABE). Genau das ist die Absicht der Bauart: es gibt nur EINE Zählung, also kann die Liste
// nicht heimlich milder sein als der Einzelabruf.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  kopfFuer,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

/** Der offene Eintrag — `intern`, für jede Rolle mit `ko.read` sichtbar. */
const KO_OFFEN = "Ventil oeffnen (JOB 4357)";
/** Der geschützte Eintrag — `vertraulich`, angelegt vom ADMIN. */
const KO_GESCHUETZT = "Schluesseluebergabe (JOB 4357)";

const TITEL_GEMISCHT = "Anlage anfahren · gemischt (JOB 4357)";
const TITEL_NUR_GESCHUETZT = "Anlage anfahren · ganz geschuetzt (JOB 4357)";
const TITEL_OHNE_BAUSTEINE = "Anlage anfahren · ohne Bausteine (JOB 4357)";

/** Was ein Listeneintrag am Draht trägt — genau die Felder, die der Auftrag verlangt. */
interface Listeneintrag {
  id: string;
  titel: string;
  stand: string;
  version: number;
  urheber: string;
  erstelltAm: string;
  geaendertAm: string;
  sichtbareBausteine: number;
  verborgeneBausteine: number;
  unvollstaendig: boolean;
}

let buehne: FrischeBuehne;
/** Die Kennungen der drei angelegten Anweisungen — gesetzt im Aufbau, gelesen in jedem Fall. */
const anweisung: Record<"gemischt" | "nurGeschuetzt" | "ohneBausteine", string> = {
  gemischt: "",
  nurGeschuetzt: "",
  ohneBausteine: "",
};
/** Die Kennung des geschützten Eintrags — sie darf in KEINER Listenantwort auftauchen. */
let geschuetzteKoId = "";

async function ruf(
  methode: "GET" | "POST",
  url: string,
  rolle: Rolle,
  payload?: Record<string, unknown>,
) {
  return buehne.app.inject({
    method: methode,
    url,
    headers: kopfFuer(buehne, rolle),
    ...(payload === undefined ? {} : { payload }),
  });
}

/** Ein Wissenseintrag samt seiner WIRKLICH belegten Fassungsnummer — nachgesehen, nicht geraten. */
async function wissenseintrag(
  titel: string,
  stufe: "intern" | "vertraulich",
  rolle: Rolle,
): Promise<{ koId: string; fassung: number }> {
  const angelegt = await ruf("POST", "/api/kos", rolle, {
    confidentiality: stufe,
    title: titel,
    statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
    type: "best_practice",
    category: "Wartung",
  });
  expect(angelegt.statusCode, `POST /api/kos (${titel}): ${angelegt.body}`).toBe(201);
  const koId = (angelegt.json() as { id: string }).id;
  const fassungen = await ruf("GET", `/api/kos/${koId}/versions`, rolle);
  expect(fassungen.statusCode, `GET /api/kos/${koId}/versions: ${fassungen.body}`).toBe(200);
  const saetze = (fassungen.json() as { version: number }[]) ?? [];
  expect(
    saetze.length,
    `der Eintrag „${titel}" hat keine belegte Fassung — dann ist er nicht bindbar`,
  ).toBeGreaterThan(0);
  return { koId, fassung: Math.max(...saetze.map((s) => s.version)) };
}

/** Eine Anweisung mit genau diesen gebundenen Fassungen. Angelegt vom ADMIN, der alles sehen darf. */
async function anweisungMit(
  titel: string,
  bausteine: readonly { koId: string; fassung: number }[],
): Promise<string> {
  const angelegt = await ruf("POST", "/api/gesamtanweisungen", "admin", { titel });
  expect(angelegt.statusCode, `POST /api/gesamtanweisungen (${titel}): ${angelegt.body}`).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  let version = (angelegt.json() as { version: number }).version;
  for (const baustein of bausteine) {
    const antwort = await ruf("POST", `/api/gesamtanweisungen/${id}/bausteine`, "admin", {
      version,
      koId: baustein.koId,
      koVersion: baustein.fassung,
      nachweisHash: null,
    });
    expect(
      antwort.statusCode,
      `POST bausteine (${titel}, ${baustein.koId}@${baustein.fassung}): ${antwort.body}`,
    ).toBe(200);
    version = (antwort.json() as { version: number }).version;
  }
  return id;
}

/** Die Liste, wie DIESE Rolle sie am Draht bekommt — mit ausgeschriebener Prüfung der Antwortform. */
async function liste(rolle: Rolle): Promise<Listeneintrag[]> {
  const antwort = await ruf("GET", "/api/gesamtanweisungen", rolle);
  expect(antwort.statusCode, `GET /api/gesamtanweisungen als ${rolle}: ${antwort.body}`).toBe(200);
  const rumpf = antwort.json() as { eintraege?: unknown };
  expect(
    Array.isArray(rumpf.eintraege),
    `die Antwort für ${rolle} trägt kein Feld eintraege: ${antwort.body.slice(0, 300)}`,
  ).toBe(true);
  return rumpf.eintraege as Listeneintrag[];
}

/** Der Eintrag zu DIESER Anweisung — fehlt er, ist das ein benannter Fehler und kein `undefined`. */
function eintragZu(eintraege: readonly Listeneintrag[], id: string, wer: string): Listeneintrag {
  const treffer = eintraege.find((e) => e.id === id);
  expect(
    treffer,
    `${wer} findet die Anweisung ${id} nicht in der Liste (vorhanden: ${eintraege
      .map((e) => `${e.id} „${e.titel}"`)
      .join(" | ")})`,
  ).toBeDefined();
  return treffer as Listeneintrag;
}

beforeAll(async () => {
  buehne = await baueFrischeBuehne();
  // Beide Einträge legt der ADMIN an: damit ist er auch ihr Autor, und die Autor-Ausnahme von
  // `darfSehen` (`sichtbarkeit.ts:74-76`) greift für experte und viewer NICHT.
  const offen = await wissenseintrag(KO_OFFEN, "intern", "admin");
  const geschuetzt = await wissenseintrag(KO_GESCHUETZT, "vertraulich", "admin");
  geschuetzteKoId = geschuetzt.koId;
  anweisung.gemischt = await anweisungMit(TITEL_GEMISCHT, [offen, geschuetzt]);
  anweisung.nurGeschuetzt = await anweisungMit(TITEL_NUR_GESCHUETZT, [geschuetzt]);
  anweisung.ohneBausteine = await anweisungMit(TITEL_OHNE_BAUSTEINE, []);
}, 120_000);

// Ohne dieses Schliessen bleiben die Schalter der Bühne gesetzt, und die nächste Prüfdatei misst
// gegen eine fremde Schalterlage (`buehne.ts`, Kopf).
afterAll(schliesseBuehnen);

describe("A11 · die Bestandsliste der Gesamtanweisungen am Draht", () => {
  // ==============================================================================================
  // DER AUFBAU SELBST IST EINE MESSUNG — ohne ihn sagen alle Fälle darunter nichts.
  // ==============================================================================================
  it("der Prüfstand trägt: drei Anweisungen, zwei Einträge, eine davon geschützt", () => {
    expect(
      [anweisung.gemischt, anweisung.nurGeschuetzt, anweisung.ohneBausteine].every(
        (id) => id.length > 0,
      ),
      "eine der drei Anweisungen ist nicht angelegt — dann misst dieser Fall nichts",
    ).toBe(true);
    expect(
      new Set([anweisung.gemischt, anweisung.nurGeschuetzt, anweisung.ohneBausteine]).size,
    ).toBe(3);
    expect(geschuetzteKoId.length, "der geschützte Eintrag fehlt").toBeGreaterThan(0);
  });

  // ==============================================================================================
  // ROLLENMATRIX (Abnahmekriterium 6) — dieselbe Erwartung wie `NUR_LESEN` in `tabelle.ts`.
  // ==============================================================================================
  it("ohne Anmeldung: 401 — und zwar aus dem Rechtetor", async () => {
    const ohne = await buehne.app.inject({ method: "GET", url: "/api/gesamtanweisungen" });
    expect(ohne.statusCode).toBe(401);
    // Nicht nur der Status: `STATUS_BY_CODE` bildet mehrere Ursachen auf 401 ab. Die Abnahme soll
    // belegen, dass DAS TOR nein gesagt hat (Codex-Lehre aus JOB 3953 R1).
    expect((ohne.json() as { error: string }).error).toBe("UNAUTHENTICATED");
  });

  it("jede angemeldete Rolle bekommt 200 — viewer, experte, controller, admin", async () => {
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      const antwort = await ruf("GET", "/api/gesamtanweisungen", rolle);
      expect(antwort.statusCode, `${rolle}: ${antwort.body.slice(0, 300)}`).toBe(200);
    }
  });

  it("jeder Leseberechtigte sieht den KOPF JEDER gespeicherten Anweisung — auch der eingeschränkte", async () => {
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      const eintraege = await liste(rolle);
      const titel = eintraege.map((e) => e.titel);
      for (const soll of [TITEL_GEMISCHT, TITEL_NUR_GESCHUETZT, TITEL_OHNE_BAUSTEINE]) {
        expect(
          titel,
          `${rolle} sieht „${soll}" nicht — eine für ihn verborgene Anweisung sähe dann aus wie eine, die es nicht gibt`,
        ).toContain(soll);
      }
      // UND DER KOPF IST VOLLSTÄNDIG: Titel, Stand, Urheber, letzte Änderung, dazu die zwei Zahlen.
      for (const eintrag of eintraege) {
        expect(typeof eintrag.titel, `${rolle}: titel`).toBe("string");
        expect(
          ["entwurf", "vorgelegt", "entschieden", "abgelehnt"],
          `${rolle}: stand „${eintrag.stand}" ist kein Stand des Modells`,
        ).toContain(eintrag.stand);
        expect(eintrag.urheber.length, `${rolle}: urheber leer`).toBeGreaterThan(0);
        expect(eintrag.geaendertAm.length, `${rolle}: geaendertAm leer`).toBeGreaterThan(0);
        expect(eintrag.erstelltAm.length, `${rolle}: erstelltAm leer`).toBeGreaterThan(0);
        expect(typeof eintrag.version, `${rolle}: version`).toBe("number");
        expect(typeof eintrag.sichtbareBausteine, `${rolle}: sichtbareBausteine`).toBe("number");
        expect(typeof eintrag.verborgeneBausteine, `${rolle}: verborgeneBausteine`).toBe("number");
        expect(typeof eintrag.unvollstaendig, `${rolle}: unvollstaendig`).toBe("boolean");
      }
    }
  });

  // ==============================================================================================
  // DIE ZÄHLUNG (Abnahmekriterien 3 und 6) — 1/1 für den Eingeschränkten, 2/0 für den anderen.
  // ==============================================================================================
  it("gemischt sichtbar: der eingeschränkte Betrachter zählt 1 sichtbar / 1 verborgen, der uneingeschränkte 2 / 0", async () => {
    for (const rolle of ["viewer", "experte"] as const) {
      const eintrag = eintragZu(await liste(rolle), anweisung.gemischt, rolle);
      expect(eintrag.sichtbareBausteine, `${rolle}: sichtbare Bausteine`).toBe(1);
      expect(eintrag.verborgeneBausteine, `${rolle}: verborgene Bausteine`).toBe(1);
      expect(eintrag.unvollstaendig, `${rolle}: unvollstaendig`).toBe(true);
    }
    for (const rolle of ["controller", "admin"] as const) {
      const eintrag = eintragZu(await liste(rolle), anweisung.gemischt, rolle);
      expect(eintrag.sichtbareBausteine, `${rolle}: sichtbare Bausteine`).toBe(2);
      expect(eintrag.verborgeneBausteine, `${rolle}: verborgene Bausteine`).toBe(0);
      expect(eintrag.unvollstaendig, `${rolle}: unvollstaendig`).toBe(false);
    }
  });

  it("DIESELBEN ZAHLEN WIE `GET /:id` — je Rolle und je Anweisung, nicht nur im Beispiel", async () => {
    // DER KERN VON ABNAHMEKRITERIUM 6. Verglichen wird nicht gegen abgeschriebene Erwartungen,
    // sondern gegen den EINZELABRUF desselben Betrachters: `bausteine.length` gegen
    // `sichtbareBausteine`, `verborgeneBausteine` gegen `verborgeneBausteine`. Liefen die zwei Wege
    // auseinander, hinge die Auskunft davon ab, über welchen man fragt.
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      const eintraege = await liste(rolle);
      for (const id of Object.values(anweisung)) {
        const einzeln = await ruf("GET", `/api/gesamtanweisungen/${id}`, rolle);
        expect(einzeln.statusCode, `GET /:id als ${rolle}: ${einzeln.body.slice(0, 200)}`).toBe(
          200,
        );
        const stand = einzeln.json() as {
          bausteine: unknown[];
          verborgeneBausteine: number;
          unvollstaendig: boolean;
          titel: string;
          urheber: string;
          stand: string;
          version: number;
          geaendertAm: string;
        };
        const eintrag = eintragZu(eintraege, id, rolle);
        expect(
          eintrag.sichtbareBausteine,
          `${rolle}/${id}: die Liste zählt ${eintrag.sichtbareBausteine} sichtbare, der Einzelabruf liefert ${stand.bausteine.length}`,
        ).toBe(stand.bausteine.length);
        expect(
          eintrag.verborgeneBausteine,
          `${rolle}/${id}: die Liste zählt ${eintrag.verborgeneBausteine} verborgene, der Einzelabruf ${stand.verborgeneBausteine}`,
        ).toBe(stand.verborgeneBausteine);
        expect(eintrag.unvollstaendig, `${rolle}/${id}: unvollstaendig weicht ab`).toBe(
          stand.unvollstaendig,
        );
        // UND DER KOPF IST DERSELBE — sonst wäre „genau wie GET /:id ihn liefert" eine Behauptung.
        expect(eintrag.titel, `${rolle}/${id}: titel weicht ab`).toBe(stand.titel);
        expect(eintrag.urheber, `${rolle}/${id}: urheber weicht ab`).toBe(stand.urheber);
        expect(eintrag.stand, `${rolle}/${id}: stand weicht ab`).toBe(stand.stand);
        expect(eintrag.version, `${rolle}/${id}: version weicht ab`).toBe(stand.version);
        expect(eintrag.geaendertAm, `${rolle}/${id}: geaendertAm weicht ab`).toBe(
          stand.geaendertAm,
        );
      }
    }
  });

  it("ganz verborgen steht mit 0 sichtbar / N verborgen in der Liste — nicht als Lücke", async () => {
    const eintrag = eintragZu(await liste("experte"), anweisung.nurGeschuetzt, "experte");
    expect(eintrag.sichtbareBausteine).toBe(0);
    expect(eintrag.verborgeneBausteine).toBe(1);
    expect(eintrag.unvollstaendig).toBe(true);
    // Und sie steht wirklich DA: „für dich ganz verborgen" darf nicht aussehen wie „gibt es nicht".
    expect(eintrag.titel).toBe(TITEL_NUR_GESCHUETZT);
  });

  it("ohne Bausteine steht mit 0 / 0 in der Liste — und NICHT als unvollständig", async () => {
    for (const rolle of ["experte", "admin"] as const) {
      const eintrag = eintragZu(await liste(rolle), anweisung.ohneBausteine, rolle);
      expect(eintrag.sichtbareBausteine, `${rolle}`).toBe(0);
      expect(eintrag.verborgeneBausteine, `${rolle}`).toBe(0);
      // DER UNTERSCHIED, DER ZÄHLT: „0 von 0" ist vollständig, „0 von 1" ist es nicht. Zöge man
      // beides zusammen, hiesse eine leere Anweisung „dir fehlt etwas" — oder eine ganz verborgene
      // „du siehst alles". Beides wäre falsch, und das zweite wäre gefährlich.
      expect(eintrag.unvollstaendig, `${rolle}: eine leere Anweisung gilt als unvollständig`).toBe(
        false,
      );
    }
  });

  // ==============================================================================================
  // WAS NICHT HINAUSGEHT (Abnahmekriterium 3) — gemessen am ROHEN Antwortkörper.
  // ==============================================================================================
  it("kein Baustein-Titel und keine Fassungskennung eines verborgenen Bausteins in der Liste", async () => {
    // GEMESSEN AM ROHEN KÖRPER und nicht an den gelesenen Feldern: ein zusätzliches Feld, das der
    // Typ oben nicht kennt, wäre über die Felder gar nicht zu sehen — und genau so sickert etwas
    // durch. Für den eingeschränkten Betrachter darf weder der Titel des geschützten Eintrags noch
    // seine Kennung im Körper stehen.
    for (const rolle of ["viewer", "experte"] as const) {
      const antwort = await ruf("GET", "/api/gesamtanweisungen", rolle);
      expect(antwort.statusCode).toBe(200);
      expect(
        antwort.body,
        `${rolle}: der Titel des geschützten Eintrags steht im Antwortkörper`,
      ).not.toContain(KO_GESCHUETZT);
      expect(
        antwort.body,
        `${rolle}: die Kennung des geschützten Eintrags steht im Antwortkörper`,
      ).not.toContain(geschuetzteKoId);
    }
    // UND DIE KALIBRIERUNG DAZU: der uneingeschränkte Betrachter bekommt sie ebenfalls NICHT — die
    // Liste trägt grundsätzlich keine Bausteinangaben. Ohne diesen Satz wäre die Prüfung oben auch
    // dann grün, wenn die Liste Bausteine gar nicht ausgäbe, weil es keine gibt.
    const alsAdmin = await ruf("GET", "/api/gesamtanweisungen", "admin");
    expect(alsAdmin.statusCode).toBe(200);
    expect(
      alsAdmin.body,
      "die Liste trägt Bausteinangaben — dann sagt die Prüfung oben nichts über das Trimmen",
    ).not.toContain(KO_GESCHUETZT);
    // Der Einzelabruf des Admins trägt sie SEHR WOHL: erst damit ist belegt, dass die Angabe im
    // Bestand überhaupt existiert und die Liste sie weglässt, statt dass es nichts zu lassen gäbe.
    const einzeln = await ruf("GET", `/api/gesamtanweisungen/${anweisung.gemischt}`, "admin");
    expect(einzeln.statusCode).toBe(200);
    expect(
      einzeln.body,
      "selbst der Einzelabruf des Admins nennt den geschützten Eintrag nicht — dann ist der Prüfstand leer",
    ).toContain(geschuetzteKoId);
  });
});
