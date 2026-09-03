// JOB 2617 D3 — WERTE STATT BILDER: der messbare Design-Abgleich.
//
// Die Frage hinter BENs Screenshot-Forderung lautet: „Stimmt der gebaute Stand mit dem Zielbild
// ueberein?" Das Zielbild ist kein Foto, sondern `.dc.html`-Dateien mit exakten Werten
// (DESIGN_ZIELBILD_20260827/). Dieses Modul liest BEIDE Seiten und vergleicht Wert fuer Wert:
//   · Zielbild-Seite: Inline-Styles der dc-Datei (`inlineStyle` — das erste Element, dessen
//     style-Attribut einen Anker traegt) und SVG-Pfade (`enthaeltPfad`).
//   · Gebaute Seite: CSS-Regeln aus dem <style>-Block (`cssProp`) mit Token-Aufloesung
//     (`var(--x)` wird ueber die :root-Definition in seinen Wert uebersetzt).
//
// EIN VERGLEICH IST NUR GRUEN, WENN BEIDE SEITEN EINEN WERT LIEFERN (kein null-null-Gleichstand):
// eine fehlende Flaeche ist eine ABWEICHUNG („fehlt im gebauten Stand"), kein stiller Treffer.
//
// PARAMETRISIERBAR (Auftrag §2.3): dieselbe Pruefung fuer 2618/2619/2620 — neue Wertetabelle je
// Zielbild, `vergleiche()` bleibt. Die Tabelle traegt je Wert einen NAMEN, damit ein Fehlschlag
// sagt, WELCHER Wert abweicht (Auftrag §2.2).

export interface WertDefinition {
  name: string;
  ziel: (zielHtml: string) => string | null;
  gebaut: (gebautHtml: string) => string | null;
  /**
   * JOB 3016 D3: der Messpunkt am LAUFENDEN Panel — Selektor des realen Elements und die
   * BERECHNETE Eigenschaft, die `getComputedStyle` dafuer liefert (Chromium-Vergleich in
   * tests/design/zielbild-pruefunglaeuft.test.ts). `gebaut` liest denselben Wert statisch aus dem
   * Stilblock; der Messpunkt ist derselbe Wert, wirksam gerendert. Fehlt er, ist die Zeile nur
   * statisch vergleichbar.
   */
  messpunkt?: { selektor: string; eigenschaft: string };
}

export interface WertBefund {
  name: string;
  ziel: string | null;
  gebaut: string | null;
  gleich: boolean;
}

// Leerraum-Normalisierung: "0 1px 2px rgba(…)" muss unabhaengig von Umbruechen vergleichbar sein.
function norm(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  return wert.replace(/\s+/g, " ").trim().toLowerCase().replace(/;$/, "");
}

/** Das style-Attribut des ersten Elements, dessen style-Inhalt `anker` enthaelt. */
export function inlineStyle(html: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    if ((m[1] ?? "").includes(anker)) {
      return m[1] ?? null;
    }
  }
  return null;
}

/** Eine Eigenschaft aus einem style-/Regeltext ("a: b; c: d") — oder null, wenn nicht gesetzt. */
export function prop(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) {
    return null;
  }
  const re = new RegExp(`(?:^|[;{\\s])${eigenschaft}\\s*:\\s*([^;}]+)`, "i");
  const m = re.exec(stil);
  return m?.[1]?.trim() ?? null;
}

/** Der Regelrumpf des ersten `selektor { … }`-Blocks im HTML (style-Block der gebauten Seite). */
export function cssRegel(html: string, selektor: string): string | null {
  const esc = selektor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s,}])${esc}\\s*\\{([^}]*)\\}`, "m");
  const m = re.exec(html);
  return m?.[1] ?? null;
}

/** `var(--x)` ueber die :root-Definitionen der gebauten Seite in den Klartext-Wert uebersetzen. */
export function tokenAufloesen(html: string, wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  return wert.replace(/var\((--[a-z0-9-]+)\)/gi, (_, token: string) => {
    const re = new RegExp(`${token}\\s*:\\s*([^;]+);`);
    const m = re.exec(html);
    return m?.[1]?.trim() ?? `UNAUFGELOEST(${token})`;
  });
}

/** CSS-Eigenschaft einer Regel der gebauten Seite, tokenaufgeloest. */
export function cssProp(html: string, selektor: string, eigenschaft: string): string | null {
  return tokenAufloesen(html, prop(cssRegel(html, selektor), eigenschaft));
}

/** Traegt das Dokument einen SVG-Pfad mit diesem `d`-Anfang? Liefert den Treffer oder null. */
export function enthaeltPfad(html: string, dAnfang: string): string | null {
  return html.includes(`d="${dAnfang}`) ? dAnfang : null;
}

export function vergleiche(
  zielHtml: string,
  gebautHtml: string,
  werte: readonly WertDefinition[],
): WertBefund[] {
  return werte.map((w) => {
    const ziel = norm(w.ziel(zielHtml));
    const gebaut = norm(w.gebaut(gebautHtml));
    return {
      name: w.name,
      ziel,
      gebaut,
      // Kein null-null-Treffer: was auf einer Seite fehlt, ist eine Abweichung.
      gleich: ziel !== null && gebaut !== null && ziel === gebaut,
    };
  });
}

// ================================================================================================
// DIE TRAGENDEN WERTE DES SCHLANKEN PANELS (Vorlage SchlankesPanel.dc.html, Zeilen 32-49).
// ================================================================================================
// Gewaehlt sind die Werte, die die Vorlage AUSDRUECKLICH beziffert und die der Bau uebernommen hat
// (Baukommentar im 2617-D1-Stand: „Werte uebernommen, nicht erfunden"). BEWUSST WEGGELASSEN
// (Begruendung in der D3-Rueckgabe): ::placeholder-Farbe (Pseudo-Selektoren liegen ausserhalb des
// Kontrastwaechter-Messbereichs, mega43/mega44), Wortlaute (gepinnt durch 2553/mega69-Waechter),
// Kopfband-Werte (Baustelle 2602/2551), Layout-ERGEBNISSE, die erst der Browser rechnet.
export const WERTE_SCHLANKES_PANEL: readonly WertDefinition[] = [
  // — Reiterleiste (Vorlage Z.32-34) —
  {
    name: "tabs-grund (weisse Leiste)",
    ziel: (z) => prop(inlineStyle(z, "border-bottom: 1px solid #E9E5DE; background"), "background"),
    gebaut: (g) => cssProp(g, ".tabs", "background"),
  },
  {
    name: "tab-schriftgrad 13px",
    ziel: (z) => prop(inlineStyle(z, "padding: 11px 0 9px"), "font-size"),
    gebaut: (g) => cssProp(g, ".tabs button", "font-size"),
  },
  {
    name: "tab-innenabstand 11px 0 9px",
    ziel: (z) => prop(inlineStyle(z, "padding: 11px 0 9px"), "padding"),
    gebaut: (g) => cssProp(g, ".tabs button", "padding"),
  },
  // — Frage-Karte (Vorlage Z.38) —
  {
    name: "karte-radius 12px",
    ziel: (z) => prop(inlineStyle(z, "border-radius: 12px; box-shadow"), "border-radius"),
    gebaut: (g) => cssProp(g, "#ask-karte", "border-radius"),
  },
  {
    name: "karte-grund weiss",
    ziel: (z) => prop(inlineStyle(z, "border-radius: 12px; box-shadow"), "background"),
    gebaut: (g) => cssProp(g, ".card", "background"),
  },
  {
    name: "karte-schatten (shadow-tile)",
    ziel: (z) => prop(inlineStyle(z, "border-radius: 12px; box-shadow"), "box-shadow"),
    gebaut: (g) => tokenAufloesen(g, cssProp(g, ".card", "box-shadow")),
  },
  // — Eingabeflaeche (Vorlage Z.39) —
  {
    name: "feld-innenabstand 14px 52px 40px 14px",
    ziel: (z) => prop(inlineStyle(z, "padding: 14px 52px 40px 14px"), "padding"),
    gebaut: (g) => cssProp(g, "#ask-input", "padding"),
  },
  {
    name: "feld-schriftgrad 15px",
    ziel: (z) => prop(inlineStyle(z, "padding: 14px 52px 40px 14px"), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-input", "font-size"),
  },
  {
    name: "feld-zeilenhoehe 1.45",
    ziel: (z) => prop(inlineStyle(z, "padding: 14px 52px 40px 14px"), "line-height"),
    gebaut: (g) => cssProp(g, "#ask-input", "line-height"),
  },
  {
    name: "feld-mindesthoehe 96px",
    ziel: (z) => prop(inlineStyle(z, "padding: 14px 52px 40px 14px"), "min-height"),
    gebaut: (g) => cssProp(g, "#ask-input", "min-height"),
  },
  // — Senden-Knopf (Vorlage Z.40-41) —
  {
    name: "knopf-breite 34px",
    ziel: (z) => prop(inlineStyle(z, "width: 34px"), "width"),
    gebaut: (g) => cssProp(g, "#ask-btn", "width"),
  },
  {
    name: "knopf-rund (50%)",
    ziel: (z) => prop(inlineStyle(z, "width: 34px"), "border-radius"),
    gebaut: (g) => cssProp(g, "#ask-btn", "border-radius"),
  },
  {
    name: "knopf-lage rechts 10px",
    ziel: (z) => prop(inlineStyle(z, "width: 34px"), "right"),
    gebaut: (g) => cssProp(g, "#ask-btn", "right"),
  },
  {
    name: "knopf-lage unten 10px",
    ziel: (z) => prop(inlineStyle(z, "width: 34px"), "bottom"),
    gebaut: (g) => cssProp(g, "#ask-btn", "bottom"),
  },
  {
    name: "knopf-farbe brand-deep #C2500A",
    ziel: (z) => prop(inlineStyle(z, "width: 34px"), "background"),
    gebaut: (g) => cssProp(g, "button.primary", "background"),
  },
  {
    name: "knopf-pfeil (SVG M12 19V5) im Knopf",
    ziel: (z) => enthaeltPfad(z, "M12 19V5"),
    // Auf der gebauten Seite muss der Pfeil IM #ask-btn stehen, nicht irgendwo im Dokument.
    gebaut: (g) => {
      const m = /id="ask-btn"[\s\S]{0,400}?d="(M12 19V5)"/.exec(g);
      return m?.[1] ?? null;
    },
  },
  // — Hinweiszeile unter der Karte (Vorlage Z.44) —
  {
    name: "hinweis-schriftgrad 12px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 12px; line-height: 1.5"), "font-size"),
    gebaut: (g) => cssProp(g, ".ask-hinweise p", "font-size"),
  },
  {
    name: "hinweis-zeilenhoehe 1.5",
    ziel: (z) => prop(inlineStyle(z, "font-size: 12px; line-height: 1.5"), "line-height"),
    gebaut: (g) => cssProp(g, ".ask-hinweise p", "line-height"),
  },
  // — Vertrauens-Fusszeile (Vorlage Z.47-49) —
  {
    name: "fuss-schriftgrad 11px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 11px; color: #525B6B"), "font-size"),
    gebaut: (g) => cssProp(g, "#kw-fuss p", "font-size"),
  },
  {
    name: "schloss-farbe pos-text #116B3C",
    ziel: (z) => {
      const m = /stroke="(#116B3C)"[^>]*stroke-width="2"/.exec(z);
      return m?.[1] ?? null;
    },
    // Das Schloss zeichnet mit currentColor; die Farbe kommt vom Fusszeilen-Container.
    gebaut: (g) => cssProp(g, "#kw-fuss", "color"),
  },
  {
    name: "schloss-buegel (SVG M8 10V7…) in der Fusszeile",
    ziel: (z) => enthaeltPfad(z, "M8 10V7a4 4 0 0 1 8 0v3"),
    gebaut: (g) => {
      const m = /id="kw-fuss"[\s\S]{0,600}?d="(M8 10V7a4 4 0 0 1 8 0v3)"/.exec(g);
      return m?.[1] ?? null;
    },
  },
] as const;

// ================================================================================================
// DIE TRAGENDEN WERTE VON „WISSEN ERFASSEN" (JOB 2620 D2; Vorlage WissenErfassen.dc.html).
// ================================================================================================
// Gewaehlt sind die Werte der Flaechen, die JOB 2620 D1 GEBAUT hat (Uebernahme-Karte,
// gemessener Bilder-Kasten, Entwurfs-Knopf, Pruefungs-Hinweis) plus die geteilte Reiterleiste.
// BEWUSST WEGGELASSEN (Begruendung in der D2-Rueckgabe): das Titel-Feld und die
// Vertraulichkeits-Wahl der Vorlage — beide in D1 MIT MESSBELEG bewusst nicht gebaut (der
// Sende-Payload traegt die Felder nicht; Bedienelemente ohne Serverwirkung waeren die Unwahrheit
// in Knopfform; offene Ownerfrage OV-1 der D1-Rueckgabe) · WORTLAUTE (eigene Waechter W1-W3 in
// job2620-wissen-erfassen.test.ts pinnen sie; der Bilder-Text der Vorlage weicht vom GEMESSENEN
// gebauten Text ab, D1 §1 — Auftrag §2 dort schlug die Vorlage) · Kopfband (Baustelle 2602/2551) ·
// ::placeholder und browserberechnete Layout-Ergebnisse (wie beim Schlanken Panel).
export const WERTE_WISSEN_ERFASSEN: readonly WertDefinition[] = [
  // — Reiterleiste (Vorlage Z.22-24; geteilte Flaeche, Werte aus 2617) —
  {
    name: "tabs-grund (weisse Leiste)",
    ziel: (z) => prop(inlineStyle(z, "border-bottom: 1px solid #E9E5DE; background"), "background"),
    gebaut: (g) => cssProp(g, ".tabs", "background"),
  },
  {
    name: "tab-schriftgrad 13px",
    ziel: (z) => prop(inlineStyle(z, "padding: 11px 0 9px"), "font-size"),
    gebaut: (g) => cssProp(g, ".tabs button", "font-size"),
  },
  {
    name: "tab-innenabstand 11px 0 9px",
    ziel: (z) => prop(inlineStyle(z, "padding: 11px 0 9px"), "padding"),
    gebaut: (g) => cssProp(g, ".tabs button", "padding"),
  },
  // — Uebernahme-Karte (Vorlage Z.28-29) —
  {
    name: "karte-radius 12px",
    ziel: (z) => prop(inlineStyle(z, "padding: 16px 14px"), "border-radius"),
    gebaut: (g) => cssProp(g, "#capture-karte", "border-radius"),
  },
  {
    name: "karte-innenabstand 16px 14px",
    ziel: (z) => prop(inlineStyle(z, "padding: 16px 14px"), "padding"),
    gebaut: (g) => cssProp(g, "#capture-karte", "padding"),
  },
  {
    name: "karte-grund weiss",
    ziel: (z) => prop(inlineStyle(z, "padding: 16px 14px"), "background"),
    gebaut: (g) => cssProp(g, ".card", "background"),
  },
  {
    name: "karte-rand hairline",
    ziel: (z) => prop(inlineStyle(z, "padding: 16px 14px"), "border"),
    gebaut: (g) => cssProp(g, ".card", "border"),
  },
  {
    name: "kartentitel-schriftgrad 13.5px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 13.5px"), "font-size"),
    gebaut: (g) => cssProp(g, "#capture-karte h2", "font-size"),
  },
  {
    name: "kartentitel-schnitt 650",
    ziel: (z) => prop(inlineStyle(z, "font-size: 13.5px"), "font-weight"),
    gebaut: (g) => cssProp(g, "#capture-karte h2", "font-weight"),
  },
  // — Der gemessene Bilder-Kasten (Vorlage Z.31-33; Farben im Bau INLINE, mega43-konform) —
  {
    name: "kasten-grund warn-bg #FDF1D7",
    ziel: (z) => prop(inlineStyle(z, "background: #FDF1D7"), "background"),
    gebaut: (g) => tokenAufloesen(g, prop(inlineStyle(g, "var(--warn-bg)"), "background")),
  },
  {
    name: "kasten-schriftfarbe warn-text #8A5A00",
    ziel: (z) => prop(inlineStyle(z, "font-size: 12px; line-height: 1.5; color: #8A5A00"), "color"),
    gebaut: (g) => tokenAufloesen(g, prop(inlineStyle(g, "var(--warn-bg)"), "color")),
  },
  {
    name: "kasten-radius 8px",
    ziel: (z) => prop(inlineStyle(z, "background: #FDF1D7"), "border-radius"),
    gebaut: (g) => cssProp(g, "#capture-bilder-hinweis", "border-radius"),
  },
  {
    name: "kasten-innenabstand 9px 10px",
    ziel: (z) => prop(inlineStyle(z, "background: #FDF1D7"), "padding"),
    gebaut: (g) => cssProp(g, "#capture-bilder-hinweis", "padding"),
  },
  {
    name: "kasten-schriftgrad 12px",
    ziel: (z) =>
      prop(inlineStyle(z, "font-size: 12px; line-height: 1.5; color: #8A5A00"), "font-size"),
    gebaut: (g) => cssProp(g, "#capture-bilder-hinweis", "font-size"),
  },
  {
    name: "kasten-zeilenhoehe 1.5",
    ziel: (z) =>
      prop(inlineStyle(z, "font-size: 12px; line-height: 1.5; color: #8A5A00"), "line-height"),
    gebaut: (g) => cssProp(g, "#capture-bilder-hinweis", "line-height"),
  },
  {
    name: "kasten-infoicon (SVG M12 8v4) im Kasten",
    ziel: (z) => enthaeltPfad(z, "M12 8v4"),
    gebaut: (g) => {
      const m = /id="capture-bilder-hinweis"[\s\S]{0,500}?d="(M12 8v4)"/.exec(g);
      return m?.[1] ?? null;
    },
  },
  {
    name: "kasten-link-schnitt 600",
    ziel: (z) => prop(inlineStyle(z, "color: #8A5A00; font-weight: 600"), "font-weight"),
    gebaut: (g) => prop(inlineStyle(g, "color: var(--warn-text); font-weight: 600"), "font-weight"),
  },
  // — Entwurfs-Knopf (Vorlage Z.52) —
  {
    name: "knopf-grund brand-deep #C2500A",
    ziel: (z) => prop(inlineStyle(z, "background: #C2500A; color: #FFFFFF"), "background"),
    gebaut: (g) => cssProp(g, "button.primary", "background"),
  },
  {
    name: "knopf-textfarbe weiss",
    ziel: (z) => prop(inlineStyle(z, "background: #C2500A; color: #FFFFFF"), "color"),
    gebaut: (g) => cssProp(g, "button.primary", "color"),
  },
  {
    name: "knopf-radius 10px",
    ziel: (z) => prop(inlineStyle(z, "background: #C2500A; color: #FFFFFF"), "border-radius"),
    gebaut: (g) => cssProp(g, "#capture-karte #send-btn", "border-radius"),
  },
  {
    name: "knopf-schriftgrad 14px",
    ziel: (z) => prop(inlineStyle(z, "background: #C2500A; color: #FFFFFF"), "font-size"),
    gebaut: (g) => cssProp(g, "#capture-karte #send-btn", "font-size"),
  },
  {
    name: "knopf-form volle Breite, 12px 0",
    ziel: (z) => prop(inlineStyle(z, "background: #C2500A; color: #FFFFFF"), "padding"),
    gebaut: (g) => cssProp(g, "#capture-karte #send-btn", "padding"),
  },
  // — Pruefungs-Hinweis unter dem Knopf (Vorlage Z.53) —
  {
    name: "pruefhinweis-schriftgrad 11.5px",
    ziel: (z) =>
      prop(inlineStyle(z, "font-size: 11.5px; color: #525B6B; text-align: center"), "font-size"),
    gebaut: (g) => prop(inlineStyle(g, "text-align: center; font-size: 11.5px"), "font-size"),
  },
  {
    name: "pruefhinweis-zentriert",
    ziel: (z) =>
      prop(inlineStyle(z, "font-size: 11.5px; color: #525B6B; text-align: center"), "text-align"),
    gebaut: (g) => prop(inlineStyle(g, "text-align: center; font-size: 11.5px"), "text-align"),
  },
] as const;

// ================================================================================================
// DIE TRAGENDEN WERTE ZWEIER FRAGEWEG-ZUSTAENDE (JOB 2619 D2; Vorlagen KeinWissen.dc.html und
// PruefungLaeuft.dc.html — je Zustand eine Tabelle).
// ================================================================================================
// JOB 3004 D1: die dritte Tabelle dieses Blocks, WERTE_FRAGEWEG_MAIN (Antwortzustand, Main.dc.html),
// ist ENTFERNT. Sie hatte keinen Aufrufer und keinen Vergleichsstand mehr (staende/ ist nicht im
// Repo) und mass die falsche Sache — Quelltext statt gebauter Flaeche. Die eine Wahrheit ueber
// dieses Zielbild ist jetzt tests/design/zielbild-klara-main.test.ts: die echte taskpane.html aus
// apps/web/dist, in Chromium geladen, im echten Antwortzustand, ein getComputedStyle-Vergleich je
// Wert. Zwei Wahrheiten ueber dasselbe Zielbild stehen nicht nebeneinander.
// BEWUSST WEGGELASSEN (Begruendung in der D2-Rueckgabe): die QUELLEN-CHIP-INNENOPTIK und die
// Marken-Sups (entstehen im Bau zur LAUFZEIT als Inline-Stile — der Baukommentar im Stand nennt
// den Grund: der Kontrastwaechter mega43/44 kann Regeln ohne Markup-Fundstelle keiner Flaeche
// zuordnen; statisch gibt es kein Markup zu messen) · die Aktionsleiste „In Word einfuegen/Kopieren"
// von Main (Laufzeit-Buttons desselben 2603-Zustandsbaus) · Wortlaute, Kopfband, ::placeholder und
// browserberechnete Layout-Ergebnisse (wie bei den beiden Tabellen darueber).
// JOB 3016 D3: der SPERR-HINWEIS von PruefungLaeuft stand hier bis dahin als bewusste Auslassung
// („bestehende Statuszeile askBusy statt Vorlagen-Absatz"). Das gilt nicht mehr: der Wartezustand
// ist jetzt die Ladekarte `#ask-ladekarte` mit dem Absatz `#ask-ladekarte-satz` (Schluessel
// `askBusy`, Wortlaut des Zielbilds Z.32), und seine Darstellungswerte stehen in
// WERTE_FRAGEWEG_PRUEFUNG. Der Warnkasten `.status.warn` bleibt den echten Warnungen.

export const WERTE_FRAGEWEG_KEIN_WISSEN: readonly WertDefinition[] = [
  {
    name: "ohne-wissen-schriftgrad 16px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 16px; line-height: 1.55"), "font-size"),
    gebaut: (g) => cssProp(g, "#antwortkarte-ohne-wissen", "font-size"),
  },
  {
    name: "ohne-wissen-zeilenhoehe 1.55",
    ziel: (z) => prop(inlineStyle(z, "font-size: 16px; line-height: 1.55"), "line-height"),
    gebaut: (g) => cssProp(g, "#antwortkarte-ohne-wissen", "line-height"),
  },
  {
    name: "ohne-wissen-zentriert",
    ziel: () => "center", // die Vorlage zentriert die ganze Flaeche (Z.27, text-align: center)
    gebaut: (g) => cssProp(g, "#antwortkarte-ohne-wissen", "text-align"),
  },
  {
    name: "lupe (SVG M21 21l…) 36px, ruhiges Grau",
    ziel: (z) => {
      const m =
        /<svg width="36" height="36"[^>]*stroke="#525B6B"[\s\S]{0,300}?d="M21 21l-4\.35-4\.35"/.exec(
          z,
        );
      return m ? "36/#525B6B/M21 21l-4.35-4.35" : null;
    },
    gebaut: (g) => {
      const m =
        /id="antwortkarte-lupe"[^>]*>\s*<svg width="36" height="36"[^>]*stroke="#525B6B"[\s\S]{0,300}?d="M21 21l-4\.35-4\.35"/.exec(
          g,
        );
      return m ? "36/#525B6B/M21 21l-4.35-4.35" : null;
    },
  },
  {
    name: "frage-aendern-innenabstand 10px 22px",
    ziel: (z) => prop(inlineStyle(z, "padding: 10px 22px"), "padding"),
    gebaut: (g) => cssProp(g, "#antwortkarte-frage-aendern, #antwortkarte-erneut", "padding"),
  },
  {
    name: "frage-aendern-radius 10px",
    ziel: (z) => prop(inlineStyle(z, "padding: 10px 22px"), "border-radius"),
    gebaut: (g) => cssProp(g, "#antwortkarte-frage-aendern, #antwortkarte-erneut", "border-radius"),
  },
  {
    name: "frage-aendern-schriftgrad 13.5px",
    ziel: (z) => prop(inlineStyle(z, "padding: 10px 22px"), "font-size"),
    gebaut: (g) => cssProp(g, "#antwortkarte-frage-aendern, #antwortkarte-erneut", "font-size"),
  },
  {
    name: "frage-aendern-schnitt 600",
    ziel: (z) => prop(inlineStyle(z, "padding: 10px 22px"), "font-weight"),
    gebaut: (g) => cssProp(g, "#antwortkarte-frage-aendern, #antwortkarte-erneut", "font-weight"),
  },
  {
    name: "gap-link-schriftgrad 12px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 12px"), "font-size"),
    gebaut: (g) => cssProp(g, "#antwortkarte-gap-link", "font-size"),
  },
  {
    name: "fuss-schriftgrad 11px",
    ziel: (z) => prop(inlineStyle(z, "font-size: 11px; color: #525B6B"), "font-size"),
    gebaut: (g) => cssProp(g, "#antwortkarte-ohne-wissen-fuss", "font-size"),
  },
] as const;

// JOB 3016 D3: die sechs Balkenzeilen stehen seit JOB 2619 D2 unveraendert (Name, ziel, gebaut);
// neu ist je Zeile der Messpunkt am laufenden Panel, und neu sind die Kartenzeilen (Zielbild Z.26)
// und die Satzzeilen (Z.32). Ein Prozentwert (Balkenbreite) wird im Browser als Anteil an der
// Inhaltsbreite der Karte gemessen — der Messtest weiss das, die Tabelle nennt nur den Wert.
// Runde 2 (BEN, Korrekturpflicht 2): auch die AUSSENABSTAENDE von Karte und Satz und die Anzeige
// `display: flex` der Karte (ohne sie waere `gap` wirkungslos) sind harte Vergleiche — ein Wert,
// der nur protokolliert wird, ist keiner.
export const WERTE_FRAGEWEG_PRUEFUNG: readonly WertDefinition[] = [
  {
    name: "balken-hoehe 14px",
    ziel: (z) => prop(inlineStyle(z, "height: 14px"), "height"),
    gebaut: (g) => cssProp(g, ".ladebalken", "height"),
    messpunkt: { selektor: ".ladebalken", eigenschaft: "height" },
  },
  {
    name: "balken-radius 7px",
    ziel: (z) => prop(inlineStyle(z, "height: 14px"), "border-radius"),
    gebaut: (g) => cssProp(g, ".ladebalken", "border-radius"),
    messpunkt: { selektor: ".ladebalken", eigenschaft: "border-radius" },
  },
  {
    name: "balken-farbe hairline #E9E5DE",
    ziel: (z) => prop(inlineStyle(z, "height: 14px"), "background"),
    gebaut: (g) => cssProp(g, ".ladebalken", "background"),
    messpunkt: { selektor: ".ladebalken", eigenschaft: "background-color" },
  },
  {
    name: "balken-breite 1 (92%)",
    ziel: (z) => prop(inlineStyle(z, "width: 92%"), "width"),
    gebaut: (g) => cssProp(g, ".ladebalken:nth-child(1)", "width"),
    messpunkt: { selektor: ".ladebalken:nth-child(1)", eigenschaft: "width" },
  },
  {
    name: "balken-breite 2 (100%)",
    ziel: (z) => prop(inlineStyle(z, "background: #E9E5DE; width: 100%"), "width"),
    gebaut: (g) => cssProp(g, ".ladebalken:nth-child(2)", "width"),
    messpunkt: { selektor: ".ladebalken:nth-child(2)", eigenschaft: "width" },
  },
  {
    name: "balken-breite 3 (64%)",
    ziel: (z) => prop(inlineStyle(z, "width: 64%"), "width"),
    gebaut: (g) => cssProp(g, ".ladebalken:nth-child(3)", "width"),
    messpunkt: { selektor: ".ladebalken:nth-child(3)", eigenschaft: "width" },
  },
  // — Ladekarte (PruefungLaeuft Z.26) —
  {
    name: "karte-aussenabstand 14px 16px 0",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "margin"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "margin"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "margin" },
  },
  {
    name: "karte-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "display"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "display"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "display" },
  },
  {
    name: "karte-innenabstand 18px 16px",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "padding"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "padding"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "padding" },
  },
  {
    name: "karte-radius 12px",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "border-radius"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "border-radius"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "border-radius" },
  },
  {
    name: "karte-rahmen hairline 1px solid #E9E5DE",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "border"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "border"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "border" },
  },
  {
    name: "karte-grund weiss #FFFFFF",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "background"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "background"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "background-color" },
  },
  {
    name: "karte-balkenabstand gap 12px",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "gap"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "gap"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "gap" },
  },
  {
    name: "karte-richtung column",
    ziel: (z) => prop(inlineStyle(z, "padding: 18px 16px"), "flex-direction"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte", "flex-direction"),
    messpunkt: { selektor: "#ask-ladekarte", eigenschaft: "flex-direction" },
  },
  // — der Satz unter der Karte (PruefungLaeuft Z.32) —
  {
    name: "satz-aussenabstand 12px 16px 0",
    ziel: (z) => prop(inlineStyle(z, "text-align: center"), "margin"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte-satz", "margin"),
    messpunkt: { selektor: "#ask-ladekarte-satz", eigenschaft: "margin" },
  },
  {
    name: "satz-schriftgrad 12px",
    ziel: (z) => prop(inlineStyle(z, "text-align: center"), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte-satz", "font-size"),
    messpunkt: { selektor: "#ask-ladekarte-satz", eigenschaft: "font-size" },
  },
  {
    name: "satz-farbe muted #525B6B",
    ziel: (z) => prop(inlineStyle(z, "text-align: center"), "color"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte-satz", "color"),
    messpunkt: { selektor: "#ask-ladekarte-satz", eigenschaft: "color" },
  },
  {
    name: "satz-ausrichtung center",
    ziel: (z) => prop(inlineStyle(z, "text-align: center"), "text-align"),
    gebaut: (g) => cssProp(g, "#ask-ladekarte-satz", "text-align"),
    messpunkt: { selektor: "#ask-ladekarte-satz", eigenschaft: "text-align" },
  },
] as const;

// ================================================================================================
// DIE TRAGENDEN WERTE DER VALIDIERUNGSFLAECHE (JOB 2618 D2; Vorlage Validierung.dc.html Z.56-64).
// ================================================================================================
// ANDERE BAU-SEITE, OFFEN BENANNT: Der 2618-D1-Stand ist eine React-Seite (Validation.tsx,
// Tailwind-Klassen), kein statisches HTML. Gemessen wird deshalb am QUELLTEXT: der
// className-String des ersten Elements nach einem eindeutigen Anker (`jsxKlassen`), Arbitrary-
// Werte (`text-[11.5px]`) direkt, Standardklassen ueber die dokumentierte Uebersetzung darunter.
// Die Token-Identitaet (hairline = #E9E5DE) haelt die Werkbank-Palette (mega40-token-disziplin);
// hier wird die KLASSE als Marker gefuehrt, nicht der Hex-Wert doppelt behauptet.
//
// GEMESSEN WIRD DER 2618-D1-GEGENSTAND — das FUSSBAND der Validierungskarte (Zielbild Z.56-64).
// BEWUSST WEGGELASSEN (Begruendung in der D2-Rueckgabe): die VOLLSEITEN-Elemente des Zielbilds
// (Kopfband, Warteschlangen-Sidebar, Suchfeld, Kartenkopf mit Pillen/Titel/Vertrauenspunkten) —
// sie sind nicht Gegenstand des 2618-D1-Baus; ihre Angleichung waere ein neuer Seitenumbau
// (Ownerfrage, keine Nachbesserung) · die KNOPF-REIHENFOLGE „Freigeben zuerst" (liegt in der
// Komponenten-Komposition, nicht als messbarer Quelltextwert; der MOUNTED-Test des D1 deckt sie) ·
// die Loesch-Rueckfrage (2616-Weiterfuehrung mit eigenem mega45-Sammler) · Wortlaute, Kopfband,
// browserberechnete Layout-Ergebnisse.

/** Der className-String des ersten class-Attributs NACH dem Anker (JSX-Quelltext-Messung). */
export function jsxKlassen(quelle: string, anker: string): string | null {
  const start = quelle.indexOf(anker);
  if (start < 0) {
    return null;
  }
  const m = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(quelle.slice(start, start + 3000));
  return m?.[1] ?? m?.[2] ?? null;
}

/** Tailwind-Standardklassen, die das Fussband nutzt — dokumentierte Uebersetzung in Pixel. */
const TAILWIND_PX: Record<string, string> = {
  "gap-2": "8px",
  "gap-2.5": "10px",
  "pt-3": "12px",
  "pt-3.5": "14px",
};

function klassenWert(klassen: string | null, praefix: string): string | null {
  if (klassen === null) {
    return null;
  }
  const treffer = klassen.split(/\s+/).find((k) => k === praefix || k.startsWith(`${praefix}-`));
  if (!treffer) {
    return null;
  }
  const arbitrary = /\[(.+)\]/.exec(treffer);
  return arbitrary?.[1] ?? TAILWIND_PX[treffer] ?? treffer;
}

const FUSSBAND_ANKER = "DIE AKTIONEN WERDEN ZUM FUSSBAND DER KARTE";
const HINWEIS_ANKER = "JOB 2618: im Fussband RECHTS, wie im Zielbild";

export const WERTE_VALIDIERUNG: readonly WertDefinition[] = [
  {
    name: "fussband-eigene-zeile (volle Breite unter dem Text)",
    // Zielbild Z.56: das Band ist ein EIGENER Bereich unter dem Karteninhalt mit Trennlinie.
    ziel: (z) => (inlineStyle(z, "border-top: 1px solid #E9E5DE") !== null ? "eigenes band" : null),
    gebaut: (g) => {
      const k = jsxKlassen(g, FUSSBAND_ANKER);
      return k?.includes("w-full") && k.includes("basis-full") ? "eigenes band" : null;
    },
  },
  {
    name: "band-trennlinie hairline",
    ziel: (z) => prop(inlineStyle(z, "background: #FAF8F5; border-top"), "border-top"),
    gebaut: (g) => {
      const k = jsxKlassen(g, FUSSBAND_ANKER);
      // Werkbank-Token: border-hairline ist 1px solid #E9E5DE (mega40 pinnt die Palette).
      return k?.includes("border-t") && k.includes("border-hairline") ? "1px solid #e9e5de" : null;
    },
  },
  {
    name: "band-oberabstand 14px",
    ziel: (z) => {
      const p = prop(inlineStyle(z, "background: #FAF8F5; border-top"), "padding");
      return p?.split(" ")[0] ?? null; // "14px 24px" → der Ober-/Unterabstand
    },
    gebaut: (g) => klassenWert(jsxKlassen(g, FUSSBAND_ANKER), "pt"),
  },
  {
    name: "band-knopfabstand 10px",
    ziel: (z) => prop(inlineStyle(z, "background: #FAF8F5; border-top"), "gap"),
    gebaut: (g) => klassenWert(jsxKlassen(g, FUSSBAND_ANKER), "gap"),
  },
  {
    name: "begruendungshinweis 11.5px",
    ziel: (z) =>
      prop(inlineStyle(z, "margin-left: auto; font-size: 11.5px; color: #525B6B"), "font-size"),
    gebaut: (g) => klassenWert(jsxKlassen(g, HINWEIS_ANKER), "text"),
  },
  {
    name: "begruendungshinweis rechtsbuendig (ml-auto)",
    ziel: (z) =>
      prop(inlineStyle(z, "margin-left: auto; font-size: 11.5px; color: #525B6B"), "margin-left"),
    gebaut: (g) => {
      const k = jsxKlassen(g, HINWEIS_ANKER);
      return k?.includes("ml-auto") ? "auto" : null;
    },
  },
] as const;
