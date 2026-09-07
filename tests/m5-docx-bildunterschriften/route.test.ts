// ================================================================================================
// JOB 3210 · M5c — DER WEG BIS SPEICHERN UND ZURÜCKLESEN, AUF DEM GEMESSENEN PFAD
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN `zuordnung.test.ts` STEHT und keine Wiederholung ist: Dort endet der Weg
// beim Server-Sanitizer, hier bei GET. Der Befund (Codex, Paket M5-DOCX-BILDUNTERSCHRIFTEN-20260907)
// ist ausdrücklich AN GENAU DIESER STELLE erhoben worden — „in der tatsächlich frisch gelesenen
// GET-Antwort unter payload.bodyHtml sind alle zehn zugeordneten figcaption-Felder leer". Ein
// Nachweis, der vor dem Speichern stehenbliebe, würde den Befund nicht widerlegen.
//
// WELCHER PFAD, und das ist keine Nebensache: der NORMALE BROWSER-DATEIIMPORT als Ganzdokument-
// Entwurf — genau der, über den Pedis BAADER-Arbeitskopie gespeichert wurde. Seine Kette ist
//
//     readDocxRich (files.ts)   →  wholeDocumentDraftPayload (captureFromFile.ts)
//         →  POST /api/drafts   →  createDraft + sanitizeHtml  →  GET /api/drafts/:id
//
// Hier steht sie mit `extractDocxRich` und GENAU den Optionen, die `readDocxRich` (files.ts:172-176)
// setzt; nur `mapImage` ist die Identität statt des Browser-Downscales, denn `canvas` gibt es unter
// Node nicht. Alles danach — Nutzlast, Route, Sanitizer, Rücklesen — ist das echte Produkt.
//
// AUSDRÜCKLICH NICHT GEMESSEN wird `POST /api/drafts/from-docx` (der Word-Add-in-Weg): diese Route
// ruft `extractDocxRich` OHNE `imageCaptionPlaceholder` (capture-routes.ts:934-936) und baut daher
// überhaupt keine `figure`/`figcaption`. Dort gibt es keine Fussnote, die eine Beschriftung
// aufnehmen könnte — das ist eine eigene Lücke, sie liegt in `services/app` und damit ausserhalb
// der Zielpfade dieses Auftrags. Sie steht als REST in der Rückgabe, nicht still hier.
import { describe, expect, it } from "vitest";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { imageCaptionEntries } from "../../services/structure/src/captions";
import { type Absatz, PNG_BLAU, PNG_ROT, alsPuffer, baueDocx } from "./docx-bauen";

/** Der lokalisierte Fussnoten-Platzhalter, den die Oberfläche injiziert (sein Text landet nie im Body). */
const PLATZHALTER = "Bildbeschreibung hinzufügen";

const ZUGANG = { name: "Admin", email: "m5c-bildunterschriften@x.de", password: "secret123" };

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token as string}` } };
}

interface Gespeichert {
  /** Der Rumpf, wie ihn ein frischer GET unter `payload.bodyHtml` liefert. */
  readonly bodyHtml: string;
  /** Die ganze zurückgelesene Nutzlast — für `sourceImageCount` und Nachbarfelder. */
  readonly payload: Record<string, unknown>;
  readonly droppedImages: number;
  /** Die beiden internen Zähler des Importschritts — sie werden nicht gespeichert (§5.2). */
  readonly captionsAssigned: number;
  readonly captionsAmbiguous: number;
}

/** Ein Dokument den Browser-Dateiimportweg entlang bis zum frischen Zurücklesen. */
async function importierenUndZurueckLesen(absaetze: readonly Absatz[]): Promise<Gespeichert> {
  const { bytes } = await baueDocx(absaetze);
  const reich = await extractDocxRich(alsPuffer(bytes), {
    mapImage: async (src) => src,
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    imageCaptionPlaceholder: PLATZHALTER,
  });
  const nutzlast = wholeDocumentDraftPayload({
    fileName: "rahmenbau.docx",
    text: reich.text,
    html: reich.html,
    sourceKind: "docx",
    locale: "de",
    sourceImageCount: reich.imageTransfer.totalImages,
  });

  const { app, headers } = await angemeldeteApp();
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: nutzlast,
  });
  expect(angelegt.statusCode, "Der Entwurf wurde nicht angelegt").toBeLessThan(300);

  const geladen = await app.inject({
    method: "GET",
    url: `/api/drafts/${(angelegt.json() as { id: string }).id}`,
    headers,
  });
  expect(geladen.statusCode, "Der Entwurf ist nicht abrufbar").toBe(200);
  // GENAU DAS FELD, an dem der Befund erhoben wurde — `payload.bodyHtml`, nicht `bodyHtml`.
  const payload = (geladen.json() as { payload: Record<string, unknown> }).payload;
  return {
    bodyHtml: (payload.bodyHtml as string | undefined) ?? "",
    payload,
    droppedImages: reich.droppedImages,
    captionsAssigned: reich.captionsAssigned,
    captionsAmbiguous: reich.captionsAmbiguous,
  };
}

/** Bildkennung → Bilddaten aus den `<img>`-Marken des gespeicherten Rumpfes. */
function bilddaten(html: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const t of html.matchAll(/<img\b[^>]*>/g)) {
    const id = /\bdata-image-id="([^"]+)"/.exec(t[0])?.[1] ?? "";
    const src = /\bsrc="data:image\/[a-zA-Z0-9.+-]+;base64,([^"]+)"/.exec(t[0])?.[1] ?? "";
    raus.set(id, src);
  }
  return raus;
}

describe("JOB 3210 · R · die Beschriftung überlebt Speichern und Zurücklesen", () => {
  it("R1 · payload.bodyHtml des frisch gelesenen Entwurfs trägt die gefüllten figcaption", async () => {
    const g = await importierenUndZurueckLesen([
      { art: "ueberschrift", text: "Rahmenbau" },
      { art: "text", text: "Der Rahmen wird aus zwei Profilen gefügt." },
      { art: "bild", png: PNG_ROT, alt: "profiles.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "text", text: "Die Verschraubung erfolgt von unten." },
      { art: "bild", png: PNG_BLAU, alt: "bolted.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 6: Bolted connection" },
    ]);

    const eintraege = imageCaptionEntries(g.bodyHtml);
    expect(
      eintraege.map((e) => e.text),
      "Die gespeicherten figcaption sind leer — genau der gemessene BAADER-Befund",
    ).toEqual(["Figure 1: Profiles", "Figure 6: Bolted connection"]);

    // Und die HERKUNFT hält: jeder Anker zeigt auf das Bild mit den richtigen Bytes.
    const daten = bilddaten(g.bodyHtml);
    expect(daten.get(eintraege[0]?.imageId ?? ""), "Der Profiles-Treffer zeigt woanders hin").toBe(
      PNG_ROT,
    );
    expect(daten.get(eintraege[1]?.imageId ?? ""), "Der Bolted-Treffer zeigt woanders hin").toBe(
      PNG_BLAU,
    );

    // Der Fliesstext bleibt vollständig, und keine Beschriftung steht doppelt da.
    expect(g.bodyHtml).toContain("Der Rahmen wird aus zwei Profilen gefügt.");
    expect(g.bodyHtml.split("Figure 1: Profiles").length - 1).toBe(1);
  });

  it("R2 · eine leer gelassene Fussnote ist KEIN Bildverlust", async () => {
    // §5.2 wörtlich: die bei Unklarheit leer gelassene Fussnote „darf NICHT als Bildverlust
    // (droppedImages) gezählt werden". Zwei Bilder unter einer gemeinsamen Legende: beide Fussnoten
    // bleiben leer, beide Bilder sind angekommen, die Bilanz meldet keinen Verlust.
    const g = await importierenUndZurueckLesen([
      { art: "bild", png: PNG_ROT },
      { art: "bild", png: PNG_BLAU },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(g.droppedImages, "Eine leere Fussnote wurde als Bildverlust gezählt").toBe(0);
    expect(g.payload.sourceImageCount, "Nicht beide Bilder gelten als Quellbilder").toBe(2);
    expect(imageCaptionEntries(g.bodyHtml), "Es wurde doch zugeordnet").toEqual([]);
    expect(
      (g.bodyHtml.match(/<img\b/g) ?? []).length,
      "Ein Bild ist auf dem Weg verlorengegangen",
    ).toBe(2);
    // Die mehrdeutige Legende steht weiter im Rumpf — sie wurde nicht still entfernt.
    expect(g.bodyHtml).toContain("Figure 1: Profiles");
  });

  it("R3 · die leere Fussnote behält ihren Anker — der Editor zeigt dafür seinen Platzhalter", async () => {
    // Der bereits vorhandene sichtbare Weg wird genutzt und NICHT umgedeutet (§5.2): eine leere
    // `figcaption` mit Anker ist genau das, was der Editor heute mit seinem lokalisierten
    // Platzhalter bemalt (`data-kw-placeholder` + CSS `:empty::before`). Nichts davon wird
    // gespeichert — der Platzhaltertext selbst darf im Rumpf nicht vorkommen.
    const g = await importierenUndZurueckLesen([{ art: "bild", png: PNG_ROT }]);
    expect(g.bodyHtml).toMatch(/<figcaption data-image-id="kw-img-[a-z0-9]+-1"><\/figcaption>/);
    expect(g.bodyHtml, "Der Platzhaltertext ist im gespeicherten Rumpf gelandet").not.toContain(
      PLATZHALTER,
    );
  });

  it("R4 · eine dokumentweite Konvention macht die mehrdeutige Legende auch bis GET nicht sicher", async () => {
    // KORREKTURPFLICHT 2 DES PRÜFERS: der Gegenfall gegen die Mehrheitsheuristik der Runde 1 wird
    // DAUERHAFT auf dem gemessenen Pfad abgesichert — nicht nur bis zum Sanitizer, sondern bis zum
    // frisch gelesenen `payload.bodyHtml`. Drei eindeutige Beschriftungen stehen ÜBER ihren Bildern
    // (jede Mehrheitszählung sagte „oben"), danach steht eine Legende zwischen zwei Einzelbildern.
    // Im gespeicherten Rumpf darf sie in KEINER Fussnote stehen; sie bleibt Fliesstext.
    const absaetze: Absatz[] = [];
    for (let i = 1; i <= 3; i += 1) {
      absaetze.push({ art: "text", text: `Abschnitt ${i}.` });
      absaetze.push({ art: "beschriftung", text: `Abbildung ${i}: Ansicht ${i}` });
      absaetze.push({ art: "bild", png: i % 2 === 0 ? PNG_BLAU : PNG_ROT });
    }
    absaetze.push({ art: "text", text: "Der Anhang zeigt zwei Details." });
    absaetze.push({ art: "bild", png: PNG_ROT, alt: "detail-a.png" });
    absaetze.push({ art: "beschriftung", text: "Abbildung 4: Offen" });
    absaetze.push({ art: "bild", png: PNG_BLAU, alt: "detail-b.png" });

    const g = await importierenUndZurueckLesen(absaetze);
    expect(g.captionsAssigned, "Die Mehrheit hat doch entschieden").toBe(3);
    expect(g.captionsAmbiguous, "Die beiden offenen Bilder sind nicht gezählt").toBe(2);
    expect(
      imageCaptionEntries(g.bodyHtml).map((e) => e.text),
      "Die mehrdeutige Legende steht in einer gespeicherten Fussnote",
    ).toEqual(["Abbildung 1: Ansicht 1", "Abbildung 2: Ansicht 2", "Abbildung 3: Ansicht 3"]);
    expect(g.bodyHtml, "Die mehrdeutige Legende wurde still entfernt").toContain(
      "Abbildung 4: Offen",
    );
    expect(g.droppedImages, "Eine leere Fussnote wurde als Bildverlust gezählt").toBe(0);
    expect((g.bodyHtml.match(/<img\b/g) ?? []).length, "Nicht alle fünf Bilder kamen an").toBe(5);
  });
});
