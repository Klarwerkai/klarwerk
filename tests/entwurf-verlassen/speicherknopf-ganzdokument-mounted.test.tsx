// @vitest-environment jsdom
// ================================================================================================
// JOB 4352 — DER SICHTBARE SPEICHERKNOPF SICHERT AUCH DIE GELADENE DATEI.
// ================================================================================================
//
// DER BEFUND, wörtlich aus der Rückgabe der Vorrunde (`archiv/4335/runde-4/RUECKGABE.md:70`,
// Lieferpunkt, und `:78`, REST): „Manueller Speicherknopf: sichert weiterhin nur den Formularstand
// (`Capture.tsx:4774`, `:4801` `saveDraft.mutate()`); die Datei bleibt dabei auf der Fläche … Es ist
// NICHT derselbe Weg wie der Wache-Rückruf (der ruft `fileWholeDraft`) — auftragsgemäss
// offengelegter Folgepunkt, nicht repariert."
//
// WAS DARAN FALSCH WAR — und es ist derselbe Widerspruch, den JOB 4335 eine Ebene höher schon
// abgetragen hat: DIESELBE Fläche kennt zwei Antworten auf die Frage „wer trägt die geladene
// Datei?". Der Rückruf der Verlassen-Wache fragt `dateiTraeger` und schickt den Ganzdokument-Fall
// über `fileWholeDraft` (`Capture.tsx`, Zweig `dateiTraeger?.art === "ganzdokument"`). Der sichtbare
// Knopf daneben fragte gar nicht — er schrieb den Formularstand und liess die Datei liegen. Für den
// Menschen sah beides gleich aus: er drückte „Als Entwurf speichern" und hatte seine Datei danach
// NICHT gesichert.
//
// DAZU KAM DIE ANGEBOTSFRAGE: im Dateiweg ohne geöffneten Entwurf ist `raw` leer, es gibt keinen
// `draft` und keine `draftId` — der Knopf stand also GRAU da, obwohl sehr wohl etwas zu sichern war.
// Ein Speicherweg, der nicht angeboten wird, ist für den Menschen kein Speicherweg.
//
// ── WAS DIESE DATEI MISST ────────────────────────────────────────────────────────────────────────
//
//   S1  Datei geladen, NICHT ausgewertet, nichts getippt: der Knopf ist betätigbar, und nach dem
//       Druck trägt ein Entwurf im Bestand den Dateiinhalt samt Herkunft — und die Quittung nennt
//       genau diese Sicherung. KEIN zweiter, leerer Eintrag daneben.
//   S2  Derselbe Weg MIT Auswertungsfunden: unverändert. Die Funde tragen die Datei (`art:
//       "punkte"`), der Knopf bietet nichts Neues an und legt nichts an.
//   S2b Funde vorhanden, ALLE abgewählt: dann trägt sie wieder das ganze Dokument — dieselbe
//       Rangfolge, die `dateiTraeger` für die Wache hält. Ein zweiter Begriff daneben wäre die
//       Stelle, an der Knopf und Wache über DENSELBEN Zustand Gegenteiliges sagen.
//   S3  Ohne geladene Datei: unverändert — Formularstand, dieselbe Quittung, kein Objekt-Upload.
//
// WAS DIESE DATEI NICHT BEWEIST (wie `dateiweg-abwahl-mounted.test.tsx:14-37`): gemessen wird ein
// gemounteter Baum gegen Attrappen von `drafts.*` und `objects.upload`. Keine echte HTTP-Grenze,
// keine Datenbank (`server.bestand` ist ein Objekt im Speicher), kein Browser (jsdom rechnet keine
// Stilklassen aus), kein Lauf in NL/EN. Der Weg an der echten Oberfläche gegen echtes PostgreSQL
// steht in `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts` daneben.
//
// WERKZEUGE: Baum, Bedienhelfer, Messfenster und Attrappen werden IMPORTIERT, nicht abgeschrieben
// (`huelle.tsx`, `attrappen.ts` — Lehre JOB 3572 R1, Prüfpunkt 7).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import {
  bestandJeTitel,
  draftsCreate,
  draftsUpdate,
  extrakt,
  nutzlastJeTitel,
  objectsUpload,
  server,
} from "./attrappen";
import {
  ENTWURF_ID,
  abbauen,
  dateiAblegen,
  feld,
  flaeche,
  fundzeilen,
  grundzustand,
  klick,
  knopf,
  mount,
  sichtbar,
  tippe,
} from "./huelle";

const DATEI = "bericht.txt";

/**
 * Der Titel, unter dem der Ganzdokument-Weg anlegt: ohne Markdown-Überschrift der Dateiname ohne
 * Endung (`captureFromFile.ts`, `wholeDocumentTitle`). Er ist der Messschlüssel im Bestand.
 */
const TRAEGER_TITEL = "bericht";

/** Die Funde, die die KI-Auswertung liefert, wenn ein Fall sie anfordert. */
const P1 = {
  title: "Dosierwert prüfen",
  summary: "Nach Schichtwechsel den Dosierwert kontrollieren.",
  sourceExcerpt: "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
};
const P2 = {
  title: "Filter wechseln",
  summary: "Der Filter wird monatlich gewechselt.",
  sourceExcerpt: "Ein Wechsel des Filters erfolgt monatlich.",
};

/** Der Dateitext — GENAU er muss nach dem Druck im Bestand stehen. Ohne Markdown-Überschrift. */
const DATEITEXT = [P1.sourceExcerpt, P2.sourceExcerpt].join("\n\n");

/**
 * Der MANUELLE Speicherknopf — an seiner vollständigen Beschriftung, nicht an einem Teilstück.
 *
 * WARUM EXAKT UND NICHT `includes`: die Ganzdokument-Karte trägt auf derselben Fläche den Knopf
 * „Ganzes Dokument als Entwurf speichern" (`CAPTURE_FILE_TEXT.wholeCta`). Ein Teilstückvergleich
 * träfe je nach Sprache beide, und dieser Fall misst gerade den UNTERSCHIED zwischen ihnen. Die
 * Fehlermeldung nennt, was wirklich dastand — sonst rät der nächste Leser.
 */
function speicherKnopf(): HTMLButtonElement {
  const gesucht = String(i18n.t("capture.saveDraft"));
  const knoepfe = [...flaeche().querySelectorAll("button")];
  const treffer = knoepfe.find(
    (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === gesucht,
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(
      `Der manuelle Speicherknopf „${gesucht}" steht nicht auf der Fläche. Vorhandene Knöpfe: ${knoepfe
        .map((b) => `«${(b.textContent ?? "").replace(/\s+/g, " ").trim()}»`)
        .join(", ")}`,
    );
  }
  return treffer;
}

/** Die Nutzlast des Ganzdokument-Trägers im Bestand — `null`, wenn ihn niemand angelegt hat. */
function traegerNutzlast(): Record<string, unknown> | null {
  return nutzlastJeTitel(TRAEGER_TITEL);
}

/** Datei in die Fläche geben, OHNE sie auswerten zu lassen. */
async function dateiOhneAuswertung(): Promise<void> {
  await mount("/erfassen", "datei");
  await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
  // „Nicht ausgewertet" wird gemessen und nicht angenommen: stünde hier schon eine Fundzeile,
  // misst der Fall einen anderen Zustand als den, über den er urteilt.
  expect(fundzeilen()).toEqual([]);
}

beforeEach(async () => {
  await grundzustand();
  extrakt.punkte = [];
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 4352 · der sichtbare Speicherknopf und die geladene Datei", () => {
  // ==============================================================================================
  // S1 · DER FALL AUS DEM AUFTRAG — geladen, nicht ausgewertet, gedrückt.
  // ==============================================================================================
  it("S1 · Datei geladen und nicht ausgewertet: der Knopf ist betätigbar und der Entwurf trägt danach den Dateiinhalt", async () => {
    await dateiOhneAuswertung();

    // ---- Die Angebotsfrage: ohne diesen Knopf gibt es den Weg für den Menschen nicht. --------
    expect(
      speicherKnopf().disabled,
      "der manuelle Speicherknopf ist grau, obwohl eine gelesene Datei auf der Fläche liegt",
    ).toBe(false);

    await klick(speicherKnopf());

    // ---- Die unabhängige Probe im Bestand: nicht die Fläche, sondern die Nutzlast. -----------
    const nutzlast = traegerNutzlast();
    expect(
      nutzlast,
      `kein Entwurf mit dem Trägertitel „${TRAEGER_TITEL}" im Bestand — angelegt wurde: ${JSON.stringify(bestandJeTitel())}`,
    ).not.toBeNull();
    expect(
      String(nutzlast?.statement ?? ""),
      "die Aussage des Entwurfs trägt den Dateitext nicht",
    ).toContain(P1.sourceExcerpt);
    expect(
      String(nutzlast?.statement ?? ""),
      "die Aussage des Entwurfs trägt den zweiten Absatz der Datei nicht",
    ).toContain(P2.sourceExcerpt);
    expect(
      String(nutzlast?.bodyHtml ?? ""),
      "der Rumpf nennt die Herkunft (Dateiname) nicht",
    ).toContain(DATEI);

    // Das Original ist gesichert und im Rumpf verlinkt — dieselbe Zusage wie am Ganzdokument-Knopf.
    expect(
      objectsUpload,
      "das Original wurde nicht in den Objektspeicher gelegt",
    ).toHaveBeenCalledTimes(1);
    const objektId = Object.keys(server.objekte)[0] ?? "(keins)";
    expect(String(nutzlast?.bodyHtml ?? ""), "die Originalreferenz steht nicht im Rumpf").toContain(
      objektId,
    );

    // ---- KEIN zweiter, leerer Eintrag daneben (die Lehre aus JOB 3770 R4). -------------------
    expect(
      draftsCreate,
      "es wurde mehr als EIN Entwurf angelegt — der Formularweg hat daneben einen leeren Eintrag geschrieben",
    ).toHaveBeenCalledTimes(1);
    expect(draftsUpdate, "der gespeicherte Entwurf wurde angefasst").not.toHaveBeenCalled();
    expect(bestandJeTitel()[String(i18n.t("capture.draftFallbackTitle"))]).toBeUndefined();

    // ---- Die Quittung nennt die Sicherung. ---------------------------------------------------
    expect(sichtbar(), "die Quittung nennt die gesicherte Datei nicht").toContain(
      String(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI })),
    );
  });

  // ==============================================================================================
  // S2 · MIT AUSWERTUNGSFUNDEN — UNVERÄNDERT.
  // ==============================================================================================
  //
  // Solange Funde ANGEHAKT sind, tragen sie die Datei (`dateiTraeger.art === "punkte"`), und dafür
  // hat die Fläche ihren eigenen sichtbaren Knopf in der Fundliste. Der manuelle Speicherknopf hat
  // hier nichts Neues zu tun — und er bietet auch nichts an: seine Angebotsfrage ist die alte
  // geblieben (getippter Inhalt oder ein geöffneter Entwurf), und im Dateiweg ohne Entwurf ist sie
  // verneint. Das ist der Zustand von vor diesem Auftrag, Zeichen für Zeichen.
  it("S2 · mit Auswertungsfunden verhält sich der Knopf unverändert: kein Angebot, keine Anlage", async () => {
    extrakt.punkte = [P1, P2];
    await mount("/erfassen", "datei");
    await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
    await klick(knopf(String(i18n.t(CAPTURE_FILE_TEXT.searchCta))));
    expect(fundzeilen()).toEqual([
      { titel: P1.title, angehakt: true },
      { titel: P2.title, angehakt: true },
    ]);

    expect(
      speicherKnopf().disabled,
      "der manuelle Speicherknopf bietet sich bei angehakten Funden an — das ist neu und war nicht verlangt",
    ).toBe(true);

    // Und in diesem Zustand ist auch wirklich nichts hinausgegangen: weder ein Ganzdokument-Entwurf
    // noch ein Punktentwurf, noch ein Original im Speicher. Die Fundliste hat für ihren Weg ihren
    // eigenen sichtbaren Knopf; dieser hier hat nichts angefasst.
    expect(draftsCreate, "es wurde trotz angehakter Funde angelegt").not.toHaveBeenCalled();
    expect(objectsUpload, "es wurde trotz angehakter Funde hochgeladen").not.toHaveBeenCalled();
    expect(traegerNutzlast(), "es steht ein Ganzdokument-Entwurf im Bestand").toBeNull();
  });

  // ==============================================================================================
  // S2b · ALLE FUNDE ABGEWÄHLT — dann trägt wieder das ganze Dokument.
  // ==============================================================================================
  //
  // DIE ENTSCHEIDUNG DIESES AUFTRAGS, ausgeschrieben: der Knopf fragt DENSELBEN Begriff wie die
  // Wache (`dateiTraeger`) und nicht eine zweite, eigene Bedingung („es gab noch keine
  // Auswertung"). Zwei Begriffe über denselben Zustand sind genau der Fehler, den JOB 4335
  // abgetragen hat. Seit JOB 3770 R4 gilt: angehakte Funde tragen die Datei, sonst das ganze
  // Dokument — und ab hier sagt der sichtbare Knopf dasselbe wie der Weg beim Verlassen.
  it("S2b · alle Funde abgewählt: der Knopf trägt die Datei als ganzes Dokument, wie der Weg beim Verlassen", async () => {
    extrakt.punkte = [P1, P2];
    await mount("/erfassen", "datei");
    await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
    await klick(knopf(String(i18n.t(CAPTURE_FILE_TEXT.searchCta))));
    await klick(knopf(String(i18n.t(CAPTURE_FILE_TEXT.deselectAll))));
    expect(fundzeilen()).toEqual([
      { titel: P1.title, angehakt: false },
      { titel: P2.title, angehakt: false },
    ]);

    expect(speicherKnopf().disabled).toBe(false);
    await klick(speicherKnopf());

    const nutzlast = traegerNutzlast();
    expect(
      nutzlast,
      `kein Ganzdokument-Entwurf im Bestand — angelegt wurde: ${JSON.stringify(bestandJeTitel())}`,
    ).not.toBeNull();
    expect(String(nutzlast?.statement ?? "")).toContain(P1.sourceExcerpt);
    // Die abgewählten Funde sind KEINE Entwürfe geworden — die Auswahl gilt.
    expect(bestandJeTitel()[P1.title]).toBeUndefined();
    expect(bestandJeTitel()[P2.title]).toBeUndefined();
  });

  // ==============================================================================================
  // S3 · OHNE GELADENE DATEI — Formularstand, gleiche Quittung.
  // ==============================================================================================
  it("S3 · ohne geladene Datei bleibt der Knopf wie bisher: Formularstand, dieselbe Quittung", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), "Zahlungsziel neu");

    expect(speicherKnopf().disabled).toBe(false);
    await klick(speicherKnopf());

    expect(draftsUpdate, "der geöffnete Entwurf wurde nicht aktualisiert").toHaveBeenCalledTimes(1);
    expect(draftsCreate, "es entstand ein zweiter Entwurf").not.toHaveBeenCalled();
    expect(objectsUpload, "ohne Datei wurde ein Objekt hochgeladen").not.toHaveBeenCalled();
    expect(sichtbar(), "die Quittung des Formularwegs hat sich geändert").toContain(
      String(i18n.t("capture.draftUpdated")),
    );
    // Und keine Datei-Quittung daneben: es gab keine Datei.
    expect(sichtbar()).not.toContain(String(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI })));
  });
});
