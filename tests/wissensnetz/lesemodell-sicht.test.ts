// ================================================================================================
// JOB 1496 · D1 (M-2, Schritt 2) — DAS GRAPH-LESEMODELL, AN SEINER ZUSAGE FESTGENAGELT.
// ================================================================================================
//
// Die Abnahmefrage des Meilensteins lautet: Kann Pedi eine Seite oeffnen, die zeigt, welche Themen
// es gibt, wer dazu beigetragen hat und wo die Luecken sind? Diese Datei prueft das Stueck
// darunter — und zwar an drei Stellen, an denen ein Lesemodell ueblicherweise falsch wird:
//
//  1. SICHTBARKEIT VOR AGGREGATION. Ein Thema, das nur vertrauliche Objekte enthaelt, darf gar
//     nicht erscheinen. Sein blosser Name waere die Auskunft, dass es dazu etwas gibt. Geprueft
//     wird an der SERIALISIERTEN Antwort, nicht an der Absicht — dasselbe Vorgehen wie in
//     tests/ko/kanten-lesekette-sichtbarkeit.test.ts:99-102.
//  2. KALIBRIERUNG. Fuer die erweiterte Sichtbarkeit ist dasselbe Thema da. Ohne diesen Gegenfall
//     waere jeder Negativtest auch mit einem Lesemodell gruen, das schlicht nie etwas liefert.
//  3. DER PORT IST KEINE ERFINDUNG. Der letzte Block weist den ECHTEN KantenLeseService und den
//     ECHTEN KoService den Ports zu und laesst die Abfrage darueber laufen. Das ist der Beweis zu
//     Auftrag §90-100: gebaut ist gegen die Namen, die PRO liefert, und die Zuweisung ist ein
//     Typfehler, sobald sich deren Flaeche aendert.
import { describe, expect, it } from "vitest";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { Confidentiality } from "../../services/knowledge-object";
import {
  InMemoryKantenRepo,
  KantenLeseService,
  type KuratierteKante,
} from "../../services/knowledge-object/src/kanten-service";
import {
  BEITRAGENDE_DECKEL,
  KANTEN_ABFRAGE_DECKEL,
  LesemodellService,
  THEMEN_DECKEL,
} from "../../services/wissensnetz/src/lesemodell";
import type {
  WissensnetzKantenLeser,
  WissensnetzKoLeser,
} from "../../services/wissensnetz/src/lesemodell-ports";

// ================================================================================================
// TEIL A — DIE ABFRAGE, GEGEN EINE SYNTHETISCHE GRUNDMENGE.
// ================================================================================================

interface TestKo {
  id: string;
  category: string;
  author?: string | null | undefined;
  confidentiality?: Confidentiality | null | undefined;
}

const bestand = (kos: readonly TestKo[]): WissensnetzKoLeser<TestKo> => ({
  alle: async () => kos,
});

// Ein Stellvertreter des Kantendienstes: Kennungen mit sichtbarer Kante werden benannt.
const kantenAus = (mitKante: readonly string[]): WissensnetzKantenLeser<TestKo> => ({
  kantenFuer: async (koId) => ({ total: mitKante.includes(koId) ? 1 : 0 }),
});

// Die ECHTE Entscheidung, nicht ein nachgebautes Praedikat: `sichtbarkeitsfilterFuer` ist die eine
// Stelle, an der im Produkt entschieden wird, wer was sehen darf (sichtbarkeit.ts:108).
const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

const GRUNDMENGE: readonly TestKo[] = [
  { id: "a1", category: "Betrieb", author: "anna", confidentiality: "intern" },
  { id: "a2", category: "Betrieb", author: "anna", confidentiality: "intern" },
  { id: "a3", category: "Betrieb", author: "bert", confidentiality: "intern" },
  { id: "b1", category: "Wartung", author: "bert", confidentiality: "intern" },
  // Ein Thema, das AUSSCHLIESSLICH aus Vertraulichem besteht: es darf fuer die Expertin nicht
  // einmal dem Namen nach existieren.
  { id: "g1", category: "Lieferantenpreise", author: "chef", confidentiality: "vertraulich" },
  // Ohne Thema — und ohne erfundenes Sammelthema.
  { id: "o1", category: "   ", author: "anna", confidentiality: "intern" },
];

describe("JOB 1496 · Lesemodell — Sichtbarkeit vor Aggregation", () => {
  it("ein Thema aus ausschliesslich vertraulichen Objekten erscheint nicht — auch nicht dem Namen nach", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.themen.map((t) => t.thema)).toEqual(["Betrieb", "Wartung"]);
    // An der serialisierten Antwort: weder der Themenname noch der Urheber reisen mit.
    const roh = JSON.stringify(sicht);
    expect(roh).not.toContain("Lieferantenpreise");
    expect(roh).not.toContain("chef");
    expect(roh).not.toContain("g1");
  });

  it("KALIBRIERUNG: fuer die erweiterte Sichtbarkeit ist dasselbe Thema da", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: CONTROLLERIN });

    expect(sicht.themen.map((t) => t.thema)).toEqual(["Betrieb", "Lieferantenpreise", "Wartung"]);
    expect(JSON.stringify(sicht)).toContain("Lieferantenpreise");
  });

  it("die Zaehler zaehlen NACH dem Trimm — es gibt keine zweite Zahl, aus der er sich errechnen liesse", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const expertin = await lm.sicht({ sichtbar: EXPERTIN });
    const controllerin = await lm.sicht({ sichtbar: CONTROLLERIN });

    // Fuenf sichtbare Objekte fuer die Expertin (a1-a3, b1, o1), sechs fuer die Controllerin.
    expect(expertin.objekteGesamt).toBe(5);
    expect(controllerin.objekteGesamt).toBe(6);
    // Kein Feld traegt die Differenz: die Antwort kennt keinen Schnittzaehler. Die Liste ist
    // ABSCHLIESSEND — jedes nicht genannte Feld laesst diesen Fall rot werden, und genau das ist
    // seine Aufgabe.
    //
    // D3 hat sie um `beitragendeNurOhneThema` ERWEITERT, nicht gelockert. Dass dieses Feld kein
    // verkappter Schnittzaehler ist, steht nicht als Behauptung hier, sondern ist unten eigens
    // geprueft: "sie ist KEIN Schnittzaehler: ein abgeschnittenes Thema macht seine Urheber nicht
    // themenlos".
    const felder = Object.keys(expertin).sort();
    expect(felder).toEqual([
      "abgeschnitten",
      "beitragendeGesamt",
      "beitragendeNurOhneThema",
      "objekteGesamt",
      "ohneThema",
      "themen",
      "verknuepfungAusgelassen",
    ]);
  });

  it("FAIL-CLOSED: ohne uebergebene Entscheidung ist nichts sichtbar — nicht alles", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({});

    expect(sicht.themen).toEqual([]);
    expect(sicht.objekteGesamt).toBe(0);
    expect(sicht.beitragendeGesamt).toBe(0);
    expect(sicht.ohneThema).toBe(0);
  });
});

describe("JOB 1496 · Lesemodell — Frage 1 und Frage 2", () => {
  it("Frage 1: welche Themen es gibt — groesstes zuerst, Name als Stichentscheid", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.themen.map((t) => [t.thema, t.objekte])).toEqual([
      ["Betrieb", 3],
      ["Wartung", 1],
    ]);
  });

  it("Frage 2: wer dazu beigetragen hat — je Thema, absteigend nach Umfang", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.themen[0]?.beitragende).toEqual([
      { urheber: "anna", objekte: 2 },
      { urheber: "bert", objekte: 1 },
    ]);
    // anna und bert sind sichtbar, chef nicht — er steht auch nicht in der Gesamtzahl.
    expect(sicht.beitragendeGesamt).toBe(2);
  });

  it("ein Objekt ohne Thema bekommt kein erfundenes Sammelthema, sondern eine eigene Zahl", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.ohneThema).toBe(1);
    expect(sicht.themen.map((t) => t.thema)).not.toContain("Sonstiges");
    // Die Summe der Themenzaehler ist objekteGesamt minus ohneThema — nachgerechnet, nicht geglaubt.
    const summe = sicht.themen.reduce((n, t) => n + t.objekte, 0);
    expect(summe).toBe(sicht.objekteGesamt - sicht.ohneThema);
  });
});

describe("JOB 1496 · Lesemodell — Rohmaterial fuer Frage 3, nicht ihre Antwort", () => {
  it("ohne Anforderung stehen die Kantenzaehler NICHT da — eine Null waere eine falsche Aussage", async () => {
    const lm = new LesemodellService<TestKo>({
      kos: bestand(GRUNDMENGE),
      kanten: kantenAus(["a1"]),
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.themen[0]?.verknuepft).toBeUndefined();
    expect(sicht.themen[0]?.unverknuepft).toBeUndefined();
    expect(sicht.verknuepfungAusgelassen).toBe(false);
  });

  it("mit Anforderung trennt es verknuepfte von unverknuepften Objekten — als Zahl, nicht als Urteil", async () => {
    const lm = new LesemodellService<TestKo>({
      kos: bestand(GRUNDMENGE),
      kanten: kantenAus(["a1", "a3"]),
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.themen[0]?.thema).toBe("Betrieb");
    expect(sicht.themen[0]?.verknuepft).toBe(2);
    expect(sicht.themen[0]?.unverknuepft).toBe(1);
    expect(sicht.verknuepfungAusgelassen).toBe(false);
    // Kein Urteil: nirgends steht, dass ein unverknuepftes Objekt eine Luecke IST.
    expect(JSON.stringify(sicht)).not.toContain("luecke");
  });

  it("ohne Kantenport wird die Anforderung ehrlich als ausgelassen gemeldet, nicht als Null beantwortet", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.themen[0]?.verknuepft).toBeUndefined();
  });
});

describe("JOB 1496 · Lesemodell — grosse Mengen", () => {
  const viele = (n: number): TestKo[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `k${i}`,
      category: `Thema ${String(i).padStart(4, "0")}`,
      author: "anna",
      confidentiality: "intern" as const,
    }));

  it("der Themendeckel schneidet ab und sagt es — ohne die Zahl des Weggelassenen zu nennen", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(viele(THEMEN_DECKEL + 5)) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.themen).toHaveLength(THEMEN_DECKEL);
    expect(sicht.abgeschnitten).toBe(true);
    // objekteGesamt bleibt die Wahrheit ueber die sichtbare Menge; eine Restzahl gibt es nicht.
    expect(sicht.objekteGesamt).toBe(THEMEN_DECKEL + 5);
    expect(Object.keys(sicht)).not.toContain("weggelassen");
  });

  it("ein eigener Deckel wird beachtet, kann den Hoechstwert aber nicht ueberschreiten", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(viele(10)) });

    expect((await lm.sicht({ sichtbar: EXPERTIN, deckel: 3 })).themen).toHaveLength(3);
    expect(
      (await lm.sicht({ sichtbar: EXPERTIN, deckel: THEMEN_DECKEL + 999 })).themen.length,
    ).toBeLessThanOrEqual(THEMEN_DECKEL);
  });

  it("ueber dem Kantendeckel werden die Zaehler AUSGELASSEN statt ueber einer Teilmenge gebildet", async () => {
    let abfragen = 0;
    const lm = new LesemodellService<TestKo>({
      kos: bestand(viele(KANTEN_ABFRAGE_DECKEL + 1)),
      kanten: {
        kantenFuer: async () => {
          abfragen++;
          return { total: 1 };
        },
      },
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.themen[0]?.verknuepft).toBeUndefined();
    // Und es ist nicht einmal abgefragt worden: der Deckel greift VOR der Last, nicht danach.
    expect(abfragen).toBe(0);
  });

  it("ohne Anforderung kostet die Sicht KEINE einzige Kantenabfrage", async () => {
    let abfragen = 0;
    const lm = new LesemodellService<TestKo>({
      kos: bestand(GRUNDMENGE),
      kanten: {
        kantenFuer: async () => {
          abfragen++;
          return { total: 0 };
        },
      },
    });

    await lm.sicht({ sichtbar: EXPERTIN });

    expect(abfragen).toBe(0);
  });
});

describe("JOB 1496 · Lesemodell ist ein Leseweg — mehr nicht", () => {
  it("der Dienst bietet keine oeffentliche Mutation an", () => {
    const flaeche = Object.getOwnPropertyNames(LesemodellService.prototype).filter(
      (n) => n !== "constructor",
    );
    expect(flaeche).toEqual(["sicht"]);
  });
});

// ================================================================================================
// TEIL B — DER PORT IST KEINE ERFINDUNG: DER ECHTE DIENST ERFUELLT IHN.
// ================================================================================================
//
// Auftrag §95: bau gegen die Namen `KantenLeseService` und `KuratierteKante`, warte nicht auf PRO.
// Genau das wird hier nachgewiesen — nicht behauptet. Die beiden Zuweisungen unten sind
// Typpruefung: aendert PRO die Flaeche, bricht dieser Test beim Bauen, nicht erst im Betrieb.

/**
 * Das echte Wissensobjekt, ohne es namentlich zu importieren: was `KoService.list` fuehrt. So haengt
 * der Beweis an der tatsaechlichen Flaeche des Dienstes und nicht an einem hier gewaehlten Namen.
 */
type EchtesKo = Awaited<ReturnType<KoService["list"]>>[number];

function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-mensch",
    gesetztAm: "2026-08-20T08:00:00.000Z",
    geaendertAm: "2026-08-20T08:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("JOB 1496 · der Vertrag mit PRO — echter KantenLeseService, echter KoService", () => {
  it("die echten Dienste erfuellen die Ports, und die Sicht laeuft ueber sie", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const kantenRepo = new InMemoryKantenRepo();
    const neuesKo = async (title: string, category: string, c: Confidentiality = "intern") =>
      (
        await ko.create({
          title,
          statement: `Aussage zu ${title}`,
          type: "best_practice",
          category,
          author: "anna",
          tags: [],
          confidentiality: c,
        })
      ).id;

    const verknuepft = await neuesKo("Wartungsplan Halle 2", "Betrieb");
    const allein = await neuesKo("Filterwechsel dokumentiert", "Betrieb");
    const geheim = await neuesKo("Lieferantenpreis Ventile", "Lieferantenpreise", "vertraulich");
    await kantenRepo.setze(kante({ quelleId: verknuepft, zielId: allein }));

    // DIE BEIDEN ZUWEISUNGEN SIND DER BEWEIS. Sie stehen ausdruecklich mit Typannotation da,
    // damit TypeScript sie prueft, statt sie wegzuschliessen.
    const kantenPort: WissensnetzKantenLeser<EchtesKo> = new KantenLeseService({
      repo: kantenRepo,
      kos: ko,
    });
    const koPort: WissensnetzKoLeser<EchtesKo> = { alle: () => ko.list() };

    const lm = new LesemodellService({ kos: koPort, kanten: kantenPort });

    const expertin = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    // Frage 1 und 2, am echten Bestand: das vertrauliche Thema fehlt vollstaendig.
    expect(expertin.themen.map((t) => t.thema)).toEqual(["Betrieb"]);
    expect(JSON.stringify(expertin)).not.toContain("Lieferantenpreis");
    expect(expertin.themen[0]?.objekte).toBe(2);
    expect(expertin.themen[0]?.beitragende).toEqual([{ urheber: "anna", objekte: 2 }]);
    // Rohmaterial fuer Frage 3, aus dem ECHTEN Kantendienst: eines der beiden ist verknuepft —
    // und zwar beide, weil die Kante von beiden Seiten gelesen wird.
    expect(expertin.themen[0]?.verknuepft).toBe(2);
    expect(expertin.themen[0]?.unverknuepft).toBe(0);

    // KALIBRIERUNG am echten Bestand: fuer die Controllerin ist das vertrauliche Thema da — und es
    // ist unverknuepft, also genau das Rohmaterial, aus dem PRO5 eine Luecke machen kann.
    const controllerin = await lm.sicht({ sichtbar: CONTROLLERIN, mitVerknuepfung: true });
    expect(controllerin.themen.map((t) => t.thema)).toEqual(["Betrieb", "Lieferantenpreise"]);
    const geheimesThema = controllerin.themen.find((t) => t.thema === "Lieferantenpreise");
    expect(geheimesThema?.unverknuepft).toBe(1);
    expect(geheimesThema?.verknuepft).toBe(0);
    expect(geheim).not.toBe("");
  });
});

// ================================================================================================
// JOB 1496 · D2 — DIE ZWEITE STILLE LUECKE: OBJEKTE OHNE URHEBER.
// ================================================================================================
//
// D1 hat fuer Themen eine Luecke geschlossen: ein Objekt ohne `category` bekommt kein erfundenes
// Sammelthema, sondern eine eigene Zahl (`ohneThema`). **Fuer Beitragende blieb dieselbe Luecke
// offen** — und das war eine Halbheit meines eigenen Stands:
//
//   `lesemodell.ts` zaehlt ein Objekt ohne Urheber in `thema.objekte` mit, traegt es aber in
//   KEINEN `beitragende`-Eintrag ein. Die Summe der Beitraege ist dann kleiner als `objekte`,
//   und die Antwort sagt nicht, warum. Genau das ist die Sorte stiller Differenz, gegen die
//   `ohneThema` gebaut wurde.
//
// WARUM DAS ROHMATERIAL FUER FRAGE 3 IST, NICHT IHRE ANTWORT: Ein Thema, dessen Objekte keinen
// benannten Urheber tragen, ist ein Kandidat fuer eine Luecke — aber ob es eine IST, entscheidet
// PRO5 in `luecken*.ts`. Hier steht eine Zahl, kein Urteil.
//
// KEINE KENNUNGEN. Die Entscheidung aus D1 bleibt: die Sicht traegt Zaehler, keine Objektlisten.
// Was nicht mitreist, kann nicht auslaufen.

const OHNE_URHEBER: readonly TestKo[] = [
  { id: "u1", category: "Betrieb", author: "anna", confidentiality: "intern" },
  { id: "u2", category: "Betrieb", author: "", confidentiality: "intern" },
  { id: "u3", category: "Betrieb", author: "   ", confidentiality: "intern" },
  { id: "u4", category: "Betrieb", author: null, confidentiality: "intern" },
  { id: "u5", category: "Wartung", author: "bert", confidentiality: "intern" },
];

describe("JOB 1496 · D2 · Objekte ohne Urheber bekommen eine eigene Zahl", () => {
  it("die Summe der Beitraege plus ohneBeitragende ergibt genau die Objektzahl", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(OHNE_URHEBER) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });
    const betrieb = sicht.themen.find((t) => t.thema === "Betrieb");

    expect(betrieb?.objekte, "vier Objekte im Thema Betrieb").toBe(4);
    expect(betrieb?.beitragende).toEqual([{ urheber: "anna", objekte: 1 }]);
    // Ohne diese Zahl waere die Differenz 4 - 1 = 3 unerklaert.
    expect(betrieb?.ohneBeitragende, "leer, Leerraum und null zaehlen gleich").toBe(3);

    const summe = (betrieb?.beitragende ?? []).reduce((n, b) => n + b.objekte, 0);
    expect(summe + (betrieb?.ohneBeitragende ?? 0)).toBe(betrieb?.objekte);
  });

  it("KALIBRIERUNG: ein Thema mit lauter benannten Urhebern meldet 0", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(OHNE_URHEBER) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });
    const wartung = sicht.themen.find((t) => t.thema === "Wartung");

    expect(wartung?.objekte).toBe(1);
    expect(wartung?.ohneBeitragende, "0, nicht undefined — die Zahl ist immer da").toBe(0);
  });

  it("die Zahl zaehlt NACH dem Trimm und traegt kein Urteilswort", async () => {
    const verdeckt: readonly TestKo[] = [
      ...OHNE_URHEBER,
      { id: "v1", category: "Betrieb", author: "", confidentiality: "vertraulich" },
    ];
    const lm = new LesemodellService<TestKo>({ kos: bestand(verdeckt) });

    const fuerExpertin = await lm.sicht({ sichtbar: EXPERTIN });
    const fuerControllerin = await lm.sicht({ sichtbar: CONTROLLERIN });

    // Das vertrauliche Objekt ohne Urheber erhoeht die Zahl NUR fuer den, der es sehen darf.
    expect(fuerExpertin.themen.find((t) => t.thema === "Betrieb")?.ohneBeitragende).toBe(3);
    expect(fuerControllerin.themen.find((t) => t.thema === "Betrieb")?.ohneBeitragende).toBe(4);
    expect(JSON.stringify(fuerExpertin)).not.toContain("luecke");
  });
});

// ================================================================================================
// JOB 1496 · D3 — DIE DRITTE STILLE LUECKE, UND ZWAR DIE EINE EBENE HOEHER.
// ================================================================================================
//
// D1 schloss sie fuer Themen (`ohneThema`), D2 fuer Urheber INNERHALB eines Themas
// (`ohneBeitragende`). **Auf der obersten Ebene blieb sie offen** — und dort faellt sie am
// meisten auf, weil `beitragendeGesamt` die Kopfzahl zu Frage 2 der Abnahmefrage ist:
//
//   `lesemodell.ts:154` zaehlt den Urheber in `alleBeitragenden`, BEVOR `:161` das Objekt ohne
//   Thema per `continue` aus der Themenbildung nimmt. Wer ausschliesslich Objekte ohne Thema
//   hat, steht damit in `beitragendeGesamt`, aber in KEINEM `beitragende`-Eintrag.
//
// WARUM DAS SCHWERER WIEGT ALS EINE UNSCHOENHEIT: Die Datei rechnet die Objektseite ausdruecklich
// vor — `lesemodell-ports.ts:158`: die Summe der Themenzaehler ist `objekteGesamt - ohneThema`.
// Fuer die Beitragendenseite gab es keine solche Gleichung, und ohne sie ist eine Seite, die
// "42 Beitragende" ueber einer Themenliste mit dreissig Namen zeigt, schlicht nicht erklaerbar.
//
// KEIN ERFUNDENER SAMMELURHEBER, KEINE KENNUNGEN, KEIN URTEIL — dieselben drei Entscheidungen
// wie in D1 und D2. Ob jemand, der nur ausserhalb der Themen beitraegt, eine Luecke IST,
// entscheidet PRO5 in `luecken*.ts`. Hier steht eine Zahl.

const NUR_OHNE_THEMA: readonly TestKo[] = [
  { id: "n1", category: "Betrieb", author: "anna", confidentiality: "intern" },
  { id: "n2", category: "Betrieb", author: "bert", confidentiality: "intern" },
  // dora taucht AUSSCHLIESSLICH ausserhalb jedes Themas auf — leerer Raum und leerer String.
  { id: "n3", category: "   ", author: "dora", confidentiality: "intern" },
  { id: "n4", category: "", author: "dora", confidentiality: "intern" },
];

/** Verschiedene Urheber, die in mindestens einem ausgelieferten Thema stehen. */
const beitragendeInThemen = (sicht: { themen: { beitragende: { urheber: string }[] }[] }): number =>
  new Set(sicht.themen.flatMap((t) => t.beitragende.map((b) => b.urheber))).size;

describe("JOB 1496 · D3 · Beitragende ohne jedes Thema bekommen eine eigene Zahl", () => {
  it("die Beitragenden in Themen plus beitragendeNurOhneThema ergeben genau beitragendeGesamt", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(NUR_OHNE_THEMA) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    expect(sicht.beitragendeGesamt, "anna, bert, dora").toBe(3);
    expect(beitragendeInThemen(sicht), "in Themen stehen nur anna und bert").toBe(2);
    // Ohne diese Zahl waere die Differenz 3 - 2 = 1 unerklaert: dora ist da und nirgends zu sehen.
    expect(sicht.beitragendeNurOhneThema, "dora traegt nur ausserhalb jedes Themas bei").toBe(1);

    // Die Gleichung, die es fuer die Objektseite laengst gibt — jetzt auch fuer die Personenseite.
    expect(beitragendeInThemen(sicht) + sicht.beitragendeNurOhneThema).toBe(
      sicht.beitragendeGesamt,
    );
    expect(sicht.ohneThema, "zwei Objekte ohne Thema, aber nur EIN Mensch dahinter").toBe(2);
  });

  it("KALIBRIERUNG: wer AUCH in einem Thema steht, zaehlt nicht mit — 0, nicht undefined", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    // anna hat o1 ohne Thema UND Objekte im Thema Betrieb. Sie ist sichtbar, also fehlt sie nicht.
    expect(sicht.ohneThema, "o1 hat kein Thema").toBe(1);
    expect(sicht.beitragendeNurOhneThema, "0, nicht undefined — die Zahl ist immer da").toBe(0);
    expect(beitragendeInThemen(sicht) + sicht.beitragendeNurOhneThema).toBe(
      sicht.beitragendeGesamt,
    );
  });

  it("die Zahl zaehlt NACH dem Trimm und traegt kein Urteilswort", async () => {
    const verdeckt: readonly TestKo[] = [
      ...NUR_OHNE_THEMA,
      // erna traegt nur ein vertrauliches Objekt ohne Thema bei.
      { id: "v2", category: " ", author: "erna", confidentiality: "vertraulich" },
    ];
    const lm = new LesemodellService<TestKo>({ kos: bestand(verdeckt) });

    const fuerExpertin = await lm.sicht({ sichtbar: EXPERTIN });
    const fuerControllerin = await lm.sicht({ sichtbar: CONTROLLERIN });

    // erna erhoeht die Zahl NUR fuer den, der ihr Objekt sehen darf.
    expect(fuerExpertin.beitragendeNurOhneThema, "nur dora").toBe(1);
    expect(fuerControllerin.beitragendeNurOhneThema, "dora und erna").toBe(2);

    // Und die Gleichung haelt auf beiden Sichtbarkeitsstufen.
    expect(beitragendeInThemen(fuerExpertin) + fuerExpertin.beitragendeNurOhneThema).toBe(
      fuerExpertin.beitragendeGesamt,
    );
    expect(beitragendeInThemen(fuerControllerin) + fuerControllerin.beitragendeNurOhneThema).toBe(
      fuerControllerin.beitragendeGesamt,
    );

    expect(JSON.stringify(fuerControllerin)).not.toContain("luecke");
  });

  it("sie ist KEIN Schnittzaehler: ein abgeschnittenes Thema macht seine Urheber nicht themenlos", async () => {
    // Zwei Themen, ein Deckel von eins: das kleinere Thema wird weggeschnitten.
    const zweiThemen: readonly TestKo[] = [
      { id: "d1", category: "Betrieb", author: "anna", confidentiality: "intern" },
      { id: "d2", category: "Betrieb", author: "anna", confidentiality: "intern" },
      { id: "d3", category: "Wartung", author: "bert", confidentiality: "intern" },
      { id: "d4", category: "   ", author: "dora", confidentiality: "intern" },
    ];
    const lm = new LesemodellService<TestKo>({ kos: bestand(zweiThemen) });

    const voll = await lm.sicht({ sichtbar: EXPERTIN });
    const beschnitten = await lm.sicht({ sichtbar: EXPERTIN, deckel: 1 });

    expect(voll.abgeschnitten).toBe(false);
    expect(beschnitten.abgeschnitten).toBe(true);
    expect(beschnitten.themen).toHaveLength(1);

    // bert steht nur im weggeschnittenen Thema Wartung. Er ist NICHT themenlos, und die Zahl
    // darf ihn nicht einsammeln — sonst waere sie ein verkappter Schnittzaehler.
    expect(voll.beitragendeNurOhneThema, "nur dora").toBe(1);
    expect(beschnitten.beitragendeNurOhneThema, "weiterhin nur dora, nicht dora und bert").toBe(1);

    // Und die Gleichung geht am Deckel bewusst NICHT auf — das sagt `abgeschnitten` an.
    expect(beitragendeInThemen(voll) + voll.beitragendeNurOhneThema).toBe(voll.beitragendeGesamt);
    expect(beitragendeInThemen(beschnitten) + beschnitten.beitragendeNurOhneThema).toBeLessThan(
      beschnitten.beitragendeGesamt,
    );
  });
});

// ================================================================================================
// JOB 1496 · D4 (a) — DER DECKEL, DEN DIE DATEI BEGRUENDET UND EINE EBENE TIEFER NICHT ANWANDTE.
// ================================================================================================
//
// `lesemodell.ts:65-67` begruendet `THEMEN_DECKEL` so: "Eine Seite, die tausend Themen zeichnet,
// ist keine Sicht mehr; und eine unbegrenzte Antwort ist ein Speicherrisiko, das der Aufrufer
// nicht sieht." **Dieselbe Begruendung galt fuer die Beitragendenliste JE THEMA und war dort nicht
// angewandt** — ein Thema mit fuenftausend Beitragenden lieferte fuenftausend Eintraege.
//
// GLEICHE BAUFORM WIE OBEN, NICHT EINE NEUE: Deckel plus BOOLEAN, kein Schnittzaehler. Die Zahl
// der weggelassenen Beitragenden waere eine Mengenauskunft ueber nicht Ausgeliefertes — genau das,
// was `kanten-service.ts:27-30` verbietet und was `abgeschnitten` eine Ebene hoeher bewusst
// vermeidet.
//
// UND DER DECKEL DARF DIE ZAHL AUS D3 NICHT VERFAELSCHEN: Wer nur weggeschnitten wurde, ist nicht
// themenlos. `beitragendeNurOhneThema` wird deshalb VOR dem Deckel gebildet — der letzte Fall
// dieses Blocks nagelt das fest.

const VIELE_BEITRAGENDE: readonly TestKo[] = [
  // Zwei Objekte, damit dieser Mensch nach Umfang unstrittig vorn steht.
  { id: "vb-top-1", category: "Betrieb", author: "aaa-viel", confidentiality: "intern" },
  { id: "vb-top-2", category: "Betrieb", author: "aaa-viel", confidentiality: "intern" },
  ...Array.from({ length: BEITRAGENDE_DECKEL + 4 }, (_, i) => ({
    id: `vb-${i}`,
    category: "Betrieb",
    author: `m${String(i).padStart(3, "0")}`,
    confidentiality: "intern" as const,
  })),
];

describe("JOB 1496 · D4 · die Beitragendenliste hat einen Deckel und sagt es", () => {
  it("unter dem Deckel bleibt alles stehen und der Schalter ist false, nicht undefined", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });
    const betrieb = sicht.themen.find((t) => t.thema === "Betrieb");

    expect(betrieb?.beitragende).toHaveLength(2);
    expect(betrieb?.beitragendeAbgeschnitten, "false, nicht undefined").toBe(false);
  });

  it("ueber dem Deckel schneidet er ab, behaelt die groessten und nennt KEINE Restzahl", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(VIELE_BEITRAGENDE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });
    const betrieb = sicht.themen.find((t) => t.thema === "Betrieb");
    const namen = (betrieb?.beitragende ?? []).map((b) => b.urheber);

    expect(betrieb?.beitragende).toHaveLength(BEITRAGENDE_DECKEL);
    expect(betrieb?.beitragendeAbgeschnitten).toBe(true);

    // Groesster zuerst — der Deckel schneidet den Schwanz ab, nicht den Kopf.
    expect(namen[0]).toBe("aaa-viel");
    expect(namen).toContain("m198");
    expect(namen).not.toContain("m199");

    // `objekte` bleibt die Wahrheit ueber das Thema; die Zahl der weggelassenen Menschen gibt es
    // NICHT — dieselbe Regel wie beim Themendeckel.
    expect(betrieb?.objekte).toBe(VIELE_BEITRAGENDE.length);
    expect(Object.keys(betrieb ?? {}).sort()).toEqual([
      "beitragende",
      "beitragendeAbgeschnitten",
      "objekte",
      "ohneBeitragende",
      "thema",
    ]);
  });

  it("der Deckel macht die Weggeschnittenen NICHT themenlos — die D3-Zahl bleibt richtig", async () => {
    const mitThemenlosem: readonly TestKo[] = [
      ...VIELE_BEITRAGENDE,
      { id: "vb-ohne", category: "   ", author: "zz-ohne-thema", confidentiality: "intern" },
    ];
    const lm = new LesemodellService<TestKo>({ kos: bestand(mitThemenlosem) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN });

    // 205 Beitragende im Thema + 1 ausserhalb.
    expect(sicht.beitragendeGesamt).toBe(BEITRAGENDE_DECKEL + 6);
    // Nur zz-ohne-thema. m199..m203 sind weggeschnitten, aber sie tragen zu einem Thema bei.
    expect(sicht.beitragendeNurOhneThema, "nur der wirklich Themenlose").toBe(1);
    expect(sicht.themen[0]?.beitragendeAbgeschnitten).toBe(true);
  });
});

// ================================================================================================
// JOB 1496 · D4 (b) — EIN SCHALTER, ZWEI URSACHEN: DAS WAR SELBST EINE STILLE DIFFERENZ.
// ================================================================================================
//
// `verknuepfungAusgelassen` wurde in D1 gebaut, damit "nicht angefordert" und "ausgelassen" nicht
// beide nur `undefined` sind (`lesemodell-ports.ts:161-167`). Der Schalter selbst warf aber ZWEI
// Ursachen zusammen:
//
//   (1) `deps.kanten` ist gar nicht verdrahtet  -> ein Fehler der Kompositionswurzel;
//   (2) die sichtbare Menge liegt ueber `KANTEN_ABFRAGE_DECKEL` -> erwartetes Verhalten.
//
// Sie verlangen entgegengesetzte Reaktionen — Verdrahtung reparieren gegen Abfrage verkleinern —
// und waren aus der Antwort nicht zu unterscheiden. Der Grund steht deshalb jetzt dabei.
//
// UND ER STEHT NUR DA, WENN ETWAS AUSGELASSEN WURDE: dieselbe Entscheidung wie bei
// `verknuepft`/`unverknuepft` — ein Grund ohne Auslassung waere eine Aussage ueber nichts.

describe("JOB 1496 · D4 · warum ausgelassen wurde, steht dabei", () => {
  it("ohne verdrahteten Kantenport: kein-kantenport", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(GRUNDMENGE) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.verknuepfungAusgelassenGrund).toBe("kein-kantenport");
  });

  it("ueber dem Kantendeckel: zu-viele-objekte — dieselbe Meldung, anderer Grund", async () => {
    const lm = new LesemodellService<TestKo>({
      kos: bestand(
        Array.from({ length: KANTEN_ABFRAGE_DECKEL + 1 }, (_, i) => ({
          id: `g${i}`,
          category: "Betrieb",
          author: `a${i}`,
          confidentiality: "intern" as const,
        })),
      ),
      kanten: kantenAus([]),
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.verknuepfungAusgelassenGrund).toBe("zu-viele-objekte");
  });

  it("wurde nichts ausgelassen, FEHLT der Schluessel — kein Grund ueber nichts", async () => {
    const lm = new LesemodellService<TestKo>({
      kos: bestand(GRUNDMENGE),
      kanten: kantenAus(["a1"]),
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(false);
    // Nicht `undefined` als Wert, sondern gar kein Schluessel — sonst waere die Feldliste oben
    // nicht mehr abschliessend.
    expect(Object.keys(sicht)).not.toContain("verknuepfungAusgelassenGrund");
  });
});

// ================================================================================================
// JOB 1496 · D5 — DER KANTENDECKEL MASS DIE FALSCHE MENGE.
// ================================================================================================
//
// `KANTEN_ABFRAGE_DECKEL` ist dokumentiert als "Hoechstzahl der OBJEKTE, FUER DIE Kantenzaehler
// erhoben werden" (`lesemodell.ts:70-74`). Gemessen wurde aber etwas anderes:
//
//   :155   ... || sichtbare.length > KANTEN_ABFRAGE_DECKEL
//   :173   if (thema === "") { ohneThema++; continue; }     <- VOR jeder Kantenabfrage
//
// Objekte ohne Thema loesen NIE eine Kantenabfrage aus — sie fallen vorher heraus. Sie zaehlten
// aber in den Deckel hinein. Folge: Ein Bestand aus 2000 themenlosen und zwei thematisierten
// Objekten liess die Zaehler aus, obwohl genau ZWEI Abfragen angefallen waeren.
//
// **Das ist kein Geschmacksfall, sondern eine Abweichung von der eigenen Zusage der Datei.** Der
// Deckel schuetzt vor Last; Last entsteht nur dort, wo abgefragt wird.

describe("JOB 1496 · D5 · der Kantendeckel misst die Objekte, die wirklich abgefragt werden", () => {
  const themenlosMitZweiThemen = (n: number): TestKo[] => [
    { id: "t-1", category: "Betrieb", author: "anna", confidentiality: "intern" },
    { id: "t-2", category: "Wartung", author: "bert", confidentiality: "intern" },
    ...Array.from({ length: n }, (_, i) => ({
      id: `frei${i}`,
      category: "   ",
      author: `f${i}`,
      confidentiality: "intern" as const,
    })),
  ];

  it("themenlose Objekte loesen den Deckel nicht aus — sie werden nie abgefragt", async () => {
    let abfragen = 0;
    const lm = new LesemodellService<TestKo>({
      kos: bestand(themenlosMitZweiThemen(KANTEN_ABFRAGE_DECKEL + 1)),
      kanten: {
        kantenFuer: async () => {
          abfragen++;
          return { total: 1 };
        },
      },
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    // Weit ueber dem Deckel an sichtbaren Objekten — aber nur zwei davon koennen abgefragt werden.
    expect(sicht.objekteGesamt).toBe(KANTEN_ABFRAGE_DECKEL + 3);
    expect(sicht.ohneThema).toBe(KANTEN_ABFRAGE_DECKEL + 1);

    expect(sicht.verknuepfungAusgelassen, "zwei Abfragen sind keine Last").toBe(false);
    expect(abfragen, "genau die zwei thematisierten Objekte").toBe(2);
    expect(sicht.themen.find((t) => t.thema === "Betrieb")?.verknuepft).toBe(1);
  });

  it("KALIBRIERUNG: liegt die abfragbare Menge selbst ueber dem Deckel, bleibt es bei der Auslassung", async () => {
    let abfragen = 0;
    const lm = new LesemodellService<TestKo>({
      kos: bestand(
        Array.from({ length: KANTEN_ABFRAGE_DECKEL + 1 }, (_, i) => ({
          id: `v${i}`,
          category: `Thema ${String(i).padStart(4, "0")}`,
          author: "anna",
          confidentiality: "intern" as const,
        })),
      ),
      kanten: {
        kantenFuer: async () => {
          abfragen++;
          return { total: 1 };
        },
      },
    });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.verknuepfungAusgelassenGrund).toBe("zu-viele-objekte");
    expect(abfragen, "der Deckel greift VOR der Last").toBe(0);
  });

  it("gezaehlt wird NACH dem Trimm: unsichtbare Themenobjekte druecken den Deckel nicht", async () => {
    let abfragen = 0;
    const verdeckt: readonly TestKo[] = [
      { id: "s-1", category: "Betrieb", author: "anna", confidentiality: "intern" },
      { id: "s-2", category: "Wartung", author: "bert", confidentiality: "intern" },
      ...Array.from({ length: KANTEN_ABFRAGE_DECKEL + 1 }, (_, i) => ({
        id: `geheim${i}`,
        category: `Geheim ${String(i).padStart(4, "0")}`,
        author: "chef",
        confidentiality: "vertraulich" as const,
      })),
    ];
    const kanten = {
      kantenFuer: async () => {
        abfragen++;
        return { total: 0 };
      },
    };

    const fuerExpertin = await new LesemodellService<TestKo>({
      kos: bestand(verdeckt),
      kanten,
    }).sicht({ sichtbar: EXPERTIN, mitVerknuepfung: true });

    // Fuer die Expertin sind nur zwei Objekte da — der Deckel darf an den verdeckten nicht haengen.
    expect(fuerExpertin.verknuepfungAusgelassen).toBe(false);
    expect(abfragen).toBe(2);

    abfragen = 0;
    const fuerControllerin = await new LesemodellService<TestKo>({
      kos: bestand(verdeckt),
      kanten,
    }).sicht({ sichtbar: CONTROLLERIN, mitVerknuepfung: true });

    // Sie sieht alles — und fuer sie greift der Deckel zu Recht.
    expect(fuerControllerin.verknuepfungAusgelassen).toBe(true);
    expect(fuerControllerin.verknuepfungAusgelassenGrund).toBe("zu-viele-objekte");
    expect(abfragen).toBe(0);
  });
});

// ================================================================================================
// JOB 1496 · D6 — EIN UNBRAUCHBARER DECKELWERT LEERTE DIE SICHT UND SAGTE, ES SEI NICHTS GEKUERZT.
// ================================================================================================
//
// `lesemodell.ts:146`:  Math.max(0, Math.min(opts.deckel ?? THEMEN_DECKEL, THEMEN_DECKEL))
//
// `Math.min` und `Math.max` reichen `NaN` UNVERAENDERT durch. Damit galt bisher:
//
//   slice(0, NaN)           -> []      die Themenliste ist leer
//   sortiert.length > NaN   -> false   `abgeschnitten` meldet: nichts gekuerzt
//
// **Eine leere Liste mit `abgeschnitten: false` behauptet, es gebe keine Themen.** Das ist die
// gefaehrlichste Form der stillen Differenz in dieser Datei: nicht eine fehlende Zahl, sondern
// eine falsche Aussage.
//
// UND ES IST KEIN KONSTRUIERTER FALL: Der naechste Verbraucher ist eine Seite. `Number(param)`
// auf einen fehlerhaften URL-Parameter liefert genau `NaN` — und die Seite zeigte dann ein leeres
// Wissensnetz, ohne dass irgendetwas darauf hinwiese.
//
// RICHTIG IST FAIL-SAFE, NICHT FAIL-EMPTY: Ein unbrauchbarer Wert heisst "nicht angegeben", also
// gilt `THEMEN_DECKEL` — dieselbe Bedeutung, die `?? THEMEN_DECKEL` eine Zeile weiter oben schon
// fuer `undefined` hat.

describe("JOB 1496 · D6 · ein unbrauchbarer Deckelwert leert die Sicht nicht", () => {
  const fuenfThemen: readonly TestKo[] = Array.from({ length: 5 }, (_, i) => ({
    id: `f${i}`,
    category: `Thema ${String(i).padStart(2, "0")}`,
    author: "anna",
    confidentiality: "intern" as const,
  }));

  it("NaN wird wie 'nicht angegeben' behandelt — keine leere Liste, die sich vollstaendig nennt", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(fuenfThemen) });

    // Genau das, was Number("zwoelf") oder Number(undefined) liefert.
    const sicht = await lm.sicht({ sichtbar: EXPERTIN, deckel: Number.NaN });

    expect(sicht.themen, "alle fuenf, nicht null").toHaveLength(5);
    expect(sicht.abgeschnitten).toBe(false);
    // Die Probe, die den alten Stand entlarvt: leer UND 'nichts gekuerzt' darf es nie geben.
    expect(sicht.themen.length === 0 && sicht.abgeschnitten === false).toBe(false);
  });

  it("auch Infinity und ein negativer Wert bleiben ehrlich", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(fuenfThemen) });

    const unendlich = await lm.sicht({ sichtbar: EXPERTIN, deckel: Number.POSITIVE_INFINITY });
    expect(unendlich.themen).toHaveLength(5);
    expect(unendlich.abgeschnitten).toBe(false);

    // Ein negativer Deckel liefert nichts — aber dann sagt er es auch.
    const negativ = await lm.sicht({ sichtbar: EXPERTIN, deckel: -5 });
    expect(negativ.themen).toHaveLength(0);
    expect(negativ.abgeschnitten, "leer UND ehrlich").toBe(true);
  });

  it("ein gebrochener Deckel schneidet ganzzahlig und meldet dieselbe Zahl, die er anwendet", async () => {
    const lm = new LesemodellService<TestKo>({ kos: bestand(fuenfThemen) });

    const sicht = await lm.sicht({ sichtbar: EXPERTIN, deckel: 2.7 });

    // Angewandt wird 2 — und `abgeschnitten` bezieht sich auf dieselbe 2, nicht auf 2.7.
    expect(sicht.themen).toHaveLength(2);
    expect(sicht.abgeschnitten).toBe(true);
  });
});
