// @vitest-environment jsdom
// ================================================================================================
// JOB 3057 · K2 — DAS FUNKTIONSINVENTAR: „heute → neuer Ort“, jede Zeile AUSGEFUEHRT.
// ================================================================================================
//
// PEDI (04.09. 07:58): „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenues." Der Umbau der Erfassen-Flaeche (Auftrag §5a) darf keine Funktion
// kosten — was aus dem Sichtfeld geht, bekommt einen benannten Ort. Diese Datei ist die Tabelle
// „heute → neuer Ort“, und jede Zeile wird am LAUFENDEN Aufgabenfenster ausgefuehrt (LEHREN, JOB
// 3062: reine Text- oder Elementpraesenz zaehlt nicht — Wirkungsnachweis je Zeile).
//
// Ausgefuehrt wird das ausgelieferte Inline-Skript im jsdom (tests/app/klara-panel-fixture.ts,
// `createKlaraPanel` mit Textmarkierung); der Dokument-Weg bekommt ein `Word.run`, das den
// Dokumentkoerper liefert.
//
// | heute (Basis 665aec8)                              | neuer Ort (JOB 3057)                              | Fall |
// |----------------------------------------------------|---------------------------------------------------|------|
// | #scope-selection „Markierter Text“ (Radio)         | Markierungskarte: #capture-kicker + .capture-absatz| I1   |
// | #scope-document „Ganzes Dokument“ (Radio)          | Textlink #capture-dokument-link (loest den Weg aus)| I2   |
// | #scope-pages (deaktiviert) + scopePagesOff-Tooltip | „?“-Menue: #capture-hinweis-seiten (EIN Satz)      | I3   |
// | #scope-pages-hint (scopePagesHint)                 | derselbe Satz, „?“-Menue                          | I3   |
// | #capture-bilder-hinweis (sendImagesNote + Link)    | „?“-Menue, gleiche Kennung, Link nach /erfassen   | I4   |
// | sendHint (Umfang, Formatierung)                    | „?“-Menue: #capture-hinweis-umfang                 | I5   |
// | #send-review-note (sendReviewNote, Pruefhinweis)   | „?“-Menue: #capture-hinweis-pruefung               | I6   |
// | #send-btn „Als Entwurf senden“                     | #send-btn (frei nur mit Markierung)               | I7   |
// | #open-block / #open-link „Entwurf oeffnen“         | Ergebniszeile #capture-ergebnis + #open-link „Oeffnen“| I8 |
// | sendOk „Entwurf angelegt: {title}“ im Statusfeld   | #capture-ergebnis „Entwurf gesendet“; Titel im Payload| I8 |
// | #send-status Fehlersatz (413/403/429/offline)      | #send-status EIN Satz + #send-status-btn „Erneut senden“| I9 |
// | sendAuth (401)                                     | #send-status + #send-status-btn „Anmelden“        | I10  |
// | #office-hint (noOffice) + title am Knopf           | #office-hint EIN Satz + #office-hint-btn „Neu laden“| I11 |
// | sendImagesMissing/-Dropped/OverBudget/PlainFallback im Statusfeld | EIN Satz #capture-bilder-satz + Link „In KLARWERK ergaenzen“ | I12 |
// | captureCardTitle (h2 der Karte)                    | h2.nur-vorlesen (Hilfstechnik)                    | I13  |
// | — (neu) Zeile „Titel“                              | #capture-titel, editierbar, reist als Titel       | I14  |
// | — (neu) ohne Markierung                            | #capture-leer „Markiere Text in Word.“, Knopf grau| I15  |
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";
const DOKUMENT = ["Dokumenttext eins.", "Dokumenttext zwei."];

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
  Reflect.deleteProperty(globalThis, "Word");
});

function oeffnen(opts: Parameters<typeof createKlaraPanel>[0] = {}): KlaraPanel {
  panel = createKlaraPanel({ selectionText: MARKIERUNG, ...opts });
  return panel;
}
function posts(p: KlaraPanel): Array<Record<string, unknown>> {
  return p.calls
    .filter(
      (c) => c.method === "POST" && (c.url === "/api/drafts" || c.url === "/api/drafts/from-docx"),
    )
    .map((c) => JSON.parse(c.body ?? "{}") as Record<string, unknown>);
}
/** `Word.run` fuer den Dokument-Weg — Rueckfall ohne getFileAsync (die Fixture stellt kein FileType). */
function wordStellen(): void {
  const body = {
    text: DOKUMENT.join("\n"),
    load: (): void => {},
    getHtml: () => ({
      value: `<html><body>${DOKUMENT.map((z) => `<p>${z}</p>`).join("")}</body></html>`,
    }),
  };
  const context = { document: { body }, sync: () => Promise.resolve() };
  (globalThis as unknown as { Word: unknown }).Word = {
    run: (cb: (c: typeof context) => unknown) => Promise.resolve().then(() => cb(context)),
  };
}
function tippen(p: KlaraPanel, selektor: string, wert: string): void {
  const el = p.q(selektor);
  if (el === null) throw new Error(`${selektor} fehlt`);
  el.value = wert;
  const EventKlasse = (globalThis as unknown as { Event: new (typ: string) => { type: string } })
    .Event;
  el.dispatchEvent(new EventKlasse("input"));
}

describe("JOB 3057 · K2 · Funktionsinventar „heute → neuer Ort“ — jede Zeile am laufenden Aufgabenfenster ausgefuehrt", () => {
  it("I1 · Markierter Text → Markierungskarte: Kicker mit Anzahl, die Absaetze aus Word, Titel vorbelegt", async () => {
    const p = oeffnen();
    await p.flush();
    p.setTab("capture");
    await p.flush();
    expect(p.q("#capture-kicker")?.className).toBe("");
    expect(p.text("#capture-kicker")).toBe(p.t("captureKicker", { n: "2" }));
    expect(p.text("#capture-absaetze")).toBe(MARKIERUNG.replace("\n", ""));
    expect(p.q("#capture-leer")?.className).toBe("hidden");
    expect(p.q("#capture-titel")?.value).toBe("Erster Absatz der Markierung.");
    // Einzahl: „1 ABSATZ“, nicht „1 ABSAETZE“.
    expect(p.t("captureKickerEins")).not.toContain("{n}");
  });

  it("I2 · Ganzes Dokument → der Textlink loest den Dokument-Weg aus (POST mit dem Dokumenttext, Ergebniszeile)", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-dok" }) } });
    await p.flush();
    wordStellen();
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();
    expect(p.text("#capture-dokument-link")).toBe(p.t("captureDocumentLink"));
    p.q("#capture-dokument-link")?.click();
    await p.flush();
    await p.flush();
    const gesendet = posts(p);
    expect(gesendet).toHaveLength(1);
    expect(String(gesendet[0]?.statement)).toContain(DOKUMENT[1]);
    expect(gesendet[0]?.title).toBe(DOKUMENT[0]);
    expect(p.q("#capture-ergebnis")?.className).toBe("");
    expect(p.q("#open-link")?.href).toContain("draft=d-dok");
  });

  it("I3 · Seiten (deaktivierte Option + Tooltip + Hinweis) → EIN Satz im „?“-Menue, zu bis zum Klick", async () => {
    const p = oeffnen();
    await p.flush();
    expect(p.q("#capture-mehr")?.className).toBe("hidden");
    expect(p.q("#capture-mehr-btn")?.getAttribute("aria-expanded")).toBe("false");
    p.q("#capture-mehr-btn")?.click();
    expect(p.q("#capture-mehr")?.className).toBe("");
    expect(p.q("#capture-mehr-btn")?.getAttribute("aria-expanded")).toBe("true");
    expect(p.text("#capture-mehr #capture-hinweis-seiten")).toBe(p.t("scopePagesHint"));
    expect(p.q("#scope-pages")).toBeNull();
    expect(p.q("#scope-pages-hint")).toBeNull();
    p.q("#capture-mehr-btn")?.click();
    expect(p.q("#capture-mehr")?.className).toBe("hidden");
  });

  it("I4 · Bilder-Hinweisband → derselbe Kasten im „?“-Menue, mit Link in die Konsole", async () => {
    const p = oeffnen();
    await p.flush();
    p.q("#capture-mehr-btn")?.click();
    expect(p.text("#capture-mehr #capture-bilder-hinweis")).toContain(p.t("sendImagesNote"));
    expect(p.text("#capture-bilder-hinweis-link")).toBe(p.t("sendImagesNoteLink"));
    expect(p.q("#capture-bilder-hinweis-link")?.href).toContain("app.klarwerk.ai/erfassen");
    // Nicht mehr in der Karte selbst:
    expect(p.q("#capture-karte #capture-bilder-hinweis")).toBeNull();
  });

  it("I5/I6 · Umfangs-Satz (sendHint) und Pruefhinweis (sendReviewNote) → „?“-Menue", async () => {
    const p = oeffnen();
    await p.flush();
    p.q("#capture-mehr-btn")?.click();
    expect(p.text("#capture-mehr #capture-hinweis-umfang")).toBe(p.t("sendHint"));
    expect(p.text("#capture-mehr #capture-hinweis-pruefung")).toBe(p.t("sendReviewNote"));
    expect(p.q("#send-review-note")).toBeNull();
    for (const sprache of ["en", "nl"]) {
      p.setLang(sprache);
      expect(p.text("#capture-hinweis-pruefung")).toBe(p.t("sendReviewNote"));
    }
  });

  it("I7/I8 · Knopf und Entwurf-Link → Klick sendet (Titel im Payload), Ergebniszeile mit „Oeffnen“ statt Statusfeld und #open-block", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    await p.flush();
    expect(p.q("#send-btn")?.disabled).toBe(false);
    p.q("#send-btn")?.click();
    await p.flush();
    await p.flush();
    const gesendet = posts(p);
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]?.title).toBe("Erster Absatz der Markierung.");
    expect(gesendet[0]?.origin).toBe("word_addin");
    expect(p.q("#capture-ergebnis")?.className).toBe("");
    expect(p.text("#capture-ergebnis")).toBe(`${p.t("sendOk")}${p.t("openLink")}`);
    expect(p.q("#open-link")?.href).toContain("/capture/frontdoor?draft=d-1");
    expect(p.q("#open-block")).toBeNull();
    expect(p.q("#send-status")?.className).toBe("status hidden");
    expect(p.q("#capture-kicker")?.className).toBe("hidden");
  });

  it("I9 · Fehlersatz → EIN Satz + Knopf „Erneut senden“, der denselben Umfang erneut sendet", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(413, {}) } });
    await p.flush();
    p.q("#send-btn")?.click();
    await p.flush();
    await p.flush();
    expect(p.text("#send-status")).toBe(p.t("sendTooLarge"));
    expect(p.q("#send-status-btn")?.className).toBe("ghost capture-knopf");
    expect(p.text("#send-status-btn")).toBe(p.t("captureRetry"));
    p.q("#send-status-btn")?.click();
    await p.flush();
    await p.flush();
    expect(posts(p)).toHaveLength(2);
    expect(p.q("#capture-ergebnis")?.className).toBe("hidden");
  });

  it("I10 · Nicht angemeldet (401) → Satz sendAuth + Knopf „Anmelden“", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(401, {}) } });
    await p.flush();
    p.q("#send-btn")?.click();
    await p.flush();
    await p.flush();
    expect(p.text("#send-status")).toBe(p.t("sendAuth"));
    expect(p.text("#send-status-btn")).toBe(p.t("captureLogin"));
    expect(p.q("#send-status-btn")?.className).toBe("ghost capture-knopf");
  });

  it("I11 · Kein Word → EIN Satz (noOffice) + Knopf „Neu laden“; Knopf und Dokument-Link gesperrt", async () => {
    const p = oeffnen({ withOffice: false });
    await p.flush();
    expect(p.q("#office-hint")?.className).toBe("status warn");
    expect(p.text("#office-hint")).toBe(p.t("noOffice"));
    expect(p.q("#office-hint-btn")?.className).toBe("ghost capture-knopf");
    expect(p.text("#office-hint-btn")).toBe(p.t("captureReload"));
    expect(p.q("#send-btn")?.disabled).toBe(true);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBe("true");
    // Ein Klick auf den gesperrten Link tut nichts.
    p.q("#capture-dokument-link")?.click();
    await p.flush();
    expect(posts(p)).toHaveLength(0);
  });

  it("I12 · Bilder-Bilanz → EIN Satz in der Karte mit Link „In KLARWERK ergaenzen“ auf den Entwurf — nur im Fall, aus gezaehlten Bildern", async () => {
    const p = oeffnen({
      selectionHtml:
        '<html><body><p>Erster Absatz der Markierung.</p><img src="cid:bild1"><p>Zweiter Absatz der Markierung.</p></body></html>',
      routes: { "/api/drafts": reply(201, { id: "d-bild" }) },
    });
    await p.flush();
    p.q("#send-btn")?.click();
    await p.flush();
    await p.flush();
    expect(p.q("#capture-ergebnis")?.className).toBe("");
    expect(p.q("#capture-bilder-ergebnis")?.className).toBe("");
    expect(p.text("#capture-bilder-satz")).toBe(p.t("sendImagesMissingOne"));
    expect(p.text("#capture-bilder-link")).toBe(p.t("captureBilderLink"));
    expect(p.q("#capture-bilder-link")?.href).toContain("draft=d-bild");
    // Sprachwechsel: der gehaltene Zustand wird in der neuen Sprache neu geschrieben.
    p.setLang("en");
    expect(p.text("#capture-bilder-satz")).toBe(p.t("sendImagesMissingOne"));
    expect(p.text("#capture-ergebnis")).toBe(`${p.t("sendOk")}${p.t("openLink")}`);
  });

  it("I13 · Kartentitel → Vorlese-Ueberschrift (Hilfstechnik), nicht im Bild", async () => {
    const p = oeffnen();
    await p.flush();
    expect(p.q("#capture-karte h2.nur-vorlesen")?.textContent).toBe(p.t("captureCardTitle"));
  });

  it("I14 · NEU: die Zeile „Titel“ ist editierbar und reist als Titel; geleert nimmt die Vorbelegung wieder ueber", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-t" }) } });
    await p.flush();
    tippen(p, "#capture-titel", "  Profile in Spritzzonen  ");
    p.q("#send-btn")?.click();
    await p.flush();
    await p.flush();
    expect(posts(p)[0]?.title).toBe("Profile in Spritzzonen");
    // Dokument-Weg mit Titel von Hand: derselbe Titel.
    wordStellen();
    p.q("#capture-dokument-link")?.click();
    await p.flush();
    await p.flush();
    expect(posts(p)[1]?.title).toBe("Profile in Spritzzonen");
    // Geleert → naechste Vorbelegung aus der Markierung.
    tippen(p, "#capture-titel", "");
    p.setTab("capture");
    await p.flush();
    expect(p.q("#capture-titel")?.value).toBe("Erster Absatz der Markierung.");
  });

  it("I15 · NEU: ohne Markierung sagt es die Karte („Markiere Text in Word.“), der Knopf ist gesperrt — ohne Erklaersatz am Knopf", async () => {
    const p = oeffnen({ selectionText: "" });
    await p.flush();
    expect(p.q("#capture-leer")?.className).toBe("");
    expect(p.text("#capture-leer")).toBe(p.t("captureEmpty"));
    expect(p.q("#capture-kicker")?.className).toBe("hidden");
    expect(p.q("#send-btn")?.disabled).toBe(true);
    expect(p.q("#send-btn")?.title).toBe("");
    expect(p.q("#capture-titel")?.value).toBe("");
    // Der Dokument-Weg bleibt offen (angemeldet, Word da).
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();
  });

  it("Vollstaendigkeit · keine heutige Kennung der Erfassen-Flaeche fehlt ohne Nachfolger, keine alte steht daneben", async () => {
    const p = oeffnen();
    await p.flush();
    for (const alt of [
      "#scope-selection",
      "#scope-document",
      "#scope-pages",
      "#scope-pages-label",
      "#scope-pages-hint",
      "#send-review-note",
      "#open-block",
    ]) {
      expect(p.q(alt), alt).toBeNull();
    }
    for (const neu of [
      "#capture-karte",
      "#capture-kicker",
      "#capture-absaetze",
      "#capture-leer",
      "#capture-ergebnis",
      "#open-link",
      "#capture-bilder-ergebnis",
      "#capture-bilder-satz",
      "#capture-bilder-link",
      "#capture-titel",
      "#send-btn",
      "#office-hint",
      "#office-hint-btn",
      "#send-status",
      "#send-status-btn",
      "#capture-dokument-link",
      "#capture-mehr-btn",
      "#capture-mehr",
      "#capture-hinweis-umfang",
      "#capture-bilder-hinweis",
      "#capture-hinweis-pruefung",
      "#capture-hinweis-seiten",
    ]) {
      expect(p.q(neu), neu).not.toBeNull();
    }
    for (const key of ["scopeSelection", "scopeDocument", "scopePages", "scopePagesOff"]) {
      // Entfernte Schluessel liefern den Schluesselnamen — sie stehen in keinem Woerterbuch mehr.
      expect(p.t(key)).toBe(key);
    }
  });
});
