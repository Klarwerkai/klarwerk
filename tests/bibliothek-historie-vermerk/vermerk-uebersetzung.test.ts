// ================================================================================================
// JOB 3627 · DER VERSIONSVERMERK — WAS ÜBERSETZT WIRD UND WAS AUSDRÜCKLICH NICHT.
// ================================================================================================
//
// Der Befund, der diese Datei auslöst, ist am Chromium gemessen (F20 in
// `tests/design/h4-funktionsinventar.test.ts`): die englische Bibliothek las unter „Mehr"
//     History › v1 · 9/11/2026 erstellt
//     Snapshots › … Initial version — no previous diff. erstellt Open version · …
// — das deutsche Wort mitten im englischen Text.
//
// F20 BLEIBT DIE ABNAHME DIESES AUFTRAGS: er misst am echten Browser, dass dort jetzt „created"
// steht. Diese Datei misst die andere Hälfte, die ein Browserfall gar nicht zeigen kann: dass
// FREMDER Text unangetastet bleibt und dass jeder Schlüssel wirklich in allen drei Sprachen liegt.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { koHistoryNote } from "../../apps/web/src/lib/koHistoryNote";
import { alleSprachbestaende } from "../support/i18nBestand";

const SPRACHEN = ["de", "en", "nl"] as const;
const BESTAND = alleSprachbestaende();

/** Die `t` einer Sprache, ohne die Fläche zu bewegen — dieselbe Quelle wie die Oberfläche. */
const uebersetzer = (lng: string): ((key: string) => string) => i18n.getFixedT(lng);

/**
 * DIE GEMESSENE LISTE (Lieferung 1) — jede Stelle, an der der Dienst einen FEST IM CODE stehenden
 * Vermerk in `history[].note` oder in einen Schnappschuss schreibt. Zeile und Wortlaut stammen aus
 * `services/knowledge-object/src/service.ts` am Basisstand 96b0e92 und werden unten gegen den
 * heutigen Quelltext gehalten, damit diese Liste nicht vergammeln kann.
 */
const DIENST_VERMERKE = [
  { wort: "erstellt", schluessel: "ko.historyNote.created", fundstellen: [1816, 1935] },
  {
    wort: "erstellt (Dokumentinhalt übernommen)",
    schluessel: "ko.historyNote.createdFromDocument",
    fundstellen: [2157],
  },
  {
    wort: "erstellt (nachgezogen)",
    schluessel: "ko.historyNote.createdBackfilled",
    fundstellen: [2585],
  },
  { wort: "überarbeitet", schluessel: "ko.historyNote.revised", fundstellen: [3595, 3624] },
  {
    wort: "überarbeitet (Dokumentinhalt übernommen)",
    schluessel: "ko.historyNote.revisedFromDocument",
    fundstellen: [3831, 3849],
  },
] as const;

describe("JOB 3627 · die Liste der festen Dienst-Vermerke ist gemessen, nicht behauptet", () => {
  // KEINE ZWEITE ABSCHRIFT (Lehre JOB 3578 R1): gelesen wird der Quelltext des Dienstes selbst.
  // Führt jemand dort einen neuen festen Vermerk ein, ohne ihn in `koHistoryNote.ts` und in den
  // Katalog nachzutragen, wird dieser Fall rot — und zwar mit dem Wortlaut, der fehlt.
  const quelle = readFileSync("services/knowledge-object/src/service.ts", "utf8");

  /** Jeder feste Vermerk: als `note: "…"`-Feld ODER als drittes Argument von `this.snapshot(…)`. */
  const gefunden = (): string[] => {
    const raus = new Set<string>();
    for (const m of quelle.matchAll(/\bnote: "([^"]*)"/g)) {
      raus.add(m[1] as string);
    }
    for (const m of quelle.matchAll(/this\.snapshot\([^)]*?"([^"]*)"/g)) {
      raus.add(m[1] as string);
    }
    return [...raus].sort();
  };

  it("der Dienst schreibt GENAU die fünf Vermerke, die die Tabelle kennt", () => {
    expect(gefunden()).toEqual([...DIENST_VERMERKE.map((v) => v.wort)].sort());
  });

  it("jede genannte Fundstelle trägt ihren Wortlaut wirklich", () => {
    const zeilen = quelle.split("\n");
    const daneben = DIENST_VERMERKE.flatMap((v) =>
      v.fundstellen
        .filter((nr) => !(zeilen[nr - 1] ?? "").includes(`"${v.wort}"`))
        .map((nr) => `service.ts:${nr} trägt nicht „${v.wort}“, sondern: ${zeilen[nr - 1] ?? "—"}`),
    );
    expect(daneben, "Fundstellen, die nicht mehr stimmen").toEqual([]);
  });

  it("KEIN Schreibweg reicht heute einen MENSCHLICH eingegebenen Vermerk durch", () => {
    // DIE GEGENPROBE ZU LIEFERUNG 1, und sie ist der Grund, warum die offene Grenze in
    // `koHistoryNote.ts` heute nicht erreichbar ist: jeder `this.snapshot(…)`-Aufruf übergibt
    // entweder ein LITERAL oder das `snapshot.note` aus `mutateKoTx` — und dessen EINZIGER
    // Erzeuger (`snapshot: { author, note: … }`) trägt seinerseits ein Literal. Käme dort je ein
    // Wert von aussen an, wäre die Grenze echt, und dieser Fall meldet es.
    const durchgereicht = [...quelle.matchAll(/this\.snapshot\(([^)]*)\)/g)]
      .map((m) => m[1] as string)
      .filter((args) => !args.includes('"'));
    expect(
      durchgereicht.filter((args) => !args.includes("snapshot.note")),
      "this.snapshot(…) mit einem Vermerk, der weder Literal noch das mutateKoTx-Feld ist",
    ).toEqual([]);
    const erzeuger = [...quelle.matchAll(/snapshot: \{[^}]*note: ([^,}]+)/g)].map((m) =>
      (m[1] as string).trim(),
    );
    expect(erzeuger, "die Erzeuger des mutateKoTx-Vermerks — jeder muss ein Literal sein").toEqual([
      '"überarbeitet"',
    ]);
  });
});

describe("JOB 3627 · (a) ein bekannter Vermerk wird zum Katalogtext", () => {
  for (const v of DIENST_VERMERKE) {
    it(`„${v.wort}“ liest sich in de und en verschieden`, () => {
      const de = koHistoryNote(v.wort, uebersetzer("de"));
      const en = koHistoryNote(v.wort, uebersetzer("en"));
      // Die deutsche Lesung bleibt Zeichen für Zeichen das Wort des Dienstes — daran hängen die
      // zwei deutschen Sollwerte in `h4-funktionsinventar.test.ts:825`/`:826-832`.
      expect(de).toBe(v.wort);
      expect(en).not.toBe(de);
      expect(en).not.toBe(v.schluessel);
    });
  }
});

describe("JOB 3627 · (b) fremder Text kommt WÖRTLICH zurück — auch wenn er ähnlich aussieht", () => {
  // DIE VERGLEICHSREGEL IST ZEICHENGENAUE GLEICHHEIT über den ganzen Wert. Kein Trimmen, keine
  // Kleinschreibung, kein Präfix: der Dienst schreibt genau seine Literale, alles andere ist
  // Inhalt eines Menschen und wird nicht angefasst.
  const FREMD = [
    "erstellt am Montag",
    "Erstellt",
    " erstellt ",
    "erstellt.",
    "neu erstellt",
    "überarbeitet nach Rücksprache mit der Konstruktion",
    "Fassung von Pedi geprüft",
    "created",
  ];
  for (const text of FREMD) {
    for (const lng of SPRACHEN) {
      it(`${lng} · „${text}“ bleibt unverändert`, () => {
        expect(koHistoryNote(text, uebersetzer(lng))).toBe(text);
      });
    }
  }
});

describe("JOB 3627 · (c) leer und fehlend kommen leer und fehlend zurück", () => {
  // Die Entscheidung, was dann dasteht, bleibt beim Aufrufer — `MehrAbschnitte.tsx:1238` hat
  // dafür `|| nameOf(h.author)`, und dieses Verhalten hängt an der Falschheit des Rückgabewerts.
  it("der leere Vermerk bleibt leer und bleibt falsch", () => {
    expect(koHistoryNote("", uebersetzer("en"))).toBe("");
    expect(koHistoryNote("", uebersetzer("en")) || "Autor").toBe("Autor");
  });

  it("null und undefined kommen unverändert zurück", () => {
    expect(koHistoryNote(null, uebersetzer("en"))).toBeNull();
    expect(koHistoryNote(undefined, uebersetzer("en"))).toBeUndefined();
  });
});

describe("JOB 3627 · (d) jeder Katalogschlüssel liegt wirklich in de, en und nl", () => {
  for (const v of DIENST_VERMERKE) {
    it(`${v.schluessel} steht in allen drei Blöcken`, () => {
      const fehlend = SPRACHEN.filter((lng) => typeof BESTAND[lng]?.[v.schluessel] !== "string");
      expect(fehlend, `Sprachen ohne Eintrag für ${v.schluessel}`).toEqual([]);
    });

    it(`${v.schluessel} lautet in en NICHT wie in de`, () => {
      // Ein fehlender englischer Eintrag fiele über `fallbackLng: "de"` auf das deutsche Wort
      // zurück — genau der Rückfall, den dieser Auftrag behebt. Er sähe ohne diesen Satz aus wie
      // eine Übersetzung.
      const de = BESTAND.de?.[v.schluessel] as string;
      const en = BESTAND.en?.[v.schluessel] as string;
      const nl = BESTAND.nl?.[v.schluessel] as string;
      expect(de).toBe(v.wort);
      expect(en).not.toBe(de);
      expect(nl).not.toBe(de);
      expect(en.length, `${v.schluessel} ist in en leer`).toBeGreaterThan(0);
      expect(nl.length, `${v.schluessel} ist in nl leer`).toBeGreaterThan(0);
    });
  }
});
