// ================================================================================================
// JOB 3782 — DER GRÖSSTMÖGLICHE ENTWURF. EINMAL GEBAUT, VON BEIDEN PRÜFSTÄNDEN BENUTZT.
// ================================================================================================
//
// Runde 1 hatte zwei Entwürfe: die Fristmessung holte einen von 3,8 MiB, die Fläche (T3) lud einen
// Absatz mit vier Wörtern. bens Befund dazu, wörtlich: „T3 verwendet nur einen kurzen Absatz und
// prüft im Rumpf lediglich ‚Schmierstellen'. Meine Mutation zeigt: Selbst vollständiger Verlust
// grosser Rümpfe bleibt unentdeckt." Der Satz „die Frist schneidet grosse Entwürfe nicht ab" stand
// damit auf einem Fall, der von grossen Entwürfen nichts wusste.
//
// Seit dieser Runde gibt es die Nutzlast genau EINMAL, hier. Die Fristmessung misst sie am
// Routenweg, T3 lädt DIESELBE durch die ganze Kette bis auf die Fläche. Zwei Entwürfe für dieselbe
// Zusage wären zwei Wahrheiten.
//
// WARUM SO GROSS: `DRAFTS_BODY_LIMIT` (`services/app/src/routes/capture-routes.ts`) ist 5 MiB.
// Einen grösseren Entwurf kann es nicht geben — `POST`/`PUT /api/drafts` weisen ihn mit 413 ab. Wer
// gegen einen Entwurf dieser Grössenordnung misst, misst den ungünstigsten Fall des Bestandes und
// nicht einen ausgedachten. Drei Viertel des Limits und nicht 100 %: ein Prüfstand, der am Rand
// balanciert, wird über die Zeit rot, ohne dass jemand etwas kaputt gemacht hätte.

import sharp from "sharp";
import { grossesPng } from "../m5c-b-bildbudget/bilder";

/** Verankerte Abbildungen im Rumpf — dieselbe Zahl steht als `sourceImageCount` am Entwurf. */
export const BILDER_IM_ENTWURF = 30;
/** Belegstellen, die auf ihre Anker warten. */
export const BELEGSTELLEN_IM_ENTWURF = 30;

export const GROSSER_TITEL = "Presse P4 abschmieren — Gesamtdokument mit Abbildungen";

// ================================================================================================
// DIE BEIDEN MARKEN — SIE SIND DER GRUND, WARUM „VOLLSTÄNDIG" HIER MESSBAR IST.
// ================================================================================================
// Ein Rumpf aus viertausend gleichlautenden Absätzen kann abgeschnitten werden, ohne dass es
// auffällt: „Schmierstellen" steht danach immer noch da. Deshalb trägt der Rumpf eine eigene erste
// und eine eigene LETZTE Zeile, und die letzte steht HINTER der dreissigsten Abbildung — also am
// Ende der Bytes, die eine gekappte Übertragung als erstes verliert.
export const MARKE_ANFANG = "ANFANGSMARKE-3782 erste Zeile des Gesamtdokuments";
export const MARKE_ENDE = "SCHLUSSMARKE-3782 letzte Zeile nach der dreissigsten Abbildung";

/** Ein Bild, wie Klara und der DOCX-Weg es in den Rumpf legen — echte base64-Bytes, kein Platzhalter. */
async function bild(nr: number): Promise<string> {
  // Eigenständige reproduzierbare Bilder, auch nach der Normalisierung noch rund 90 KiB groß.
  const daten = await sharp(grossesPng(375, 375, nr))
    .webp({ quality: 80 })
    .toBuffer();
  return (
    `<figure data-image-id="kw-img-3782-${nr}">` +
    `<img data-image-id="kw-img-3782-${nr}" src="data:image/webp;base64,${daten.toString("base64")}" alt="Abbildung ${nr}">` +
    `<figcaption data-image-id="kw-img-3782-${nr}">Abbildung ${nr} aus dem Originaldokument</figcaption></figure>`
  );
}

/**
 * Der Rumpf allein — getrennt vom Umschlag, weil die Fläche gegen IHN misst und nicht gegen den
 * Entwurf: was im Editor steht, ist dieser String (durch `frontDoorBodyFromDraft`, das bereits
 * verankerte figures unberührt lässt).
 */
async function grosserRumpf(): Promise<string> {
  const absatz = "<p>Vor jedem Anlauf die Schmierstellen der Presse P4 prüfen und quittieren.</p>";
  const bilder = await Promise.all(
    Array.from({ length: BILDER_IM_ENTWURF }, (_, i) => bild(i + 1)),
  );
  return `<p>${MARKE_ANFANG}.</p>${absatz.repeat(4_000)}${bilder.join("")}<p>${MARKE_ENDE}.</p>`;
}

/**
 * Der ganze Entwurf: viel Text, dreissig verankerte Abbildungen, dreissig wartende Belegstellen.
 *
 * `sourceImageCount` IST HIER KEIN BEIWERK. Es ist die Zahl, gegen die die Galerie unter dem Blatt
 * einen Bildverlust überhaupt erkennen kann (`lib/bildverlust.ts`: ohne Quellzahl sagt sie ehrlich
 * „unbekannt" statt „alles da"). Mit ihr wird die Vollständigkeitsprüfung in T3 eine Aussage der
 * FLÄCHE und nicht nur eine Zählung des Prüfstands.
 *
 * Die Belegstellen tragen `anchorKey`, aber KEINE `objectId`: `ankerKennungen`
 * (`services/capture/src/service.ts`) sammelt nur `objectId`. Ein gesichertes Original, das es
 * nicht gibt, hielte den Rumpf beim Fortsetzen ZURÜCK (`resumeDraft`) — dann prüfte T3 den
 * Rückhalt und nicht die Frist. Dieser Entwurf kommt vollständig zurück, und genau das ist die
 * Voraussetzung des Falls.
 */
export async function grosserEntwurf(): Promise<Record<string, unknown>> {
  const quellen = Array.from({ length: BELEGSTELLEN_IM_ENTWURF }, (_, i) => ({
    label: `Wartungshandbuch P4, Abschnitt ${i + 1}`,
    url: `https://intranet.example/p4/${i + 1}`,
    excerpt: "Schmierstellen, Intervalle und Quittierung.".repeat(20),
    anchorKey: `anker-${i + 1}`,
  }));
  return {
    title: GROSSER_TITEL,
    statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
    category: "Instandhaltung",
    confidentiality: "intern",
    origin: "frontdoor",
    bodyHtml: await grosserRumpf(),
    sourceImageCount: BILDER_IM_ENTWURF,
    pendingSources: quellen,
  };
}
