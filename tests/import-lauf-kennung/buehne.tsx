// ================================================================================================
// JOB 3357 · DIE GEMEINSAME BÜHNE DER VIER FÄLLE — EIN AUFBAU, KEIN ZWEITER.
// ================================================================================================
//
// Die vier Fälle dieses Auftrags messen dieselbe Fläche (`ImportGroups`) im selben Ablauf
// (gruppieren → übernehmen → Bilanz) und unterscheiden sich nur in den zwei Antworten, die sie
// stellen: die Übernahme-Antwort und der Laufakten-Haken. Genau diese zwei bleiben deshalb in der
// Hand des einzelnen Falls; alles andere — Mounten, Klicken, Abbauen, Lesen — steht hier einmal.
// (Lehre JOB 3258, 08.09.: genau EIN Bühnenaufbau, kein zweiter `createRoot`.)
//
// ------------------------------------------------------------------------------------------------
// WAS „SICHTBAR" IN DIESEN FÄLLEN HEISST — und warum `textContent` dafür nicht genügt
// ------------------------------------------------------------------------------------------------
//
// `container.textContent` liest den GANZEN Baum: auch `aria-hidden`-Teilbäume, auch `sr-only`,
// auch `hidden`. Eine Kennung, die nur dort steht, kann Pedi weder vorlesen noch abschreiben — der
// Zweck dieses Auftrags (§8.1: „vorlesen und wiederfinden") wäre verfehlt und der Fall trotzdem
// grün. Deshalb liest `sichtbarerText()` ausdrücklich:
//
//   · KEINE Attribute — `title=`, `aria-label=`, `data-*` tragen nichts zum sichtbaren Text bei;
//   · KEINE `aria-hidden="true"`-Teilbäume — sie sind für die Vorlesehilfe unsichtbar, und ein
//     Wert, den der Screenreader nicht nennt, ist kein angebotener Wert;
//   · KEINE `sr-only`/`hidden`/`display:none`/`visibility:hidden`-Knoten.
//
// Das ist die Antwort auf die im Auftrag §6 verlangte Ansage: aria-hidden-Teilbäume werden NICHT
// mitgelesen, und zwar weil dieser Auftrag Sichtbarkeit zusichert, nicht Vorhandensein. Die
// Gegenprobe G5 (Kennung nur in `title=` oder unter `aria-hidden`) kippt genau daran.
//
// WAS DIESE BÜHNE NICHT PRÜFT, und das gehört an dieselbe Stelle wie die Zusicherung: echte
// Layoutwirkung. jsdom rechnet kein Layout; eine Kennung, die durch eine CSS-Regel aus dem Bild
// geschoben wird, sähe hier sichtbar aus. Gegen die eine Layoutregel, die diesen Wert praktisch
// unbrauchbar machen würde (Abschneiden), prüft `bilanz-zeigt-die-laufkennung.test.tsx` deshalb
// zusätzlich die Klassen des Knotens selbst.
import type { Mock } from "vitest";
import type { ReactElement } from "../../apps/web/node_modules/react";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { useImportRun } from "../../apps/web/src/api/hooks";
import type {
  ImportApplyResponse,
  ImportGroupResponse,
  ImportRunRecord,
} from "../../apps/web/src/api/types";
import { ImportGroups } from "../../apps/web/src/components/ImportGroups";
import i18n from "../../apps/web/src/i18n";
import { IMPORT_GROUPS_TEXT } from "../../apps/web/src/lib/importGroups";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die zwei ersetzten Endpunkte und der ersetzte Lesehaken — als Doppelgänger, nicht als Nachbau. */
export const gruppeDoppel = (): Mock => endpoints.admin.import.group as unknown as Mock;
export const uebernahmeDoppel = (): Mock => endpoints.admin.import.apply as unknown as Mock;
export const laufDoppel = (): Mock => useImportRun as unknown as Mock;

/** Was `useImportRun` der Fläche liefert — genau die Felder, die die Fläche liest. */
export interface LaufZustand {
  // Ausdrücklich `| undefined`: „noch nichts gelesen" ist ein eigener Zustand dieses Hakens und
  // wird in den Fällen benannt gesetzt, nicht durch Weglassen angedeutet (`exactOptionalPropertyTypes`).
  data: ImportRunRecord | undefined;
  isError: boolean;
  isFetching: boolean;
  // AUSGESETZT: react-query hält eine Abfrage ohne Verbindung an (`fetchStatus: "paused"`) — ohne
  // `isError`, ohne `isFetching`. Dieses Feld ist PFLICHT und hat bewusst keinen Vorgabewert: ein
  // Doppelgänger, der es weglassen dürfte, hätte in Runde 1 genau den Zustand verschwiegen, den der
  // Prüfer dann am echten `QueryClient` fand. Wie nah dieser Doppelgänger am echten Haken liegt,
  // misst `laufakte-offline-pausiert.test.tsx` — dort ohne jeden Doppelgänger.
  isPaused: boolean;
}

/** Der Laufakten-Haken antwortet ab jetzt so. Vor jedem Mounten zu setzen. */
export function laufAntwortStellen(zustand: LaufZustand): void {
  laufDoppel().mockReturnValue(zustand);
}

/**
 * Ein abgeschlossener Lauf, wie ihn `GET /api/admin/import/runs/:importId` liefert.
 * Die Zähler sind die des Live-Falls aus `CODEX-LIVE-3288-20260908.md:31` (eine Seite, bereits in
 * Prüfung): ein GÜLTIGER Lauf ohne neu Angelegtes — kein Fehler.
 */
export function laufakte(teil: Partial<ImportRunRecord> = {}): ImportRunRecord {
  return {
    importId: "run-4711",
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "DEMO",
    requestedSourceVersion: null,
    status: "COMPLETED",
    sourceRecordId: null,
    startedAt: "2026-09-08T18:44:00.000Z",
    completedAt: "2026-09-08T18:52:00.000Z",
    failureCode: null,
    failureReason: null,
    counters: { itemsTotal: 1, itemsCreated: 0, itemsBound: 1, itemsSkipped: 0, itemsFailed: 0 },
    ...teil,
  };
}

/** Die Antwort der Übernahme — genau der Live-Ausgang, `importId` je Fall gesetzt oder fehlend. */
export function uebernahmeAntwort(importId?: string): ImportApplyResponse {
  return {
    imported: 0,
    updates: 0,
    alreadyQueued: 1,
    failed: [],
    notFound: [],
    ...(importId !== undefined ? { importId } : {}),
  };
}

/** Eine Gruppierung über `anzahl` frische Kandidaten — alle vorab ausgewählt (nichts abgewählt). */
export function gruppenAntwort(anzahl: number): ImportGroupResponse {
  const candidates = Array.from({ length: anzahl }, (_, i) => ({
    id: `kand-${i + 1}`,
    title: `Demoseite ${i + 1}`,
    alreadyImported: false,
    alreadyQueued: false,
    sourceNewer: false,
    hints: [],
  }));
  return {
    groups: [{ title: "Demo", ids: candidates.map((c) => c.id) }],
    candidates,
    demo: true,
    fallbackReason: "no-model",
    snapshotToken: 7,
  };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const durchatmen = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Die gemountete Fläche. Wirft, statt still `null` zu liefern — ein leerer Baum beweist nichts. */
export function flaeche(): HTMLDivElement {
  if (container === null) {
    throw new Error("Die Bühne steht nicht — `bisZurBilanz()` fehlt.");
  }
  return container;
}

/**
 * Eine Hülle um die Fläche, für Fälle, die einen Kontext brauchen (der Offline-Fall stellt hier
 * seinen ECHTEN `QueryClientProvider` hinein). Bewusst als Parameter DIESER Bühne und nicht als
 * zweiter Aufbau daneben: es bleibt bei genau einem `createRoot`, einem Klickweg und einem
 * Textleser — sonst driften die Fälle auseinander (Lehre JOB 3258).
 */
export type Huelle = (kind: ReactElement) => ReactElement;

export function mounten(anzahl: number, huelle?: Huelle): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const flaechenElement = createElement(ImportGroups, {
    criteria: {},
    selectedCandidateIds: Array.from({ length: anzahl }, (_, i) => `kand-${i + 1}`),
  } as never);
  act(() => {
    root?.render(huelle ? huelle(flaechenElement) : flaechenElement);
  });
}

export async function abbauen(): Promise<void> {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  }
}

/** Klickt den Knopf, dessen Beschriftung diesen Text trägt — über i18n, nicht über eine Klasse. */
export async function klicken(beschriftung: string): Promise<void> {
  const knopf = [...flaeche().querySelectorAll("button")].find((k) =>
    (k.textContent ?? "").includes(beschriftung),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${beschriftung}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  await act(async () => {
    knopf.click();
    await durchatmen();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(durchatmen);
  }
}

/**
 * Der ganze Weg bis zur Bilanz: gruppieren, alles freigeben (Vorgabe), übernehmen.
 * Die Übernahme-Antwort und der Laufakten-Haken stehen VORHER im jeweiligen Fall.
 */
export async function bisZurBilanz(anzahl = 1, huelle?: Huelle): Promise<void> {
  gruppeDoppel().mockResolvedValue(gruppenAntwort(anzahl));
  mounten(anzahl, huelle);
  await klicken(i18n.t(IMPORT_GROUPS_TEXT.cta));
  await klicken(i18n.t(IMPORT_GROUPS_TEXT.applyCta, { n: anzahl }));
}

function istVerborgen(el: Element): boolean {
  if (el.hasAttribute("hidden")) {
    return true;
  }
  if (el.getAttribute("aria-hidden") === "true") {
    return true;
  }
  const klassen = el.getAttribute("class") ?? "";
  if (/(^|\s)(sr-only|hidden|invisible)(\s|$)/.test(klassen)) {
    return true;
  }
  const stil = el.getAttribute("style") ?? "";
  return /display\s*:\s*none/.test(stil) || /visibility\s*:\s*hidden/.test(stil);
}

/**
 * Der Text, den ein Mensch (und eine Vorlesehilfe) wirklich bekommt. Siehe Kopf dieser Datei.
 *
 * Geschwisterknoten werden mit einem LEERZEICHEN verbunden, nicht stumpf aneinandergehängt: zwei
 * getrennte Knoten sind auf dem Schirm zwei getrennte Wörter. Ohne diese Fuge verschmölze eine
 * Überschrift mit dem Wert darunter zu einer Zeichenkette, und ein Fall, der ein alleinstehendes
 * „—" sucht, fände es nicht mehr — er wäre still schwächer geworden.
 */
export function sichtbarerTextVon(wurzel: Element): string {
  const teile: string[] = [];
  for (const kind of [...wurzel.childNodes]) {
    if (kind.nodeType === Node.TEXT_NODE) {
      teile.push(kind.nodeValue ?? "");
    } else if (kind.nodeType === Node.ELEMENT_NODE && !istVerborgen(kind as Element)) {
      teile.push(sichtbarerTextVon(kind as Element));
    }
  }
  return teile.join(" ");
}

export function sichtbarerText(): string {
  return sichtbarerTextVon(flaeche());
}

/** Alle sichtbaren Kennungs-Knoten der Bilanz, in DOM-Reihenfolge (= Aufrufreihenfolge). */
export function kennungsKnoten(): HTMLElement[] {
  return [...flaeche().querySelectorAll("[data-testid=imp-groups-run-id]")].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}
