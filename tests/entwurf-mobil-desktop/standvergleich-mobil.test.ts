// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — DER GESEHENE STAND REIST MIT (rein, DOM-frei).
// ================================================================================================
//
// DIE AUSGANGSLAGE (auf main `cedd24de` gemessen): `formToPayload` baute die Nutzlast aus `title`
// und `statement`/`bodyHtml` — an keiner Stelle stand ein gesehener Stand, und `draftToForm` las
// nur `payload` und `anchorsMissing`. Der mobile Aktualisierungsweg konnte den Standvergleich der
// Route (JOB 2684 D1) deshalb gar nicht auslösen: ohne `expectedUpdatedAt` gewinnt der letzte
// Schreiber, und die Desktop-Fassung war still weg.
//
// HIER WIRD DREIERLEI GEPINNT:
//   1. ein FORTGESETZTER Entwurf erzeugt einen Aktualisierungsvorgang, der seinen Stand trägt;
//   2. ein NEU angelegter trägt keinen — auch keinen leeren;
//   3. der Stand steht NICHT in der `DraftPayload` (wörtlich wie in
//      `tests/app/job2684-draft-stale-route.test.ts`: `payload.expectedUpdatedAt` ist `undefined`).
//
// UND VIERTENS die Annahme, auf der die Warteschlange ruht: die reinen Funktionen in
// `lib/offlineQueue.ts` tragen Felder durch, die der Hook an einen Vorgang heftet
// (`seenUpdatedAt`, s. `app/useOfflineQueue.ts`). Sie tun das, weil sie durchweg mit `{ ...q }`
// arbeiten — ohne diesen Pin gälte das zufällig statt zugesichert.
import { describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import {
  abweichendeFelder,
  draftToForm,
  formToPayload,
  formToUpdate,
} from "../../apps/web/src/lib/draftForm";
import {
  type QueuedOp,
  enqueue,
  markFailed,
  markPending,
  markSynced,
  replacePayload,
  reviveInterrupted,
} from "../../apps/web/src/lib/offlineQueue";

const STAND = "2026-09-15T08:00:00.000Z";
const LINK_BODY = '<p><a href="https://klarwerk.de">Hand</a></p><p><strong>A</strong></p>';

function entwurf(payload: Draft["payload"], updatedAt = STAND): Draft {
  return {
    id: "d1",
    payload,
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-15T07:00:00.000Z",
    updatedAt,
  };
}

describe("JOB 4193 · der gesehene Stand reist neben der Nutzlast", () => {
  it("ein FORTGESETZTER Entwurf erzeugt einen Aktualisierungsvorgang mit genau diesem Stand", () => {
    const form = draftToForm(entwurf({ title: "T", statement: "S" }));
    expect(form.gesehenerStand).toBe(STAND);
    expect(formToUpdate(form)).toEqual({
      payload: { title: "T", statement: "S" },
      expectedUpdatedAt: STAND,
    });
  });

  it("derselbe Stand reist auch am Entwurf MIT Body mit — der Bauplan bleibt daneben stehen", () => {
    const form = draftToForm(entwurf({ title: "T", bodyHtml: LINK_BODY }));
    const vorgang = formToUpdate(form);
    expect(vorgang.expectedUpdatedAt).toBe(STAND);
    expect(vorgang.payload).toEqual({ title: "T", bodyHtml: LINK_BODY });
  });

  it("ein NEU angelegter Entwurf trägt KEINEN Stand — auch keinen leeren", () => {
    const vorgang = formToUpdate({ title: "Neu", statement: "Frisch getippt" });
    expect(vorgang).toEqual({ payload: { title: "Neu", statement: "Frisch getippt" } });
    expect("expectedUpdatedAt" in vorgang).toBe(false);
  });

  it("der Stand ist KEIN Entwurfsfeld — er steht nicht in der Nutzlast", () => {
    const form = draftToForm(entwurf({ title: "T", statement: "S" }));
    const payload = formToPayload(form) as Record<string, unknown>;
    expect(payload.expectedUpdatedAt).toBeUndefined();
    expect(payload.gesehenerStand).toBeUndefined();
    expect(Object.keys(payload).sort()).toEqual(["statement", "title"]);
    // Und dieselbe Zusicherung am fertigen Vorgang: der Stand steht NEBEN der Nutzlast.
    const vorgang = formToUpdate(form);
    expect((vorgang.payload as Record<string, unknown>).expectedUpdatedAt).toBeUndefined();
  });

  it("eine Nutzlast OHNE Entwurfsumschlag (offline liegende Fassung) bekommt keinen Stand angedichtet", () => {
    const form = draftToForm({ payload: { title: "T", statement: "S" } });
    expect(form.gesehenerStand).toBeUndefined();
    expect(formToUpdate(form)).toEqual({ payload: { title: "T", statement: "S" } });
  });
});

describe("JOB 4193 · die Feldangabe nennt das Feld, das der Mensch vor sich hat", () => {
  const server = draftToForm(entwurf({ title: "Wartung", statement: "Fassung A" }));

  it("nur die Kernaussage weicht ab", () => {
    expect(abweichendeFelder({ ...server, statement: "Fassung B" }, server)).toEqual(["statement"]);
  });

  it("nur der Titel weicht ab", () => {
    expect(abweichendeFelder({ ...server, title: "Wartung neu" }, server)).toEqual(["title"]);
  });

  it("beide weichen ab — beide werden genannt, in der Reihenfolge der Fläche", () => {
    expect(abweichendeFelder({ ...server, title: "X", statement: "Y" }, server)).toEqual([
      "title",
      "statement",
    ]);
  });

  it("gleicher Stand: nichts wird genannt — ein Vergleich, der nichts findet, schweigt", () => {
    expect(abweichendeFelder({ ...server }, server)).toEqual([]);
  });

  it("nur äussere Leerzeichen sind kein Unterschied (wie `isDraftFormChanged`)", () => {
    expect(abweichendeFelder({ ...server, statement: " Fassung A\n" }, server)).toEqual([]);
  });

  it("am Entwurf MIT Body heisst das Textfeld `body` — nicht die unsichtbare Kernaussage", () => {
    const mitBody = draftToForm(entwurf({ title: "T", statement: "S", bodyHtml: LINK_BODY }));
    expect(abweichendeFelder({ ...mitBody, body: "Etwas anderes" }, mitBody)).toEqual(["body"]);
    // Die gespeicherte Kernaussage ist in dieser Betriebsart nicht sichtbar — eine Abweichung
    // dort wäre eine Aussage über ein Feld, das niemand vor sich hat.
    expect(abweichendeFelder({ ...mitBody, statement: "Andere Aussage" }, mitBody)).toEqual([]);
  });
});

/**
 * Die Gestalt, die der Hook an einen Vorgang heftet (`VorgangMitStand`, app/useOfflineQueue.ts).
 * Sie steht hier AUSGESCHRIEBEN statt importiert, und das ist kein Abschreiben aus Bequemlichkeit:
 * der Wurzel-Typcheck ist Node-rein (`tsconfig.json`: `lib: ["ES2022"]`, `.tsx` ausgeschlossen),
 * und der Hook ist DOM-behaftet (`window`, `navigator.onLine`). Ein Import zöge ihn in einen
 * Prüflauf, der keine DOM-Typen hat. Geprüft wird hier ohnehin die Zusicherung der REINEN
 * Funktionen — dass sie ein fremdes Feld durchtragen —, nicht die Bauform des Hooks.
 */
type VorgangMitStand = QueuedOp & { seenUpdatedAt?: string };

describe("JOB 4193 · die Warteschlange trägt den gehefteten Stand durch", () => {
  const vorgang = (): VorgangMitStand[] =>
    enqueue([], {
      id: "op-1",
      kind: "draft.update",
      draftId: "d1",
      payload: { statement: "Offline" },
      title: "Offline",
      createdAt: "2026-09-15T09:00:00.000Z",
    }).map((q): VorgangMitStand => ({ ...q, seenUpdatedAt: STAND }));

  it("markPending/markSynced/markFailed/replacePayload lassen den Stand stehen", () => {
    const stand = (q: readonly QueuedOp[]): string | undefined =>
      (q[0] as VorgangMitStand | undefined)?.seenUpdatedAt;
    const start = vorgang();
    expect(stand(start)).toBe(STAND);
    expect(stand(markPending(start, "op-1"))).toBe(STAND);
    expect(stand(markSynced(start, "op-1"))).toBe(STAND);
    expect(stand(markFailed(start, "op-1", "x"))).toBe(STAND);
    expect(stand(replacePayload(start, "op-1", { statement: "Neu" }, "Neu"))).toBe(STAND);
    expect(stand(reviveInterrupted(markPending(start, "op-1")))).toBe(STAND);
  });

  it("ein zweites Speichern desselben Entwurfs ersetzt den Vorgang in place — der Stand bleibt am selben Eintrag", () => {
    const zweites = enqueue(vorgang(), {
      id: "op-2",
      kind: "draft.update",
      draftId: "d1",
      payload: { statement: "Offline, zweiter Wurf" },
      title: "Offline",
      createdAt: "2026-09-15T09:05:00.000Z",
    });
    expect(zweites).toHaveLength(1);
    expect(zweites[0]?.id).toBe("op-1");
    expect((zweites[0] as VorgangMitStand | undefined)?.seenUpdatedAt).toBe(STAND);
  });
});
