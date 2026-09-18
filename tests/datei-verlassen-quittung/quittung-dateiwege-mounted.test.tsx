// @vitest-environment jsdom
// ================================================================================================
// JOB 4231 — DIE QUITTUNG DES VERLASSEN-WEGS SAGT, WAS WIRKLICH GESCHAH.
// ================================================================================================
//
// ── RUNDE 2, KORREKTURPFLICHT 1 (ben): DIE UNERREICHBARKEITS-BEHAUPTUNG WAR FALSCH ─────────────
//
// Runde 1 hat hier behauptet, der Zustand „geöffneter Entwurf UND geladene Datei" sei nicht
// herstellbar, und daraus geschlossen, der Befund sei bloss latent. BEN hat das widerlegt und den
// Weg vorgeführt. Er ist kurz, und jede seiner Stufen steht im Produkt:
//
//   1. Einen Entwurf fortsetzen, der NUR einen Titel trägt. Genau den schreibt `saveDraft`, wenn
//      nichts getippt war: der Titel fällt auf `capture.draftFallbackTitle` zurück, und ohne
//      gewählte Stufe reist KEIN `confidentiality` mit (`Capture.tsx:2205`, `:2222`).
//   2. Den Titel im Formular LEEREN. Damit ist `draftHasContent` falsch (`:2742`), und weil auch
//      keine Stufe geladen wurde, ist `hasUnsavedMeta` falsch (`:2400`, `:2795`). Der Eintrags-Zweig
//      des `save`-Rückrufs hat ab hier nichts mehr zu tun — messbar daran, dass `drafts.update` in
//      A1/A2 NIE gerufen wird.
//   3. In „Aus Datei" wechseln. Der Moduswechsel ERHÄLT den Zustand (`switchMode`, `:2661`: für
//      „datei" wird nur `setMode` gerufen) — `draftId` bleibt, der Verlassen-Knopf bleibt.
//   4. Datei laden, auswerten lassen, die Funde stehen lassen (`punkte`) oder abwählen
//      (`ganzdokument`).
//   5. Verlassen → „Entwurf speichern und wechseln". Jetzt trägt ALLEIN der Dateizweig, und genau
//      hier las der Mensch vor diesem Auftrag „verworfen und gewechselt".
//
// Der Befund ist damit KEIN latenter Bauform-Mangel, sondern ein lebender Anzeigefehler. Die
// Rückgabe der Runde 1 ist entsprechend korrigiert.
//
// ── WIE DER MODUSWECHSEL HIER ENTSTEHT, OHNE EINE ZWEITE HÜLLE ────────────────────────────────
//
// Im Betrieb reicht das BLATT den Modus als Prop herein und ändert ihn, wenn der Mensch die
// Modus-Leiste bedient (`pages/Capture.tsx`, `Capture()`: `<Blatt arbeitsraum={({ modus }) =>
// <CaptureArbeitsraum modus={modus} … />} />`). Die Hülle dieses Ordners reicht den Modus ebenfalls
// herein, hält ihn aber für die Lebensdauer des Baums fest — und sie ist nicht Zielpfad dieses
// Auftrags, darf also nicht erweitert werden.
//
// DESHALB STEHT DIE MODUS-BÜHNE HIER, und sie baut die Hülle NICHT nach (Lehre 3550/3571/3572):
// Baum, Mount, Bedienhelfer, Messfenster und Attrappen kommen unverändert aus
// `tests/entwurf-verlassen/`. Ersetzt wird per `vi.mock` ausschliesslich das eine Bauteil, das den
// Prop bekommt: `CaptureArbeitsraum` wird in einen Zwischenkörper gehüllt, der den ECHTEN
// Arbeitsraum rendert und ihm `modus` aus einem kleinen Speicher reicht. Der Zwischenkörper tut
// damit genau das, was `Blatt` tut — nicht mehr. Der Baum darunter ist Bauteil für Bauteil der der
// Hülle, und die Komponente wird beim Wechsel NICHT neu montiert: React erkennt sie an Typ und
// Stelle wieder, `draftId` und der Dateizustand überleben. Genau das ist der Punkt.
//
// ── WAS GEMESSEN WIRD ─────────────────────────────────────────────────────────────────────────
//   A1  Ganzdokument gespeichert ⇒ die Quittung sagt „gespeichert" (Rotnachweis, §6 des Auftrags).
//   A2  Punkte gespeichert ⇒ dieselbe Quittung (Rotnachweis).
//   A3  Ganzdokument scheitert ⇒ keine Quittung, kein Wechsel; zweiter Druck gelingt ⇒ „gespeichert",
//       ein Entwurf, ein Upload.
//   A4  Punkte-Teilfehler ⇒ Grund im Dialog, keine Quittung; zweiter Druck ⇒ „gespeichert", kein
//       Entwurf doppelt.
//   A5  Nach dem gescheiterten DATEI-Speichern doch verwerfen ⇒ „verworfen", nicht „gespeichert".
//   Q1  Dasselbe auf dem Eintrags-Weg (Server lehnt ab, dann verwerfen).
//   Q2  Eintrags-Weg, zweiter Druck gelingt.
//   R1/R2  Die Ordnungsprobe: warum der Entwurf ZUERST geöffnet und erst danach gewechselt wird —
//       ein `?draft=` im Dateimodus wird gar nicht geladen (`Capture.tsx:3056`). Sie sagen nichts
//       über Erreichbarkeit; das war der Fehler der Runde 1.
//
// WAS HIER NICHT STEHT, weil es im Nachbarordner steht: der gelungene Eintrags-Speicherweg
// (`entwurf-verlassen-mounted` 12/12b), der offene Dialog nach einer Absage (`dialog-speicherfall-
// mounted` D4/D4b/D5) und die Dateizweige am ANDEREN Navigationsweg (`dateiweg-abwahl-mounted` A2,
// `dateiweg-ganzdokument-fehlerwege-mounted` B1–B3, `dateiweg-teilfehler-mounted` T1–T4). Neu ist
// hier ausschliesslich der QUITTUNGSSATZ des Verlassen-Wegs nach einem Datei-Speicherweg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Modus, den der Baum gerade hereinreicht — im Betrieb die Modus-Leiste des Blatts.
 * `vi.hoisted`, weil die `vi.mock`-Fabrik unten vor allen Importen läuft.
 */
const modusBuehne = vi.hoisted(() => {
  let wert: string | undefined = "formular";
  const hoerer = new Set<() => void>();
  return {
    lies: (): string | undefined => wert,
    setze: (neu: string | undefined): void => {
      wert = neu;
      for (const h of [...hoerer]) {
        h();
      }
    },
    abonnieren: (h: () => void): (() => void) => {
      hoerer.add(h);
      return () => {
        hoerer.delete(h);
      };
    },
  };
});

vi.mock("../../apps/web/src/pages/Capture", async (echt) => {
  const original = await echt<typeof import("../../apps/web/src/pages/Capture")>();
  const react = await import("../../apps/web/node_modules/react");
  // Der Zwischenkörper: dieselbe Aufgabe wie `Blatt` — den Modus hereinreichen. Er rendert den
  // ECHTEN Arbeitsraum; nichts am Produkt ist nachgebaut oder abgeschaltet.
  function CaptureArbeitsraum(eigenschaften: CaptureArbeitsraumProps): JSX.Element {
    const modus = react.useSyncExternalStore(
      modusBuehne.abonnieren,
      modusBuehne.lies,
      modusBuehne.lies,
    );
    return react.createElement(original.CaptureArbeitsraum, {
      ...eigenschaften,
      modus: modus as CaptureMode | undefined,
    });
  }
  return { ...original, CaptureArbeitsraum };
});

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import type { CaptureMode } from "../../apps/web/src/lib/captureEntry";
import type { CaptureArbeitsraumProps } from "../../apps/web/src/pages/Capture";
import {
  anlageversucheJeTitel,
  bestandJeTitel,
  draftsCreate,
  draftsGet,
  draftsRemove,
  draftsUpdate,
  extrakt,
  lasseCreateScheiternFuer,
  lasseNaechstesUpdateScheitern,
  nutzlastJeTitel,
  objectsUpload,
  server,
} from "../entwurf-verlassen/attrappen";
import {
  ENTWURF_ID,
  abbauen,
  adresse,
  bestand,
  dateiAblegen,
  erreichbareStellen,
  feld,
  flaeche,
  flush,
  fundKaestchen,
  fundzeilen,
  grundIstErreichbar,
  grundIstImDialog,
  grundzustand,
  imWacheDialog,
  klick,
  knopf,
  mount,
  sichtbar,
  speichernKnopfDa,
  tippe,
  verlassenKnopf,
  wacheDialoge,
} from "../entwurf-verlassen/huelle";

const ADRESSE = `/erfassen?draft=${ENTWURF_ID}`;
const DATEI = "bericht.txt";
/** `wholeDocumentTitle` nimmt ohne Markdown-Überschrift den Dateinamen ohne Endung. */
const TRAEGER_TITEL = "bericht";
const NEUER_TITEL = "Zahlungsziel (neu gedacht)";

const P1 = {
  title: "Filter wechseln",
  summary: "Der Filter wird monatlich gewechselt.",
  sourceExcerpt: "Ein Wechsel des Filters erfolgt monatlich.",
};
const P2 = {
  title: "Dosierwert prüfen",
  summary: "Nach Schichtwechsel den Dosierwert kontrollieren.",
  sourceExcerpt: "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
};
const DATEITEXT = [P1.sourceExcerpt, P2.sourceExcerpt].join("\n\n");

/** Der Satz nach einem SPEICHERN. */
const GESPEICHERT = (): string => i18n.t("capture.leaveDraft.doneSaved");
/** Der Satz nach einem VERWERFEN. */
const VERWORFEN = (): string => i18n.t("capture.leaveDraft.done");

/**
 * DER ENTWURF, DEN EIN MENSCH WIRKLICH BEKOMMT, wenn er ohne Eingabe sichert: Rückfalltitel, leere
 * Aussage, KEINE Vertraulichkeitsstufe (`Capture.tsx:2205`, `:2222` — „gewählt ⇒ mitschicken, nicht
 * gewählt ⇒ weglassen"). Er ist der Ausgangspunkt von A1–A5, weil an ihm — nach dem Leeren des
 * Titels — der Eintrags-Zweig der Wache nichts mehr zu sichern hat.
 *
 * Bewusst NICHT `entwurf()` aus der Hülle: die trägt Aussage, Bedingungen, Kategorie und Stufe, und
 * damit liefe der Eintrags-Zweig immer mit. Das ist kein zweiter Aufbau, sondern ein zweiter
 * DATENFALL; der Baum und alle Helfer bleiben die der Hülle.
 */
function entwurfNurTitel(): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-10T09:00:00.000Z",
    payload: { title: "Entwurf", statement: "", origin: "expert" },
  };
}

/** Den Modus wechseln — der Griff, den im Betrieb die Modus-Leiste des Blatts tut. */
async function modusWechsel(neu: CaptureMode): Promise<void> {
  await act(async () => {
    modusBuehne.setze(neu);
    await flush();
  });
  await act(flush);
}

/** Die Ablegezone des Dateiimports. */
function ablegezone(): HTMLElement | null {
  return flaeche().querySelector<HTMLElement>("[data-testid=capture-dropzone]");
}

/**
 * Die Fläche öffnen. Der Modus kommt AUS DER BÜHNE — sie ist ab hier der einzige Wahrheitsort, weil
 * der Zwischenkörper oben den Prop der Hülle überschreibt. Beide Werte werden trotzdem gesetzt,
 * damit `mount(url, modus)` und Bühne nicht auseinanderlaufen; gemessen wurde die Gefahr, nicht
 * vermutet: R2 mit Bühne auf „formular" und `mount(…, "datei")` war rot („expected null not to be
 * null", die Ablegezone fehlte), weil die Bühne gewann.
 */
async function oeffnen(url: string, modus: CaptureMode): Promise<void> {
  modusBuehne.setze(modus);
  await mount(url, modus);
}

/** Schritt 1–2 des Wegs: den Entwurf öffnen und seinen Titel leeren. */
async function entwurfOffenUndLeer(): Promise<void> {
  server.bestand = { [ENTWURF_ID]: entwurfNurTitel() };
  await oeffnen(ADRESSE, "formular");
  expect(verlassenKnopf(), "der Entwurf ist nicht geöffnet").not.toBeNull();
  await tippe(feld(i18n.t("capture.fTitle")), "");
}

/** Schritt 3–4: in „Aus Datei" wechseln, Datei ablegen, auswerten lassen. */
async function dateiLaden(): Promise<void> {
  await modusWechsel("datei");
  expect(ablegezone(), "der Moduswechsel hat die Ablegezone nicht gebracht").not.toBeNull();
  expect(
    verlassenKnopf(),
    "der geöffnete Entwurf hat den Moduswechsel nicht überlebt",
  ).not.toBeNull();
  await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
  await klick(knopf(i18n.t("capture.file.searchCta")));
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: true },
    { titel: P2.title, angehakt: true },
  ]);
}

/** Alle Funde abwählen — danach trägt die Datei der Ganzdokument-Weg. */
async function alleFundeAbwaehlen(): Promise<void> {
  await klick(fundKaestchen(P1.title));
  await klick(fundKaestchen(P2.title));
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: false },
    { titel: P2.title, angehakt: false },
  ]);
}

/**
 * Schritt 5, OHNE Erwartung an den Zweig: zurück ins Formular, Verlassen drücken, Dialog steht.
 * Welchen Zweig die Wache zeigt, ist ab hier der Gegenstand der Messung (B1/B2) und darf deshalb
 * nicht schon im Aufbauhelfer zugesichert werden.
 */
async function verlassenDialogOeffnen(): Promise<void> {
  await modusWechsel("formular");
  await klick(verlassenKnopf() as HTMLButtonElement);
  expect(wacheDialoge()).toBe(1);
}

/** Schritt 5: zurück ins Formular und über den Verlassen-Knopf hinauswollen. */
async function verlassenWollen(): Promise<void> {
  await verlassenDialogOeffnen();
  expect(speichernKnopfDa(), "die Wache bietet gar kein Speichern an").toBe(true);
}

/** Ein Druck auf „Entwurf speichern und wechseln". */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf(i18n.t("nav.guard.save")));
}

beforeEach(async () => {
  await grundzustand();
  // Der Speicher lebt modulweit — ohne diese Zeile trüge der nächste Fall den Modus des vorigen.
  modusBuehne.setze("formular");
  extrakt.punkte = [P1, P2];
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 4231 · die Quittung des Verlassen-Wegs nach einem Datei-Speicherweg", () => {
  // ==============================================================================================
  // A1 · GANZES DOKUMENT GESPEICHERT — UND DIE QUITTUNG SAGT „GESPEICHERT".
  // ==============================================================================================
  //
  // DER ROTNACHWEIS DIESES AUFTRAGS. Am Basisstand setzte nur der Eintrags-Zweig die Marke; hier
  // läuft er nachweislich NICHT (`drafts.update` wird nie gerufen), und der Mensch las trotz
  // gesicherter Datei „verworfen und gewechselt".
  //
  // Gemessen wird nicht nur der Satz, sondern die ganze Kette bis zum WIEDERFINDEN: der Volltext
  // steht als Aussage im Bestand, und der Rumpf zeigt auf das Original im Objektspeicher.
  it("A1 · ganzes Dokument über die Wache gesichert: die Meldung heisst „gespeichert“", async () => {
    await entwurfOffenUndLeer();
    await dateiLaden();
    await alleFundeAbwaehlen();
    await verlassenWollen();

    await speichernUndWechseln();

    // DIE LAGE DES BEFUNDS: allein der Dateizweig hat getragen.
    expect(
      draftsUpdate,
      "der Eintrags-Zweig hat mitgespeichert — dann misst A1 nicht den Befund",
    ).not.toHaveBeenCalled();
    expect(anlageversucheJeTitel()).toEqual({ [TRAEGER_TITEL]: 1 });

    // Gewechselt ist, und der Satz gehört zu dem, was geschah.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(
      sichtbar(),
      "die Fläche meldet „verworfen“, obwohl die Datei gesichert ist",
    ).not.toContain(VERWORFEN());

    // UND DER BESTAND IST WIEDERZUFINDEN — samt Originalquelle.
    const nutzlast = nutzlastJeTitel(TRAEGER_TITEL);
    expect(nutzlast, `kein Entwurf „${TRAEGER_TITEL}" im Bestand`).not.toBeNull();
    expect(String(nutzlast?.statement)).toContain(P1.sourceExcerpt);
    expect(String(nutzlast?.statement)).toContain(P2.sourceExcerpt);
    const objekte = Object.keys(server.objekte);
    expect(objekte).toHaveLength(1);
    expect(String(nutzlast?.bodyHtml)).toContain(String(objekte[0]));
    expect(String(nutzlast?.bodyHtml)).toContain(DATEI);
  });

  // ==============================================================================================
  // A2 · DIE PUNKTE GESPEICHERT — DIESELBE QUITTUNG, DER ANDERE ZWEIG.
  // ==============================================================================================
  //
  // Die naheliegende Halbheit wäre, nur einen der beiden Dateizweige zu versorgen. Dieser Fall ist
  // deshalb kein Abklatsch von A1: er läuft durch `createPointDrafts` statt durch `fileWholeDraft`.
  it("A2 · die Funde über die Wache gesichert: die Meldung heisst „gespeichert“", async () => {
    await entwurfOffenUndLeer();
    await dateiLaden();
    // Die Funde bleiben angehakt — damit trägt der Punkte-Weg.
    await verlassenWollen();

    await speichernUndWechseln();

    expect(
      draftsUpdate,
      "der Eintrags-Zweig hat mitgespeichert — dann misst A2 nicht den Befund",
    ).not.toHaveBeenCalled();
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1 });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    // Kein Ganzdokument-Träger daneben: es ist EIN Weg, nicht zwei.
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
  });

  // ==============================================================================================
  // A3 · DER GESCHEITERTE DATEIWEG MELDET KEINEN ERFOLG — UND DER ZWEITE DRUCK GELINGT.
  // ==============================================================================================
  //
  // bens Prüflücke 6: Datei-Fehler und Wiederholung waren am QUITTUNGSPFAD ungemessen (die
  // bestehenden Fälle fahren den anderen Navigationsweg, `dateiweg-ganzdokument-fehlerwege-mounted`).
  it("A3 · Anlage scheitert: kein Wechsel, keine Meldung — zweiter Druck sichert und quittiert", async () => {
    lasseCreateScheiternFuer(TRAEGER_TITEL);
    await entwurfOffenUndLeer();
    await dateiLaden();
    await alleFundeAbwaehlen();
    await verlassenWollen();

    await speichernUndWechseln();

    // Nichts behauptet „gesichert", und gewechselt wird nicht.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();
    expect(sichtbar()).not.toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());

    // ---- Der zweite Druck, diesmal nimmt der Server an. --------------------------------------
    lasseCreateScheiternFuer();
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
    // Ein Entwurf, ein Original — der Wiederholungsdruck legt nichts doppelt an.
    expect(anlageversucheJeTitel()).toEqual({ [TRAEGER_TITEL]: 2 });
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.objekte)).toHaveLength(1);
  });

  // ==============================================================================================
  // A4 · TEILFEHLER DER PUNKTE — DER GRUND STEHT IM DIALOG, DIE QUITTUNG KOMMT ERST DANACH.
  // ==============================================================================================
  it("A4 · ein Punkt scheitert: Grund im Dialog; nach dem zweiten Druck „gespeichert“ ohne Dublette", async () => {
    lasseCreateScheiternFuer(P2.title);
    await entwurfOffenUndLeer();
    await dateiLaden();
    await verlassenWollen();

    await speichernUndWechseln();

    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    grundIstImDialog(i18n.t("capture.file.draftsPartial", { failed: P2.title }));
    expect(sichtbar()).not.toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());

    // ---- Zweiter Druck: nur der offene Punkt wird noch versucht. ------------------------------
    lasseCreateScheiternFuer();
    await speichernUndWechseln();

    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 2 });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(draftsUpdate).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // A5 · NACH DEM GESCHEITERTEN DATEI-SPEICHERN DOCH VERWERFEN — DIE MELDUNG FOLGT DER TAT.
  // ==============================================================================================
  //
  // Die Probe auf den ZEITPUNKT, jetzt auf dem Dateiweg: notierte einer der beiden Zweige seine
  // Tatsache VOR dem `await`, trüge der Mensch hier ein „gespeichert" davon, obwohl er verworfen hat
  // und nichts im Bestand liegt.
  it("A5 · Dateiweg gescheitert, dann verwerfen: „verworfen“, und der Bestand ist leer", async () => {
    lasseCreateScheiternFuer(TRAEGER_TITEL);
    await entwurfOffenUndLeer();
    const vorher = bestand();
    await dateiLaden();
    await alleFundeAbwaehlen();
    await verlassenWollen();

    await speichernUndWechseln();
    expect(wacheDialoge()).toBe(1);

    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(VERWORFEN());
    expect(
      sichtbar(),
      "die Marke des gescheiterten Dateiwegs ist in die Verwerfen-Antwort geleckt",
    ).not.toContain(GESPEICHERT());
    // Und es liegt wirklich nichts da: kein Träger, kein Punktentwurf, der Entwurf unverändert.
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();
    expect(bestand()).toBe(vorher);
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // Q1 · DERSELBE ZEITPUNKT-BEWEIS AUF DEM EINTRAGS-WEG.
  // ==============================================================================================
  //
  // A5 misst ihn am Dateizweig, Q1 am Eintrags-Zweig: speichern lassen, der Server lehnt ab (das
  // misst D4 der Nachbardatei), und DANN daneben „Verwerfen und wechseln" drücken. Ab dort misst
  // dieser Fall, was D4 nicht mehr misst.
  it("Q1 · Server lehnt ab, dann verwerfen: die Meldung heisst „verworfen“, nicht „gespeichert“", async () => {
    await oeffnen(ADRESSE, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), NEUER_TITEL);
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);
    const vorher = bestand();

    lasseNaechstesUpdateScheitern(
      new ApiError(503, "UPSTREAM_UNAVAILABLE", "Der Entwurfsdienst antwortet gerade nicht."),
    );
    await speichernUndWechseln();

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(bestand()).toBe(vorher);
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe(ADRESSE);
    grundIstErreichbar("Der Entwurfsdienst antwortet gerade nicht.");

    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(VERWORFEN());
    expect(
      sichtbar(),
      "die Marke des gescheiterten Speicherversuchs ist in die Verwerfen-Antwort geleckt",
    ).not.toContain(GESPEICHERT());
    expect(bestand()).toBe(vorher);
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // Q2 · EINTRAGS-WEG, ZWEITER DRUCK: DIE MARKE HÄNGT NICHT AM ERSTEN VERSUCH FEST.
  // ==============================================================================================
  it("Q2 · zweiter Druck gelingt: gewechselt, geschrieben, und die Meldung heisst „gespeichert“", async () => {
    await oeffnen(ADRESSE, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), NEUER_TITEL);
    await klick(verlassenKnopf() as HTMLButtonElement);

    lasseNaechstesUpdateScheitern(
      new ApiError(503, "UPSTREAM_UNAVAILABLE", "Der Entwurfsdienst antwortet gerade nicht."),
    );
    await speichernUndWechseln();
    expect(wacheDialoge()).toBe(1);

    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(draftsUpdate).toHaveBeenCalledTimes(2);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
  });

  // ==============================================================================================
  // R1/R2 · DIE ORDNUNGSPROBE — WARUM DER ENTWURF ZUERST GEÖFFNET WIRD.
  // ==============================================================================================
  //
  // RUNDE 2: diese zwei Fälle standen in Runde 1 als „Beweis der Unerreichbarkeit" da. Das waren sie
  // nie — sie messen den EINSTIEG bei festem Modus, nicht den Weg über den Moduswechsel (ben,
  // Prüfpunkt 2). Sie bleiben, weil sie die REIHENFOLGE in A1–A5 begründen: der Ladeeffekt der
  // Adresse verlangt den Expertenmodus (`Capture.tsx:3056`), ein `?draft=` im Dateimodus wird also
  // nie geholt. Deshalb erst öffnen, dann wechseln — nicht umgekehrt.
  it("R1 · Einstieg im Expertenmodus: der Entwurf wird geholt, die Ablegezone kommt erst mit dem Wechsel", async () => {
    await oeffnen(ADRESSE, "formular");

    expect(draftsGet).toHaveBeenCalledTimes(1);
    expect(draftsGet).toHaveBeenCalledWith(ENTWURF_ID);
    expect(verlassenKnopf()).not.toBeNull();
    expect(ablegezone(), "die Ablegezone steht schon im Expertenmodus").toBeNull();

    // Und der Wechsel bringt sie — ohne den geöffneten Entwurf zu verlieren (die Naht von A1–A5).
    await modusWechsel("datei");
    expect(ablegezone()).not.toBeNull();
    expect(verlassenKnopf()).not.toBeNull();
  });

  it("R2 · Einstieg im Dateimodus: dasselbe ?draft= wird gar nicht erst geholt", async () => {
    await oeffnen(ADRESSE, "datei");

    expect(ablegezone()).not.toBeNull();
    expect(draftsGet).not.toHaveBeenCalled();
    expect(verlassenKnopf()).toBeNull();
  });
});

// ================================================================================================
// JOB 4335 — DIE WACHE DARF KEINEN VERLUST BEHAUPTEN, DEN DER SPEICHERWEG GAR NICHT HÄTTE.
// ================================================================================================
//
// DER BEFUND (JOB 4324 R2, Produktbefund (b), im echten Chromium gegen echtes PostgreSQL gemessen:
// `tests/import-wiederoeffnen-nutzerweg/import-wiederoeffnen-pg-im-browser.integration.test.ts:611`).
// Ein Mensch setzt einen Entwurf fort, wechselt in „Aus Datei", lädt eine Datei — und die Auswertung
// findet nichts oder findet gar nicht statt (in einer Instanz ohne Modell gibt es sie nie). Drückt er
// „Entwurf verlassen", stand dort bis zu diesem Job der VERLUST-Zweig der Wache: „Nicht alles kann
// gesichert werden … die hochgeladene Datei — ihre Auswertung ist noch nicht abgeschlossen", und
// „Entwurf speichern und wechseln" fehlte.
//
// DAS WAR EINE FALSCHE VERLUSTBEHAUPTUNG, kein konservativer Schutz: derselbe Speicher-Rückruf trägt
// diesen Zustand ausdrücklich (`Capture.tsx:3288` `dateiTraeger?.art === "ganzdokument"` →
// `fileWholeDraft`), und `dateiTraeger` entsteht auch ganz ohne Funde (`Capture.tsx:1171-1179`).
// Zwei Begriffe über denselben Zustand sagten Gegenteiliges; `hasPendingFileImport` war der falsche.
//
// WARUM DIE BESTEHENDEN FÄLLE DAS NICHT FANDEN: A1–A5 oben erreichen den Ganzdokument-Weg nur über
// `alleFundeAbwaehlen()` — dort hat eine Auswertung stattgefunden, `hasUnsavedFilePoints` ist wahr
// und nahm `hasPendingFileImport` schon vorher zurück. Der Zustand „Datei da, Auswertung liefert
// nichts" kam in diesem Ordner nicht vor.
//
// B1 misst den reparierten Weg, B2 seine GRENZE: eine Datei, aus der kein Text gelesen wurde
// (leere Textdatei, PDF ohne Textebene), ist WIRKLICH nicht sicherbar — dort bleibt der Verlust-Zweig
// samt Grund stehen. Ohne B2 wäre die Reparatur die bequeme Variante „Knopf immer anbieten".
describe("JOB 4335 · die Verlassen-Wache bei geladener Datei ohne Funde", () => {
  /** Eine Datei, aus der der Import KEINEN Text lesen kann — der wahre Wartezustand. */
  const LEERE_DATEI = "ohne-text.txt";

  /** Der Titel des Verlust-Zweigs der Wache (`NavGuardContext.tsx:399`). */
  const VERLUSTTITEL = (): string => i18n.t("nav.guard.unsavableTitle");
  /** Der Grund, den der Verlust-Zweig für eine geladene Datei nennt. */
  const DATEIGRUND = (name: string): string => i18n.t("capture.unsavable.file", { name });

  /**
   * Ein Satz steht ERREICHBAR im Dialog der Wache — dieselbe Messung wie `grundIstImDialog` der
   * Hülle, nur ohne dessen Bindung an `[data-navguard-save-error]`: der Verlust-Zweig zeigt seine
   * Gründe in einer Liste, nicht im Fehlerfeld.
   */
  function stehtImWacheDialog(satz: string): void {
    const offen = erreichbareStellen(satz).filter((el) => imWacheDialog(el));
    expect(
      offen.length,
      `„${satz}" steht nicht erreichbar im Dialog der Wache (Fundstellen gesamt: ${
        erreichbareStellen(satz).length
      })`,
    ).toBeGreaterThan(0);
  }

  /** Schritt 3–4 ohne Funde: in „Aus Datei" wechseln, Datei ablegen, auswerten lassen — nichts kommt. */
  async function dateiLadenOhneFunde(): Promise<void> {
    await modusWechsel("datei");
    expect(ablegezone(), "der Moduswechsel hat die Ablegezone nicht gebracht").not.toBeNull();
    await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
    await klick(knopf(i18n.t("capture.file.searchCta")));
    expect(fundzeilen(), "die Auswertung hat wider Erwarten Funde geliefert").toEqual([]);
  }

  // ==============================================================================================
  // B1 · DATEI GELADEN, AUSWERTUNG OHNE FUNDE — DIE WACHE BIETET SPEICHERN AN UND SICHERT WIRKLICH.
  // ==============================================================================================
  //
  // DER ROTNACHWEIS DIESES AUFTRAGS. Am Basisstand scheitert dieser Fall an der ersten Zusicherung
  // („die Wache bietet … NICHT an"), und zwar mit dem Verlusttitel und dem Dateigrund als Befund.
  it("B1 · keine Funde, Datei da: die Wache bietet Speichern an, sichert das ganze Dokument und quittiert „gespeichert“", async () => {
    extrakt.punkte = [];
    await entwurfOffenUndLeer();
    await dateiLadenOhneFunde();
    await verlassenDialogOeffnen();

    // ── DIE ZUSAGE: der sicherbare Zustand bekommt seinen Speicherweg. ─────────────────────────
    expect(
      speichernKnopfDa(),
      `PRODUKTBEFUND (b): die Wache bietet «${i18n.t(
        "nav.guard.save",
      )}» NICHT an, obwohl der Ganzdokument-Weg (Capture.tsx:3288) diesen Zustand trägt. Was stattdessen dasteht: Titel «${VERLUSTTITEL()}» ${
        sichtbar().includes(VERLUSTTITEL()) ? "steht" : "steht nicht"
      } · Grund «${DATEIGRUND(DATEI)}» ${
        sichtbar().includes(DATEIGRUND(DATEI)) ? "steht" : "steht nicht"
      }`,
    ).toBe(true);
    // Und die falsche Verlustbehauptung ist weg — nicht nur der Knopf zusätzlich da.
    expect(
      sichtbar(),
      "die Wache behauptet weiterhin einen Verlust, den der Speicherweg gar nicht hätte",
    ).not.toContain(VERLUSTTITEL());
    expect(sichtbar()).not.toContain(DATEIGRUND(DATEI));

    await speichernUndWechseln();

    // Allein der Dateizweig hat getragen — der Eintrags-Zweig hat an diesem Entwurf nichts zu tun.
    expect(
      draftsUpdate,
      "der Eintrags-Zweig hat mitgespeichert — dann misst B1 nicht den Befund",
    ).not.toHaveBeenCalled();
    expect(anlageversucheJeTitel()).toEqual({ [TRAEGER_TITEL]: 1 });

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(
      sichtbar(),
      "die Fläche meldet „verworfen“, obwohl die Datei gesichert ist",
    ).not.toContain(VERWORFEN());

    // DER BESTAND TRÄGT WIRKLICH DIE DATEI — Volltext als Aussage, Original im Objektspeicher.
    const nutzlast = nutzlastJeTitel(TRAEGER_TITEL);
    expect(nutzlast, `kein Entwurf „${TRAEGER_TITEL}" im Bestand`).not.toBeNull();
    expect(String(nutzlast?.statement)).toContain(P1.sourceExcerpt);
    expect(String(nutzlast?.statement)).toContain(P2.sourceExcerpt);
    const objekte = Object.keys(server.objekte);
    expect(objekte).toHaveLength(1);
    expect(String(nutzlast?.bodyHtml)).toContain(String(objekte[0]));
    expect(String(nutzlast?.bodyHtml)).toContain(DATEI);
  });

  // ==============================================================================================
  // B3 · DERSELBE WEG, DEN DIE CHROMIUM-STRECKE GEHT: GANZDOKUMENT-MODUS, GAR KEINE AUSWERTUNG.
  // ==============================================================================================
  //
  // B1 lässt die Auswertung laufen und leer zurückkommen; P2 (b) der Chromium-Strecke ruft sie NIE
  // (in einer Instanz ohne Modell gibt es sie nicht) und arbeitet ausserdem in der Importart
  // „Ganzes Dokument übernehmen". Dieser Fall bildet genau diese Lage ab — sonst hinge der Nachweis,
  // dass der Speicherweg auch OHNE jeden Auswertungslauf trägt, allein an der teuren Cloud-Strecke.
  it("B3 · Ganzdokument-Modus, keine Auswertung: die Wache speichert die Datei und quittiert „gespeichert“", async () => {
    await entwurfOffenUndLeer();
    await modusWechsel("datei");
    expect(ablegezone()).not.toBeNull();
    await klick(knopf(i18n.t("capture.file.importMode.whole")));
    await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
    // Beleg, dass der Text wirklich gelesen ist (derselbe Satz, auf den die Chromium-Strecke wartet).
    expect(sichtbar()).toContain(i18n.t("capture.file.wholeSourceNote", { name: DATEI }));

    await verlassenDialogOeffnen();
    expect(speichernKnopfDa(), "die Wache bietet im Ganzdokument-Modus kein Speichern an").toBe(
      true,
    );

    await speichernUndWechseln();

    expect(
      anlageversucheJeTitel(),
      "der Speicherweg der Wache hat die Datei nicht angelegt",
    ).toEqual({ [TRAEGER_TITEL]: 1 });
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
    expect(nutzlastJeTitel(TRAEGER_TITEL)).not.toBeNull();
  });

  // ==============================================================================================
  // B2 · DIE GRENZE: EINE DATEI OHNE GELESENEN TEXT BLEIBT NICHT SICHERBAR.
  // ==============================================================================================
  //
  // `onExtractFile` setzt den Dateinamen VOR dem Lesen (`Capture.tsx:3926`) und kehrt bei leerem
  // Ergebnis mit einer Ablehnung zurück, OHNE ihn zu räumen (`:4107-4118`). Genau dann gibt es
  // nichts, was der Ganzdokument-Weg tragen könnte (`ganzdokumentEingabe === null`, `:1132-1143`) —
  // die Wache muss den Verlust benennen, und zwar weiterhin ohne Speicherknopf. Dieselbe Lage hat
  // ein PDF ohne Textebene.
  it("B2 · Datei gewählt, kein Text gelesen: weiterhin Verlust-Dialog mit Grund, ohne Speicherknopf", async () => {
    extrakt.punkte = [];
    await entwurfOffenUndLeer();
    await modusWechsel("datei");
    expect(ablegezone()).not.toBeNull();
    await dateiAblegen(new File([""], LEERE_DATEI, { type: "text/plain" }));
    // Beleg, dass wirklich KEIN Text gelesen wurde: die Fläche lehnt die Datei sichtbar ab.
    expect(
      sichtbar(),
      "der Import hat die leere Datei angenommen — dann misst B2 nicht den Wartezustand",
    ).toContain(i18n.t("capture.file.empty", { name: LEERE_DATEI }));

    await verlassenDialogOeffnen();

    expect(
      speichernKnopfDa(),
      "die Wache bietet Speichern an, obwohl aus der Datei kein Text gelesen wurde",
    ).toBe(false);
    stehtImWacheDialog(VERLUSTTITEL());
    stehtImWacheDialog(DATEIGRUND(LEERE_DATEI));
    // Und es bleibt bei den zwei Wegen des Verlust-Zweigs.
    expect(knopf(i18n.t("nav.guard.stay"))).not.toBeNull();
    expect(knopf(i18n.t("nav.guard.discard"))).not.toBeNull();
  });
});
