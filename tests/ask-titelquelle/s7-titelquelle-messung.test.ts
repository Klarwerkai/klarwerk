// ================================================================================================
// JOB 3425 · S7 — DIE TITELQUELLE ÜBERLEBT DIE MENGE. MESSUNG UND ZUSAGE.
// ================================================================================================
//
// Diese Datei stellt Reihe 2 E des Codex-Befunds
// `gespraech/abnahme/befunde/R-1548-20260905T192334143854.json` über den ECHTEN Ask-Weg nach —
// echte `KoService`-Kandidatensuche (mit `deckelauswahl: "trefferguete"`), echte Suchprojektion,
// echter `AskService.ask` bis `result.sources`.
//
// AUFBAU (Reihe 2 E, wörtlich): EINE Zielquelle, die die Frage im TITEL und in der AUSSAGE
// beantwortet, mit Trust 83; dazu 60 Objekte, die ALLE Fragewörter tragen — aber ausschliesslich im
// Fließtext —, mit Trust 100. Alle 61 sind validiert.
//
// ------------------------------------------------------------------------------------------------
// WARUM TRUST 83 GEGEN 100 UND NICHT ÜBERALL DERSELBE WERT (BEN, Runde 1, Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
// Runde 1 hat Reihe 2 B nachgestellt: alle 61 Objekte mit gleichem Status und gleichem Trust. Dann
// messen alle denselben `rankScore`, und WELCHES Objekt aus `slice(0, 8)` fällt, entscheidet die
// stabile Sortierung nach der Eingangsreihenfolge. Die kommt aus `validiert ↓, trust ↓, koId`
// (search-projection-repo.ts:794) und damit — bei gleichem Status und gleichem Trust — aus der
// `randomUUID` der Erstanlage (`service.ts:575`). BEN hat das nachgewiesen: in Wiederholung 14
// stand die Zielquelle auf Eingangsplatz 2 und der Fall wurde rot, obwohl der Code stimmte; mit
// aufsteigend vergebenen Kennungen bestanden die Zusagetests sogar OHNE die Reparatur.
//
// Reihe 2 E braucht diesen Zufall nicht. `trust ↓` steht in der Ausgabeordnung VOR `koId`, also
// legt der Trust die Eingangsreihenfolge fest: die 60 Körperquellen (100) zuerst, die Zielquelle
// (83) zuletzt. Die Kennungen entscheiden nichts mehr. Der Befund führt diese Reihe ausdrücklich —
// „wie B, Ziel-Trust auf 83 gesenkt", ebenfalls ohne Antwort —, es ist also keine erfundene Lage.
//
// ------------------------------------------------------------------------------------------------
// DIE MESSUNG, DIE DER BEFUND OFFEN GELASSEN HAT (Auftrag §3, Schritt 1). Gemessen auf dem Stand
// VOR der Reparatur, ausgegeben von genau den Fällen M1 und M2 unten (Arbeitsprüfkennung und
// Cloud-Lauf stehen in RUECKGABE.md, Abschnitt REMOTE-LÄUFE):
//
//   Der 50er-Deckel ist NICHT die Verluststelle. Die Zielquelle steht in der Vorauswahl JEDES
//   Fragebegriffs — die Güteleiter (`titel: 4`/`aussage: 3` gegen `koerper: 0`) trägt sie durch den
//   Deckel, genau wie JOB 3053 es zugesagt hat, und zwar OBWOHL sie den niedrigsten Trust im
//   Bestand hat. Der Deckel wirft 11 der 61 Objekte weg, nie das Ziel.
//
//   Der Verlust liegt IM RANKING, hinter dem Gate und vor dem Modell:
//
//     Zielquelle (Titel + Aussage)   keywordScore 4 · kerntreffer 4 · Boost 0.832 · rankScore 4.832
//     Vergleich 1 (nur Körper)       keywordScore 4 · kerntreffer 0 · Boost 0.9   · rankScore 4.9
//     Vergleich 2 (nur Körper)       keywordScore 4 · kerntreffer 0 · Boost 0.9   · rankScore 4.9
//
//   Alle 61 Quellen messen DENSELBEN `keywordScore` — seit G27 verschmilzt `refMatchText` Titel,
//   Aussage, Fußnoten und Körper zu EINEM Text, ein Titeltreffer ist im Ranking also nichts mehr
//   wert. Damit entschied allein der Status-/Trust-Bonus, und der spricht hier gegen das Ziel: es
//   stand auf Eingangsplatz 49 von 50 und auf Rangplatz 49 von 50, also weit hinter
//   `slice(0, DEFAULT_TOP_K)`. Der Ask-Weg antwortete danach aus einer Körperquelle, ohne das Ziel
//   (`sources` hatte genau einen Eintrag, und der war nicht das Ziel).
//
//   Die Vorauswahl liefert 50 der 61 Objekte; 11 Körperquellen fallen im Deckel weg. Rangplatz und
//   Eingangsplatz sind vor der Reparatur identisch — der Bonus ordnet die Menge genau so, wie die
//   Datenquelle sie liefert.
//
//   WAS DIE MESSUNG WIDERLEGT: Der 50er-Deckel als Ursache (ausgeschlossen, s. M1) UND die
//   Vermutung, `DEFAULT_TOP_K` sei zu klein. Acht Plätze genügen — es standen die falschen darin.
// ------------------------------------------------------------------------------------------------
//
// Der vorhandene Skalierungsvertrag `tests/ask/ask-retrieval-topk-scaling-contract.test.ts` trifft
// diesen Fall NICHT: seine Störer tragen die Fragewörter gar nicht, also entscheidet dort schon die
// Trefferzahl. Hier tragen alle 61 Objekte dieselben Wörter; nur die FUNDSTELLE unterscheidet sie.
//
// DETERMINISTISCH GEHALTEN: `KLARWERK_SKIP_KEYCHAIN` schaltet die Auflösung des Cloud-Schlüssels
// aus dem Schlüsselbund ab (dieselbe Begründung wie in `tests/ask/g27-klara-volltext.test.ts`) —
// ohne diese Zeile entschiede auf einer Maschine mit hinterlegtem Schlüssel ein ECHTER Modellaufruf
// über das Ergebnis.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  DEFAULT_TOP_K,
  type KnowledgeRef,
  queryTokens,
  rankCandidates,
  statusTrustBoost,
  waehleKandidaten,
} from "../../services/reasoner";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

// Die Frage des Befunds, wörtlich aus dem Auftrag.
const FRAGE = "Womit werden Topasfenster gereinigt und welche Freigabemarke gilt?";
const TERME = queryTokens(FRAGE);
// Reihe 2 E: 61 Quellen insgesamt.
const KOERPERTREFFER = 60;

// Die Ask-Vorauswahl schneidet die Frage auf acht Begriffe und holt je Begriff 50 Kandidaten
// (`ASK_PREFILTER_MAX_TERMS` / `ASK_PREFILTER_TERM_LIMIT`, services/ask/src/service.ts). Beide
// Zahlen stehen hier nur, damit die Nachstellung denselben Weg geht wie der Dienst.
const PREFILTER_TERME = 8;
const PREFILTER_LIMIT = 50;

// Die beiden Werte des Befunds (Reihe 2 E). Sie legen die Eingangsreihenfolge fest — s. Kopf.
const ZIEL_TRUST = 83;
const KOERPER_TRUST = 100;

const ZIELTITEL = "Topasfenster reinigen und Freigabemarke";
const ZIELAUSSAGE = `Topasfenster werden mit Zitrusseife gereinigt; es gilt die Freigabemarke K7. ${TERME.join(" ")}.`;

async function aufbauen() {
  const { buildApp, buildServices } = await import("../../services/app/src/build-app");
  const services = buildServices();
  const app = buildApp(services);
  // Die Suchprojektion wird im `onReady`-Haken freigegeben (build-app.ts:1504); ohne diese Zeile
  // ist `findSearchHits` fail-closed und wirft `SEARCH_PROJECTION_NOT_READY`. Kein Sonderweg —
  // derselbe Haken, den auch jeder HTTP-Aufruf auslöst.
  await app.ready();
  return { app, services };
}

type Dienste = Awaited<ReturnType<typeof aufbauen>>["services"];

// Ein Fließtext, in dem ALLE Fragewörter stehen — und sonst nichts, was zur Frage gehört.
function koerperMitAllenFragewoertern(nr: number): string {
  return (
    `<p>${"Ablaufnotiz ohne eigenen Bezug zur Anfrage. ".repeat(6)}</p>` +
    `<p>Vermerk ${nr}: ${TERME.join(" ")}.</p>`
  );
}

async function bestandReihe2E(): Promise<{ services: Dienste; zielId: string }> {
  const { services } = await aufbauen();
  // Die Zielquelle: die Fragewörter stehen im Titel UND in der Aussage, kein Fließtext nötig.
  const ziel = await services.ko.create({
    title: ZIELTITEL,
    statement: ZIELAUSSAGE,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  });
  // `setValidationState` ist der Schreibweg, den auch die Validierung nimmt (FR-VAL-01/02) — kein
  // Sonderweg am Bestand vorbei. Er setzt Status und Trust, sonst nichts; die Suchprojektion und
  // damit jeder gemessene Text bleiben unberührt.
  await services.ko.setValidationState(ziel.id, { trust: ZIEL_TRUST, status: "validiert" });
  for (let i = 0; i < KOERPERTREFFER; i += 1) {
    const stoerer = await services.ko.create({
      // Titel und Aussage tragen KEIN Fragewort — die Unterscheidung liegt allein in der Fundstelle.
      title: `Sammelvermerk ${i}`,
      statement: `Allgemeine Ablaufnotiz ${i} ohne eigene Auskunft.`,
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: koerperMitAllenFragewoertern(i),
    });
    await services.ko.setValidationState(stoerer.id, {
      trust: KOERPER_TRUST,
      status: "validiert",
    });
  }

  // ============================================================================================
  // DIE VORBEDINGUNG DIESES BESTANDS — GEPRÜFT, NICHT GEHOFFT (BEN, Korrekturpflicht 1).
  // ============================================================================================
  // Sie steht HIER und nicht in einem einzelnen Fall, damit sie für JEDEN gilt, der diesen Bestand
  // benutzt — auch für S7-2, der den Ask-Weg von innen nicht beobachten kann.
  //
  // Zugesagt wird die ungünstige Ausgangslage: die Zielquelle steht in der Trefferliste jedes
  // Fragebegriffs GANZ HINTEN, hinter 49 Körperquellen. Das ist keine Zufallszahl, sondern die
  // Ausgabeordnung `validiert ↓, trust ↓, koId` bei gleichem Status und Trust 83 gegen 100; die
  // Kennungen kommen gar nicht mehr zum Zug. Fällt die Zusage, ist der Fall entwertet und sagt es.
  for (const term of TERME.slice(0, PREFILTER_TERME)) {
    const treffer = await services.ko.findCandidates({ terms: [term], limit: PREFILTER_LIMIT });
    expect(treffer.length, `Term „${term}" ist gedeckelt`).toBe(PREFILTER_LIMIT);
    expect(
      treffer.findIndex((k) => k.id === ziel.id),
      `Term „${term}": die Zielquelle steht zuletzt, hinter ${PREFILTER_LIMIT - 1} Körperquellen`,
    ).toBe(PREFILTER_LIMIT - 1);
  }
  return { services, zielId: ziel.id };
}

// GENAU der Refs-Bau von `AskService.ask` (services/ask/src/service.ts): dieselben acht Begriffe,
// dieselbe Methode, dasselbe Limit, dieselbe Reihung, je Kandidat die Suchprojektion für
// `bodyText`. Kein Nachbau der Auswahlregel — nur der Weg dorthin, damit die Zahlen aus dem
// Ranking selbst gelesen werden können.
async function refsWieAsk(services: Dienste): Promise<KnowledgeRef[]> {
  const gesammelt = new Map<string, { ko: KnowledgeObject; rang: number; treffer: number }>();
  for (const term of TERME.slice(0, PREFILTER_TERME)) {
    const liste = await services.ko.findCandidates({ terms: [term], limit: PREFILTER_LIMIT });
    liste.forEach((kandidat, rang) => {
      const vorhanden = gesammelt.get(kandidat.id);
      if (vorhanden) {
        vorhanden.treffer += 1;
        vorhanden.rang = Math.min(vorhanden.rang, rang);
        return;
      }
      gesammelt.set(kandidat.id, { ko: kandidat, rang, treffer: 1 });
    });
  }
  const geordnet = [...gesammelt.values()].sort((a, b) => b.treffer - a.treffer || a.rang - b.rang);
  return Promise.all(
    geordnet.map(async ({ ko }) => {
      const projektion = await services.ko.searchProjectionOf(ko.id);
      return {
        id: ko.id,
        title: ko.title,
        statement: ko.statement,
        status: ko.status,
        trust: ko.trust,
        ...(ko.captionTexts?.length ? { captionTexts: ko.captionTexts } : {}),
        ...(projektion?.bodyText.trim() ? { bodyText: projektion.bodyText } : {}),
      } satisfies KnowledgeRef;
    }),
  );
}

describe("JOB 3425 · S7 — die Messung: wo geht die Titelquelle verloren?", () => {
  it("M0 · Kalibrierung: der Aufbau ist Reihe 2 E — Ziel in den Kurzfeldern, 60 Störer nur im Körper", async () => {
    expect(TERME.length).toBeGreaterThanOrEqual(3);
    const { services, zielId } = await bestandReihe2E();

    const zielKurz = `${ZIELTITEL} ${ZIELAUSSAGE}`.toLowerCase();
    const refs = await refsWieAsk(services);
    const stoerer = refs.find((r) => r.id !== zielId);
    expect(stoerer, "mindestens eine Körperquelle in der Vorauswahl").toBeDefined();
    const stoererKurz = `${stoerer?.title} ${stoerer?.statement}`.toLowerCase();
    for (const term of TERME) {
      // Alle Fragewörter in Titel/Aussage der Zielquelle …
      expect(zielKurz, `Zielquelle trägt „${term}"`).toContain(term);
      // … und in KEINEM Kurzfeld der Störer, aber in seinem Fließtext.
      expect(stoererKurz, `Störer trägt „${term}" nicht in Titel/Aussage`).not.toContain(term);
      expect(stoerer?.bodyText?.toLowerCase(), `Störer trägt „${term}" im Körper`).toContain(term);
    }
    // Und der Trust ist wirklich verteilt wie zugesagt — sonst ist die Vorbedingung oben zufällig.
    const zielRef = refs.find((r) => r.id === zielId);
    expect(zielRef?.trust, "Ziel-Trust").toBe(ZIEL_TRUST);
    expect(zielRef?.status, "Ziel ist validiert").toBe("validiert");
    expect(stoerer?.trust, "Körper-Trust").toBe(KOERPER_TRUST);
    expect(stoerer?.status, "Körperquelle ist validiert").toBe("validiert");
  });

  it("M1 · der 50er-Deckel ist NICHT die Verluststelle: die Zielquelle steht in jeder Vorauswahl", async () => {
    const { services, zielId } = await bestandReihe2E();
    for (const term of TERME.slice(0, PREFILTER_TERME)) {
      const treffer = await services.ko.findCandidates({ terms: [term], limit: PREFILTER_LIMIT });
      // Der Deckel greift wirklich — sonst sagt dieser Fall nichts über ihn aus.
      expect(treffer.length, `Term „${term}" ist gedeckelt`).toBe(PREFILTER_LIMIT);
      // Und er trägt die Zielquelle durch, obwohl sie den NIEDRIGSTEN Trust im Bestand hat: der
      // Deckel wählt nach Treffergüte, nicht nach Verlässlichkeit (JOB 3048/3053).
      expect(
        treffer.map((k) => k.id),
        `Term „${term}" trägt die Zielquelle durch den Deckel`,
      ).toContain(zielId);
    }
    const refs = await refsWieAsk(services);
    expect(refs.map((r) => r.id)).toContain(zielId);
    console.info(
      `[JOB 3425 · M1] Bestand ${KOERPERTREFFER + 1} · Deckel ${PREFILTER_LIMIT} · Kandidaten nach Vorauswahl ${refs.length} · Ziel enthalten: ja`,
    );
  });

  it("M2 · die Zahlen: Ziel und zwei Körperquellen messen denselben keywordScore — die Fundstelle unterscheidet sie", async () => {
    const { services, zielId } = await bestandReihe2E();
    const refs = await refsWieAsk(services);
    // Ohne Deckel gerankt: so sind ALLE Kandidaten mit ihren Zahlen sichtbar.
    const gerankt = rankCandidates(FRAGE, refs, refs.length, []);
    const zeile = (id: string) => {
      const eintrag = gerankt.find((k) => k.ref.id === id);
      expect(eintrag, `Kandidat ${id} steht im Ranking`).toBeDefined();
      return {
        id,
        eingangsplatz: refs.findIndex((r) => r.id === id),
        rangplatz: gerankt.findIndex((k) => k.ref.id === id),
        keywordScore: eintrag?.keywordScore,
        kerntreffer: eintrag?.kerntreffer,
        statusTrustBoost: eintrag ? statusTrustBoost(eintrag.ref) : undefined,
        rankScore: eintrag?.rankScore,
      };
    };
    const vergleichsIds = refs
      .filter((r) => r.id !== zielId)
      .slice(0, 2)
      .map((r) => r.id);
    expect(vergleichsIds).toHaveLength(2);
    const ziel = zeile(zielId);
    const vergleiche = vergleichsIds.map(zeile);
    console.info(
      `[JOB 3425 · M2] ${JSON.stringify({ kandidaten: refs.length, ziel, vergleiche }, null, 1)}`,
    );

    // DAS IST DIE MESSUNG (Auftrag §3, Schritt 1) — sie gilt VOR wie NACH der Reparatur:
    // dieselbe Wortüberschneidung für alle, obwohl nur EINE Quelle die Frage in den Kurzfeldern
    // beantwortet. Das ist der Befund: der Titeltreffer ist im Ranking nichts wert.
    for (const v of vergleiche) {
      expect(v.keywordScore, "gleiche Wortüberschneidung wie das Ziel").toBe(ziel.keywordScore);
      // … und genau EIN Unterschied im Text: die Körperquelle trifft die Frage in keinem Kurzfeld.
      expect(v.kerntreffer, "Körperquelle: kein Treffer ausserhalb des Fließtexts").toBe(0);
      // Der Status-/Trust-Bonus spricht GEGEN das Ziel (Reihe 2 E: 83 gegen 100). Vor der
      // Reparatur war er der einzige Unterschied, der die Rangfolge erreichte — deshalb stand das
      // Ziel hinten, und zwar nicht zufällig, sondern rechnerisch.
      expect(v.statusTrustBoost, "Körperquelle: höherer Bonus").toBe(
        statusTrustBoost({ status: "validiert", trust: KOERPER_TRUST }),
      );
      expect(v.rankScore, "Körperquelle: höherer rankScore").toBeGreaterThan(ziel.rankScore ?? 0);
    }
    expect(ziel.statusTrustBoost, "Ziel: der niedrigere Bonus").toBe(
      statusTrustBoost({ status: "validiert", trust: ZIEL_TRUST }),
    );
    expect(ziel.kerntreffer, "Zielquelle: jedes gezählte Wort steht im Kurzfeld").toBe(
      ziel.keywordScore,
    );
    // Und die Eingangsreihenfolge stellt die Zielquelle GANZ NACH HINTEN — das ist die ungünstige
    // Lage, die dieser Test herstellt, und sie ist deterministisch (Vorbedingung in
    // `bestandReihe2E`), nicht ausgewürfelt.
    expect(refs.length, "die Vorauswahl liefert genau den Deckel").toBe(PREFILTER_LIMIT);
    expect(ziel.eingangsplatz, "Ziel steht zuletzt in der Eingangsreihenfolge").toBe(
      refs.length - 1,
    );
    expect(ziel.eingangsplatz).toBeGreaterThanOrEqual(DEFAULT_TOP_K);
  });
});

describe("JOB 3425 · S7 — die Zusage: die passende Titelquelle bleibt in der Antwort", () => {
  it("S7-1 · die Zielquelle steht unter den acht Kandidaten, die der Fragedienst wählt", async () => {
    const { services, zielId } = await bestandReihe2E();
    const refs = await refsWieAsk(services);
    // Die Ausgangslage ist die schlechtestmögliche: letzter Eingangsplatz, niedrigster Bonus.
    expect(refs.findIndex((r) => r.id === zielId)).toBe(refs.length - 1);
    const gewaehlt = waehleKandidaten(FRAGE, refs, DEFAULT_TOP_K, []);
    expect(gewaehlt.length).toBeLessThanOrEqual(DEFAULT_TOP_K);
    expect(gewaehlt.map((r) => r.id)).toContain(zielId);
    // Sie steht nicht irgendwo drin, sondern vorn: sie ist die einzige, die die Frage in den
    // Kurzfeldern beantwortet.
    expect(gewaehlt[0]?.id).toBe(zielId);
  });

  it("S7-2 · Reihe 2 E über den ganzen Ask-Weg: die Antwort kommt mit der Titelquelle", async () => {
    const { services, zielId } = await bestandReihe2E();
    const { result } = await services.ask.ask(FRAGE);
    expect(result.sources).toContain(zielId);
    expect(result.answered).toBe(true);
  });

  it("S7-3 · Reihe 2 F: allein steht dieselbe Zielquelle in der Antwort (unverändert)", async () => {
    const { services } = await aufbauen();
    const ziel = await services.ko.create({
      title: ZIELTITEL,
      statement: ZIELAUSSAGE,
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    await services.ko.setValidationState(ziel.id, { trust: ZIEL_TRUST, status: "validiert" });
    const { result } = await services.ask.ask(FRAGE);
    expect(result.sources).toEqual([ziel.id]);
    expect(result.answered).toBe(true);
  });
});

// ================================================================================================
// DIE GEGENPROBE (Auftrag §3, verpflichtend): wir tauschen keinen Fehler gegen den umgekehrten.
// ================================================================================================
describe("JOB 3425 · S7 — eine Antwort, die im Körper steht, wird weiterhin gefunden", () => {
  const KOERPERFRAGE = "Welches Nachspannmoment gilt für die Flanschschrauben der Presse?";
  const KOERPERTERME = queryTokens(KOERPERFRAGE);

  it("G1 · der Nur-Fließtext-Treffer bleibt Antwortgrundlage, auch neben einem Titel-Teiltreffer", async () => {
    const { services } = await aufbauen();
    // Die einzige Quelle, die die Frage WIRKLICH beantwortet — und zwar im Fließtext. Sie bekommt
    // ausdrücklich den NIEDRIGEREN Trust, damit die Gegenprobe nicht über den Bonus gewinnt.
    const koerperquelle = await services.ko.create({
      title: "Montageblatt der Presse",
      statement: "Kurzfassung ohne die Zahlenangabe.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: `<p>${"Allgemeine Vorbemerkung zum Blatt. ".repeat(20)}</p><p>${KOERPERTERME.join(" ")}: 42 Nm.</p>`,
    });
    await services.ko.setValidationState(koerperquelle.id, {
      trust: ZIEL_TRUST,
      status: "validiert",
    });
    // Nachbarn, die die Frage NUR TEILWEISE in den Kurzfeldern tragen — mit dem HÖHEREN Trust.
    // Stünde die Fundstelle vor der Wortüberschneidung, schöben sie sich vor die richtige Quelle.
    for (let i = 0; i < 20; i += 1) {
      const nachbar = await services.ko.create({
        title: `Presse ${i}: Flanschschrauben`,
        statement: `Die Flanschschrauben der Presse ${i} werden jährlich gesichtet.`,
        type: "best_practice",
        category: "Wartung",
        author: "anna",
      });
      await services.ko.setValidationState(nachbar.id, {
        trust: KOERPER_TRUST,
        status: "validiert",
      });
    }

    const { result } = await services.ask.ask(KOERPERFRAGE);
    expect(result.answered).toBe(true);
    expect(result.sources).toContain(koerperquelle.id);
  });

  it("G2 · Rangfolge: mehr Wortüberschneidung im Körper schlägt weniger im Titel", () => {
    const koerper: KnowledgeRef = {
      id: "koerper",
      title: "Montageblatt",
      statement: "Kurzfassung.",
      status: "offen",
      trust: 0,
      bodyText: `${KOERPERTERME.join(" ")} betraegt 42 Nm.`,
    };
    // Alle Fragewörter BIS AUF EINES, dafür im Titel und mit dem höchsten Status-/Trust-Bonus,
    // den es gibt. Er müsste gewinnen, wenn die Fundstelle vor der Wortüberschneidung stünde.
    const titel: KnowledgeRef = {
      id: "titel",
      title: KOERPERTERME.slice(0, -1).join(" "),
      statement: "Eine Teilangabe ohne die gesuchte Zahl.",
      status: "validiert",
      trust: 100,
    };
    expect(KOERPERTERME.length, "die Frage trägt genug Inhaltswörter").toBeGreaterThanOrEqual(3);

    const gerankt = rankCandidates(KOERPERFRAGE, [titel, koerper], DEFAULT_TOP_K, []);
    // Beide sind im Rennen — sonst prüft die Gegenprobe nichts.
    expect(gerankt.map((k) => k.ref.id).sort()).toEqual(["koerper", "titel"]);
    // Der Körpertreffer deckt MEHR Fragewörter ab: Zeile eins der Sortierung entscheidet, die
    // Fundstelle wird gar nicht erst gelesen — obwohl sie und der Bonus für den anderen sprächen.
    expect(gerankt[0]?.ref.id).toBe("koerper");
    expect(gerankt[0]?.keywordScore).toBeGreaterThan(gerankt[1]?.keywordScore ?? 0);
    expect(gerankt[0]?.kerntreffer).toBe(0);
    expect(gerankt[1]?.kerntreffer).toBeGreaterThan(0);
  });
});
