// @vitest-environment jsdom
// ================================================================================================
// JOB 3822 — DIE DREI FEHLERWEGE DES GANZDOKUMENT-TRÄGERS, ÜBER DIE WACHE GEMESSEN.
// ================================================================================================
//
// DIE HERKUNFT, wörtlich und vom PRÜFER, nicht von der Steuerung (`archiv/3770/runde-4/ben.md:29`,
// Prüfpunkt 6 „PRÜFLÜCKEN: GRÜN mit Rest"): „Als dauerhafte Tests sinnvoll: B1/B2 übernehmen und
// einen übergroßen Dateiträger über die Wache prüfen." Ben hat B1/B2 an Runde 4 in `/tmp` gefahren
// und danach alles bytegleich zurückgenommen (`ben.md:14-15`) — die zwei Fälle waren damit gemessen
// und trotzdem nirgends im Bestand. Hier stehen sie, und der dritte dazu.
//
// WAS DER TRÄGER IST. Wer im Erfassen-Weg „Aus Datei" ALLE Funde abwählt und dann die Fläche
// verlässt, bekommt seit JOB 3770 keinen Punktentwurf, aber auch keinen stillen Verlust: die Wache
// schickt die geladene Datei über `fileWholeDraft` (`Capture.tsx:3239`) — Volltext als Aussage,
// Quellenvermerk mit Dateinamen im Rumpf, Original als Referenz im Objektspeicher. Der GELUNGENE
// Weg ist in A2/A2b/A2c der Nachbardatei gemessen. Ungemessen waren seine drei FEHLERWEGE:
//
//   B1   Der zweite Anlauf nach einem Anlagefehler lädt das Original NICHT ein zweites Mal.
//        Getragen vom Ref-Cache (`Capture.tsx:1480`, `if (!ref)`): ein Retry referenziert dieselbe
//        `objectId`, statt ein verwaistes zweites Objekt im Store zu hinterlassen.
//   B2   Ein gescheiterter Original-Upload ist NICHT tödlich (`Capture.tsx:1499`) — und er wird
//        GENANNT (`:1558-1565`). Beide Meldewege werden gefahren: `capture.originalAttachFailed`
//        für den allgemeinen Upload-Fehler, `capture.attachTooLarge` für den 413.
//   B3   Eine zu große Datei bekommt „zu groß für den Import" und nicht irgendeinen Techniksatz —
//        und es wurde NICHTS hochgeladen, weil der Preflight VOR dem Upload steht
//        (`Capture.tsx:1472-1474`).
//
// DAS PRODUKT VERHÄLT SICH HEUTE RICHTIG. Der Wert dieser Fälle liegt im Rotwerden: die
// Rotnachweise sind Mutationen an genau den vier oben genannten Produktzeilen, jeweils einzeln
// gefahren und bytegleich zurückgenommen (RUECKGABE, Abschnitt GEGENPROBEN).
//
// DIE ARBEITSTEILUNG gegenüber `tests/app/whole-draft-preflight.test.ts`: DORT steht die
// MUTATIONSEBENE für sich — dieselbe Reihenfolge (htmlOverflow → Preflight → Ref-Cache → finaler
// Guard) an nachgebauten Helferaufrufen, DOM-frei, plus zwei Quelltext-Wächter über die Reihenfolge
// im Text von `Capture.tsx`. HIER steht der WEG ÜBER DIE WACHE: echte Kästchen, echter
// `GuardedLink`, echter Wache-Dialog, echte Modalgrenze, und als Ergebnis der SICHTBARE SATZ und die
// ADRESSE. Keine Zeile verdoppelt die dortige Ebene; keine dortige Zeile sieht den Dialog.
//
// WAS DIESE DATEI NICHT BEWEIST (wie `dateiweg-abwahl-mounted.test.tsx:14-37`): gemessen wird ein
// gemounteter Baum gegen Attrappen von `drafts.create` und `objects.upload`. Es gibt hier KEINE
// echte HTTP-Grenze (der 413 des Servers wird nachgestellt, nicht erlebt), KEINE DB-Persistenz
// (`server.bestand` ist ein Objekt im Speicher), KEINEN Browser (jsdom rechnet keine Stilklassen
// aus) und keinen Lauf in NL/EN. Ob der Mensch die Fehlermeldung nach dem Wechsel auf `/start` lange
// genug SIEHT, ist eine Frage an den Toast-Zeitgeber und steht hier nicht.
//
// WERKZEUGE: Baum, Bedienhelfer, Messfenster und Attrappen werden IMPORTIERT, nicht abgeschrieben
// (`huelle.tsx`, `attrappen.ts` — Lehre JOB 3572 R1, Prüfpunkt 7). Der eine fehlende Schalter (ein
// scheiternder `objects.upload`) steht in `attrappen.ts` bei seinen Geschwistern, nicht hier.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT,
  DRAFT_PAYLOAD_LIMIT_BYTES,
} from "../../apps/web/src/lib/captureFromFile";
import {
  anlageNutzlasten,
  anlageversucheJeTitel,
  attrappenZuruecksetzen,
  bestandJeTitel,
  draftsCreate,
  extrakt,
  lasseCreateScheiternFuer,
  lasseNaechstenUploadScheitern,
  objectsUpload,
  server,
} from "./attrappen";
import {
  abbauen,
  adresse,
  dateiAblegen,
  erreichbareStellen,
  fundzeilen,
  grundStehtImDialogfeld,
  grundzustand,
  imToast,
  imWacheDialog,
  klick,
  knopf,
  mount,
  sichtbar,
  speichernKnopfDa,
  wacheDialoge,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";

/**
 * Der Titel, unter dem der Dateiträger anlegt: `wholeDocumentTitle` nimmt ohne Markdown-Überschrift
 * den Dateinamen ohne Endung (`captureFromFile.ts:335`, in A2b an „wartungsplan" gemessen).
 *
 * Er ist hier ABSICHTLICH festgenagelt und nicht — wie in A2 — über „welcher Titel ist keiner der
 * Punkte" umschrieben: B1 muss die Anlage GENAU dieses Titels scheitern lassen
 * (`lasseCreateScheiternFuer`), und ein Schalter auf einen Titel, den es nicht gibt, wäre ein
 * stiller Nichtschalter. Damit er das nicht unbemerkt werden kann, verlangt B1 ausdrücklich, dass
 * der erste Druck SCHEITERT (Dialog bleibt, keine Anlage im Bestand) — änderte sich die Namensregel,
 * wäre der Fall rot und nicht grün.
 */
const TRAEGER_TITEL = "bericht";

/** Die drei Funde der Auswertung — sie werden in jedem Fall dieser Datei vollständig abgewählt. */
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
const P3 = {
  title: "Schichtbuch führen",
  summary: "Jede Schicht trägt ihre Störungen ein.",
  sourceExcerpt: "Störungen gehören in das Schichtbuch der jeweiligen Schicht.",
};

/** Der Dateitext — GENAU er ist der Stand, der in B1 und B2 nicht verloren gehen darf. */
const DATEITEXT = [P1.sourceExcerpt, P2.sourceExcerpt, P3.sourceExcerpt].join("\n\n");

// ================================================================================================
// DER WEG ZUR ÜBERGRÖSSE — DIE WAHL UND DIE NICHT GEWÄHLTE ALTERNATIVE (§5.3).
// ================================================================================================
//
// GEWÄHLT: die reine TEXTLÄNGE. Der Ganzdokument-Payload trägt den Text ZWEIMAL — als `statement`
// (Leerraum gefaltet) und als `bodyHtml` (Absätze gerendert, `captureFromFile.ts:463`, `:391`). Eine
// Textdatei, deren Zeichenzahl allein schon die Byte-Grenze erreicht, sprengt den serialisierten
// Payload deshalb sicher, und zwar OHNE jede DOCX-Attrappe: der Weg geht durch `readTextFile` und
// den echten Ablegepfad der Fläche. Die Grenze wird nicht abgeschrieben, sondern aus
// `DRAFT_PAYLOAD_LIMIT_BYTES` (4 500 000) gerechnet — eine Änderung des Limits verschiebt den Fall
// mit, statt ihn stumm grün zu machen. Reiner ASCII: ein Zeichen ist ein Byte, damit „Zeichen" und
// „Bytes" hier dasselbe sagen.
//
// NICHT GEFAHREN: `fileImageInfo.htmlOverflow` (`Capture.tsx:1464`). Dieses Signal setzt nur der
// DOCX-/PPTX-Lesepfad (`readDocxRich`/`readPptxRich`, `Capture.tsx:3919`, `:3946`); es zu erreichen
// verlangte eine echte DOCX-Attrappe mit überlaufendem Bildbudget. Das ist ein eigener Fall und
// steht hier ausdrücklich offen — der Abbruch selbst ist auf der Mutationsebene gemessen
// (`tests/app/whole-draft-preflight.test.ts:133`).
//
// EINMAL gebaut, nicht je Fall: eine Zeichenkette dieser Größe kostet Zeit und Speicher.
const RIESENSATZ = "Diese Zeile steht nur da, damit die Nutzlast die Grenze sprengt. ";
const RIESENTEXT = [
  P1.sourceExcerpt,
  RIESENSATZ.repeat(Math.ceil(DRAFT_PAYLOAD_LIMIT_BYTES / RIESENSATZ.length)),
  P3.sourceExcerpt,
].join("\n\n");
const RIESENDATEI = "riesenbericht.txt";
/** Der Titel, unter dem der übergroße Träger anlegen WÜRDE — er darf nie im Bestand auftauchen. */
const RIESEN_TITEL = "riesenbericht";

/**
 * Datei einlesen und auswerten lassen, dann ALLE Funde abwählen — der Aufbau von A2, hier für jeden
 * Fall derselbe. Danach trägt `dateiTraeger` die Art „ganzdokument" (`Capture.tsx:1148`), und der
 * Weg hinaus geht über `fileWholeDraft`.
 */
async function dateiOhneAuswahl(datei = DATEI, text = DATEITEXT): Promise<void> {
  await mount("/erfassen", "datei", true);
  await dateiAblegen(new File([text], datei, { type: "text/plain" }));
  await klick(knopf(i18n.t("capture.file.searchCta")));
  // Die drei stehen angehakt da — die Voreinstellung, von der aus abgewählt wird. Ohne diese Zeile
  // wüsste kein Fall, ob er die Abwahl oder ein fehlgeschlagenes Einlesen messt.
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: true },
    { titel: P2.title, angehakt: true },
    { titel: P3.title, angehakt: true },
  ]);
  await klick(knopf(i18n.t("capture.file.deselectAll")));
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: false },
    { titel: P2.title, angehakt: false },
    { titel: P3.title, angehakt: false },
  ]);
}

/** Hinauswollen — über das Produktbauteil `GuardedLink`, wie jeder Menü- und Kachelklick. */
async function hinauswollen(): Promise<void> {
  await klick(wechselLink() as HTMLAnchorElement);
  expect(wacheDialoge()).toBe(1);
  // Es wird überhaupt angeboten, zu sichern — sonst messen die Fälle unten nichts.
  expect(speichernKnopfDa()).toBe(true);
}

/** Ein Druck auf „Entwurf speichern und wechseln". */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf(i18n.t("nav.guard.save")));
}

/** Die Nutzlast des Trägers, wie sie wirklich zum Server ginge — beim n-ten Versuch. */
function traegerVersuch(n: number): Record<string, unknown> {
  const versuche = anlageNutzlasten(TRAEGER_TITEL);
  expect(versuche.length, `weniger als ${n} Anlageversuche für „${TRAEGER_TITEL}"`).toBeGreaterThan(
    n - 1,
  );
  return versuche[n - 1] as Record<string, unknown>;
}

/** Der Text im Fehlerfeld des Dialogs — der Satz, den der Mensch dort wirklich liest. */
function dialogFehlertext(): string {
  return (document.querySelector("[data-navguard-save-error]")?.textContent ?? "").replace(
    /\s+/g,
    " ",
  );
}

beforeEach(async () => {
  await grundzustand();
  extrakt.punkte = [P1, P2, P3];
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3822 · der Ganzdokument-Träger in seinen drei Fehlerwegen", () => {
  // ==============================================================================================
  // B1 · WIEDERHOLUNG NACH ANLAGEFEHLER — DAS ORIGINAL GEHT NICHT ZWEIMAL IN DEN SPEICHER.
  // ==============================================================================================
  //
  // DIE PRODUKTSTELLE, DIE DAS TRÄGT: der Ref-Cache in `Capture.tsx:1480`. Der Upload legt das
  // Original UNWIDERRUFLICH ab; der erste Anlauf füllt deshalb `fileOriginalRef`, und der zweite
  // nimmt dieselbe `objectId`. Ohne ihn hinterliesse jeder Wiederholungsdruck ein weiteres Objekt im
  // Store, von dem am Ende genau eines referenziert wird — der Rest liegt für immer verwaist darin.
  //
  // Gemessen wird der VOLLE Weg: erster Druck scheitert an `drafts.create` (der Dialog bleibt offen,
  // die Fläche behält ihren Dateizustand), zweiter Druck gelingt.
  it("B1 · zweiter Anlauf nach Anlagefehler: ein Upload, ein Objekt, ein Entwurf", async () => {
    // Der Trägertitel scheitert — SOLANGE er im Schalter steht (`attrappen.ts:44`).
    lasseCreateScheiternFuer(TRAEGER_TITEL);
    await dateiOhneAuswahl();
    await hinauswollen();

    await speichernUndWechseln();

    // ---- Nach dem ERSTEN Druck: hochgeladen ist, angelegt ist nicht. --------------------------
    // Das Original liegt schon im Store — genau das ist die Lage, in der ein zweiter Upload
    // entstehen könnte.
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.objekte)).toHaveLength(1);
    // Der Versuch lief, der Entwurf entstand nicht.
    expect(anlageversucheJeTitel()[TRAEGER_TITEL]).toBe(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();
    // Und gewechselt wird NICHT: der Dialog hält, und nichts behauptet „gesichert".
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
    expect(sichtbar()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));

    // ---- Der ZWEITE Druck, diesmal nimmt der Server an. --------------------------------------
    lasseCreateScheiternFuer();
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    // DER KERN: kein zweiter Upload, kein zweites Objekt — auch nicht eines, das niemand nennt.
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    const objekte = Object.keys(server.objekte);
    expect(objekte).toHaveLength(1);

    // Der Entwurf steht EINMAL im Bestand, nicht zweimal — bei zwei Anlageversuchen.
    expect(anlageversucheJeTitel()[TRAEGER_TITEL]).toBe(2);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    // Kein Punktentwurf daneben: die Auswahl gilt weiter (JOB 3770).
    expect(anlageversucheJeTitel()[P1.title]).toBeUndefined();
    expect(anlageversucheJeTitel()[P3.title]).toBeUndefined();
    expect(draftsCreate).toHaveBeenCalledTimes(2);

    // Und der Rumpf zeigt auf GENAU DIESES EINE Objekt — nicht bloss „auf irgendeines".
    const gelungen = traegerVersuch(2);
    expect(String(gelungen.bodyHtml)).toContain(String(objekte[0]));
    expect(String(gelungen.statement)).toContain(P1.sourceExcerpt);
    expect(String(gelungen.statement)).toContain(P3.sourceExcerpt);
    // Derselbe Verweis wie beim ersten, gescheiterten Versuch: es ist dieselbe Ablage.
    expect(String(traegerVersuch(1).bodyHtml)).toContain(String(objekte[0]));

    // Erst JETZT ist gewechselt, und der Mensch erfährt, was gesichert wurde.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));
  });

  // ==============================================================================================
  // B2 · DER UPLOADFEHLER IST NICHT TÖDLICH — UND ER WIRD GENANNT.
  // ==============================================================================================
  //
  // „Ehrlichkeit vor Optik", und zwar in BEIDE Richtungen (Produktkommentar `Capture.tsx:1556`):
  // der Text-Import ist gesichert und bleibt es (kein Abbruch, der Wechsel findet statt) — aber der
  // Import darf nicht wie eine Voll-Übernahme aussehen. Der fehlende Original-Anhang steht als
  // eigener Satz da.
  //
  // DIE HALBHEIT, DIE DIESER FALL AUSSCHLIESST: nur zu prüfen, dass der Träger entsteht. Das wäre
  // auch an einem Produkt grün, das den Uploadfehler verschweigt — deshalb wird der Erfolgssatz
  // ausdrücklich NICHT ALLEIN zugelassen.
  it("B2 · Uploadfehler (allgemein): Volltext gesichert, Wechsel geschieht, Fehler ist sichtbar", async () => {
    lasseNaechstenUploadScheitern(new Error("Objektspeicher nicht erreichbar"));
    await dateiOhneAuswahl();
    await hinauswollen();

    await speichernUndWechseln();

    // Versucht wurde der Upload, abgelegt wurde nichts.
    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.objekte)).toHaveLength(0);

    // DER TRÄGER ENTSTEHT TROTZDEM und hält den Volltext — dieselbe Schärfe wie A2.
    const traeger = traegerVersuch(1);
    expect(String(traeger.statement)).toContain(P1.sourceExcerpt);
    expect(String(traeger.statement)).toContain(P3.sourceExcerpt);
    expect(String(traeger.bodyHtml)).toContain(DATEI);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    // Und er trägt KEINE Objektreferenz: ein Verweis auf ein Objekt, das es nicht gibt, wäre eine
    // zweite Unwahrheit neben der verschwiegenen (`fileLinkHtml` baut `/api/objects/<id>/raw`).
    expect(String(traeger.bodyHtml)).not.toContain("/api/objects/");

    // Der Wechsel FINDET STATT — ein gescheiterter Anhang hält den Menschen nicht fest.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");

    // Und er erfährt beides: dass der Text gesichert ist UND dass das Original fehlt.
    const fehlersatz = i18n.t("capture.originalAttachFailed", { name: DATEI });
    expect(sichtbar()).toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));
    expect(
      sichtbar(),
      "der Erfolgssatz steht ALLEIN — der Uploadfehler ist verschwiegen",
    ).toContain(fehlersatz);
    // Nicht bloss irgendwo im Baum: der Satz ist nach dem Wechsel auch erreichbar (der Toast lebt
    // über der Route, `huelle.tsx`: `ToastViewport` steht ausserhalb des Routers).
    expect(
      erreichbareStellen(fehlersatz).length,
      "der Satz steht nur im verborgenen Teil",
    ).toBeGreaterThan(0);
    // Und es ist der Satz für „Upload gescheitert", nicht der für „zu groß" (beide Wege unten).
    expect(sichtbar()).not.toContain(i18n.t("capture.attachTooLarge", { name: DATEI }));
  });

  // ==============================================================================================
  // B2b · DERSELBE WEG MIT DEM ANDEREN GRUND — DER 413 SAGT „ZU GROSS", NICHT „FEHLGESCHLAGEN".
  // ==============================================================================================
  //
  // `Capture.tsx:1558-1565` kennt ZWEI Meldewege, und `classifyUploadError`
  // (`captureAttachments.ts:71`) trennt sie am Status 413. Ohne diesen Fall wäre B2 auch an einem
  // Produkt grün, das beide Gründe in denselben Satz wirft — und der Mensch wüsste nicht, ob er die
  // Datei verkleinern soll oder es einfach nochmal versuchen.
  //
  // Der Fehler trägt ABSICHTLICH keinen Größenwortlaut in der Meldung („413"): `classifyUploadError`
  // prüft Status UND Wortlaut, und nur so misst der Fall die Statuskante statt der Textkante.
  it("B2b · Uploadfehler 413: derselbe gesicherte Volltext, aber der Satz „zu groß für den Anhang“", async () => {
    lasseNaechstenUploadScheitern(Object.assign(new Error("413"), { status: 413 }));
    await dateiOhneAuswahl();
    await hinauswollen();

    await speichernUndWechseln();

    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.objekte)).toHaveLength(0);
    // Der Text-Import bleibt auch hier erhalten — das sagt der Satz zu, und es stimmt auch. In
    // DERSELBEN Schärfe wie B2 (JOB 3822 R1, ben Prüfpunkt 4): erster UND letzter Absatz, damit der
    // Fall nicht an einem abgeschnittenen Volltext grün bliebe, und der Dateiname im Rumpf.
    const traeger = traegerVersuch(1);
    expect(String(traeger.statement)).toContain(P1.sourceExcerpt);
    expect(String(traeger.statement)).toContain(P3.sourceExcerpt);
    expect(String(traeger.bodyHtml)).toContain(DATEI);
    expect(String(traeger.bodyHtml)).not.toContain("/api/objects/");
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    // Der Wechsel findet statt und der Dialog ist zu — auch der 413 hält den Menschen nicht fest.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");

    // DER UNTERSCHIED: „zu groß für den Anhang" — und ausdrücklich NICHT der allgemeine Satz.
    const zuGross = i18n.t("capture.attachTooLarge", { name: DATEI });
    expect(sichtbar()).toContain(zuGross);
    expect(sichtbar()).not.toContain(i18n.t("capture.originalAttachFailed", { name: DATEI }));
    expect(erreichbareStellen(zuGross).length).toBeGreaterThan(0);
    // Und der Erfolgssatz steht auch hier nicht allein.
    expect(sichtbar()).toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));
  });

  // ==============================================================================================
  // B3 · DER ÜBERGROSSE TRÄGER AN DER WACHE — „ZU GROSS", UND NICHTS IM SPEICHER.
  // ==============================================================================================
  //
  // Bens Bestellung, wörtlich: „einen übergroßen Dateiträger über die Wache prüfen"
  // (`ben.md:29`). Zwei Zusagen hängen daran, und keine ist heute gemessen:
  //
  //   1. DER SATZ. `Capture.tsx:3248-3250` unterscheidet den Größenfall vom Rest und gibt
  //      `tooLargeForImport` in den Dialog. Ohne diese Zeile stünde dort `fehlersatz(e)`, also für
  //      einen `DraftPayloadTooLargeError` (keine `ApiError`) das nackte „Etwas ist schiefgelaufen."
  //      — der Mensch wüsste nicht, dass er die Datei teilen muss.
  //   2. NICHTS WURDE HOCHGELADEN. Der Preflight `:1472-1474` steht genau dafür da. Fällt er weg,
  //      landet das Original VOR dem Abbruch im Store und bleibt dort verwaist liegen: ein Schaden,
  //      den der Mensch nie sieht und den heute kein Test an der Wache bemerkt.
  it("B3 · zu große Datei: Dialog bleibt, Satz „zu groß für den Import“, kein Upload", async () => {
    await dateiOhneAuswahl(RIESENDATEI, RIESENTEXT);
    await hinauswollen();

    await speichernUndWechseln();

    // ---- NICHTS WURDE HOCHGELADEN. Das ist der eigentliche Wert dieses Falls. -----------------
    expect(objectsUpload).toHaveBeenCalledTimes(0);
    expect(Object.keys(server.objekte)).toHaveLength(0);
    // Und angelegt wurde auch nichts: der Abbruch kommt vor `drafts.create`.
    expect(draftsCreate).toHaveBeenCalledTimes(0);

    // ---- NICHTS BEHAUPTET „GESICHERT". -------------------------------------------------------
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
    expect(bestandJeTitel()[RIESEN_TITEL]).toBeUndefined();
    expect(sichtbar()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: RIESENDATEI }));

    // ---- DER SATZ, UND ZWAR UNTERSCHEIDBAR. --------------------------------------------------
    const zuGross = i18n.t(CAPTURE_FILE_TEXT.tooLargeForImport);
    // Er steht erreichbar an der Stelle, die der Dialog dafür hat. Nicht die strengere Zusage
    // `grundIstImDialog` des Teilfehlerpfads: dieser Weg meldet den Satz ZUSÄTZLICH als Toast
    // (`Capture.tsx:1572`), und der Viewport hängt ausserhalb der Modalgrenze — gemessen, siehe die
    // Begründung an `grundStehtImDialogfeld` in der Hülle.
    grundStehtImDialogfeld(zuGross);
    // Und die weiteren erreichbaren Fundstellen sind genau das: Toasts. Kein Satz kommt aus dem per
    // `inert` gesperrten Fehlerkasten der Seite — dort wäre er für Tastatur und Screenreader nicht da.
    const offen = erreichbareStellen(zuGross);
    expect(
      offen.map((el) => imWacheDialog(el) || imToast(el)),
      "erreichbare Fundstelle weder im Dialog noch in einem Toast",
    ).toEqual(offen.map(() => true));
    // Die Abgrenzung: es ist NICHT der allgemeine Fehlersatz und nicht die rohe `Error`-Meldung.
    // Ohne diese zwei Zeilen wäre der Fall auch an einem Produkt grün, das jeden Fehler gleich
    // benennt — er unterschiede „zu groß" dann nicht von „Server weg".
    expect(dialogFehlertext()).not.toContain(i18n.t("state.error"));
    expect(dialogFehlertext()).not.toContain("DRAFT_PAYLOAD_TOO_LARGE");
  });

  // ==============================================================================================
  // B3b · DIE KALIBRIERUNG — DERSELBE WEG MIT EINER NORMALEN DATEI IST GRÜN.
  // ==============================================================================================
  //
  // Ein Fall, der bei JEDEM Fehler rot wird, unterscheidet „zu groß" nicht von „irgendetwas kaputt".
  // Diese Zeile hält fest, dass der ungestörte Durchlauf desselben Wegs durchgeht: derselbe Aufbau,
  // nur eine Datei normaler Größe — Upload, Anlage, Wechsel, Erfolgssatz, und der Größensatz kommt
  // NICHT. Sie ist bewusst kurz: den Inhalt des Trägers messen A2/A2b/A2c der Nachbardatei.
  it("B3b · dieselbe Bahn mit normaler Datei: gesichert, gewechselt, kein Größensatz", async () => {
    await dateiOhneAuswahl();
    await hinauswollen();

    await speichernUndWechseln();

    expect(objectsUpload).toHaveBeenCalledTimes(1);
    expect(Object.keys(server.objekte)).toHaveLength(1);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBe(1);
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));
    expect(sichtbar()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.tooLargeForImport));
    // Und kein Wort über ein fehlendes Original — es ist ja da (Abgrenzung gegen B2/B2b).
    expect(sichtbar()).not.toContain(i18n.t("capture.originalAttachFailed", { name: DATEI }));
    expect(sichtbar()).not.toContain(i18n.t("capture.attachTooLarge", { name: DATEI }));
  });

  // ==============================================================================================
  // S1 · DIE VORRICHTUNG SELBST — DER UPLOAD-EINMALFEHLER VERBRAUCHT SICH WIRKLICH.
  // ==============================================================================================
  //
  // Bestellt von ben (JOB 3822 R1, Prüfpunkt 6): „Sinnvoll wäre zusätzlich eine isolierte Gegenprobe
  // für den verbrauchenden Uploadfehlerschalter." Der Grund ist keine Förmlichkeit: B2/B2b sagen zu,
  // dass EIN Upload scheitert. Wäre `lasseNaechstenUploadScheitern` in Wahrheit eine stehende
  // Umschaltung, blieben beide Fälle trotzdem grün — sie fahren ja nur einen Versuch —, aber der
  // Schalter risse jeden nachfolgenden Fall des Ordners mit, und B1 („der zweite Anlauf gelingt")
  // liesse sich mit ihm gar nicht bauen. Diese Zeile misst deshalb die Vorrichtung, nicht das
  // Produkt: kein Mount, keine Fläche, nur die Attrappe (`attrappen.ts:197`, `:261`).
  it("S1 · Kalibrierung der Attrappe: der Einmalfehler trifft nur den nächsten Upload", async () => {
    const gesetzt = new Error("Objektspeicher nicht erreichbar");
    lasseNaechstenUploadScheitern(gesetzt);

    // Der nächste Upload scheitert — und zwar mit GENAU dem gesetzten Fehler, nicht mit irgendeinem.
    await expect(objectsUpload({ name: DATEI, mime: "text/plain", data: "eins" })).rejects.toBe(
      gesetzt,
    );
    expect(Object.keys(server.objekte)).toHaveLength(0);

    // Der übernächste gelingt wieder und legt wirklich ab — der Schalter ist verbraucht.
    const ref = await objectsUpload({ name: DATEI, mime: "text/plain", data: "zwei" });
    expect(Object.keys(server.objekte)).toHaveLength(1);
    expect(server.objekte[String(ref.id)]?.data).toBe("zwei");

    // Und ein gesetzter, NIE verbrauchter Schalter (so liegt die Lage nach B3: der Größenabbruch
    // kommt vor dem Upload) reicht nicht in den nächsten Fall hinein — `attrappenZuruecksetzen()`
    // löscht ihn. Ohne diese Zeile wäre der Nachhall aus B3 erst am nächsten roten Nachbarn zu sehen.
    lasseNaechstenUploadScheitern(new Error("darf nie geworfen werden"));
    await attrappenZuruecksetzen();
    await expect(
      objectsUpload({ name: DATEI, mime: "text/plain", data: "drei" }),
    ).resolves.toMatchObject({ name: DATEI });
  });
});
