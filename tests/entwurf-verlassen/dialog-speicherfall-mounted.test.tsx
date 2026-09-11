// @vitest-environment jsdom
// ================================================================================================
// JOB 3572 — DIE ZUSAGE GILT AUCH *IM* WACHE-DIALOG.
// ================================================================================================
//
// DER BEFUND. Pedi hat einen gespeicherten Entwurf offen, ändert etwas und will weg. Die Wache
// fragt: „Hier bleiben · Verwerfen und wechseln · Entwurf speichern und wechseln". Er klickt
// „Entwurf speichern und wechseln", der Server hängt eine Sekunde — und er überlegt es sich anders
// und klickt daneben „Verwerfen und wechseln". Auf DIESEM Knopf steht seine eigene Zusage: der
// gespeicherte Entwurf bleibt unverändert (`capture.leaveDraft.keepsDraftHint`, Fall 2c der
// Nachbardatei). In genau diesem Augenblick war sie falsch — er wurde weggeschickt, und der
// laufende Schreibvorgang überschrieb danach genau den Entwurf, den er behalten wollte.
//
// Es ist DERSELBE Fehler, den Ben in JOB 3526 für den SEITEN-Knopf gefunden hat (dort geschlossen
// mit `verlassenGesperrt`, Capture.tsx:3134, gemessen in den Fällen 10/11 der Nachbardatei) — nur
// an der anderen Stelle: dort VOR dem Dialog, hier IM Dialog.
//
// Die zweite Hälfte von Bens Prüflücke aus JOB 3526 Runde 4 steht ebenfalls hier: was geschieht,
// wenn das Speichern AUS DEM DIALOG scheitert (`saveAndGo` fängt den Fehler und lässt den Dialog
// offen — bis heute von niemandem gemessen), und was ein Browser-Zurück bei offenem Dialog tut.
//
// WERKZEUGE: Testserver, Bremse und Bedienhelfer werden IMPORTIERT, nicht abgeschrieben —
// `attrappen.ts` und `huelle.ts` (JOB 3572, Lieferung 7).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import {
  bremse,
  draftsCreate,
  draftsRemove,
  draftsUpdate,
  lasseNaechstesUpdateScheitern,
  server,
} from "./attrappen";
import {
  ENTWURF_ID,
  abbauen,
  adresse,
  bestand,
  entwurf,
  erreichbareStellen,
  feld,
  flush,
  gesperrteBereiche,
  grundzustand,
  imWacheDialog,
  klick,
  knopf,
  mount,
  sichtbar,
  stellen,
  tippe,
  verlassenKnopf,
  wacheDialoge,
  wacheOffen,
} from "./huelle";

const ADRESSE = `/erfassen?draft=${ENTWURF_ID}`;

/**
 * DIE PRÜFUNG, DIE IN RUNDE 1 GEFEHLT HAT (bens Korrekturpflicht 2).
 *
 * Runde 1 hat `sichtbar()` gefragt — also `body.textContent`. Das beantwortet nur, ob ein Satz
 * IRGENDWO im Baum steht. Im Betrieb steht er beim offenen Wache-Dialog aber im Fehlerkasten der
 * SEITE, und den sperrt die Modalgrenze per `inert` (`ModalBoundaryContext.tsx:121`): für Tastatur
 * und Screenreader ist er dann nicht da. Der Test war grün, der Mensch stand vor einem stummen
 * Dialog.
 *
 * Hier wird deshalb dreierlei verlangt:
 *  1. Die Grenze ist überhaupt scharf — mindestens ein Bereich ist gesperrt. Ohne diese Zeile
 *     hiesse „erreichbar" nur, dass nie etwas gesperrt war.
 *  2. Der Satz hat mindestens eine ERREICHBARE Stelle (nicht inert, nicht `hidden`,
 *     nicht `aria-hidden`).
 *  3. JEDE erreichbare Stelle liegt IM Dialog — nicht im gesperrten Hintergrund daneben.
 */
function grundIstErreichbar(satz: string): void {
  expect(gesperrteBereiche(), "die Modalgrenze sperrt gerade nichts").toBeGreaterThan(0);
  const alle = stellen(satz);
  const offen = erreichbareStellen(satz);
  expect(alle.length, `„${satz}" steht nirgends im Baum`).toBeGreaterThan(0);
  expect(
    offen.length,
    `„${satz}" steht nur im gesperrten oder verborgenen Teil (${alle.length} Fundstellen)`,
  ).toBeGreaterThan(0);
  expect(
    offen.map((el) => imWacheDialog(el)),
    `erreichbare Fundstellen ausserhalb des Wache-Dialogs: ${offen
      .filter((el) => !imWacheDialog(el))
      .map((el) => el.tagName)
      .join(", ")}`,
  ).toEqual(offen.map(() => true));
}

/** Der Titel, den der Server aktuell hält. */
function titelImBestand(): string | undefined {
  const d = server.bestand[ENTWURF_ID] as { payload?: { title?: string } } | undefined;
  return d?.payload?.title;
}

/**
 * Zwei Verlaufseinträge in jsdoms ECHTER Sitzungsgeschichte anlegen und auf dem zweiten stehen
 * bleiben — der Zustand, aus dem heraus „Zurück" überhaupt etwas bedeutet.
 *
 * Der Index (`history.state.idx`) ist der vom Router gestempelte; `navHistory.readHistoryIndex`
 * liest genau ihn. Im MemoryRouter stempelt der Router nicht selbst, also wird hier gestempelt,
 * was der BrowserRouter im Betrieb stempelt (`@remix-run/router`: push ⇒ Index + 1).
 */
function verlaufAufbauen(): void {
  window.history.replaceState({ idx: 0 }, "", "/start");
  window.history.pushState({ idx: 1 }, "", ADRESSE);
}

/**
 * Der ECHTE Browser-Zurück-Knopf, so weit jsdom ihn hergibt: `history.back()` auf der echten
 * Sitzungsgeschichte. Der Wächter hängt am `popstate`-Ereignis des Fensters
 * (`navHistory.installPopGuardListener`) — hier wird nichts nachgebaut, sondern ausgelöst.
 */
async function browserZurueck(): Promise<void> {
  await act(async () => {
    window.history.back();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await grundzustand();
  // Jeder Fall startet auf einem ungestempelten Eintrag: nur die POP-Fälle bauen sich einen Verlauf.
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3572 · der Speicherfall IM Wache-Dialog", () => {
  // ==============================================================================================
  // LIEFERUNG 1 · KEIN AUSGANG, SOLANGE AUS DIESEM DIALOG HERAUS GESCHRIEBEN WIRD.
  // ==============================================================================================

  it("D1 · während aus dem Dialog gespeichert wird, ist der Verwerfen-Ausgang zu", async () => {
    await mount(ADRESSE, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);

    bremse.halte();
    await klick(knopf(i18n.t("nav.guard.save")));
    // Der Schreibvorgang hängt jetzt im Riegel: genau das Fenster, um das es geht.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(titelImBestand()).toBe("Zahlungsziel");

    // (a) Der Speichern-Knopf ist zu — das war er schon (NavGuardContext.tsx: `disabled={saving}`).
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(true);
    // (b) UND der Ausgang daneben ist es auch. Auf ihm steht die Zusage, die der laufende Vorgang
    //     gleich darauf bräche — ein Ausgang, der so etwas verspricht, ist schlimmer als keiner.
    expect(knopf(i18n.t("nav.guard.discard")).disabled).toBe(true);

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });
  });

  it("D2 · der Satz am Ende gehört zu dem, was wirklich im Bestand steht", async () => {
    await mount(ADRESSE, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);

    bremse.halte();
    await klick(knopf(i18n.t("nav.guard.save")));
    // Der Mensch überlegt es sich anders und klickt daneben auf „Verwerfen und wechseln".
    await klick(knopf(i18n.t("nav.guard.discard")));
    // Solange geschrieben wird, bewegt dieser Klick nichts: keine Meldung, kein Wechsel.
    expect(adresse()).toBe(ADRESSE);
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });

    // Der Schreibvorgang läuft zu Ende — der Bestand IST danach verändert. Genau deshalb darf der
    // Satz auf dem Bildschirm nicht „der gespeicherte Entwurf ist unverändert" lauten. Verglichen
    // wird der VOLLSTÄNDIGE Bestand, nicht ein Feld.
    expect(bestand()).not.toBe(vorher);
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
    expect(titelImBestand()).toBe("Zahlungsziel (neu gedacht)");
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
    // Der Wechsel ist der des SPEICHERNS — mit seinem Satz, nicht mit dem des Verwerfens.
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });

  // ==============================================================================================
  // LIEFERUNG 3 · „HIER BLEIBEN" IM SELBEN FENSTER — GEMESSEN, NICHT GERATEN.
  // ==============================================================================================
  //
  // Was danach gilt, ist hier NICHT vorausgesetzt, sondern festgehalten: der Schreibvorgang läuft
  // durch (er ist längst unterwegs, ihn abzubrechen könnte niemand versprechen), der Bestand ist
  // danach geschrieben — und der Mensch liest genau das („Entwurf aktualisiert"), nicht eine
  // Verlassen-Meldung über einen Wechsel, den er gerade abgesagt hat.
  it("D3 · Hier bleiben während des Speicherns: geschrieben wird, gewechselt nicht", async () => {
    await mount(ADRESSE, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);

    bremse.halte();
    await klick(knopf(i18n.t("nav.guard.save")));
    await klick(knopf(i18n.t("nav.guard.stay")));

    // Der Dialog ist weg, die Fläche steht.
    expect(wacheDialoge()).toBe(0);
    expect(wacheOffen()).toBe(false);
    expect(adresse()).toBe(ADRESSE);

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });

    // Der Schreibvorgang ist durch — und er hat den Entwurf geschrieben.
    expect(titelImBestand()).toBe("Zahlungsziel (neu gedacht)");
    expect(adresse()).toBe(ADRESSE);
    // Der Mensch liest die Auskunft über das, was geschehen ist: gespeichert. KEINE der beiden
    // Verlassen-Meldungen — er hat den Wechsel abgesagt, und keine Zusage über einen unveränderten
    // Entwurf steht da (der ist ja gerade geschrieben worden).
    expect(sichtbar()).toContain(i18n.t("capture.draftUpdated"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
  });

  // ==============================================================================================
  // LIEFERUNG 4 · DER GESCHEITERTE SPEICHERWEG AUS DEM DIALOG — IN BEIDEN SPIELARTEN.
  // ==============================================================================================
  //
  // `NavGuardContext.tsx` behauptet an seinem Fehlerzweig: „Speichern fehlgeschlagen: Dialog offen
  // lassen — die Seite zeigt die Fehlermeldung." Dieselbe Behauptung steht zweimal in Capture.tsx
  // (geschlossenes Speichertor, Teilfehler des Dateiwegs). Ob sie trägt, sagte bis hierher kein
  // Test: die 24 Fälle der Nachbardatei enden beim ERFOLGREICHEN Speicherweg.

  it("D4 · der Server lehnt ab: der Dialog steht, nichts wechselt — und der Grund steht da", async () => {
    await mount(ADRESSE, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);

    // Die abweisende Fabrik — kein HTTP-500-Ersatz, sondern der Fehler, den der Client wirft.
    lasseNaechstesUpdateScheitern(
      new ApiError(503, "UPSTREAM_UNAVAILABLE", "Der Entwurfsdienst antwortet gerade nicht."),
    );
    await klick(knopf(i18n.t("nav.guard.save")));

    // Es wurde versucht — und es ist nichts geschrieben worden.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(bestand()).toBe(vorher);
    expect(draftsCreate).not.toHaveBeenCalled();
    // Der Dialog steht noch, und zwar genau EINER; gewechselt wurde nicht.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    // Keine Erfolgsmeldung über einen Erfolg, den es nicht gab.
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
    // Und der Grund ist ERREICHBAR — nicht bloss irgendwo im DOM.
    grundIstErreichbar("Der Entwurfsdienst antwortet gerade nicht.");
  });

  it("D4b · 409 DRAFT_STALE: der Dialog nennt den Satz der Konfliktkarte, nicht die rohe Servermeldung", async () => {
    // Der eine Fehlerfall, in dem die Seite BEWUSST keinen Fehlerkasten zeigt, sondern ihre
    // Konfliktkarte (`Capture.tsx`, `saveDraft.onError` → `setStaleConflict(true)`, `setErr(null)`).
    // Genau deshalb darf der Dialog hier nicht einfach `e.message` weiterreichen: das wäre die rohe,
    // unübersetzte Servermeldung, die in keiner Oberflächensprache steht.
    await mount(ADRESSE, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);

    lasseNaechstesUpdateScheitern(
      new ApiError(409, "DRAFT_STALE", "draft has been modified by someone else"),
    );
    await klick(knopf(i18n.t("nav.guard.save")));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(bestand()).toBe(vorher);
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    grundIstErreichbar(i18n.t("fd.draftStale"));
    expect(sichtbar()).not.toContain("draft has been modified by someone else");
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });

  it("D5 · das Speichertor ist zu, bevor der Dialog aufgeht: kein Schreibversuch, Grund lesbar", async () => {
    // Der Zustand wird HERGESTELLT, nicht gleichgesetzt: der Server liefert einen ausgedünnten
    // Entwurf mit fehlenden Originalen (`anchorsMissing`) — daran fällt das Speichertor zu
    // (Capture.tsx: `speicherTor`), und zwar schon beim Laden, lange vor dem Klick.
    server.bestand = {
      [ENTWURF_ID]: entwurf("expert", { anchorsMissing: ["Rahmenvertrag.docx"] }),
    };
    await mount(ADRESSE, "formular");
    const vorher = bestand();
    const grund = i18n.t("capture.anchorsMissingNext");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);
    await klick(knopf(i18n.t("nav.guard.save")));

    // Es wurde gar nicht erst geschrieben.
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(bestand()).toBe(vorher);
    // Der Dialog steht noch, gewechselt wurde nicht — und er steht nicht stumm da.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    grundIstErreichbar(grund);
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });

  // ==============================================================================================
  // LIEFERUNG 6 · BROWSER-ZURÜCK BEI OFFENEM DIALOG.
  // ==============================================================================================
  //
  // `NavGuardContext.tsx:260-264` sichert zu: ist bereits ein Dialog offen, gibt es keinen zweiten
  // (Kante 3). Kein Fall in diesem Ordner ist bis hierher einen POP gegen einen offenen Dialog
  // gefahren.

  it("D6 · Zurück bei offenem Dialog: es bleibt bei EINEM Dialog, nichts wechselt", async () => {
    verlaufAufbauen();
    await mount(ADRESSE, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);

    await browserZurueck();

    // Kein Dialogstapel: die Frage steht genau einmal, und es ist dieselbe.
    expect(wacheDialoge()).toBe(1);
    expect(wacheOffen()).toBe(true);
    // Der Wächter hat den POP aufgefangen und die Adresszeile auf den Ort der Fläche zurückgestellt.
    expect(window.location.pathname).toBe("/erfassen");
    // Nichts ist geschehen: kein Wechsel, kein Schreibaufruf, unveränderter Bestand.
    expect(adresse()).toBe(ADRESSE);
    expect(bestand()).toBe(vorher);
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("D7 · Zurück, WÄHREND aus dem Dialog gespeichert wird: kein Weg, der die Zusage bricht", async () => {
    verlaufAufbauen();
    await mount(ADRESSE, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);

    bremse.halte();
    await klick(knopf(i18n.t("nav.guard.save")));
    await browserZurueck();

    // Der Dialog steht weiter, der Ausgang daneben bleibt zu, gewechselt wurde nicht.
    expect(wacheDialoge()).toBe(1);
    expect(knopf(i18n.t("nav.guard.discard")).disabled).toBe(true);
    expect(adresse()).toBe(ADRESSE);
    expect(window.location.pathname).toBe("/erfassen");

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });

    // Und am Ende steht genau der eine Weg, den der Mensch gewählt hat: gespeichert und gewechselt.
    expect(titelImBestand()).toBe("Zahlungsziel (neu gedacht)");
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });
});
