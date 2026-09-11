// ================================================================================================
// JOB 3640 · DER GEMESSENE BESTAND, AUS DEM DIESE TESTS RECHNEN.
// ================================================================================================
//
// Die Zahlen sind NICHT erfunden: sie stehen so in Pedis Bildbeleg vom 11.09.
// (`gespraech/feedback-20260911-admin-loeschen/confluence-ohne-demo-firmenfilter.png`) — 110 Seiten,
// 1 Quelle, 1 Autor, zehn Themen, alle „abgeleitet", davon „(ohne Thema) 27". Genau diese Lage ist
// der Grund des Auftrags, und genau an ihr muss die Fläche gemessen werden.
//
// WAS DIE ZAHLEN BEWEISEN (Auftrag §4.3): weder Quelle (1) noch Autor (1) können hier trennen, und
// die Themen sind Titelwörter mit einer 27er-Lücke. Übrig bleibt der Titel. Die Fälle unten führen
// das vor, statt es zu behaupten.
import type { ImportExploreResponse } from "../../apps/web/src/api/types";

/** Die zehn Themen des Bildbelegs, in seiner Reihenfolge. Summe der Zähler = 110. */
export const THEMEN = [
  { label: "Demo", count: 40, origin: "derived" as const },
  { label: "Basic", count: 17, origin: "derived" as const },
  { label: "Stand", count: 9, origin: "derived" as const },
  { label: "Policy", count: 6, origin: "derived" as const },
  { label: "Charging", count: 3, origin: "derived" as const },
  { label: "Guide", count: 2, origin: "derived" as const },
  { label: "Ladestation", count: 2, origin: "derived" as const },
  { label: "Melden", count: 2, origin: "derived" as const },
  { label: "Ocpp", count: 2, origin: "derived" as const },
  { label: "(ohne Label)", count: 27 },
];

export const BESTAND: ImportExploreResponse = {
  summary: {
    totalCount: 110,
    distinctSources: 1,
    authors: [{ name: "Peter Kohnert", count: 110 }],
    themes: THEMEN,
    dateRange: { earliest: "2026-01-04T09:00:00.000Z", latest: "2026-09-10T17:00:00.000Z" },
    withImagesHint: 0,
    sourceNames: [{ name: "KLARWERK", count: 110 }],
    textCodec: "decoded",
  },
  truncated: false,
  alreadyImported: 1,
  alreadyQueued: 35,
  failedPages: 0,
};

/** Das Wort, mit dem Pedi seine Vorführung rahmt. */
export const FIRMA = "Advisor";

/** Wie viele Seiten dieses Wort im Titel tragen — die Zahl, die der Server misst. */
export const FIRMA_SEITEN = 40;
