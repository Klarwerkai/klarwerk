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
