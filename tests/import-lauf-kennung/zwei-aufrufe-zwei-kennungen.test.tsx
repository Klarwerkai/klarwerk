// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · FALL 2 — ZWEI AUFRUFE SIND ZWEI LÄUFE, UND BEIDE WERDEN GENANNT.
// ================================================================================================
//
// DIE HALBHEIT, GEGEN DIE DIESER FALL STEHT (Auftrag §8.4): die Kennung „des" Laufs anzuzeigen, als
// gäbe es je Bilanz genau einen. `runApply` schneidet die Auswahl in Stapel zu je
// `APPLY_BATCH_SIZE` (= 10, `lib/importGroups.ts`) und ruft die Übernahme je Stapel EINMAL auf —
// der Server legt dabei je Aufruf einen EIGENEN Lauf an. Elf Kandidaten sind deshalb zwei Läufe,
// und eine Fläche, die nur den ersten (oder nur den letzten) nennt, verschweigt einen echten
// Vorgang. Zusammenfassen kann man sie nicht: es sind verschiedene Läufe mit verschiedenen Akten.
//
// ELF, NICHT ZWANZIG: die kleinste Zahl, die die Stapelgrenze wirklich überschreitet. Wäre die
// Grenze eines Tages eine andere, müsste dieser Fall es merken — deshalb steht sie unten nicht als
// Zahl, sondern kommt aus derselben Konstante wie das Produkt.
//
// ARIA-HIDDEN: nicht mitgelesen, aus dem im Kopf von `buehne.tsx` genannten Grund.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn() } } },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({ useImportRun: vi.fn() }));

import { useImportRun } from "../../apps/web/src/api/hooks";
import i18n from "../../apps/web/src/i18n";
import { APPLY_BATCH_SIZE } from "../../apps/web/src/lib/importGroups";
import {
  abbauen,
  bisZurBilanz,
  kennungsKnoten,
  laufAntwortStellen,
  laufakte,
  sichtbarerText,
  uebernahmeAntwort,
  uebernahmeDoppel,
} from "./buehne";

const ERSTER = "run-a1-erster";
const ZWEITER = "run-b2-zweiter";
const KANDIDATEN = APPLY_BATCH_SIZE + 1;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  uebernahmeDoppel()
    .mockResolvedValueOnce(uebernahmeAntwort(ERSTER))
    .mockResolvedValueOnce(uebernahmeAntwort(ZWEITER));
  // Die Laufakte gehört zum ZULETZT genannten Lauf (Auftrag §5.3) — hier also zum zweiten.
  laufAntwortStellen({
    data: laufakte({ importId: ZWEITER }),
    isError: false,
    isFetching: false,
    isPaused: false,
  });
});

afterEach(async () => {
  await abbauen();
  vi.clearAllMocks();
});

describe("JOB 3357 · L2 — jede zurückgegebene Kennung steht da, in Aufrufreihenfolge", () => {
  it("B1 · der Durchlauf ruft die Übernahme wirklich zweimal auf (sonst prüfte B2 nichts)", async () => {
    await bisZurBilanz(KANDIDATEN);
    expect(uebernahmeDoppel()).toHaveBeenCalledTimes(2);
  });

  it("B2 · BEIDE Kennungen stehen sichtbar da — keine Zusammenfassung zu einer", async () => {
    await bisZurBilanz(KANDIDATEN);
    const text = sichtbarerText();
    expect({
      ersterSichtbar: text.includes(ERSTER),
      zweiterSichtbar: text.includes(ZWEITER),
      anzahlKennungen: kennungsKnoten().length,
    }).toEqual({ ersterSichtbar: true, zweiterSichtbar: true, anzahlKennungen: 2 });
  });

  it("B3 · sie stehen in AUFRUFREIHENFOLGE — erster Stapel zuerst", async () => {
    await bisZurBilanz(KANDIDATEN);
    const text = sichtbarerText();
    const wortlaute = kennungsKnoten().map((k) => (k.textContent ?? "").trim());
    expect({
      wortlaute,
      // Zweite, unabhängige Messung derselben Aussage am reinen Text: der erste Aufruf steht
      // WEITER OBEN. Eine Liste, die von hinten füllt, kippt hier.
      ersterStehtVorZweitem: text.indexOf(ERSTER) < text.indexOf(ZWEITER),
    }).toEqual({ wortlaute: [ERSTER, ZWEITER], ersterStehtVorZweitem: true });
  });

  it("B4 · der Ausgang wird für den ZULETZT gelaufenen geholt — nicht zweimal, nicht für den ersten", async () => {
    await bisZurBilanz(KANDIDATEN);
    // Auftrag §5.3: die Laufakte gehört zur letzten Kennung. Der Haken darf mit keiner anderen
    // gerufen werden — sonst stünde unter zwei Kennungen der Ausgang einer dritten Sache.
    const kennungen = (useImportRun as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => c[0],
    );
    expect(new Set(kennungen)).toEqual(new Set([ZWEITER]));
  });
});
