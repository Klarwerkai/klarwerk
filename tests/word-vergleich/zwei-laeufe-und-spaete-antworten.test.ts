// @vitest-environment jsdom
// ================================================================================================
// JOB 3281 · ZWEI LAEUFE, DIE SICH UEBERHOLEN — WEM GEHOERT DER ZUSTAND?
// ================================================================================================
//
// DER BELEGTE BEFUND (Codex-Vorpruefung R2 vom 08.09., 16:10, `4f344967`, statische Ableitung an
// `apps/web/public/word-addin/taskpane.html`): „Pruefung A starten (API haelt) → A abbrechen →
// Pruefung B starten (API haelt) → alte Antwort von A trifft ein". Die drei Ausstiege eines
// ueberholten Laufs setzten das GLOBALE `wvLaeuft` auf `false`, obwohl laengst ein anderer Lauf
// die Fahne haelt. Folge im Fenster: „Abbrechen" verweigert danach den Dienst (`wvAbbrechen`
// steigt bei `!wvLaeuft` sofort aus), und beim naechsten Neuzeichnen steht der Startknopf wieder
// frei, waehrend Klara noch Absatz um Absatz abfragt.
//
// DIE REGEL, DIE HIER GEMESSEN WIRD: nur der Lauf mit der GLEICHEN Kennung darf `wvLaeuft`, den
// Fortschritt und die Liste anfassen. Eine verspaetete Antwort eines abgebrochenen Laufs ist
// stumm — sie faellt weg, sie raeumt nicht auf.
//
// ZWEITE PRUEFLUECKE DESSELBEN BERICHTS: `wvSchluss` raeumte `wvLaeuft` VOR seiner eigenen
// Kennungspruefung, und sein Schreiblauf hatte gar keine. Mit einem verzoegerten `context.sync`
// (die Buehne haelt ihn fest) ist beides messbar — Z4/Z5 unten.
//
// GEMESSEN WIRD AM AUSGELIEFERTEN FENSTER, gegen den nachgebauten Word-Host. Die erwarteten
// Saetze stehen woertlich hier (Nachbarschaftsprobe), nicht als `p.t("…")`.
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, KlaraPanel } from "../app/klara-panel-fixture";
import { reply } from "../app/klara-panel-fixture";
import { type WordBuehne, createWordBuehne, starteMitWord } from "./word-buehne";

// ------------------------------------------------------------------------------------------------
// Drei Absaetze, jeder ueber der 40-Zeichen-Schwelle — jeder geht also wirklich hinaus.
// ------------------------------------------------------------------------------------------------
const A1 =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck " +
  "abzubauen.";
const A2 = "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht durchgesehen.";
const A3 =
  "Der Not-Aus an Linie 4 wird monatlich durch die Elektrofachkraft auf Funktion geprueft.";

/**
 * Eine vollstaendig geprueft gemeldete Antwort von `/api/check-text` — die Form stammt aus
 * `toResponse` in `services/app/src/routes/check-text-routes.ts`. `quellenfund.gelaufen: true` ist
 * Pflicht und keine Verzierung: erst ein vollstaendiger Lauf darf ueberhaupt eine Farbe tragen
 * (Nachfuehrung 08.09.). Damit faerbt jeder Absatz, und der SCHREIBLAUF am Ende findet statt —
 * ohne ihn gaebe es den `sync`, um den es in Z4–Z7 geht, gar nicht.
 *
 * OHNE `duplicates` heisst die Antwort „kein Fund" und faerbt tuerkis („Neu"); MIT einem
 * Dublettentreffer faerbt sie gelb („Ähnlich"). Beides wird in Z7 nebeneinander gebraucht.
 */
function koerper(duplicates: readonly unknown[] = []): Record<string, unknown> {
  return {
    duplicates: duplicates.slice(0),
    conflicts: [],
    konfliktpruefung: {
      gelaufen: false,
      grund: "nicht_angefordert",
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    },
    answer: null,
    note: null,
    persisted: false,
    sourceHits: [],
    sourceHitsTruncated: false,
    quellenfund: { gelaufen: true, grund: null, geprueft: 3 },
  };
}

const LEER = reply(200, koerper());

/**
 * Ein Dublettentreffer (`toResponse.duplicates`) — er stuft den Absatz als „Ähnlich" (gelb) ein
 * statt als „Neu" (tuerkis). Gebraucht wird er in Z7: erst wenn die beiden Laeufe VERSCHIEDENE
 * Kategorien tragen, ist ueberhaupt sichtbar, WESSEN Farbe am Ende im Dokument steht.
 */
const DUBLETTE = {
  koId: "ko-1",
  koTitle: "Wartungsregel Presse P2",
  relation: "identisch",
  confidence: 0.98,
  method: "trigram",
  rationale: null,
  koStatus: "validiert",
  koCategory: "Instandhaltung",
  pruefstand: "validiert",
  version: 9,
  fundort: {
    kategorie: "Instandhaltung",
    bereich: "Instandhaltung",
    bibliothekPfad: "/wissen/ko-1",
  },
};

let panel: KlaraPanel | null = null;

function dokument(optionen: { haelteSync?: number } = {}): WordBuehne {
  return createWordBuehne([{ text: A1 }, { text: A2 }, { text: A3 }], optionen);
}

// ------------------------------------------------------------------------------------------------
// DER TORWAECHTER: er haelt jede Frage an `/api/check-text` fest, bis der Test sie einzeln
// durchlaesst. Nur so entsteht das Fenster, in dem sich zwei Laeufe ueberholen koennen.
//
// Er wird UM den Fetch der Fixture gelegt (nicht an seiner Stelle): die Mitschrift `p.calls` und
// die Antwortrouten bleiben genau die der Fixture. Gezaehlt wird beim EINTRITT, nicht beim
// Durchlassen — sonst waere eine festgehaltene Frage unsichtbar, und „B hat weitergefragt" nicht
// von „B steht still" zu unterscheiden.
// ------------------------------------------------------------------------------------------------
interface Torwaechter {
  /** Die Rumpftexte aller gestellten Fragen, in Reihenfolge des Eintritts. */
  gestellt: string[];
  /** Die i-te festgehaltene Frage beantworten lassen. */
  durchlassen(i: number): void;
}

interface FetchGlobals {
  fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown>;
  window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
}

function torwaechter(): Torwaechter {
  const globals = globalThis as unknown as FetchGlobals;
  const durch = globals.fetch;
  const wartend: Array<() => void> = [];
  const gestellt: string[] = [];
  const gehalten = async (url: string, init?: Record<string, unknown>): Promise<unknown> => {
    if (!String(url).startsWith("/api/check-text")) {
      return durch(url, init);
    }
    gestellt.push(typeof init?.body === "string" ? init.body : "");
    await new Promise<void>((weiter) => {
      wartend.push(weiter);
    });
    return durch(url, init);
  };
  globals.fetch = gehalten;
  globals.window.fetch = gehalten;
  return {
    gestellt,
    durchlassen(i): void {
      const weiter = wartend[i];
      if (weiter === undefined) {
        throw new Error(`Frage ${i} wurde nie gestellt — der Fall ist nicht hergestellt`);
      }
      weiter();
    },
  };
}

function starte(buehne: WordBuehne): KlaraPanel {
  panel = starteMitWord({ "/api/check-text": LEER }, buehne);
  return panel;
}

/**
 * Wie `starte`, aber die Antwort haengt an einer umschaltbaren Lage: Lauf A bekommt „kein Fund"
 * (tuerkis), Lauf B nach dem Umschalten einen Dublettentreffer (gelb). Die Route liest die Lage
 * beim DURCHLASSEN der Frage, nicht beim Stellen — in Z7 ist A da laengst fertig.
 */
function starteMitLage(buehne: WordBuehne, lage: { wert: "neu" | "aehnlich" }): KlaraPanel {
  panel = starteMitWord(
    {
      "/api/check-text": (): FakeReplyInit =>
        reply(200, koerper(lage.wert === "aehnlich" ? [DUBLETTE] : [])),
    },
    buehne,
  );
  return panel;
}

function klick(p: KlaraPanel, wahl: string): void {
  const el = p.q(wahl);
  expect(el, `die Stelle ${wahl} fehlt`).not.toBeNull();
  (el as { click(): void }).click();
}

/** Alle Promise-Ketten des Panels abwarten — der Weg ist eine Kette je Absatz. */
async function ruhe(p: KlaraPanel): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await p.flush();
  }
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

// ================================================================================================
describe("JOB 3281 · Z · eine verspaetete Antwort gehoert dem Lauf, der sie gestellt hat", () => {
  /**
   * Stellt die Lage des Berichts her und gibt den Torwaechter zurueck: Lauf A laeuft, wird
   * abgebrochen, Lauf B laeuft — und A's Antwort steht noch aus.
   */
  async function zweiLaeufe(p: KlaraPanel): Promise<Torwaechter> {
    await p.flush();
    const tor = torwaechter();

    klick(p, "#wv-btn"); // Lauf A
    await ruhe(p);
    expect(tor.gestellt, "Vorbedingung: A fragt den ersten Absatz und wartet").toHaveLength(1);

    klick(p, "#wv-abbrechen"); // A abgebrochen — die Antwort ist damit herrenlos
    await ruhe(p);
    expect(p.text("#wv-stand"), "Vorbedingung: A ist wirklich abgebrochen").toContain(
      "Abgebrochen",
    );

    klick(p, "#wv-btn"); // Lauf B
    await ruhe(p);
    expect(tor.gestellt, "Vorbedingung: B fragt seinerseits den ersten Absatz").toHaveLength(2);

    tor.durchlassen(0); // DIE ALTE ANTWORT VON A TRIFFT EIN
    await ruhe(p);
    return tor;
  }

  it("Z1 · nach der alten Antwort ist der laufende Lauf B weiterhin abbrechbar", async () => {
    const p = starte(dokument());
    const tor = await zweiLaeufe(p);

    // A's Antwort darf B nichts weggenommen haben: „Abbrechen" muss B wirklich stoppen.
    klick(p, "#wv-abbrechen");
    await ruhe(p);
    tor.durchlassen(1); // B's eigene Antwort kommt NACH seinem Abbruch — sie ist jetzt herrenlos
    await ruhe(p);

    // Kein dritter Abruf: B hat nach dem Abbruch keinen weiteren Absatz mehr gefragt.
    // GEGENPROBE ZUM ABBRUCH: liesse man B laufen (Z3), sind es drei.
    expect(tor.gestellt).toHaveLength(2);
    expect(p.text("#wv-stand")).toContain("Abgebrochen");
  });

  it("Z2 · nach der alten Antwort bleibt der Startknopf gesperrt und der Abbruchknopf sichtbar", async () => {
    const p = starte(dokument());
    const tor = await zweiLaeufe(p);

    // B's erster Absatz kommt zurueck — damit zeichnet das Fenster neu, und der Zustand wird
    // sichtbar. Genau hier stand der Startknopf frei, waehrend Klara noch fragte.
    tor.durchlassen(1);
    await ruhe(p);
    expect(tor.gestellt, "Vorbedingung: B fragt den zweiten Absatz, laeuft also noch").toHaveLength(
      3,
    );

    expect(p.q("#wv-btn")?.disabled, "der Startknopf steht frei, obwohl B noch laeuft").toBe(true);
    expect(
      p.q("#wv-abbrechen")?.className,
      "der Abbruchknopf ist weg, obwohl B noch laeuft",
    ).not.toContain("hidden");
  });

  it("Z3 · die alte Antwort taucht weder im Fortschritt noch in der Liste von B auf", async () => {
    const p = starte(dokument());
    const tor = await zweiLaeufe(p);

    // A hatte den ersten Absatz gefragt; B steht noch bei ebendiesem. Waere A's Antwort in B's
    // Stand geflossen, stuende der Fortschritt schon auf Absatz 2 und die Liste haette eine Zeile.
    expect(p.text("#wv-stand")).toContain("Absatz 1 von 3");
    expect(p.text("#wv-liste")).toBe("");

    // Und B laeuft danach unbeirrt zu Ende — der Lauf ist nicht beschaedigt, nur A ist still.
    tor.durchlassen(1);
    await ruhe(p);
    tor.durchlassen(2);
    await ruhe(p);
    tor.durchlassen(3);
    await ruhe(p);
    expect(p.text("#wv-stand")).toContain("3 von 3 Absätzen abgeglichen");
  });
});

// ================================================================================================
describe("JOB 3281 · Z · der Schreiblauf eines fertigen Laufs und der naechste Lauf", () => {
  /** Lauf A vollstaendig durchfahren; sein bestaetigender Schreib-`sync` bleibt haengen. */
  async function aFertigSchreiblaufHaengt(p: KlaraPanel, tor: Torwaechter): Promise<void> {
    klick(p, "#wv-btn");
    await ruhe(p);
    for (let i = 0; i < 3; i += 1) {
      tor.durchlassen(i);
      await ruhe(p);
    }
    expect(tor.gestellt, "Vorbedingung: alle drei Absaetze wurden gefragt").toHaveLength(3);
  }

  it("Z4 · waehrend der Schreiblauf haengt, bietet das Fenster kein „Abbrechen“ mehr an, das nichts tut", async () => {
    // GEMESSEN (08.09., an diesem Stand): der Lauf ist mit dem letzten Absatz zu Ende — `wvSchluss`
    // raeumt `wvLaeuft` —, aber gezeichnet wurde zuletzt MITTEN im Lauf. Im Fenster stand deshalb
    // „Absatz 3 von 3 …" mit sichtbarem Abbruchknopf und gesperrtem Startknopf, waehrend ein Klick
    // auf „Abbrechen" nichts mehr bewirkte (`wvAbbrechen` steigt bei `!wvLaeuft` sofort aus). Ein
    // Knopf, der nichts tut, ist eine Behauptung ueber einen Zustand, den es nicht gibt.
    const buehne = dokument({ haelteSync: 4 });
    const p = starte(buehne);
    await p.flush();
    const tor = torwaechter();
    await aFertigSchreiblaufHaengt(p, tor);
    expect(buehne.syncHaengt(), "Vorbedingung: der Schreiblauf haengt wirklich").toBe(true);

    expect(p.text("#wv-stand"), "der Stand behauptet noch einen laufenden Absatz").not.toContain(
      "Absatz 3 von 3",
    );
    expect(
      p.q("#wv-abbrechen")?.className,
      "der Abbruchknopf steht da, obwohl er nichts mehr abbrechen kann",
    ).toContain("hidden");
    expect(p.q("#wv-btn")?.disabled, "der Startknopf ist gesperrt, obwohl kein Lauf laeuft").toBe(
      false,
    );
  });

  it("Z5 · ein spaet gescheiterter Schreiblauf haengt seinen Fehlersatz nicht dem naechsten Lauf an", async () => {
    // Vier `sync` gehoeren zu Lauf A: zwei beim Lesen, zwei beim Faerben. Der vierte bestaetigt.
    const buehne = dokument({ haelteSync: 4 });
    const p = starte(buehne);
    await p.flush();
    const tor = torwaechter();
    await aFertigSchreiblaufHaengt(p, tor);

    // A ist zu Ende, also laesst sich B starten — waehrend A's Farben noch nicht bestaetigt sind.
    klick(p, "#wv-btn");
    await ruhe(p);
    expect(tor.gestellt, "Vorbedingung: B laeuft wirklich").toHaveLength(4);

    // Jetzt scheitert A's Schreiblauf. Das ist ein Befund ueber A — B hat noch gar nicht
    // geschrieben, und an B's Stand waere der Satz schlicht falsch.
    buehne.syncFreigeben(false);
    await ruhe(p);

    expect(
      p.text("#wv-stand"),
      "A's Schreibfehler steht an B's Stand, obwohl B gar nicht geschrieben hat",
    ).not.toContain("Die Farben konnten nicht ins Dokument geschrieben werden");
  });

  it("Z6 · ein spaet BESTAETIGTER Schreiblauf bleibt zuruecknehmbar, auch wenn schon B laeuft", async () => {
    // Die Gegenrichtung zu Z4, und sie ist genauso Pflicht: was Word wirklich geschrieben hat,
    // MUSS in die Merkliste — sonst stuenden Klaras Farben im Dokument, und „Markierungen
    // entfernen" boete sie nicht mehr an. Der Lauf ist ueberholt, die Farbe im Dokument ist es
    // nicht.
    const buehne = dokument({ haelteSync: 4 });
    const p = starte(buehne);
    await p.flush();
    const tor = torwaechter();
    await aFertigSchreiblaufHaengt(p, tor);

    klick(p, "#wv-btn"); // B laeuft
    await ruhe(p);
    buehne.syncFreigeben(true); // A's Farben sind jetzt wirklich im Dokument
    await ruhe(p);

    expect(buehne.farben(), "A hat gefaerbt — drei Absaetze ohne Fund sind tuerkis").toEqual([
      "Turquoise",
      "Turquoise",
      "Turquoise",
    ]);
    expect(
      p.q("#wv-entfernen")?.className,
      "die Farben stehen im Dokument, aber das Fenster bietet keine Ruecknahme an",
    ).not.toContain("hidden");
  });
});

// ================================================================================================
describe("JOB 3281 · Z7 · der ueberholte Schreiblauf faerbt nicht ueber den fertigen naechsten", () => {
  /**
   * BEN, Pruefung der Runde 3 (08.09.), Korrekturpflicht 1 — der Fall, den Z4–Z6 NICHT trafen.
   *
   * Jene drei halten den BESTAETIGENDEN Schreib-`sync` fest (Nummer 4). Da hat Word Klaras Farben
   * schon entgegengenommen; nachgemessen wird nur noch, wem die Bestaetigung gehoert. Der
   * ungeschuetzte Griff liegt einen `sync` FRUEHER: Nummer 3 laedt die Absaetze FUER das Faerben.
   * Haengt er, laeuft der naechste Vergleich vollstaendig durch und faerbt — und wenn der alte
   * Ladevorgang danach zurueckkommt, schreibt er seine Kategorien ueber die des neuen. Gemessen an
   * diesem Stand (08.09.): das Dokument stand dreimal auf „Turquoise" (Lauf A: kein Fund), waehrend
   * das Fenster dreimal „Ähnlich" auswies (Lauf B: Dublettentreffer). Das Panel behauptete damit
   * eine Farbe, die im Dokument nirgends stand.
   *
   * DIE REGEL: die Laufkennung gilt vor JEDEM Schreibvorgang, auch nach einem verzoegerten `sync`
   * — nicht nur beim Aufraeumen des Zustands. Und was Word einem fertigen Lauf bestaetigt hat,
   * bleibt zuruecknehmbar (die Gegenrichtung aus Z6 gilt hier weiter).
   */
  async function aHaengtVorDemFaerben(
    p: KlaraPanel,
    buehne: WordBuehne,
    tor: Torwaechter,
    lage: { wert: "neu" | "aehnlich" },
  ): Promise<void> {
    klick(p, "#wv-btn"); // Lauf A
    await ruhe(p);
    for (let i = 0; i < 3; i += 1) {
      tor.durchlassen(i);
      await ruhe(p);
    }
    expect(buehne.syncHaengt(), "Vorbedingung: A haengt wirklich vor dem Faerben").toBe(true);
    expect(
      buehne.farben(),
      "Vorbedingung: A hat noch KEINE Farbe geschrieben — sonst traefe der Test einen anderen Fall",
    ).toEqual([null, null, null]);
    lage.wert = "aehnlich"; // ab hier antwortet die Route mit einem Fund: B wird gelb, nicht tuerkis
  }

  async function bVollstaendig(p: KlaraPanel, tor: Torwaechter): Promise<void> {
    klick(p, "#wv-btn"); // Lauf B — A hat seine Fahne beim Abschluss abgegeben
    await ruhe(p);
    for (let i = 3; i < 6; i += 1) {
      tor.durchlassen(i);
      await ruhe(p);
    }
  }

  it("Z7 · A's verspaeteter Schreibbeginn laesst B's Farben und B's Liste unberuehrt", async () => {
    const lage: { wert: "neu" | "aehnlich" } = { wert: "neu" };
    const buehne = dokument({ haelteSync: 3 });
    const p = starteMitLage(buehne, lage);
    await p.flush();
    const tor = torwaechter();

    await aHaengtVorDemFaerben(p, buehne, tor, lage);
    await bVollstaendig(p, tor);

    expect(buehne.farben(), "Vorbedingung: B ist durch und hat gelb gefaerbt").toEqual([
      "Yellow",
      "Yellow",
      "Yellow",
    ]);
    expect(p.text("#wv-liste"), "Vorbedingung: B's Liste steht im Fenster").toContain("Ähnlich");

    // JETZT kommt A's Ladevorgang zurueck — der Lauf ist laengst ueberholt.
    buehne.syncFreigeben(true);
    await ruhe(p);

    expect(
      buehne.farben(),
      "der ueberholte Lauf A hat B's Farben im Dokument ueberschrieben",
    ).toEqual(["Yellow", "Yellow", "Yellow"]);
    expect(
      p.text("#wv-liste"),
      "das Fenster zeigt B's Befund — er muss zur Farbe im Dokument passen",
    ).toContain("Ähnlich");
    expect(p.text("#wv-liste"), "A's Befund ist in B's Liste gewandert").not.toContain(
      "Kein Fund im durchsuchten Bestand",
    );
  });

  it("Z7b · nach dem verspaeteten Schreibbeginn bleiben B's bestaetigte Markierungen zuruecknehmbar", async () => {
    // Die Gegenrichtung, wie in Z6: die Absicherung darf die Ruecknahme nicht mitnehmen. Genau drei
    // Markierungen stehen im Dokument — die von B. A hat keine geschrieben, also merkt er auch keine.
    const lage: { wert: "neu" | "aehnlich" } = { wert: "neu" };
    const buehne = dokument({ haelteSync: 3 });
    const p = starteMitLage(buehne, lage);
    await p.flush();
    const tor = torwaechter();

    await aHaengtVorDemFaerben(p, buehne, tor, lage);
    await bVollstaendig(p, tor);
    buehne.syncFreigeben(true);
    await ruhe(p);

    klick(p, "#wv-entfernen");
    await ruhe(p);

    expect(
      buehne.farben(),
      "die Ruecknahme hat die Ursprungsfarben nicht wiederhergestellt",
    ).toEqual([null, null, null]);
    expect(p.text("#wv-stand")).toContain("3 Markierungen zurückgenommen");
  });
});
