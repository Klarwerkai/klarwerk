// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DATEIANHÄNGE (R-0095) — der Rückverweis vom Anhang auf sein Objekt.
// ================================================================================================
//
// Ein Wissensobjekt nannte seine Anhänge; ein Anhang nannte sein Wissensobjekt nicht. An jeder
// Anhangkachel steht jetzt, welchen Wissensobjekten der Anhang gehört — als Link, nicht als
// Klartext (`GET /api/objects/:id/traeger`). Trägt ihn der gerade geöffnete Eintrag selbst, sagt
// der Zusatz das, damit der Link nicht wie ein Sprung woandershin aussieht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "anhangtraeger.",
  legacySchluessel: [],
  de: {
    "anhangtraeger.gehoertZu": "Gehört zu",
    "anhangtraeger.dieserEintrag": "(dieser Eintrag)",
    "anhangtraeger.ohneTitel": "Ohne Titel",
  },
  en: {
    "anhangtraeger.gehoertZu": "Belongs to",
    "anhangtraeger.dieserEintrag": "(this entry)",
    "anhangtraeger.ohneTitel": "Untitled",
  },
  nl: {
    "anhangtraeger.gehoertZu": "Hoort bij",
    "anhangtraeger.dieserEintrag": "(dit item)",
    "anhangtraeger.ohneTitel": "Zonder titel",
  },
} satisfies Textmodul;
