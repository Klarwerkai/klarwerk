// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · FALL 1 — DIE BILANZ NENNT DEN LAUF, DEN SIE GERADE GEFAHREN HAT.
// ================================================================================================
//
// DER BEFUND, WÖRTLICH (`gespraech/advisor-freitag/abnahme/CODEX-LIVE-3288-20260908.md:36`, nach
// einem echten Selektivimport auf 1.201): „Eine konkrete Laufkennung wird weiterhin nicht sichtbar
// angeboten; Uhrzeit und Ergebniszähler funktionieren jetzt praktisch."
//
// Der Server schickt die Kennung längst mit (`confluence-import-routes.ts`, Apply-Route:
// `...(uebernahmelauf !== null ? { importId: uebernahmelauf } : {})`). Verloren ging sie im
// Client: `ImportApplyResponse` kannte das Feld nicht, die Bilanzfläche zeigte es nicht. Dieser
// Fall misst beide Glieder auf einmal — an der echten Komponente, am echten DOM.
//
// DIE ANTWORT IST GENAU DER LIVE-AUSGANG aus `:31` (0 importiert, 1 bereits in Prüfung); die
// Kennung `run-4711` ist die einzige erfundene Zutat, und sie ist erfunden, weil eine echte
// `randomUUID` nichts zusätzlich belegte.
//
// ARIA-HIDDEN: Teilbäume mit `aria-hidden="true"` werden NICHT mitgelesen (Begründung im Kopf von
// `buehne.tsx`). Dieser Auftrag sichert zu, dass Pedi die Kennung vorlesen und abschreiben kann —
// nicht, dass sie im DOM steht. Ein `pageText()` über den ganzen Baum bewiese das Zweite und
// behauptete das Erste (Lehre JOB 3258, 08.09.).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn() } } },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({ useImportRun: vi.fn() }));

import { useImportRun } from "../../apps/web/src/api/hooks";
import i18n from "../../apps/web/src/i18n";
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

const KENNUNG = "run-4711";

/** Klassen, die genau diesen Wert unbrauchbar machen würden: ein halb gezeigter Wert ist keiner. */
const ABSCHNEIDENDE_KLASSEN = ["truncate", "text-ellipsis", "overflow-hidden", "line-clamp"];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  uebernahmeDoppel().mockResolvedValue(uebernahmeAntwort(KENNUNG));
  laufAntwortStellen({ data: laufakte(), isError: false, isFetching: false, isPaused: false });
});

afterEach(async () => {
  await abbauen();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3357 · L1+L2+L3 — die Kennung kommt an, steht da und trägt ihren Ausgang", () => {
  it("A1 · die Kennung des Laufs steht SICHTBAR in der Bilanz", async () => {
    await bisZurBilanz(1);
    // Vor dieser Runde stand `run-4711` nirgends: der Typ kannte das Feld nicht, die Fläche
    // rendert es nicht. Das ist die Rot-Bedingung dieses Falls.
    expect(sichtbarerText(), `sichtbar: ${sichtbarerText()}`).toContain(KENNUNG);
  });

  it("A2 · sie steht als eigener Wert da — vollständig, nicht abgeschnitten, mit Etikett", async () => {
    await bisZurBilanz(1);
    const knoten = kennungsKnoten();
    expect(knoten).toHaveLength(1);
    const knopf = knoten[0] as HTMLElement;
    expect({
      // Der Knoten trägt den GANZEN Wert — kein Präfix, keine Ellipse.
      wortlaut: (knopf.textContent ?? "").trim(),
      // Und er trägt keine Klasse, die ihn im Bild beschneiden würde. jsdom rechnet kein Layout;
      // deshalb wird hier die Regel geprüft, die die Wirkung erzeugt, nicht die Wirkung selbst.
      abschneidend: ABSCHNEIDENDE_KLASSEN.filter((k) =>
        (knopf.getAttribute("class") ?? "").split(/\s+/).includes(k),
      ),
      // Ein nackter Wert ohne Etikett wäre eine Zeichenfolge, keine Auskunft.
      etikettDaneben: sichtbarerText().includes(i18n.t("imp.groups.runIdLabel")),
    }).toEqual({ wortlaut: KENNUNG, abschneidend: [], etikettDaneben: true });
  });

  it("A3 · der Ausgang steht daneben — aus der Laufakte, über den BESTEHENDEN Lesehaken", async () => {
    await bisZurBilanz(1);
    // Der Haken wird mit GENAU dieser Kennung gerufen — das ist die Naht zwischen Apply-Antwort
    // und Laufakte. Ohne sie stünde die Kennung da und der Ausgang käme von irgendwoher.
    expect(useImportRun).toHaveBeenCalledWith(KENNUNG);
    const text = sichtbarerText();
    expect({
      status: text.includes(i18n.t("w2.run.status.COMPLETED")),
      // Die Zähler mit DEMSELBEN Satz wie in `Stufe2.tsx` (`w2.run.progress`) — ein zweites
      // Vokabular für dieselbe Sache müsste Pedi zweimal lernen.
      zaehler: text.includes(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })),
    }).toEqual({ status: true, zaehler: true });
  });

  it("A4 · auf Englisch dasselbe — die Vorführung läuft auf Englisch", async () => {
    await i18n.changeLanguage("en");
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      kennung: text.includes(KENNUNG),
      etikett: text.includes(i18n.t("imp.groups.runIdLabel")),
      etikettIstEnglisch: i18n.t("imp.groups.runIdLabel") !== "imp.groups.runIdLabel",
      status: text.includes("Completed"),
    }).toEqual({ kennung: true, etikett: true, etikettIstEnglisch: true, status: true });
  });

  it("A6 · der Typ TRÄGT das Feld — und zwar optional, ohne Ersatzwert", () => {
    // EHRLICH BENANNTE GRENZE: Die bindende Kraft hat hier der Typprüfer, nicht dieser Fall.
    // Nimmt man `importId` aus `ImportApplyResponse` heraus, meldet `apps/web && tsc --noEmit`
    // drei Fehler in `ImportGroups.tsx` und `tools/check` wird rot — Vitest dagegen bliebe grün,
    // weil esbuild Typen nur entfernt und nicht prüft. Damit ein SICHTBARER Fall kippt und nicht
    // nur ein Schritt des Tors, steht die Erklärung hier als zweite Spur.
    const typen = readFileSync(resolve(process.cwd(), "apps/web/src/api/types.ts"), "utf8");
    const anfang = typen.indexOf("export interface ImportApplyResponse");
    // Bis zur schliessenden Klammer AM ZEILENANFANG — `failed: { … }[]` trägt selbst eine, und
    // ein Schnitt an der ersten Klammer endete vor dem Feld, um das es geht.
    const block = typen.slice(anfang, typen.indexOf("\n}", anfang));
    expect(
      block.length,
      "die Erhebung greift nicht — alles darunter wäre leer-grün",
    ).toBeGreaterThan(100);
    expect({
      // Optional, weil der Server sie nur bei einem wirklich geführten Lauf sendet.
      optional: /\n\s*importId\?: string;/.test(block),
      // Und nicht als Pflichtfeld mit Ersatzwert — das wäre genau der Platzhalter, den der
      // Serverkommentar ausschließt.
      keinPflichtfeld: !/\n\s*importId: string;/.test(block),
    }).toEqual({ optional: true, keinPflichtfeld: true });
  });

  it("A5 · KEIN ZWEITER WEG: die Fläche ruft den vorhandenen Haken, nicht einen eigenen Abruf", () => {
    // Auftrag §7: kein eigener `fetch` auf `/api/admin/import/runs/:importId`, kein zweiter
    // Lauf-Renderer. Am Quelltext geprüft, weil ein DOM-Fall einen zusätzlichen Abrufweg nicht
    // sichtbar macht, solange er dasselbe anzeigt.
    const quelle = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ImportGroups.tsx"),
      "utf8",
    );
    expect({
      benutztDenHaken: quelle.includes('from "../api/hooks"'),
      keinEigenerAbruf: !quelle.includes("/api/admin/import/runs"),
      keinRohesFetch: !/\bfetch\(/.test(quelle),
      // Der bestehende Zustandsrenderer wird BENUTZT, nicht nachgebaut.
      benutztDenBestehendenRenderer: quelle.includes("RunStateBanner"),
      // Und die dokumentierte Entscheidung von mega9 E-5 bleibt: kein QueryClient in dieser Fläche.
      keinQueryClient: !quelle.includes("useQueryClient"),
    }).toEqual({
      benutztDenHaken: true,
      keinEigenerAbruf: true,
      keinRohesFetch: true,
      benutztDenBestehendenRenderer: true,
      keinQueryClient: true,
    });
  });
});
