// @vitest-environment jsdom
// ================================================================================================
// R-0017 / R-0020 / R-0156 — FORMULAR UND DATEI GEMEINSAM, UND DER ZWEITE KLICK BEI HÄNGENDEM UPLOAD.
// ================================================================================================
//
// DIE ZIELZUSTÄNDE (Auftrag aufnahme:20260922:erfassen-doppelklick):
//   R-0017  Ein Dokument landete zweimal im Bestand — die Ursache der Doppelerfassung wird abgestellt.
//   R-0020  Wer zweimal hintereinander auf Speichern klickt, erzeugt nicht zwei Einträge — auch
//           dann nicht, wenn die Antwort des Servers unterwegs VERLORENGEHT (Quellwortlaut).
//   R-0156  Ein Dokument landete doppelt im Bestand — Ursache behoben, Fall erklärbar.
//
// DIE URSACHE, gemessen an diesem Baum (Gegenprobe siehe Rückgabe): gesperrt waren die drei Wege,
// die eine geladene Datei hinausschicken (manueller Knopf, Kartenknopf „Ganzes Dokument", Wache),
// nur über `isPending` — eine Anzeige, die erst mit dem nächsten Render ankommt. Zwei Klicks davor
// liefen beide durch; und während der Eintrags-Anteil des manuellen Knopfes lief, war der
// Kartenknopf frei und startete die Datei ein zweites Mal. Und beide Anlagewege (Formular, Datei)
// schickten KEINEN Wiederholschlüssel mit, obwohl Route und Dienst ihn tragen (JOB 2697) — ging die
// Antwort verloren, legte der zweite Druck neu an (bens B1, Runde 1).
//
// Die Reparatur (`Capture.tsx`): Einzellauf je Weg (`ganzdokumentSichern`, `manuellSichern`), eine
// Marke für den schon gesicherten Dateistand (`ganzdokumentGesichertRef`) und der an die Nutzlast
// gebundene Wiederholschlüssel an beiden Anlagen (`anlageVorgangFuer`, `lib/createOperation.ts`).
//
// WAS DIESE DATEI MISST:
//   K1  Geöffneter Entwurf (Formular) UND geladene Datei, EIN Druck: der Entwurf trägt die Änderung
//       und seinen bekannten Inhalt, die Datei liegt als EIN Ganzdokument-Entwurf daneben — und
//       eine frisch montierte Fläche (Reload) bekommt genau diese beiden vom Server zurück.
//   D1  Zwei Klicks VOR dem nächsten Render auf den manuellen Knopf: ein Upload, eine Anlage.
//   D2  Dasselbe mit geöffnetem Entwurf: ein Update, eine Datei-Anlage.
//   U1  Upload angehalten, zweiter Druck über die Wache („Entwurf speichern und wechseln"): kein
//       zweiter Upload, kein zweiter Entwurf, und vor dem Ende steht keine Erfolgsquittung.
//   R1  Formular angehalten, manueller Knopf UND Kartenknopf im selben Takt (Eintritt beider
//       gemessen), Datei fertig vor Formular: eine Datei-Anlage.
//   R2  Dasselbe, Upload angehalten, Formular fertig vor Datei: eine Datei-Anlage, kein vorzeitiger
//       Erfolg.
//   V1  Datei-Anlage ausgeführt, Antwort verloren, zweiter Druck: ein Entwurf, derselbe Schlüssel.
//   V2  Formular-Anlage ausgeführt, Antwort verloren, zweiter Druck: ein Entwurf.
//   V3  Formular + Datei, Datei-Antwort verloren, zweiter Druck: kein Doppelbestand.
//   V4  Upload scheitert UND Anlage-Antwort verloren, zweiter Druck ohne Änderung: derselbe
//       Vorgang (Nutzlast, Schlüssel) wird wiederaufgenommen — ein Entwurf (Runde 3, bens G5).
//   F1  Upload scheitert bei angehaltenem Lauf und Doppelklick: EIN Entwurf mit dem Volltext, der
//       Fehler ist benannt, keine Originalreferenz behauptet — und der Korrekturweg (Entwurf wieder
//       öffnen, ergänzen, speichern) ist AUSGEFÜHRT.
//   F2  Anlage scheitert: keine Erfolgsquittung, die Datei bleibt auf der Fläche, der zweite Druck
//       sichert sie mit DEMSELBEN Original (kein zweiter Upload).
//
// WAS DIESE DATEI NICHT BEWEIST: gemessen wird ein gemounteter Baum in jsdom gegen die Attrappen des
// Ordners (`attrappen.ts`). Keine echte HTTP-Grenze, keine Datenbank, kein Browser. Die echte
// Fastify-Anwendung hinter dem echten Client steht in `erfassen-doppelklick-echte-api-mounted.test.tsx`;
// Browser + PostgreSQL in `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts` (Q2–Q5).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import {
  bestandJeTitel,
  bremse,
  draftsCreate,
  draftsList,
  draftsUpdate,
  lasseCreateScheiternFuer,
  lasseNaechsteAnlageAntwortVerlorenGehen,
  lasseNaechstenUploadScheitern,
  nutzlastJeTitel,
  objectsUpload,
  server,
  uploadBremse,
} from "./attrappen";
import {
  ENTWURF_ID,
  abbauen,
  ansichtWechseln,
  dateiAblegen,
  feld,
  flaeche,
  flush,
  grundzustand,
  klick,
  knopf,
  mount,
  sichtbar,
  speichernKnopfDa,
  tippe,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";
/** Der Titel des Ganzdokument-Entwurfs: Dateiname ohne Endung (`wholeDocumentTitle`). */
const TRAEGER_TITEL = "bericht";
const ABSATZ_1 = "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.";
const ABSATZ_2 = "Ein Wechsel des Filters erfolgt monatlich.";
const DATEITEXT = [ABSATZ_1, ABSATZ_2].join("\n\n");
/** Der bekannte Inhalt des geöffneten Entwurfs (`huelle.tsx`, `entwurf()`). */
const ENTWURF_AUSSAGE = "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.";
/** Der Titel, den der Fall im geöffneten Entwurf tippt — unabhängig von allem, was die Datei trägt. */
const NEUER_TITEL = "Zahlungsziel neu";

/**
 * Formular UND Datei auf einer Fläche, wie ein Mensch dorthin kommt: Entwurf im Formular öffnen,
 * etwas ändern, über das Blatt in den Dateiweg wechseln (Entwurf bleibt geöffnet), Datei ablegen.
 */
async function formularUndDatei(): Promise<void> {
  await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
  await tippe(feld(String(i18n.t("capture.wizard.titleLabel"))), NEUER_TITEL);
  await ansichtWechseln("datei");
  await dateiAblegen(datei());
}

function speicherKnopf(): HTMLButtonElement {
  const gesucht = String(i18n.t("capture.saveDraft"));
  const treffer = [...flaeche().querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === gesucht,
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Der manuelle Speicherknopf „${gesucht}" steht nicht auf der Fläche.`);
  }
  return treffer;
}

/** Zwei Klicks im selben Takt — der zweite kommt an, BEVOR React neu gerendert hat. */
async function doppelklick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    el.click();
    await flush();
  });
}

/** Ein Klick, nach dem NICHT auf das Ende gewartet wird — der Lauf hängt an einer Bremse. */
async function klickOhneWarten(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

async function loslassen(b: { loslassen(): Promise<void> }): Promise<void> {
  await act(async () => {
    await b.loslassen();
    await flush();
  });
}

function datei(): File {
  return new File([DATEITEXT], DATEI, { type: "text/plain" });
}

const gesichertSatz = (): string => String(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));

beforeEach(async () => {
  await grundzustand();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("R-0017/R-0020/R-0156 · Formular und Datei gemeinsam, zweiter Klick bei hängendem Upload", () => {
  it("K1 · geöffneter Entwurf plus Datei, ein Druck: beides gesichert und nach dem Reload wiedergefunden", async () => {
    await formularUndDatei();

    expect(speicherKnopf().disabled).toBe(false);
    await klick(speicherKnopf());

    // Der Formular-Anteil: DERSELBE Entwurf, aktualisiert — mit Änderung und bekanntem Altinhalt.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsUpdate.mock.calls[0]?.[0]).toBe(ENTWURF_ID);
    const eintrag = (server.bestand[ENTWURF_ID] as { payload: Record<string, unknown> }).payload;
    expect(eintrag.title).toBe(NEUER_TITEL);
    expect(eintrag.statement).toBe(ENTWURF_AUSSAGE);

    // Der Datei-Anteil: EIN Ganzdokument-Entwurf mit Volltext, Herkunft und Original.
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    const traeger = nutzlastJeTitel(TRAEGER_TITEL);
    expect(traeger, JSON.stringify(bestandJeTitel())).not.toBeNull();
    expect(String(traeger?.statement)).toContain(ABSATZ_1);
    expect(String(traeger?.statement)).toContain(ABSATZ_2);
    expect(String(traeger?.bodyHtml)).toContain(DATEI);
    expect(String(traeger?.bodyHtml)).toContain(Object.keys(server.objekte)[0] ?? "(keins)");
    expect(sichtbar()).toContain(gesichertSatz());

    // ---- Reload: eine frische Fläche fragt den Server, und er liefert genau diese zwei. -------
    abbauen();
    draftsList.mockClear();
    await mount("/erfassen", "formular");
    expect(draftsList).toHaveBeenCalled();
    const geliefert = (await draftsList.mock.results[0]?.value) as {
      id: string;
      payload: Record<string, unknown>;
    }[];
    expect(geliefert.map((d) => d.payload.title).sort()).toEqual(
      [NEUER_TITEL, TRAEGER_TITEL].sort(),
    );
    const wieder = geliefert.find((d) => d.payload.title === TRAEGER_TITEL);
    expect(String(wieder?.payload.statement)).toContain(ABSATZ_2);
    expect(geliefert.find((d) => d.id === ENTWURF_ID)?.payload.statement).toBe(ENTWURF_AUSSAGE);
  });

  it("D1 · Doppelklick vor dem Render im Dateiweg: ein Upload, ein Entwurf", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    await doppelklick(speicherKnopf());

    expect(objectsUpload, "das Original wurde doppelt hochgeladen").toHaveBeenCalledTimes(1);
    expect(draftsCreate, "die Datei wurde doppelt angelegt").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
  });

  it("D2 · Doppelklick vor dem Render mit geöffnetem Entwurf: ein Update, eine Datei-Anlage", async () => {
    await formularUndDatei();

    await doppelklick(speicherKnopf());

    expect(draftsUpdate, "der Entwurf wurde doppelt geschrieben").toHaveBeenCalledTimes(1);
    expect(draftsCreate, "die Datei wurde doppelt angelegt").toHaveBeenCalledTimes(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()).toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });
  });

  it("U1 · Upload angehalten, zweiter Druck über die Wache: kein Doppelbestand, kein vorzeitiger Erfolg", async () => {
    await mount("/erfassen", "datei", true);
    await dateiAblegen(datei());

    uploadBremse.halte();
    await klickOhneWarten(speicherKnopf());

    // Der Lauf hängt: gesperrt, nichts angelegt, und KEINE Erfolgsquittung.
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(speicherKnopf().disabled).toBe(true);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(sichtbar()).not.toContain(gesichertSatz());

    // Der zweite Weg, der NICHT am `disabled` hängt: die Wache beim Seitenwechsel.
    const link = wechselLink();
    if (!link) {
      throw new Error("Wechselweg nicht im Baum");
    }
    await klickOhneWarten(link);
    expect(speichernKnopfDa()).toBe(true);
    const wacheSpeichern = [...document.querySelectorAll("[data-navguard-dialog] button")].find(
      (b) => (b.textContent ?? "").includes(String(i18n.t("nav.guard.save"))),
    ) as HTMLButtonElement;
    await klickOhneWarten(wacheSpeichern);
    expect(objectsUpload, "die Wache hat einen zweiten Upload gestartet").toHaveBeenCalledTimes(1);

    await loslassen(uploadBremse);

    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(draftsCreate, "die Datei liegt doppelt im Bestand").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    // Die erste Eingabe und ihre Datei bleiben zusammen: der eine Entwurf trägt Text UND Original.
    const traeger = nutzlastJeTitel(TRAEGER_TITEL);
    expect(String(traeger?.statement)).toContain(ABSATZ_1);
    expect(String(traeger?.bodyHtml)).toContain("obj-1");
  });

  // ==============================================================================================
  // RUNDE 2 (bens B2) — ZWEI WEGE BETRETEN DENSELBEN SPEICHERVORGANG, IN BEIDEN REIHENFOLGEN.
  // ==============================================================================================
  //
  // Beide Klicks fallen in DENSELBEN Takt, also vor jedes Neuzeichnen: der manuelle Knopf und der
  // Kartenknopf sind beide noch betätigbar, und beide Handler laufen wirklich an. Der Eintritt
  // jedes Weges wird gemessen, nicht angenommen (Runde 1 hatte ihn per `disabled = false` nur
  // behauptet — bens Gegenprobe G4 fand danach null Uploads).
  it("R1 · Formular angehalten, manueller Knopf und Kartenknopf im selben Takt: Datei fertig VOR Formular — eine Datei-Anlage", async () => {
    await formularUndDatei();
    await klick(knopf(String(i18n.t(CAPTURE_FILE_TEXT.importModeWhole))));
    const karte = knopf(String(i18n.t(CAPTURE_FILE_TEXT.wholeCta)));

    bremse.halte();
    await act(async () => {
      speicherKnopf().click();
      karte.click();
      await flush();
    });

    // Eintritt BEIDER Wege: der manuelle steht im Formular-Update, der Kartenweg ist schon durch.
    expect(draftsUpdate, "der manuelle Weg hat das Formular nicht betreten").toHaveBeenCalledTimes(
      1,
    );
    expect(objectsUpload, "der Kartenweg hat die Datei nicht betreten").toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);

    // Jetzt kommt das Formular nach — und der manuelle Weg schickt seine Datei NICHT hinterher.
    await loslassen(bremse);

    expect(objectsUpload, "das Original wurde doppelt hochgeladen").toHaveBeenCalledTimes(1);
    expect(draftsCreate, "die Datei wurde doppelt angelegt").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()).toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });
    expect(String(nutzlastJeTitel(TRAEGER_TITEL)?.bodyHtml)).toContain("obj-1");
  });

  it("R2 · Upload angehalten, manueller Knopf und Kartenknopf im selben Takt: Formular fertig VOR Datei — eine Datei-Anlage", async () => {
    await formularUndDatei();
    await klick(knopf(String(i18n.t(CAPTURE_FILE_TEXT.importModeWhole))));
    const karte = knopf(String(i18n.t(CAPTURE_FILE_TEXT.wholeCta)));

    uploadBremse.halte();
    await act(async () => {
      speicherKnopf().click();
      karte.click();
      await flush();
    });

    expect(draftsUpdate, "der manuelle Weg hat das Formular nicht betreten").toHaveBeenCalledTimes(
      1,
    );
    expect(objectsUpload, "der Kartenweg hat die Datei nicht betreten").toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(sichtbar(), "Erfolg gemeldet, obwohl die Datei noch hängt").not.toContain(
      gesichertSatz(),
    );

    await loslassen(uploadBremse);

    expect(objectsUpload, "das Original wurde doppelt hochgeladen").toHaveBeenCalledTimes(1);
    expect(draftsCreate, "die Datei wurde doppelt angelegt").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()).toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });
    expect(sichtbar()).toContain(gesichertSatz());
  });

  // ==============================================================================================
  // RUNDE 2 (bens B1) — DIE ANTWORT GEHT VERLOREN, NACHDEM DER SERVER ANGELEGT HAT.
  // ==============================================================================================
  //
  // Die Attrappe legt an und wirft DANACH einen Netzfehler (`lasseNaechsteAnlageAntwortVerlorenGehen`).
  // Sie hält die Vorgänge wie `CaptureService.createDraftVorgang`: derselbe Schlüssel mit derselben
  // Nutzlast liefert den schon angelegten Entwurf. Gemessen wird deshalb auch, DASS der Schlüssel
  // reist und bei der Wiederholung derselbe ist — sonst bewiese der Fall nur die Attrappe.
  it("V1 · Datei: Antwort verloren, zweiter Druck — ein Upload, ein Entwurf, derselbe Schlüssel", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    lasseNaechsteAnlageAntwortVerlorenGehen();
    await klick(speicherKnopf());
    expect(bestandJeTitel()[TRAEGER_TITEL], "der Server hat nicht angelegt").toBe(1);
    expect(sichtbar(), "Erfolg gemeldet, obwohl keine Antwort kam").not.toContain(gesichertSatz());
    expect(speicherKnopf().disabled, "die Datei ist nicht mehr sicherbar").toBe(false);

    await klick(speicherKnopf());

    expect(objectsUpload, "das Original wurde erneut hochgeladen").toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(2);
    const [erst, zweit] = draftsCreate.mock.calls.map((c) => c[1]);
    expect(erst, "die Anlage trägt keinen Wiederholschlüssel").toMatch(/^create-/);
    expect(zweit, "die Wiederholung trägt einen anderen Schlüssel").toBe(erst);
    expect(bestandJeTitel()[TRAEGER_TITEL], "die Datei liegt doppelt im Bestand").toBe(1);
    expect(sichtbar()).toContain(gesichertSatz());
  });

  it("V2 · Formular ohne geöffneten Entwurf: Antwort verloren, zweiter Druck — ein Entwurf", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.wizard.titleLabel"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ENTWURF_AUSSAGE);

    lasseNaechsteAnlageAntwortVerlorenGehen();
    await klick(speicherKnopf());
    expect(bestandJeTitel()[NEUER_TITEL], "der Server hat nicht angelegt").toBe(1);
    expect(sichtbar()).not.toContain(String(i18n.t("capture.draftSaved")));

    await klick(speicherKnopf());

    const [erst, zweit] = draftsCreate.mock.calls.map((c) => c[1]);
    expect(erst).toMatch(/^create-/);
    expect(zweit).toBe(erst);
    expect(bestandJeTitel()[NEUER_TITEL], "der Formularentwurf liegt doppelt im Bestand").toBe(1);
    expect(sichtbar()).toContain(String(i18n.t("capture.draftSaved")));
  });

  it("V3 · Formular und Datei: Datei-Antwort verloren, zweiter Druck — ein Formularstand, eine Datei", async () => {
    await formularUndDatei();

    lasseNaechsteAnlageAntwortVerlorenGehen();
    await klick(speicherKnopf());
    expect(bestandJeTitel()).toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });

    await klick(speicherKnopf());

    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(bestandJeTitel(), "Doppelbestand nach verlorener Antwort").toEqual({
      [NEUER_TITEL]: 1,
      [TRAEGER_TITEL]: 1,
    });
    expect(sichtbar()).toContain(gesichertSatz());
  });

  // RUNDE 3 (bens B1, Gegenprobe G5): Uploadfehler UND verlorene Anlage-Antwort. Der zweite Druck
  // ist unverändert — der Mensch hat nichts getan. Bis Runde 2 baute er die Nutzlast neu, diesmal
  // mit gelungenem Upload und Originallink: neuer Abdruck, neuer Schlüssel, zweiter Entwurf.
  it("V4 · Upload scheitert, Anlage-Antwort verloren, zweiter Druck: derselbe Vorgang wird wiederaufgenommen — ein Entwurf", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    lasseNaechstenUploadScheitern(new Error("Netz weg"));
    lasseNaechsteAnlageAntwortVerlorenGehen();
    await klick(speicherKnopf());
    expect(bestandJeTitel()[TRAEGER_TITEL], "der Server hat nicht angelegt").toBe(1);
    expect(sichtbar(), "Erfolg gemeldet, obwohl keine Antwort kam").not.toContain(gesichertSatz());

    await klick(speicherKnopf());

    const [erst, zweit] = draftsCreate.mock.calls.map((c) => c[1]);
    expect(erst).toMatch(/^create-/);
    expect(zweit, "der Wiederholversuch trägt einen anderen Schlüssel").toBe(erst);
    expect(
      JSON.stringify(draftsCreate.mock.calls[1]?.[0]),
      "der Wiederholversuch schickt eine andere Nutzlast",
    ).toBe(JSON.stringify(draftsCreate.mock.calls[0]?.[0]));
    expect(objectsUpload, "der Wiederholversuch hat erneut hochgeladen").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[TRAEGER_TITEL], "Doppelbestand ohne Änderung des Menschen").toBe(1);
    // Die Upload-Lage des ersten Versuchs wird nicht verdeckt: kein Original, und das steht da.
    expect(String(nutzlastJeTitel(TRAEGER_TITEL)?.bodyHtml)).not.toContain("obj-");
    expect(sichtbar()).toContain(gesichertSatz());
    expect(sichtbar()).toContain(String(i18n.t("capture.originalAttachFailed", { name: DATEI })));
  });

  it("F1 · Upload scheitert bei hängendem Lauf und Doppelklick: ein Entwurf mit Volltext, Fehler benannt", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    uploadBremse.halte();
    lasseNaechstenUploadScheitern(new Error("Netz weg"));
    await act(async () => {
      speicherKnopf().click();
      speicherKnopf().click();
      await flush();
    });
    await loslassen(uploadBremse);

    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    const traeger = nutzlastJeTitel(TRAEGER_TITEL);
    expect(String(traeger?.statement), "der Volltext ist nicht gesichert").toContain(ABSATZ_2);
    expect(String(traeger?.bodyHtml), "eine Originalreferenz wird behauptet").not.toContain("obj-");
    expect(sichtbar()).toContain(String(i18n.t("capture.originalAttachFailed", { name: DATEI })));

    // ---- Der Korrekturweg, ausgeführt: den gesicherten Entwurf wieder öffnen und weiterarbeiten.
    const kennung = Object.keys(server.bestand).find(
      (id) =>
        (server.bestand[id] as { payload: { title?: string } }).payload.title === TRAEGER_TITEL,
    );
    abbauen();
    await mount(`/erfassen?draft=${kennung}`, "formular");
    const aussage = feld(String(i18n.t("capture.fStatement")));
    expect(aussage.value, "der wieder geöffnete Entwurf trägt den Dateitext nicht").toContain(
      ABSATZ_2,
    );
    await tippe(aussage, `${aussage.value}\n\nNachtrag: Original liegt im Laufwerk Q.`);
    await klick(speicherKnopf());
    expect(draftsUpdate.mock.calls.at(-1)?.[0], "nicht derselbe Entwurf aktualisiert").toBe(
      kennung,
    );
    expect(bestandJeTitel()[TRAEGER_TITEL], "die Korrektur legte einen zweiten Entwurf an").toBe(1);
    expect(String(nutzlastJeTitel(TRAEGER_TITEL)?.statement)).toContain("Nachtrag");
  });

  it("F2 · Anlage scheitert: keine Erfolgsquittung, Datei bleibt, der zweite Druck nimmt dasselbe Original", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    lasseCreateScheiternFuer(TRAEGER_TITEL);
    await klick(speicherKnopf());
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();
    expect(sichtbar()).not.toContain(gesichertSatz());
    // Die Arbeit ist nicht weg: der Knopf bietet dieselbe Datei weiter an.
    expect(speicherKnopf().disabled).toBe(false);

    lasseCreateScheiternFuer();
    await klick(speicherKnopf());

    expect(objectsUpload, "der zweite Druck lud das Original erneut hoch").toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    expect(String(nutzlastJeTitel(TRAEGER_TITEL)?.bodyHtml)).toContain("obj-1");
    expect(sichtbar()).toContain(gesichertSatz());
  });
});
