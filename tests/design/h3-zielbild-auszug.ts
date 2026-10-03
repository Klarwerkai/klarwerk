// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:layout` — DIE SOLLWERTE VON H3 IM REPOSITORY.
// ================================================================================================
//
// DER BEFUND. `zielbild-h3-erfassen.test.ts` liest seine Sollwerte aus dem Mockup
// `design/klarwerk/Erfassen.dc.html` (`MOCKUP` in `h3-blatt-buehne.ts`). Diese Datei liegt NICHT im
// Repository, sondern im Steuerungsverzeichnis des Produktions-Macs. Browsermessungen laufen aber
// nur auf dem Server- bzw. Linux-Prüfweg — und dort fehlt das Mockup. Der Abgleich meldete sich
// deshalb genau dort, wo er laufen darf, als „übersprungen", und Ben fand für Kriterium 4 keinen
// Browsernachweis.
//
// DIE ANTWORT. Ein AUSZUG: genau die Stilblöcke, die der Abgleich liest, mit genau den
// Eigenschaften, die er daraus zieht. Herkunft je Wert:
//   · der ANKER ist der wörtliche Ausschnitt des Mockup-Stilblocks, über den JOB 3062 ihn findet
//     (`A_*` in `zielbild-h3-erfassen.test.ts`) — er wird hier unverändert übernommen;
//   · ein ZUSATZ ist eine weitere Eigenschaft desselben Blocks. Ihr Wert steht in JOB 3062 im
//     Fallnamen (z. B. „V14 · titel-laufweite -0.3px"), der gegen das Mockup geschrieben wurde.
//
// KEIN WERT KOMMT AUS DEM PRODUKT. Der Schatten des Blattes (V7) nennt im Fallnamen nur das Token
// `shadow-tile`, keinen Wert; ihn aus `themes.css` zu übernehmen hiesse, das Produkt gegen sich
// selbst zu messen. Er fehlt im Auszug ausdrücklich (`OHNE_AUSZUG`), V7 misst nur gegen das Mockup.
//
// DRIFT. Liegt das Mockup vor, prüft `zielbild-h3-erfassen.test.ts` (Fall A) jeden Wert dieses
// Auszugs gegen das Mockup. Ändert Pedi das Zielbild, wird A dort rot, wo das Mockup liegt.

export interface AuszugBlock {
  /** Wörtlicher Ausschnitt des Mockup-Stilblocks. */
  readonly anker: string;
  /** Weitere Eigenschaften desselben Blocks: Eigenschaft → Wert. */
  readonly zusatz: Readonly<Record<string, string>>;
}

export const AUSZUG: readonly AuszugBlock[] = [
  // Spalte (Mockup Z.35) — V33
  { anker: "width: 820px; padding: 24px 0 0", zusatz: { gap: "14px" } },
  // Werkzeugzeile (Mockup Z.36)
  { anker: "display: flex; align-items: center; gap: 22px; padding: 0 4px", zusatz: {} },
  // Werkzeug „Diktieren" (Mockup Z.36-38)
  { anker: "gap: 6px; font-size: 13px; color: #525B6B", zusatz: {} },
  // Menü „Bereich" (Mockup Z.39-45) — V20, V22
  {
    anker: "padding: 6px 12px; background: #FFFFFF; border: 1px solid #E9E5DE",
    zusatz: { "border-radius": "8px", "font-size": "13px" },
  },
  // Blatt (Mockup Z.46-52) — V2, V11; Schatten V7 bewusst nicht
  {
    anker: "border-radius: 14px 14px 0 0; padding: 56px 72px 0",
    zusatz: { background: "#FFFFFF", gap: "22px" },
  },
  // Titel — V14
  { anker: "font-size: 28px; font-weight: 650", zusatz: { "letter-spacing": "-0.3px" } },
  // Text
  { anker: "font-size: 16px; line-height: 1.75", zusatz: {} },
  // „Entwurf sichern" (Mockup Z.53) — V26, V27
  {
    anker: "padding: 10px 20px; background: #FFFFFF; color: #1A2233",
    zusatz: { "border-radius": "10px", "font-size": "14px" },
  },
  // „Einreichen" (Mockup Z.53) — V31, V32
  {
    anker: "background: #C2500A; color: #FFFFFF",
    zusatz: { "border-radius": "10px", "font-weight": "600" },
  },
];

/** Werte, die der Auszug NICHT trägt, weil das Repository keinen unabhängigen Beleg hat. */
export const OHNE_AUSZUG = ["blatt.box-shadow"] as const;

/**
 * Der Auszug in der Schreibweise des Mockups: je Block ein `style="…"`. Damit lesen `zielStil` und
 * `zielProp` ihn genau wie das Mockup — es gibt keinen zweiten Leseweg.
 */
export function auszugAlsQuelle(): string {
  return AUSZUG.map((block) => {
    const zusatz = Object.entries(block.zusatz)
      .map(([eigenschaft, wert]) => `; ${eigenschaft}: ${wert}`)
      .join("");
    return `<div style="${block.anker}${zusatz}"></div>`;
  }).join("\n");
}
