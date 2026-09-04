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
   * JOB 3016 D3, weiterverwendet in JOB 3046 D2: der Messpunkt am LAUFENDEN Panel — Selektor des
   * realen Elements und die BERECHNETE Eigenschaft, die `getComputedStyle` dafuer liefert
   * (Chromium-Vergleich in tests/design/zielbild-pruefunglaeuft.test.ts bzw.
   * tests/design/zielbild-keinwissen.test.ts). `gebaut` liest denselben Wert statisch aus dem
   * Stilblock; der Messpunkt ist derselbe Wert, wirksam gerendert. Fehlt er, ist die Zeile nur
   * statisch vergleichbar.
   */
  messpunkt?: {
    selektor: string;
    eigenschaft: string;
    /**
     * JOB 3052 D6: `"attribut"` liest ein DOM-Attribut (z. B. `viewBox` — kein CSS-Wert, den
     * `getComputedStyle` kennt); fehlt die Art, ist der Messpunkt eine berechnete Eigenschaft.
     */
    art?: "stil" | "attribut";
  };
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
// JOB 3046 D2: aus demselben Grund ist die Tabelle WERTE_FRAGEWEG_KEIN_WISSEN (JOB 2619) ERSETZT
// durch WERTE_FRAGEWEG_LUECKE. Sie hatte keinen Leser und mass Selektoren, die im Produkt nie
// gebaut wurden (`#antwortkarte-ohne-wissen`, `#antwortkarte-frage-aendern`, …). Die neue Tabelle
// misst die gebaute Lueckenflaeche (`#ask-luecke`, Markenblock KW-D2-LUECKE in taskpane.html) —
// statisch am Stilblock UND je Zeile mit Messpunkt in Chromium (tests/design/zielbild-keinwissen.
// test.ts). Kein Wert steht zweimal.

// ---- KeinWissen.dc.html: die Anker der Vorlagenzeilen (Z.27-35), an denen `inlineStyle` liest ----
const KW_FLAECHE = "flex-grow: 1; display: flex; flex-direction: column";
const KW_SATZ = "font-size: 16px; line-height: 1.55";
const KW_KNOPF = "padding: 10px 22px";
const KW_LINK = "font-size: 12px";
const KW_FUSS_RAHMEN = "padding: 12px 16px; display: flex; justify-content: center";
const KW_FUSS_SATZ = "font-size: 11px; color: #525B6B";

/**
 * Der Attributrumpf des `<svg …>`, in dessen Naehe der Griffpfad der Lupe (Z.28, `M21 21l-4.35-4.35`)
 * steht — die Vorlage traegt genau eine solche Lupe; im Bau wird ab `vorlauf` gesucht.
 */
function lupeSvg(html: string, vorlauf: string): string | null {
  const start = vorlauf.length > 0 ? html.indexOf(vorlauf) : 0;
  if (start < 0) {
    return null;
  }
  const re = /<svg\s([^>]*)>[\s\S]{0,300}?M21 21l-4\.35-4\.35/g;
  re.lastIndex = start;
  const m = re.exec(html);
  return m?.[1] ?? null;
}
function svgAttribut(rumpf: string | null, name: string): string | null {
  if (rumpf === null) {
    return null;
  }
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(rumpf)?.[1] ?? null;
}
/** Die Lupe im GEBAUTEN Stand steht in `#ask-luecke`, nicht irgendwo im Dokument. */
const KW_LUPE_GEBAUT = 'id="ask-luecke"';

/**
 * Der Wert „kein Kasten": Z.27 setzt weder `background` noch `border`. So serialisiert
 * getComputedStyle eine Flaeche ohne Hintergrund und ohne Rand — und so lesen es beide Seiten:
 * fehlt die Deklaration, ist der Wert der transparente bzw. der leere Rand; steht sie da, ist es
 * ihr Wert (und dann eine Abweichung, weil das Zielbild keinen Kasten kennt).
 */
const OHNE_HINTERGRUND = "rgba(0, 0, 0, 0)";
function hintergrundOderKeiner(stil: string | null): string | null {
  if (stil === null) {
    return null;
  }
  return prop(stil, "background") ?? prop(stil, "background-color") ?? OHNE_HINTERGRUND;
}
function randOderKeiner(stil: string | null, teil: "style" | "width"): string | null {
  if (stil === null) {
    return null;
  }
  const rand = prop(stil, "border");
  if (rand === null) {
    return teil === "style" ? "none" : "0px";
  }
  const teile = rand.split(/\s+/);
  return teil === "width" ? (teile[0] ?? null) : (teile[1] ?? null);
}

export const WERTE_FRAGEWEG_LUECKE: readonly WertDefinition[] = [
  // — die Flaeche (KeinWissen Z.27): ruhig, mittig, KEIN Kasten —
  {
    name: "flaeche-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "display"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "display"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "display" },
  },
  {
    name: "flaeche-wachstum flex-grow 1",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "flex-grow"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "flex-grow"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "flex-grow" },
  },
  {
    name: "flaeche-richtung column",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "flex-direction"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "flex-direction"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "flex-direction" },
  },
  {
    name: "flaeche-querachse align-items center",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "align-items"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "align-items"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "align-items" },
  },
  {
    name: "flaeche-hauptachse justify-content center",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "justify-content"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "justify-content"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "justify-content" },
  },
  {
    name: "flaeche-abstand gap 20px",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "gap"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "gap"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "gap" },
  },
  {
    name: "flaeche-innenabstand 0 32px",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "padding"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "padding"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "padding" },
  },
  {
    name: "flaeche-textausrichtung center",
    ziel: (z) => prop(inlineStyle(z, KW_FLAECHE), "text-align"),
    gebaut: (g) => cssProp(g, "#ask-luecke", "text-align"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "text-align" },
  },
  {
    name: "flaeche-ohne-hintergrund (kein Kasten)",
    ziel: (z) => hintergrundOderKeiner(inlineStyle(z, KW_FLAECHE)),
    gebaut: (g) => hintergrundOderKeiner(cssRegel(g, "#ask-luecke")),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "background-color" },
  },
  {
    name: "flaeche-ohne-rand (kein Kasten): Randart none",
    ziel: (z) => randOderKeiner(inlineStyle(z, KW_FLAECHE), "style"),
    gebaut: (g) => randOderKeiner(cssRegel(g, "#ask-luecke"), "style"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "border-style" },
  },
  {
    name: "flaeche-ohne-rand (kein Kasten): Randbreite 0px",
    ziel: (z) => randOderKeiner(inlineStyle(z, KW_FLAECHE), "width"),
    gebaut: (g) => randOderKeiner(cssRegel(g, "#ask-luecke"), "width"),
    messpunkt: { selektor: "#ask-luecke", eigenschaft: "border-width" },
  },
  // — die Lupe (Z.28): 36x36, Strich ruhiges Grau 1.5, keine Fuellung —
  {
    name: "lupe-breite 36px",
    ziel: (z) => {
      const w = svgAttribut(lupeSvg(z, ""), "width");
      return w === null ? null : `${w}px`;
    },
    gebaut: (g) => {
      const w = svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "width");
      return w === null ? null : `${w}px`;
    },
    messpunkt: { selektor: "#ask-luecke svg", eigenschaft: "width" },
  },
  {
    name: "lupe-hoehe 36px",
    ziel: (z) => {
      const h = svgAttribut(lupeSvg(z, ""), "height");
      return h === null ? null : `${h}px`;
    },
    gebaut: (g) => {
      const h = svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "height");
      return h === null ? null : `${h}px`;
    },
    messpunkt: { selektor: "#ask-luecke svg", eigenschaft: "height" },
  },
  {
    name: "lupe-strichfarbe muted #525B6B",
    ziel: (z) => svgAttribut(lupeSvg(z, ""), "stroke"),
    // Im Bau zeichnet die Lupe mit `currentColor`; die Farbe kommt als Werkbank-Token vom
    // Element (`#ask-luecke svg { color: var(--muted) }`) — kein zweites Farbliteral (mega43).
    gebaut: (g) =>
      svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "stroke") === "currentColor"
        ? cssProp(g, "#ask-luecke svg", "color")
        : svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "stroke"),
    messpunkt: { selektor: "#ask-luecke svg", eigenschaft: "stroke" },
  },
  {
    name: "lupe-strichstaerke 1.5",
    ziel: (z) => {
      const s = svgAttribut(lupeSvg(z, ""), "stroke-width");
      return s === null ? null : `${s}px`;
    },
    gebaut: (g) => {
      const s = svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "stroke-width");
      return s === null ? null : `${s}px`;
    },
    messpunkt: { selektor: "#ask-luecke svg", eigenschaft: "stroke-width" },
  },
  {
    name: "lupe-fuellung none",
    ziel: (z) => svgAttribut(lupeSvg(z, ""), "fill"),
    gebaut: (g) => svgAttribut(lupeSvg(g, KW_LUPE_GEBAUT), "fill"),
    messpunkt: { selektor: "#ask-luecke svg", eigenschaft: "fill" },
  },
  // — der eine Satz (Z.29) —
  {
    name: "satz-schriftgrad 16px",
    ziel: (z) => prop(inlineStyle(z, KW_SATZ), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-luecke-satz", "font-size"),
    messpunkt: { selektor: "#ask-luecke-satz", eigenschaft: "font-size" },
  },
  {
    name: "satz-zeilenhoehe 1.55",
    ziel: (z) => prop(inlineStyle(z, KW_SATZ), "line-height"),
    gebaut: (g) => cssProp(g, "#ask-luecke-satz", "line-height"),
    messpunkt: { selektor: "#ask-luecke-satz", eigenschaft: "line-height" },
  },
  {
    name: "satz-farbe text #1A2233",
    ziel: (z) => prop(inlineStyle(z, KW_SATZ), "color"),
    gebaut: (g) => cssProp(g, "#ask-luecke-satz", "color"),
    messpunkt: { selektor: "#ask-luecke-satz", eigenschaft: "color" },
  },
  // — die Hauptaktion „Frage aendern" (Z.30): weisser Knopf mit Haarlinie —
  {
    name: "knopf-innenabstand 10px 22px",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "padding"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "padding"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "padding" },
  },
  {
    name: "knopf-grund weiss #FFFFFF",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "background"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "background"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "background-color" },
  },
  {
    name: "knopf-rand hairline 1px solid #E9E5DE",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "border"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "border"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "border" },
  },
  {
    name: "knopf-radius 10px",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "border-radius"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "border-radius"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "border-radius" },
  },
  {
    name: "knopf-schriftgrad 13.5px",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "font-size"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "font-size" },
  },
  {
    name: "knopf-schnitt 600",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "font-weight"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "font-weight"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "font-weight" },
  },
  {
    name: "knopf-farbe text #1A2233",
    ziel: (z) => prop(inlineStyle(z, KW_KNOPF), "color"),
    gebaut: (g) => cssProp(g, "#ask-luecke-frage-aendern", "color"),
    messpunkt: { selektor: "#ask-luecke-frage-aendern", eigenschaft: "color" },
  },
  // — die Nebenaktion „Als offene Frage an KLARWERK geben" (Z.31): Textlink 12px —
  {
    name: "link-schriftgrad 12px",
    ziel: (z) => prop(inlineStyle(z, KW_LINK), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-gap-send-btn", "font-size"),
    messpunkt: { selektor: "#ask-gap-send-btn", eigenschaft: "font-size" },
  },
  // — die Fusszeile (Z.34 Rahmen, Z.35 Satz) —
  {
    name: "fuss-innenabstand 12px 16px",
    ziel: (z) => prop(inlineStyle(z, KW_FUSS_RAHMEN), "padding"),
    gebaut: (g) => cssProp(g, "#ask-luecke-fuss", "padding"),
    messpunkt: { selektor: "#ask-luecke-fuss", eigenschaft: "padding" },
  },
  {
    name: "fuss-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, KW_FUSS_RAHMEN), "display"),
    gebaut: (g) => cssProp(g, "#ask-luecke-fuss", "display"),
    messpunkt: { selektor: "#ask-luecke-fuss", eigenschaft: "display" },
  },
  {
    name: "fuss-hauptachse justify-content center",
    ziel: (z) => prop(inlineStyle(z, KW_FUSS_RAHMEN), "justify-content"),
    gebaut: (g) => cssProp(g, "#ask-luecke-fuss", "justify-content"),
    messpunkt: { selektor: "#ask-luecke-fuss", eigenschaft: "justify-content" },
  },
  {
    name: "fuss-schriftgrad 11px",
    ziel: (z) => prop(inlineStyle(z, KW_FUSS_SATZ), "font-size"),
    gebaut: (g) => cssProp(g, "#ask-luecke-fuss", "font-size"),
    messpunkt: { selektor: "#ask-luecke-fuss", eigenschaft: "font-size" },
  },
  {
    name: "fuss-farbe muted #525B6B",
    ziel: (z) => prop(inlineStyle(z, KW_FUSS_SATZ), "color"),
    gebaut: (g) => cssProp(g, "#ask-luecke-fuss", "color"),
    messpunkt: { selektor: "#ask-luecke-fuss", eigenschaft: "color" },
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

// ================================================================================================
// DIE TRAGENDEN WERTE DES WISSENSNETZES (JOB 3052 D6; Vorlage Wissensnetz.dc.html Z.24–91).
// ================================================================================================
// ANDERE BAU-SEITE, OFFEN BENANNT: die Themenkarte ist eine React-Seite (pages/Wissensnetz.tsx).
// `gebaut` liest deshalb NICHT den Quelltext (das waere eine zweite Wahrheit ueber dieselbe
// Flaeche — JOB 3004 D1), sondern das in Chromium GERENDERTE Dokument: `document.body.outerHTML`
// nach dem Mount, gefolgt von den Token-Definitionen des modernen Themas (styles/themes.css, der
// `[data-theme="modern"]`-Block vor dem `:root`-Block, damit `tokenAufloesen` den modernen Wert
// zuerst findet). Die tragenden Werte stehen im Bau als INLINE-STIL bzw. SVG-ATTRIBUT am Element
// (Farben als `rgb(var(--kw-…))` — Token, kein zweites Hex-Literal; mega40-token-disziplin), und
// genau dort liest `gebaut` sie. Je Zeile gibt es zusaetzlich den MESSPUNKT: das reale Element
// (ueber `data-testid`) und die berechnete Eigenschaft, die tests/design/zielbild-wissensnetz.test.ts
// in Chromium misst — der wirksame Wert, nicht der geschriebene.
//
// BEWUSST WEGGELASSEN (Begruendung in der D6-Rueckgabe): das dunkle Kopfband (Z.17–20, App-Huelle),
// die von Hand gesetzten Knotenpositionen und Radien der Vorlage (im Produkt Ergebnis der Daten:
// Radius 22…46 nach Wurzelskala, Schriftgrad nach Radius — als VERHALTEN im Chromium-Test geprueft,
// nicht als fester Wert), die Zeile „1 von 3 gruen" (Z.87, keine Datenquelle im Produkt) sowie
// Wortlaute (Legende und Leiste sprechen die Produktwahrheit, dreisprachig — eigene Faelle).

// ---- Wissensnetz.dc.html: die Anker der Vorlagenzeilen, an denen gelesen wird ----------------------
const WN_ZEICHENFLAECHE = "flex-grow: 1; position: relative; padding: 16px";
const WN_LEGENDE = "position: absolute; left: 32px; bottom: 24px";
const WN_LEGENDE_EINTRAG = "gap: 6px; font-size: 11.5px; color: #525B6B";
const WN_LEGENDE_PUNKT = "width: 10px; height: 10px; border-radius: 50%; background: #E0F1E7";
const WN_LEISTE = "width: 340px; border-left: 1px solid #E9E5DE";
const WN_LEISTE_KOPF = "display: flex; align-items: center; gap: 8px";
const WN_LEISTE_PUNKT = "width: 12px; height: 12px; border-radius: 50%; background: #E8630A";
const WN_LEISTE_TITEL = "font-size: 16px; font-weight: 650";
const WN_LEISTE_ZAEHLUNG = "font-size: 12.5px; color: #525B6B";
const WN_LEISTE_LISTE = "display: flex; flex-direction: column; gap: 8px";
const WN_LEISTE_KARTE = "padding: 10px 12px; background: #FAF8F5";
const WN_LEISTE_KARTE_TITEL = "font-size: 13px; font-weight: 600";
const WN_LEISTE_KARTE_UNTER = "font-size: 11.5px; color: #525B6B";
const WN_LEISTE_LINK = "font-size: 12.5px; font-weight: 600";

/** Die drei Knotenzustaende der Vorlage plus der gewaehlte — erkannt an der Fuellfarbe (Z.34–59). */
const WN_KNOTEN = {
  belegt: { kreis: 'fill="#E0F1E7"', text: 'fill="#116B3C"' },
  offen: { kreis: 'fill="#FDF1D7"', text: 'fill="#8A5A00"' },
  freigegeben: { kreis: 'fill="#FFFFFF"', text: 'fill="#525B6B"' },
  gewaehlt: { kreis: 'fill="#E8630A"', text: 'fill="#9C5009"' },
} as const;
type WnKnotenArt = keyof typeof WN_KNOTEN;

/** Hex oder `rgb(r, g, b)` / `rgb(r g b)` → `#rrggbb` (klein); alles andere unveraendert. */
export function farbeKanon(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  const w = wert.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(w);
  if (hex) {
    return `#${(hex[1] ?? "").toLowerCase()}`;
  }
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(w);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return w;
}

/** Ein Teil einer `border`-Kurzform (`1px solid #E9E5DE`): Breite, Art oder Farbe (kanonisch). */
function randTeil(rand: string | null, teil: "width" | "style" | "color"): string | null {
  if (rand === null) {
    return null;
  }
  const t = rand.trim().split(/\s+/);
  if (teil === "width") {
    return t[0] ?? null;
  }
  if (teil === "style") {
    return t[1] ?? null;
  }
  return farbeKanon(t.slice(2).join(" ") || null);
}

/** Der Attributrumpf des ersten `<tag …>` AB `vorlauf`, dessen Rumpf `anker` enthaelt. */
function tagRumpf(html: string, tag: string, anker: string, vorlauf = ""): string | null {
  const start = vorlauf.length > 0 ? html.indexOf(vorlauf) : 0;
  if (start < 0) {
    return null;
  }
  const re = new RegExp(`<${tag}\\s([^>]*)>`, "g");
  re.lastIndex = start;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    if ((m[1] ?? "").includes(anker)) {
      return m[1] ?? null;
    }
  }
  return null;
}

/** Wie `inlineStyle`, aber erst AB dem Vorlauf gesucht (dieselben Stilwerte kommen mehrfach vor). */
function stilAb(html: string, vorlauf: string, anker: string): string | null {
  const start = html.indexOf(vorlauf);
  if (start < 0) {
    return null;
  }
  return inlineStyle(html.slice(start), anker);
}

/** Vorlage: Kreis und Text eines Knotenzustands (Z.34–59), am Fuellwert erkannt. */
function zielKnoten(z: string, art: WnKnotenArt): { kreis: string | null; text: string | null } {
  return {
    kreis: tagRumpf(z, "circle", WN_KNOTEN[art].kreis),
    text: tagRumpf(z, "text", WN_KNOTEN[art].text),
  };
}

// ---- Das gerenderte Dokument: Elemente ueber `data-testid`, Werte aus Inline-Stil und Attribut ----

/** Der Rumpf (inkl. Tagname) des ersten Elements mit diesem `data-testid`. */
function domTag(html: string, testid: string): string | null {
  const i = html.indexOf(`data-testid="${testid}"`);
  if (i < 0) {
    return null;
  }
  const a = html.lastIndexOf("<", i);
  const b = html.indexOf(">", i);
  return a < 0 || b < 0 ? null : html.slice(a + 1, b);
}
/** Eine Eigenschaft aus dem Inline-Stil des Elements, tokenaufgeloest. */
function domStil(html: string, testid: string, eigenschaft: string): string | null {
  return tokenAufloesen(html, prop(svgAttribut(domTag(html, testid), "style"), eigenschaft));
}
function domAttr(html: string, testid: string, name: string): string | null {
  return svgAttribut(domTag(html, testid), name);
}
/**
 * Der erste Knoten `<g data-testid="themenknoten" …>` mit dieser Farbe und diesem Auswahlzustand;
 * geliefert werden die Rumpfe seines Kreises und seines Textes (das naechste `<circle`/`<text`).
 */
function domKnoten(html: string, art: WnKnotenArt): { kreis: string | null; text: string | null } {
  const gewaehlt = art === "gewaehlt";
  const re = /<g\s([^>]*data-testid="themenknoten"[^>]*)>/g;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    const rumpf = m[1] ?? "";
    const passt =
      rumpf.includes(`aria-pressed="${gewaehlt}"`) &&
      (gewaehlt || rumpf.includes(`data-farbe="${art}"`));
    if (!passt) {
      continue;
    }
    const ab = html.slice(m.index);
    return { kreis: tagRumpf(ab, "circle", ""), text: tagRumpf(ab, "text", "") };
  }
  return { kreis: null, text: null };
}
/** Ein Stilwert am Kreis/Text eines Knotenrumpfs — tokenaufgeloest. */
function knotenStil(html: string, rumpf: string | null, eigenschaft: string): string | null {
  return tokenAufloesen(html, prop(svgAttribut(rumpf, "style"), eigenschaft));
}
/** Vorlage: SVG-Attribut mit `px` (die berechnete Eigenschaft liefert Pixel, das Attribut nicht). */
function px(wert: string | null): string | null {
  return wert === null ? null : /^[0-9.]+$/.test(wert) ? `${wert}px` : wert;
}

/** Die Knotenzeilen — je Zustand dieselben vier Kreis- und drei Textwerte, plus Zusatz beim Gewaehlten. */
function knotenZeilen(art: WnKnotenArt, name: string): WertDefinition[] {
  const g = `[data-testid="themenknoten"][aria-pressed="true"]`;
  const u = `[data-testid="themenknoten"][data-farbe="${art}"][aria-pressed="false"]`;
  const sel = art === "gewaehlt" ? g : u;
  const zeilen: WertDefinition[] = [
    {
      name: `knoten ${name}: fuellung`,
      ziel: (z) => farbeKanon(svgAttribut(zielKnoten(z, art).kreis, "fill")),
      gebaut: (h) => farbeKanon(knotenStil(h, domKnoten(h, art).kreis, "fill")),
      messpunkt: { selektor: `${sel} circle`, eigenschaft: "fill" },
    },
    {
      name: `knoten ${name}: rand`,
      ziel: (z) => farbeKanon(svgAttribut(zielKnoten(z, art).kreis, "stroke")),
      gebaut: (h) => farbeKanon(knotenStil(h, domKnoten(h, art).kreis, "stroke")),
      messpunkt: { selektor: `${sel} circle`, eigenschaft: "stroke" },
    },
    {
      name: `knoten ${name}: randstaerke`,
      ziel: (z) => px(svgAttribut(zielKnoten(z, art).kreis, "stroke-width")),
      gebaut: (h) => px(svgAttribut(domKnoten(h, art).kreis, "stroke-width")),
      messpunkt: { selektor: `${sel} circle`, eigenschaft: "stroke-width" },
    },
    {
      name: `knoten ${name}: textfarbe`,
      ziel: (z) => farbeKanon(svgAttribut(zielKnoten(z, art).text, "fill")),
      gebaut: (h) => farbeKanon(knotenStil(h, domKnoten(h, art).text, "fill")),
      messpunkt: { selektor: `${sel} text`, eigenschaft: "fill" },
    },
    {
      name: `knoten ${name}: textschnitt`,
      ziel: (z) => svgAttribut(zielKnoten(z, art).text, "font-weight"),
      gebaut: (h) => knotenStil(h, domKnoten(h, art).text, "font-weight"),
      messpunkt: { selektor: `${sel} text`, eigenschaft: "font-weight" },
    },
    {
      name: `knoten ${name}: textanker mittig`,
      ziel: (z) => svgAttribut(zielKnoten(z, art).text, "text-anchor"),
      gebaut: (h) => svgAttribut(domKnoten(h, art).text, "text-anchor"),
      messpunkt: { selektor: `${sel} text`, eigenschaft: "text-anchor" },
    },
  ];
  if (art === "gewaehlt") {
    zeilen.push(
      {
        name: `knoten ${name}: fuelldeckung 0.14`,
        ziel: (z) => svgAttribut(zielKnoten(z, art).kreis, "fill-opacity"),
        gebaut: (h) => svgAttribut(domKnoten(h, art).kreis, "fill-opacity"),
        messpunkt: { selektor: `${sel} circle`, eigenschaft: "fill-opacity" },
      },
      {
        name: `knoten ${name}: schriftgrad 13px`,
        ziel: (z) => px(svgAttribut(zielKnoten(z, art).text, "font-size")),
        gebaut: (h) => knotenStil(h, domKnoten(h, art).text, "font-size"),
        messpunkt: { selektor: `${sel} text`, eigenschaft: "font-size" },
      },
    );
  }
  return zeilen;
}

export const WERTE_WISSENSNETZ: readonly WertDefinition[] = [
  // — die Zeichenflaeche (Z.24): flexibel, relativ (traegt die Legende), 16px Polster —
  {
    name: "zeichenflaeche-wachstum flex-grow 1",
    ziel: (z) => prop(inlineStyle(z, WN_ZEICHENFLAECHE), "flex-grow"),
    gebaut: (h) => domStil(h, "netz-zeichenflaeche", "flex-grow"),
    messpunkt: { selektor: '[data-testid="netz-zeichenflaeche"]', eigenschaft: "flex-grow" },
  },
  {
    name: "zeichenflaeche-lage relative",
    ziel: (z) => prop(inlineStyle(z, WN_ZEICHENFLAECHE), "position"),
    gebaut: (h) => domStil(h, "netz-zeichenflaeche", "position"),
    messpunkt: { selektor: '[data-testid="netz-zeichenflaeche"]', eigenschaft: "position" },
  },
  {
    name: "zeichenflaeche-polster 16px",
    ziel: (z) => prop(inlineStyle(z, WN_ZEICHENFLAECHE), "padding"),
    gebaut: (h) => domStil(h, "netz-zeichenflaeche", "padding"),
    messpunkt: { selektor: '[data-testid="netz-zeichenflaeche"]', eigenschaft: "padding" },
  },
  // Runde 6 (BEN): die Zeile „svg-koordinaten viewBox 0 0 880 660" ist ENTFERNT. Ein `viewBox`
  // belegt keine sichtbare Groesse; das Bild traegt jetzt die sichtbare Groesse als `viewBox`
  // (Skalierung 1). Die 880×660 des Zielbilds misst der Chromium-Test als getBoundingClientRect,
  // sobald das Fenster den Platz hergibt (G5, 1600×900); bei 1280×800 nennt er die Breite, die die
  // Huelle laesst (G).
  {
    name: "svg-anzeige block",
    ziel: (z) => prop(svgAttribut(tagRumpf(z, "svg", "viewBox"), "style"), "display"),
    gebaut: (h) => domStil(h, "themenkarte", "display"),
    messpunkt: { selektor: '[data-testid="themenkarte"]', eigenschaft: "display" },
  },
  // — die Kanten (Z.25–32): eine ruhige helle Linie, eine Breite —
  {
    name: "kante-farbe hairline #E9E5DE",
    ziel: (z) => farbeKanon(svgAttribut(tagRumpf(z, "line", "stroke"), "stroke")),
    gebaut: (h) => farbeKanon(domStil(h, "themenkante", "stroke")),
    messpunkt: { selektor: '[data-testid="themenkante"]', eigenschaft: "stroke" },
  },
  {
    name: "kante-staerke 2",
    ziel: (z) => px(svgAttribut(tagRumpf(z, "line", "stroke"), "stroke-width")),
    gebaut: (h) => px(domAttr(h, "themenkante", "stroke-width")),
    messpunkt: { selektor: '[data-testid="themenkante"]', eigenschaft: "stroke-width" },
  },
  // — die Knoten (Z.34–59): drei Zustaende und der gewaehlte —
  ...knotenZeilen("belegt", "freigegeben+belegt (gruen)"),
  ...knotenZeilen("offen", "in Pruefung (gelb)"),
  ...knotenZeilen("freigegeben", "freigegeben ohne Quelle (weiss)"),
  ...knotenZeilen("gewaehlt", "gewaehlt (orange)"),
  // — die Legenden-Karte (Z.62–67) —
  {
    name: "legende-lage absolute",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "position"),
    gebaut: (h) => domStil(h, "netz-legende", "position"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "position" },
  },
  {
    name: "legende-links 32px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "left"),
    gebaut: (h) => domStil(h, "netz-legende", "left"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "left" },
  },
  {
    name: "legende-unten 24px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "bottom"),
    gebaut: (h) => domStil(h, "netz-legende", "bottom"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "bottom" },
  },
  {
    name: "legende-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "display"),
    gebaut: (h) => domStil(h, "netz-legende", "display"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "display" },
  },
  {
    // Runde 2: die Vorlage kennt eine Zeile (`gap: 16px`); der Bau bricht in der schmaleren
    // Produktflaeche um und traegt deshalb `column-gap 16 / row-gap 6`. Verglichen wird der
    // Spaltenabstand — der Wert der Vorlage; der Zeilenabstand ist eine benannte Abweichung.
    name: "legende-abstand gap 16px (Spaltenabstand)",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "gap"),
    // Das gerenderte Dokument traegt die Kurzform `gap: <Zeile> <Spalte>` (so serialisiert Chromium
    // gesetzte row-gap und column-gap); der Spaltenabstand ist der zweite Wert — oder der einzige.
    gebaut: (h) => {
      const einzeln = domStil(h, "netz-legende", "column-gap");
      if (einzeln !== null) {
        return einzeln;
      }
      const teile = domStil(h, "netz-legende", "gap")?.split(/\s+/) ?? [];
      return teile[1] ?? teile[0] ?? null;
    },
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "column-gap" },
  },
  {
    name: "legende-polster 10px 14px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "padding"),
    gebaut: (h) => domStil(h, "netz-legende", "padding"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "padding" },
  },
  {
    name: "legende-grund weiss",
    ziel: (z) => farbeKanon(prop(inlineStyle(z, WN_LEGENDE), "background")),
    gebaut: (h) => farbeKanon(domStil(h, "netz-legende", "background")),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "background-color" },
  },
  {
    name: "legende-rand hairline: Breite",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEGENDE), "border"), "width"),
    gebaut: (h) => randTeil(domStil(h, "netz-legende", "border"), "width"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "border-top-width" },
  },
  {
    name: "legende-rand hairline: Farbe",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEGENDE), "border"), "color"),
    gebaut: (h) => randTeil(domStil(h, "netz-legende", "border"), "color"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "border-top-color" },
  },
  {
    name: "legende-radius 10px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE), "border-radius"),
    gebaut: (h) => domStil(h, "netz-legende", "border-radius"),
    messpunkt: { selektor: '[data-testid="netz-legende"]', eigenschaft: "border-radius" },
  },
  {
    name: "legendeneintrag-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_EINTRAG), "display"),
    gebaut: (h) => domStil(h, "netz-legende-eintrag", "display"),
    messpunkt: { selektor: '[data-testid="netz-legende-eintrag"]', eigenschaft: "display" },
  },
  {
    name: "legendeneintrag-querachse center",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_EINTRAG), "align-items"),
    gebaut: (h) => domStil(h, "netz-legende-eintrag", "align-items"),
    messpunkt: { selektor: '[data-testid="netz-legende-eintrag"]', eigenschaft: "align-items" },
  },
  {
    name: "legendeneintrag-abstand gap 6px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_EINTRAG), "gap"),
    gebaut: (h) => domStil(h, "netz-legende-eintrag", "gap"),
    messpunkt: { selektor: '[data-testid="netz-legende-eintrag"]', eigenschaft: "gap" },
  },
  {
    name: "legendeneintrag-schriftgrad 11.5px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_EINTRAG), "font-size"),
    gebaut: (h) => domStil(h, "netz-legende-eintrag", "font-size"),
    messpunkt: { selektor: '[data-testid="netz-legende-eintrag"]', eigenschaft: "font-size" },
  },
  {
    name: "legendeneintrag-farbe muted #525B6B",
    ziel: (z) => farbeKanon(prop(inlineStyle(z, WN_LEGENDE_EINTRAG), "color")),
    gebaut: (h) => farbeKanon(domStil(h, "netz-legende-eintrag", "color")),
    messpunkt: { selektor: '[data-testid="netz-legende-eintrag"]', eigenschaft: "color" },
  },
  {
    name: "legendenpunkt-breite 10px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_PUNKT), "width"),
    gebaut: (h) => domStil(h, "netz-legende-punkt", "width"),
    messpunkt: { selektor: '[data-testid="netz-legende-punkt"]', eigenschaft: "width" },
  },
  {
    name: "legendenpunkt-hoehe 10px",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_PUNKT), "height"),
    gebaut: (h) => domStil(h, "netz-legende-punkt", "height"),
    messpunkt: { selektor: '[data-testid="netz-legende-punkt"]', eigenschaft: "height" },
  },
  {
    name: "legendenpunkt-rund 50%",
    ziel: (z) => prop(inlineStyle(z, WN_LEGENDE_PUNKT), "border-radius"),
    gebaut: (h) => domStil(h, "netz-legende-punkt", "border-radius"),
    messpunkt: { selektor: '[data-testid="netz-legende-punkt"]', eigenschaft: "border-radius" },
  },
  {
    name: "legendenpunkt-rand 1.5px",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEGENDE_PUNKT), "border"), "width"),
    gebaut: (h) => randTeil(domStil(h, "netz-legende-punkt", "border"), "width"),
    messpunkt: { selektor: '[data-testid="netz-legende-punkt"]', eigenschaft: "border-top-width" },
  },
  // — die Seitenleiste (Z.70): 340 breit, Haarlinie links, weiss, 24px 20px, Spalte mit 14px —
  {
    name: "leiste-breite 340px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE), "width"),
    gebaut: (h) => domStil(h, "netz-seitenleiste", "width"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "width" },
  },
  {
    name: "leiste-rand links: Breite 1px",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEISTE), "border-left"), "width"),
    gebaut: (h) => randTeil(domStil(h, "netz-seitenleiste", "border-left"), "width"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "border-left-width" },
  },
  {
    name: "leiste-rand links: Art solid",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEISTE), "border-left"), "style"),
    gebaut: (h) => randTeil(domStil(h, "netz-seitenleiste", "border-left"), "style"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "border-left-style" },
  },
  {
    name: "leiste-rand links: Farbe hairline",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEISTE), "border-left"), "color"),
    gebaut: (h) => randTeil(domStil(h, "netz-seitenleiste", "border-left"), "color"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "border-left-color" },
  },
  {
    name: "leiste-grund weiss",
    ziel: (z) => farbeKanon(prop(inlineStyle(z, WN_LEISTE), "background")),
    gebaut: (h) => farbeKanon(domStil(h, "netz-seitenleiste", "background")),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "background-color" },
  },
  {
    name: "leiste-polster 24px 20px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE), "padding"),
    gebaut: (h) => domStil(h, "netz-seitenleiste", "padding"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "padding" },
  },
  {
    name: "leiste-anzeige flex",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE), "display"),
    gebaut: (h) => domStil(h, "netz-seitenleiste", "display"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "display" },
  },
  {
    name: "leiste-richtung column",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE), "flex-direction"),
    gebaut: (h) => domStil(h, "netz-seitenleiste", "flex-direction"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "flex-direction" },
  },
  {
    name: "leiste-abstand gap 14px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE), "gap"),
    gebaut: (h) => domStil(h, "netz-seitenleiste", "gap"),
    messpunkt: { selektor: '[data-testid="netz-seitenleiste"]', eigenschaft: "gap" },
  },
  // — der Kopf der Leiste (Z.71–74): Farbpunkt 12px + Titel 16px/650 —
  {
    name: "leistenkopf-anzeige flex",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_KOPF), "display"),
    gebaut: (h) => domStil(h, "leiste-kopf", "display"),
    messpunkt: { selektor: '[data-testid="leiste-kopf"]', eigenschaft: "display" },
  },
  {
    name: "leistenkopf-querachse center",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_KOPF), "align-items"),
    gebaut: (h) => domStil(h, "leiste-kopf", "align-items"),
    messpunkt: { selektor: '[data-testid="leiste-kopf"]', eigenschaft: "align-items" },
  },
  {
    name: "leistenkopf-abstand gap 8px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_KOPF), "gap"),
    gebaut: (h) => domStil(h, "leiste-kopf", "gap"),
    messpunkt: { selektor: '[data-testid="leiste-kopf"]', eigenschaft: "gap" },
  },
  {
    name: "leistenpunkt-breite 12px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_PUNKT), "width"),
    gebaut: (h) => domStil(h, "leiste-punkt", "width"),
    messpunkt: { selektor: '[data-testid="leiste-punkt"]', eigenschaft: "width" },
  },
  {
    name: "leistenpunkt-hoehe 12px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_PUNKT), "height"),
    gebaut: (h) => domStil(h, "leiste-punkt", "height"),
    messpunkt: { selektor: '[data-testid="leiste-punkt"]', eigenschaft: "height" },
  },
  {
    name: "leistenpunkt-rund 50%",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_PUNKT), "border-radius"),
    gebaut: (h) => domStil(h, "leiste-punkt", "border-radius"),
    messpunkt: { selektor: '[data-testid="leiste-punkt"]', eigenschaft: "border-radius" },
  },
  {
    name: "leistenpunkt-farbe brand #E8630A",
    ziel: (z) => farbeKanon(prop(inlineStyle(z, WN_LEISTE_PUNKT), "background")),
    gebaut: (h) => farbeKanon(domStil(h, "leiste-punkt", "background")),
    messpunkt: { selektor: '[data-testid="leiste-punkt"]', eigenschaft: "background-color" },
  },
  {
    name: "leistentitel-schriftgrad 16px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_TITEL), "font-size"),
    gebaut: (h) => domStil(h, "leiste-titel", "font-size"),
    messpunkt: { selektor: '[data-testid="leiste-titel"]', eigenschaft: "font-size" },
  },
  {
    name: "leistentitel-schnitt 650",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_TITEL), "font-weight"),
    gebaut: (h) => domStil(h, "leiste-titel", "font-weight"),
    messpunkt: { selektor: '[data-testid="leiste-titel"]', eigenschaft: "font-weight" },
  },
  // — die Zaehlzeile (Z.75) —
  {
    name: "zaehlung-schriftgrad 12.5px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_ZAEHLUNG), "font-size"),
    gebaut: (h) => domStil(h, "leiste-zaehlung", "font-size"),
    messpunkt: { selektor: '[data-testid="leiste-zaehlung"]', eigenschaft: "font-size" },
  },
  {
    name: "zaehlung-farbe muted #525B6B",
    ziel: (z) => farbeKanon(prop(stilAb(z, WN_LEISTE, WN_LEISTE_ZAEHLUNG), "color")),
    gebaut: (h) => farbeKanon(domStil(h, "leiste-zaehlung", "color")),
    messpunkt: { selektor: '[data-testid="leiste-zaehlung"]', eigenschaft: "color" },
  },
  // — die Objektliste (Z.76) und ihre Karten (Z.77–88) —
  {
    name: "objektliste-anzeige flex",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_LISTE), "display"),
    gebaut: (h) => domStil(h, "leiste-objekte", "display"),
    messpunkt: { selektor: '[data-testid="leiste-objekte"]', eigenschaft: "display" },
  },
  {
    name: "objektliste-richtung column",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_LISTE), "flex-direction"),
    gebaut: (h) => domStil(h, "leiste-objekte", "flex-direction"),
    messpunkt: { selektor: '[data-testid="leiste-objekte"]', eigenschaft: "flex-direction" },
  },
  {
    name: "objektliste-abstand gap 8px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_LISTE), "gap"),
    gebaut: (h) => domStil(h, "leiste-objekte", "gap"),
    messpunkt: { selektor: '[data-testid="leiste-objekte"]', eigenschaft: "gap" },
  },
  {
    name: "objektkarte-polster 10px 12px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_KARTE), "padding"),
    gebaut: (h) => domStil(h, "leiste-objekt", "padding"),
    messpunkt: { selektor: '[data-testid="leiste-objekt"]', eigenschaft: "padding" },
  },
  {
    name: "objektkarte-grund papier #FAF8F5",
    ziel: (z) => farbeKanon(prop(inlineStyle(z, WN_LEISTE_KARTE), "background")),
    gebaut: (h) => farbeKanon(domStil(h, "leiste-objekt", "background")),
    messpunkt: { selektor: '[data-testid="leiste-objekt"]', eigenschaft: "background-color" },
  },
  {
    name: "objektkarte-rand hairline: Breite",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEISTE_KARTE), "border"), "width"),
    gebaut: (h) => randTeil(domStil(h, "leiste-objekt", "border"), "width"),
    messpunkt: { selektor: '[data-testid="leiste-objekt"]', eigenschaft: "border-top-width" },
  },
  {
    name: "objektkarte-rand hairline: Farbe",
    ziel: (z) => randTeil(prop(inlineStyle(z, WN_LEISTE_KARTE), "border"), "color"),
    gebaut: (h) => randTeil(domStil(h, "leiste-objekt", "border"), "color"),
    messpunkt: { selektor: '[data-testid="leiste-objekt"]', eigenschaft: "border-top-color" },
  },
  {
    name: "objektkarte-radius 9px",
    ziel: (z) => prop(inlineStyle(z, WN_LEISTE_KARTE), "border-radius"),
    gebaut: (h) => domStil(h, "leiste-objekt", "border-radius"),
    messpunkt: { selektor: '[data-testid="leiste-objekt"]', eigenschaft: "border-radius" },
  },
  {
    name: "objekttitel-schriftgrad 13px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE_KARTE, WN_LEISTE_KARTE_TITEL), "font-size"),
    gebaut: (h) => domStil(h, "leiste-objekt-titel", "font-size"),
    messpunkt: { selektor: '[data-testid="leiste-objekt-titel"]', eigenschaft: "font-size" },
  },
  {
    name: "objekttitel-schnitt 600",
    ziel: (z) => prop(stilAb(z, WN_LEISTE_KARTE, WN_LEISTE_KARTE_TITEL), "font-weight"),
    gebaut: (h) => domStil(h, "leiste-objekt-titel", "font-weight"),
    messpunkt: { selektor: '[data-testid="leiste-objekt-titel"]', eigenschaft: "font-weight" },
  },
  {
    name: "objektunterzeile-schriftgrad 11.5px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE_KARTE, WN_LEISTE_KARTE_UNTER), "font-size"),
    gebaut: (h) => domStil(h, "leiste-objekt-unterzeile", "font-size"),
    messpunkt: { selektor: '[data-testid="leiste-objekt-unterzeile"]', eigenschaft: "font-size" },
  },
  {
    name: "objektunterzeile-farbe muted #525B6B",
    ziel: (z) => farbeKanon(prop(stilAb(z, WN_LEISTE_KARTE, WN_LEISTE_KARTE_UNTER), "color")),
    gebaut: (h) => farbeKanon(domStil(h, "leiste-objekt-unterzeile", "color")),
    messpunkt: { selektor: '[data-testid="leiste-objekt-unterzeile"]', eigenschaft: "color" },
  },
  // — der Link „Alle N Objekte oeffnen" (Z.90; Farbe aus dem Helmet-Stil `a { color: #9C5009 }`) —
  {
    name: "link-schriftgrad 12.5px",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_LINK), "font-size"),
    gebaut: (h) => domStil(h, "leiste-alle", "font-size"),
    messpunkt: { selektor: '[data-testid="leiste-alle"]', eigenschaft: "font-size" },
  },
  {
    name: "link-schnitt 600",
    ziel: (z) => prop(stilAb(z, WN_LEISTE, WN_LEISTE_LINK), "font-weight"),
    gebaut: (h) => domStil(h, "leiste-alle", "font-weight"),
    messpunkt: { selektor: '[data-testid="leiste-alle"]', eigenschaft: "font-weight" },
  },
  {
    name: "link-farbe brand-text #9C5009",
    ziel: (z) => farbeKanon(/a\s*\{\s*color:\s*(#[0-9A-Fa-f]{6})/.exec(z)?.[1] ?? null),
    gebaut: (h) => farbeKanon(domStil(h, "leiste-alle", "color")),
    messpunkt: { selektor: '[data-testid="leiste-alle"]', eigenschaft: "color" },
  },
] as const;
