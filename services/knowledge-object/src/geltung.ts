// ================================================================================================
// R-1632 / R-1633 (aufnahme:20260922:gesamt-standortwissen) — WO EIN WISSENSPUNKT GILT.
// ================================================================================================
//
// R-1632 (Werks- und Standort-Vererbung): „Wissen kann als ‚Konzern-Standard', ‚Werks-Praxis' oder
// ‚Schicht-Spezifisch' geführt werden. Kollisionen werden als Kontext-Konflikt sauber dargestellt."
// R-1633 (Schicht- und Rollen-Filter beim Fragen): „Wenn ein Mitarbeiter aus der Frühschicht fragt,
// gewichtet KLARWERK Antworten, die aus der Frühschicht stammen, höher als solche aus der
// Nachtschicht — falls relevant. Sichtbar im UI. Macht den Rollen-Konflikt-Typ produktiv nutzbar."
//
// DIESE DATEI IST DIE EINE REGEL für alle drei Verbraucher — Speichern (`KoService.setGeltung`),
// Fragen (`AskService.ask`, Rang je Quelle) und Konflikterkennung (App-Wurzel reicht
// `geltungsKollision` an den Konfliktdienst, der `knowledge-object` nicht kennt).
//
// DIE VERERBUNG, in einem Satz je Ebene:
//   · konzern — gilt in jedem Werk und jeder Schicht (wird überall geerbt);
//   · werk    — gilt in genau diesem Werk und in allen seinen Schichten;
//   · schicht — gilt nur in dieser Schicht (mit Werk: nur dort; ohne Werk: in jedem Werk).
// `rolle` ist eine zweite, unabhängige Einschränkung (z. B. „Instandhaltung"): fehlt sie, gilt der
// Punkt für jede Rolle.
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT: nichts wird ausgeblendet. Die Geltung ordnet beim Fragen nur
// unter gleich relevanten Quellen (`geltungFuerFrage` → `geltungsrang`, Regel an `rankCandidates`)
// und benennt bei der Erkennung die Konfliktart. Sichtbarkeit, Freigabe und Vertraulichkeit bleiben
// unberührt. Fehlt die Angabe, ist sie UNBEKANNT — sie wird nie aus Kategorie, Titel oder Space
// abgeleitet.

export type GeltungsEbene = "konzern" | "werk" | "schicht";

export const GELTUNGS_EBENEN: readonly GeltungsEbene[] = ["konzern", "werk", "schicht"];

/** Die Geltung eines Wissenspunkts in Normalform (Ränder weg, Innenleerraum zu einem Zeichen). */
export interface KoGeltung {
  ebene: GeltungsEbene;
  /** Pflicht bei `werk`, optional bei `schicht`, nie bei `konzern`. */
  werk?: string;
  /** Pflicht bei `schicht`, sonst nie. */
  schicht?: string;
  /** Optional auf jeder Ebene. */
  rolle?: string;
}

/** Wofür gefragt wird — jede Angabe optional; ohne Angabe wird nicht gewichtet. */
export interface Fragekontext {
  werk?: string;
  schicht?: string;
  rolle?: string;
}

/** Höchstlänge je Angabe (Werk, Schicht, Rolle) — dieselbe an Speichern und Fragen. */
export const GELTUNG_TEXT_MAX = 80;

function text(wert: unknown): string | undefined | null {
  if (wert === undefined || wert === null) {
    return undefined;
  }
  if (typeof wert !== "string") {
    return null;
  }
  const t = wert.replace(/\s+/g, " ").trim();
  if (t.length > GELTUNG_TEXT_MAX) {
    return null;
  }
  return t.length > 0 ? t : undefined;
}

export type GeltungEingang =
  | { ok: true; geltung: KoGeltung | undefined }
  | { ok: false; grund: string };

/**
 * Prüft und normalisiert eine Geltungsangabe. `null`/fehlend heisst „keine Angabe" (entfernt sie);
 * alles andere muss vollständig zu seiner Ebene passen — es wird nichts gekürzt oder geraten.
 */
export function normalizeGeltung(roh: unknown): GeltungEingang {
  if (roh === undefined || roh === null) {
    return { ok: true, geltung: undefined };
  }
  if (typeof roh !== "object" || Array.isArray(roh)) {
    return { ok: false, grund: "geltung muss ein Objekt oder null sein." };
  }
  const r = roh as Record<string, unknown>;
  const ebene = r.ebene;
  if (typeof ebene !== "string" || !(GELTUNGS_EBENEN as readonly string[]).includes(ebene)) {
    return { ok: false, grund: "geltung.ebene muss konzern, werk oder schicht sein." };
  }
  const werk = text(r.werk);
  const schicht = text(r.schicht);
  const rolle = text(r.rolle);
  if (werk === null || schicht === null || rolle === null) {
    return {
      ok: false,
      grund: `Werk, Schicht und Rolle sind Text mit höchstens ${GELTUNG_TEXT_MAX} Zeichen.`,
    };
  }
  if (ebene === "konzern" && (werk || schicht)) {
    return { ok: false, grund: "Ein Konzern-Standard nennt kein Werk und keine Schicht." };
  }
  if (ebene === "werk" && (!werk || schicht)) {
    return { ok: false, grund: "Eine Werks-Praxis nennt ein Werk und keine Schicht." };
  }
  if (ebene === "schicht" && !schicht) {
    return { ok: false, grund: "Eine schichtspezifische Angabe nennt die Schicht." };
  }
  return {
    ok: true,
    geltung: {
      ebene: ebene as GeltungsEbene,
      ...(werk ? { werk } : {}),
      ...(schicht ? { schicht } : {}),
      ...(rolle ? { rolle } : {}),
    },
  };
}

/**
 * Prüft einen Fragekontext. Ein leerer Kontext (keine einzige Angabe) ist `undefined` — dann wird
 * nicht gewichtet und der Frageweg ist der bisherige. `null` heisst: ungültig (400 an der Route).
 */
export function normalizeFragekontext(roh: unknown): Fragekontext | undefined | null {
  if (roh === undefined || roh === null) {
    return undefined;
  }
  if (typeof roh !== "object" || Array.isArray(roh)) {
    return null;
  }
  const r = roh as Record<string, unknown>;
  const werk = text(r.werk);
  const schicht = text(r.schicht);
  const rolle = text(r.rolle);
  if (werk === null || schicht === null || rolle === null) {
    return null;
  }
  if (!werk && !schicht && !rolle) {
    return undefined;
  }
  return {
    ...(werk ? { werk } : {}),
    ...(schicht ? { schicht } : {}),
    ...(rolle ? { rolle } : {}),
  };
}

/** Gleichheit zweier Angaben: Gross-/Kleinschreibung zählt nicht („Frühschicht" = „frühschicht"). */
function gleich(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").toLocaleLowerCase("de") === (b ?? "").toLocaleLowerCase("de");
}

/**
 * Wie ein Wissenspunkt zu einem Fragekontext steht:
 *   · `eigene_schicht` — schichtspezifisch für genau die gefragte Schicht (rang 3);
 *   · `eigenes_werk`   — Werks-Praxis des gefragten Werks, von seinen Schichten geerbt (rang 2);
 *   · `konzern`        — Konzern-Standard, überall geerbt (rang 1);
 *   · `unbestimmt`     — keine Geltung angegeben, oder der Kontext nennt nicht, was zum Vergleich
 *                        nötig wäre (z. B. Werks-Praxis, aber kein Werk gefragt) (rang 1);
 *   · `andere`         — gilt nachweislich woanders: anderes Werk, andere Schicht, andere Rolle (rang 0).
 * Der Rang ordnet nur — ein Punkt mit Rang 0 bleibt Kandidat und bleibt sichtbar.
 */
export type GeltungsPassung =
  | "eigene_schicht"
  | "eigenes_werk"
  | "konzern"
  | "unbestimmt"
  | "andere";

const RANG: Record<GeltungsPassung, number> = {
  eigene_schicht: 3,
  eigenes_werk: 2,
  konzern: 1,
  unbestimmt: 1,
  andere: 0,
};

export function geltungFuerFrage(
  geltung: KoGeltung | undefined,
  kontext: Fragekontext,
): { passung: GeltungsPassung; rang: number } {
  const passung = passungVon(geltung, kontext);
  return { passung, rang: RANG[passung] };
}

function passungVon(geltung: KoGeltung | undefined, kontext: Fragekontext): GeltungsPassung {
  if (!geltung) {
    return "unbestimmt";
  }
  // Die Rolle ist eine eigene Einschränkung: nennen beide eine, und es ist nicht dieselbe, gilt
  // der Punkt für diese Frage woanders — gleich auf welcher Ebene.
  if (geltung.rolle && kontext.rolle && !gleich(geltung.rolle, kontext.rolle)) {
    return "andere";
  }
  if (geltung.ebene === "konzern") {
    return "konzern";
  }
  if (geltung.werk) {
    if (!kontext.werk) {
      return "unbestimmt";
    }
    if (!gleich(geltung.werk, kontext.werk)) {
      return "andere";
    }
  }
  if (geltung.ebene === "werk") {
    return "eigenes_werk";
  }
  if (!kontext.schicht) {
    return "unbestimmt";
  }
  return gleich(geltung.schicht, kontext.schicht) ? "eigene_schicht" : "andere";
}

/** Die Geltung als Satzteil für Menschen — „Werks-Praxis (Werk Nord)". */
export function geltungsText(geltung: KoGeltung): string {
  const ort =
    geltung.ebene === "konzern"
      ? "Konzern-Standard"
      : geltung.ebene === "werk"
        ? `Werks-Praxis (${geltung.werk})`
        : `Schicht-spezifisch (${[geltung.werk, geltung.schicht].filter(Boolean).join(" · ")})`;
  return geltung.rolle ? `${ort}, Rolle ${geltung.rolle}` : ort;
}

/**
 * R-1632 / R-1633 — WELCHE KONFLIKTART EIN ERKANNTER WIDERSPRUCH ZWEIER PUNKTE IST.
 *
 * Nur wenn BEIDE Punkte ihre Geltung angeben, lässt sich etwas sagen:
 *   · anderer Ort (Ebene, Werk oder Schicht verschieden) → `context`: die beiden Aussagen können
 *     jede an ihrem Ort gelten; typisch „Werks-Praxis weicht vom Konzern-Standard ab";
 *   · gleicher Ort, aber verschiedene Rolle (oder nur einer nennt eine) → `role`;
 *   · gleicher Ort und gleiche Rolle → `null`: ein echter Widerspruch am selben Ort, er bleibt
 *     ein Wahrheitskonflikt mit Eskalationspflicht.
 * Fehlt die Angabe an einer Seite, ist die Lage unbekannt → `null` (nichts wird geraten).
 */
export function geltungsKollision(
  a: KoGeltung | undefined,
  b: KoGeltung | undefined,
): { art: "context" | "role"; vermerk: string } | null {
  if (!a || !b) {
    return null;
  }
  const ortGleich = a.ebene === b.ebene && gleich(a.werk, b.werk) && gleich(a.schicht, b.schicht);
  const rolleGleich = gleich(a.rolle, b.rolle);
  if (ortGleich && rolleGleich) {
    return null;
  }
  const vermerk = `Geltung: ${geltungsText(a)} gegenüber ${geltungsText(b)} — jede Aussage kann in ihrem Bereich gelten.`;
  return { art: ortGleich ? "role" : "context", vermerk };
}
