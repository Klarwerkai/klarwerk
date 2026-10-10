// @vitest-environment jsdom
// ================================================================================================
// R-0017 / R-0020 / R-0156 · LAUF 6 — DER GEMEINSAME SPEICHERWEG AN DER VOLLSTÄNDIGEN SEITE.
// ================================================================================================
//
// DER BEFUND (bens B5/B6, Lauf 5 Runde 3): `saveDraft.onSuccess` rief den Blatt-Rückruf
// `onEntwurfInsBlatt` schon nach dem FORMULAR-Anteil. Das Blatt wechselte daraufhin die Ansicht und
// baute den Arbeitsraum ab, während `manuellSichern` den Datei-Anteil noch schrieb. Scheiterte der,
// waren Dateiname, eingelesener Text und Wiederholzustand fort; gelang er, stand seine Quittung in
// einem Arbeitsraum, den es nicht mehr gab. Die bisherigen Fälle dieses Ordners montierten den
// Arbeitsraum OHNE Blatt und sahen den Übergang nicht.
//
// DIESE DATEI MONTIERT DESHALB DIE GANZE SEITE (`Capture` mit dem echten `Blatt` und dessen
// produktivem Rückruf, `huelle.tsx` `mount(…, ganzeSeite)`) und misst:
//   B1  Formular + Datei, Upload angehalten, zweiter Druck währenddessen: der Arbeitsraum steht
//       noch, kein zweites Update, kein zweiter Upload, keine vorzeitige Datei-Anlage. Nach der
//       Freigabe: genau ein Ganzdokument-Entwurf mit dem bekannten Dateitext und der Original-
//       referenz, der Formularentwurf mit dem bekannten Titel — und erst JETZT wechselt das Blatt.
//       Eine frisch montierte Seite (Reload) findet beide Inhalte über den Server wieder.
//   B2  Formular + Datei, Upload UND Datei-Anlage scheitern: der Arbeitsraum bleibt stehen, Dateiname
//       und Text sind noch da, nichts behauptet „gesichert". Der zweite Druck sichert genau diese
//       Datei (ein Entwurf) und wechselt erst dann ins Blatt.
//
// RUNDE 2 (bens B7): beide Fälle messen zusätzlich die ERFOLGSMELDUNG. Solange die Datei aussteht
// oder gescheitert ist, steht KEIN grüner Satz „Entwurf aktualisiert." (weder Toast noch Hinweis),
// sondern der ausdrückliche Teilerfolg (`capture-teilerfolg`, `data-lage`). Der grüne Satz erscheint
// erst, wenn auch die Datei gesichert ist.
//
// WAS DIESE DATEI NICHT BEWEIST: jsdom gegen die Attrappen des Ordners, keine echte HTTP-Grenze,
// keine Datenbank, kein Browser. Die Browser-/PostgreSQL-Messung steht in
// `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts` (Q2).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  draftsCreate,
  draftsUpdate,
  kennungJeTitel,
  lasseCreateScheiternFuer,
  lasseNaechstenUploadScheitern,
  nutzlastJeTitel,
  objectsUpload,
  server,
  uploadBremse,
} from "./attrappen";
import {
  ENTWURF_ID,
  abbauen,
  dateiAblegen,
  feld,
  flaeche,
  flush,
  grundzustand,
  klick,
  mount,
  tippe,
} from "./huelle";

const FORMULARTITEL = "Lauf6 Formular 4711";
const DATEITEXT = "Lauf6 Dateitext 4711, unabhängig bekannt.";
const DATEI = "lauf6-4711.txt";
// Der Ganzdokument-Weg bildet den Titel aus dem Dateinamen ohne Endung, Bindestrich als Leerzeichen.
const DATEITITEL = "lauf6 4711";

beforeEach(async () => {
  await grundzustand();
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  abbauen();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function knopfGenau(text: string): HTMLButtonElement {
  const b = [...flaeche().querySelectorAll("button")].find(
    (x) => x.textContent?.replace(/\s+/g, " ").trim() === text,
  );
  if (!b) {
    throw new Error(`Knopf „${text}" nicht gefunden`);
  }
  return b;
}

async function weg(schluessel: string): Promise<void> {
  await klick(flaeche().querySelector('[data-testid="blatt-werkzeug-datei"]') as HTMLElement);
  await klick(knopfGenau(String(i18n.t(schluessel))));
}

/** Alle GRÜNEN Meldungen der Seite — Toasts und Hinweiskasten, beide mit `bg-trust-pos-bg`. */
function grueneMeldungen(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".bg-trust-pos-bg")].map(
    (el) => el.textContent ?? "",
  );
}

function entwurfErfolgGruen(): boolean {
  const satz = String(i18n.t("capture.draftUpdated"));
  return grueneMeldungen().some((m) => m.includes(satz));
}

/** Die Lage des sichtbaren Teilerfolgs, `null`, wenn keiner dasteht. */
function teilerfolgLage(): string | null {
  return (
    document.querySelector<HTMLElement>('[data-testid="capture-teilerfolg"]')?.dataset.lage ?? null
  );
}

function arbeitsraumSteht(): boolean {
  return flaeche().querySelector('[data-testid="blatt-arbeitsraum"]') !== null;
}

/** Was auf der Fläche steht — Text UND Feldwerte (Titel, eingelesener Dateitext stehen in Feldern). */
function stand(): string {
  const werte = [
    ...flaeche().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
  ].map((el) => el.value);
  return [flaeche().textContent ?? "", ...werte].join("\n");
}

function blattTitel(): string {
  return flaeche().querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value ?? "";
}

/** Geöffneter Entwurf, Titel im Formular geändert, danach im Dateiweg eine Datei geladen. */
async function formularUndDatei(): Promise<void> {
  await mount(`/erfassen?draft=${ENTWURF_ID}`, undefined, false, true);
  await weg("erfassen.weg.formular");
  await tippe(feld(String(i18n.t("capture.wizard.titleLabel"))), FORMULARTITEL);
  await weg("erfassen.weg.datei");
  await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
  expect(arbeitsraumSteht()).toBe(true);
  expect(flaeche().textContent).toContain(DATEI);
}

describe("R-0017/R-0020/R-0156 · gemeinsamer Speicherweg an der ganzen Seite (Blatt)", () => {
  it("B1: angehaltener Upload + zweiter Druck — ein Bestand je Inhalt, Blattwechsel erst nach der Datei, Reload findet beides", async () => {
    await formularUndDatei();
    uploadBremse.halte();
    const speichern = knopfGenau(String(i18n.t("capture.saveDraft")));
    await act(async () => {
      speichern.click();
      await flush();
    });
    // Formular geschrieben, Upload hängt: der Arbeitsraum mit der Datei steht NOCH.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(0);
    expect(arbeitsraumSteht()).toBe(true);
    expect(flaeche().textContent).toContain(DATEI);
    // B7: kein grüner Gesamterfolg, sondern der ausdrückliche Teilerfolg „Datei läuft noch".
    expect(entwurfErfolgGruen()).toBe(false);
    expect(teilerfolgLage()).toBe("ausstehend");
    expect(document.body.textContent).toContain(
      String(i18n.t("capture.teilerfolg.dateiAusstehend", { name: DATEI })),
    );
    // Zweiter Druck während des angehaltenen Uploads — direkt am Element, wie ein Tastaturweg.
    await act(async () => {
      speichern.click();
      await flush();
    });
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(0);
    expect(entwurfErfolgGruen()).toBe(false);
    expect(teilerfolgLage()).toBe("ausstehend");

    await act(async () => {
      await uploadBremse.loslassen();
      await flush();
    });
    await act(flush);

    // Genau ein Ganzdokument-Entwurf mit dem bekannten Text und einer Referenz auf das EINE Original.
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    const datei = nutzlastJeTitel(DATEITITEL);
    expect(datei?.statement).toContain(DATEITEXT);
    expect(Object.keys(server.objekte)).toEqual(["obj-1"]);
    expect(JSON.stringify(datei)).toContain("obj-1");
    // Der Formularentwurf trägt den bekannten Titel — kein zweiter Formularentwurf.
    expect(nutzlastJeTitel(FORMULARTITEL)).not.toBeNull();
    expect(Object.keys(server.bestand).sort()).toEqual([ENTWURF_ID, "neu-1"].sort());
    // Erst jetzt wechselt das Blatt — zum Formularentwurf dieses Weges.
    expect(arbeitsraumSteht()).toBe(false);
    expect(blattTitel()).toBe(FORMULARTITEL);
    expect(window.confirm).not.toHaveBeenCalled();
    // B7: erst jetzt, mit gesicherter Datei, der grüne Erfolg — und kein Teilerfolg mehr.
    expect(entwurfErfolgGruen()).toBe(true);
    expect(teilerfolgLage()).toBeNull();

    // Reload: frische Montage, der Inhalt kommt vom Server zurück.
    abbauen();
    const dateiId = kennungJeTitel(DATEITITEL);
    expect(dateiId).toBe("neu-1");
    await mount(`/erfassen?draft=${dateiId}`, undefined, false, true);
    await act(flush);
    expect(stand()).toContain(DATEITEXT);
    expect(stand()).toContain(`Quelle: ${DATEI}, gesamtes Dokument`);
    abbauen();
    await mount(`/erfassen?draft=${ENTWURF_ID}`, undefined, false, true);
    await act(flush);
    expect(blattTitel()).toBe(FORMULARTITEL);
  });

  it("B2: Upload und Datei-Anlage scheitern — Datei bleibt korrigierbar auf der Fläche, der zweite Druck sichert genau sie", async () => {
    await formularUndDatei();
    lasseNaechstenUploadScheitern(new Error("Originalupload fehlgeschlagen"));
    lasseCreateScheiternFuer(DATEITITEL);
    await klick(knopfGenau(String(i18n.t("capture.saveDraft"))));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(nutzlastJeTitel(DATEITITEL)).toBeNull();
    expect(nutzlastJeTitel(FORMULARTITEL)).not.toBeNull();
    // Kein Blattwechsel: Arbeitsraum, Dateiname und eingelesener Text stehen noch da.
    expect(arbeitsraumSteht()).toBe(true);
    expect(stand()).toContain(DATEI);
    expect(window.confirm).not.toHaveBeenCalled();
    // B7: der Knopf ist wieder frei, und die Seite sagt ausdrücklich „nur teilweise" — kein Grün.
    expect(knopfGenau(String(i18n.t("capture.saveDraft"))).disabled).toBe(false);
    expect(entwurfErfolgGruen()).toBe(false);
    expect(teilerfolgLage()).toBe("gescheitert");
    expect(document.body.textContent).toContain(
      String(i18n.t("capture.teilerfolg.dateiGescheitert", { name: DATEI })),
    );

    // Die Ursache ist behoben; der naheliegende Handgriff ist derselbe Knopf.
    lasseCreateScheiternFuer();
    await klick(knopfGenau(String(i18n.t("capture.saveDraft"))));
    await act(flush);

    // Der Formularentwurf ist nicht nochmals geschrieben, die Datei liegt genau einmal im Bestand.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(nutzlastJeTitel(DATEITITEL)?.statement).toContain(DATEITEXT);
    expect(
      Object.values(server.bestand).filter(
        (e) => (e as { payload?: { title?: string } }).payload?.title === DATEITITEL,
      ),
    ).toHaveLength(1);
    expect(arbeitsraumSteht()).toBe(false);
    expect(blattTitel()).toBe(FORMULARTITEL);
    expect(entwurfErfolgGruen()).toBe(true);
    expect(teilerfolgLage()).toBeNull();
  });
});
