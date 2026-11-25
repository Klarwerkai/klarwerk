import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const panel = readFileSync("apps/web/public/word-addin/taskpane.js", "utf8");
const vergleich = readFileSync("apps/web/public/word-addin/dokumentvergleich.js", "utf8");
const lesen = panel.slice(
  panel.indexOf("var WORD_ADDIN_AUSWAHL_FRIST_MS"),
  panel.indexOf("// JOB 3056 K1 (Rebase auf KA5)"),
);
const satz = "Guest Wi-Fi must provide access to the internal staff network.";
const marke = { start: 12, end: 24 };

class Bereich {
  constructor(public text: string) {}
  load = vi.fn();
  track = vi.fn();
  untrack = vi.fn();
  select = vi.fn();
  treffer: Bereich[] = [];
  search = vi.fn((phrase: string) => {
    this.treffer = this.text
      .split(phrase)
      .slice(1)
      .map(() => new Bereich(phrase));
    return { load: vi.fn(), items: this.treffer };
  });
}

function wirt(auswahl: Bereich) {
  const bindung = {
    "x-klara-document": "doc-1",
    "x-klara-session": "sess-1",
    "x-klara-instance": "instance-1",
  };
  const context = { document: { getSelection: vi.fn(() => auswahl) }, sync: vi.fn(async () => {}) };
  type Lauf = (ctx: typeof context) => Promise<unknown>;
  const word = {
    run: (objekt: Lauf | Bereich, mitBereich?: Lauf) =>
      typeof objekt === "function" ? objekt(context) : mitBereich?.(context),
  };
  const umgebung = {
    Word: word,
    window: { Word: word },
    officeUsable: () => true,
    klaraS4Header: () => ({ ...bindung }),
    WORD_ADDIN_ASK_MAX_CHARS: 2000,
    askMitlesen: true,
    askErgebnisGeneration: 1,
    setTimeout,
    clearTimeout,
  };
  const api = runInNewContext(
    `${vergleich}
    ${lesen}
    ;({ readAskSelection, askVergleichInWordZeigen, askVergleichHatWordBereich, askVergleichBereichFreigeben })`,
    umgebung,
  ) as {
    readAskSelection: (
      fertig: (text: string, bezug?: string) => void,
      wordZuerst: boolean,
      fehler: (e: Error) => void,
      frage: string,
      signal: AbortSignal,
    ) => void;
    askVergleichInWordZeigen: (text: string, stelle: typeof marke | null) => Promise<boolean>;
    askVergleichHatWordBereich: (text: string) => boolean;
    askVergleichBereichFreigeben: () => void;
  };
  const controller = new AbortController();
  const pruefen = () =>
    new Promise<[string, string | undefined]>((resolve, reject) =>
      api.readAskSelection(
        (text, bezug) => resolve([text, bezug]),
        true,
        reject,
        "Is this correct?",
        controller.signal,
      ),
    );
  return { api, pruefen, bindung, context };
}

describe("Direktvergleich – Auswahl im Word-Host", () => {
  it("wählt die entscheidenden Wörter im ursprünglich geprüften Bereich, auch bei verschobenem Cursor und gleichem Satz", async () => {
    const original = new Bereich(satz);
    const andereStelle = new Bereich(satz);
    const { api, pruefen, context } = wirt(original);
    expect((await pruefen())[0]).toBe(satz);
    context.document.getSelection.mockReturnValue(andereStelle);
    expect(api.askVergleichHatWordBereich(satz)).toBe(true);
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(true);
    expect(original.treffer[0]?.text).toBe("must provide");
    expect(original.treffer[0]?.select).toHaveBeenCalledOnce();
    expect(andereStelle.search).not.toHaveBeenCalled();
    expect(context.document.getSelection).toHaveBeenCalledTimes(1);
    expect(await api.askVergleichInWordZeigen(satz, null)).toBe(true);
    expect(original.select).toHaveBeenCalledOnce();
  });

  it.each(["cursor", "previous"])(
    "bindet den gelesenen Absatz (%s) an seinen Content-Bereich",
    async (bezug) => {
      const original = new Bereich(satz);
      const absatz = { text: satz, getRange: vi.fn(() => original), load: vi.fn() };
      const leer = { text: "", getPreviousOrNullObject: () => absatz };
      const cursor = Object.assign(new Bereich(""), {
        paragraphs: { load: vi.fn(), items: [bezug === "previous" ? leer : absatz] },
      });
      const { api, pruefen } = wirt(cursor);
      expect(await pruefen()).toEqual([satz, bezug]);
      expect(absatz.getRange).toHaveBeenCalledWith("Content");
      expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(true);
      expect(original.treffer[0]?.select).toHaveBeenCalledOnce();
      expect(cursor.select).not.toHaveBeenCalled();
    },
  );

  it("berücksichtigt den genauen Offset bei mehrfach gleichem Text im geprüften Bereich", async () => {
    const original = new Bereich("must provide; must provide");
    const { api, pruefen } = wirt(original);
    await pruefen();
    expect(await api.askVergleichInWordZeigen(original.text, { start: 14, end: 26 })).toBe(true);
    expect(original.treffer[0]?.select).not.toHaveBeenCalled();
    expect(original.treffer[1]?.select).toHaveBeenCalledOnce();
  });

  it("wählt nichts bei editiertem Absatz, Dokumentwechsel oder nach dem Freigeben", async () => {
    const original = new Bereich(satz);
    const { api, pruefen, bindung } = wirt(original);
    await pruefen();
    original.text = satz.replace("must", "should");
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(false);
    original.text = satz;
    bindung["x-klara-document"] = "doc-2";
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(false);
    bindung["x-klara-document"] = "doc-1";
    api.askVergleichBereichFreigeben();
    expect(original.untrack).toHaveBeenCalledOnce();
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(false);
    expect(original.select).not.toHaveBeenCalled();
    expect(original.treffer.every((fund) => fund.select.mock.calls.length === 0)).toBe(true);
  });

  it("wählt bei fehlendem Suchtreffer oder Verwerfen während context.sync keine Ersatzauswahl", async () => {
    const original = new Bereich(satz);
    const { api, pruefen, context } = wirt(original);
    await pruefen();
    original.search.mockReturnValueOnce({ load: vi.fn(), items: [] });
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(false);
    context.sync.mockImplementationOnce(async () => api.askVergleichBereichFreigeben());
    expect(await api.askVergleichInWordZeigen(satz, marke)).toBe(false);
    expect(original.select).not.toHaveBeenCalled();
    expect(original.treffer[0]?.select).not.toHaveBeenCalled();
  });
});

type Korrektur = {
  vorher: string;
  ersatz: string;
  suche: string;
  ort: string;
  nachher: string;
};

const korrekturen = runInNewContext(`${vergleich}
  ;({
    plan(dokument, beleg, status, fassung, passage, outcome) {
      const direktvergleich = askDirektvergleich("widersprochen", dokument,
        [{ text: beleg, quellen: ["quelle"] }], [{ sourceId: "quelle", snippet: beleg }], true, { quelle: 1 });
      return askWortkorrektur({ kind: "answered", direktvergleich, ...outcome },
        [{ id: "quelle", geladen: true, status, version: fassung, passage }]);
    },
    anwenden: wordKorrekturAnwenden
  })`) as {
  plan: (
    alt: string,
    neu: string,
    status: string,
    version: number,
    passage: string,
    outcome?: object,
  ) => Korrektur | null;
  anwenden: (word: object, anker: object, plan: Korrektur, gilt: () => boolean) => Promise<string>;
};

describe("Wortkorrektur aus dem bestätigten Satzbeleg", () => {
  const regel = satz.replace("must provide", "must not provide");
  it.each([
    [satz, regel, "provide", "not ", "Before"],
    [regel, satz, "not ", "", "Replace"],
    [
      "Der Zugang ist hier erlaubt.",
      "Der Zugang ist hier gesperrt.",
      "erlaubt",
      "gesperrt",
      "Replace",
    ],
    [
      "De toegang is hier toegestaan.",
      "De toegang is hier verboden.",
      "toegestaan",
      "verboden",
      "Replace",
    ],
  ])("beschränkt den Eingriff auf die geänderte Stelle in %s", (alt, neu, suche, ersatz, ort) => {
    expect(korrekturen.plan(alt, neu, "validiert", 1, neu)).toMatchObject({
      suche,
      ersatz,
      ort,
      nachher: neu,
    });
  });

  it("bietet nur genau einen bestätigten Beleg und einen eindeutigen Eingriff an", () => {
    expect(korrekturen.plan(satz, regel, "pruefung", 1, regel)).toBeNull();
    expect(korrekturen.plan(satz, regel, "validiert", 2, regel)).toBeNull();
    expect(korrekturen.plan(satz, regel, "validiert", 1, "")).toBeNull();
    expect(korrekturen.plan(satz, regel, "validiert", 1, `${regel} ${regel}`)).toBeNull();
    expect(
      korrekturen.plan(satz, regel, "validiert", 1, regel, { konflikte: ["offen"] }),
    ).toBeNull();
    expect(
      korrekturen.plan(satz, regel, "validiert", 1, regel, { abgeschnitten: true }),
    ).toBeNull();
    const wiederholung = "The users may only only change their own settings.";
    const eindeutig = wiederholung.replace("only only", "only");
    expect(korrekturen.plan(wiederholung, eindeutig, "validiert", 1, eindeutig)).toBeNull();
  });

  it.each(["geaendert", "mehrdeutig", "verworfen"])(
    "schreibt nichts, wenn der gebundene Word-Bereich %s ist",
    async (grund) => {
      const plan = korrekturen.plan(satz, regel, "validiert", 1, regel)!;
      const schreiben = vi.fn();
      const treffer = { text: plan.suche, insertText: schreiben, delete: schreiben };
      const bereich = {
        text: grund === "geaendert" ? `${satz} ` : satz,
        load: vi.fn(),
        search: () => ({
          load: vi.fn(),
          items: grund === "mehrdeutig" ? [treffer, treffer] : [treffer],
        }),
      };
      const anker = { bereich, original: satz, text: satz };
      let gueltig = true;
      const ctx = {
        sync: async () => {
          gueltig = grund !== "verworfen";
        },
      };
      const word = {
        run: (gebunden: object, lauf: (context: typeof ctx) => unknown) => {
          expect(gebunden).toBe(bereich);
          return lauf(ctx);
        },
      };
      expect(await korrekturen.anwenden(word, anker, plan, () => gueltig)).toBe("veraltet");
      expect(schreiben).not.toHaveBeenCalled();
    },
  );
});
