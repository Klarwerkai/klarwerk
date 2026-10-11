// ================================================================================================
// AKTIVE BEGLEITUNG · DER VORGANGSADAPTER — liest ausdrücklich eingerichtete Vorgänge.
// ================================================================================================
//
// Ein Vorgang wird eingerichtet, indem seine Fläche sich selbst kennzeichnet:
//
//   <form data-klara-begleitbereich="pruefformular-42" data-klara-begleitbereich-name="Prüfformular">
//     <input name="leistung" data-klara-einheit="W,kW" …>          ← erwartet eine Einheit
//     <input name="kundennummer" data-klara-ausgeschlossen …>      ← wird nie gelesen
//
// Gelesen wird NUR innerhalb dieser Fläche und NUR Eingabefelder. Ein ausgeschlossenes Feld, ein
// Passwort- oder verstecktes Feld und alles in einem `[data-klara-ausgeschlossen]`-Teilbaum wird
// gar nicht erst angefasst — sein Wert verlässt dieses Modul nicht (K2). Der übrige Bildschirm,
// andere Seiten und andere Fenster sind für diesen Adapter unsichtbar.
//
// Browser (BPA-01) und Nativanwendung (BPA-04) liefern DASSELBE `KontextEreignis` über das
// Fensterereignis `KONTEXT_EREIGNIS`; dieser Adapter ist der eine, der heute im Produkt liest.
import type { Bereich, Feld, KontextEreignis, Systemereignis } from "./kern";

export const BEREICH_ATTRIBUT = "data-klara-begleitbereich";
const NAME_ATTRIBUT = "data-klara-begleitbereich-name";
const AUSSCHLUSS_ATTRIBUT = "data-klara-ausgeschlossen";
const EINHEIT_ATTRIBUT = "data-klara-einheit";
const MAX_FELDER = 50;
const MAX_WERT = 200;

/** Host-Adapter melden Kontext (`detail: KontextEreignis`) … */
export const KONTEXT_EREIGNIS = "klarwerk:begleitung-kontext";
/** … und Sperrbildschirm, Kontowechsel, Rechteentzug (`detail: { ereignis: Systemereignis }`). */
export const SYSTEM_EREIGNIS = "klarwerk:begleitung-system";

type Eingabe = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function istSystemereignis(wert: unknown): wert is Systemereignis {
  return wert === "sperrbildschirm" || wert === "kontowechsel" || wert === "rechteentzug";
}

function flaechen(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(`[${BEREICH_ATTRIBUT}]`));
}

/** Die eingerichteten Vorgänge auf dieser Seite — die einzigen Bereiche, die angeboten werden. */
export function eingerichteteBereiche(doc: Document): Bereich[] {
  const bereiche: Bereich[] = [];
  for (const el of flaechen(doc)) {
    const kennung = (el.getAttribute(BEREICH_ATTRIBUT) ?? "").trim();
    if (kennung) {
      const bezeichnung = (el.getAttribute(NAME_ATTRIBUT) ?? "").trim() || kennung;
      bereiche.push({ art: "vorgang", kennung, bezeichnung });
    }
  }
  return bereiche;
}

function ausgeschlossen(el: Eingabe): boolean {
  return (
    el.closest(`[${AUSSCHLUSS_ATTRIBUT}]`) !== null ||
    (el instanceof HTMLInputElement && (el.type === "password" || el.type === "hidden"))
  );
}

function bezeichnungVon(el: Eingabe, doc: Document): string {
  const label = el.id
    ? Array.from(doc.getElementsByTagName("label")).find((l) => l.htmlFor === el.id)
    : el.closest("label");
  const text = label?.textContent ?? el.getAttribute("aria-label") ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Liest den Vorgang `kennung`, falls er auf der Seite steht. Steht er nicht da (Seite gewechselt),
 * meldet das Ereignis eine fremde Quelle ohne Felder — der Kern verbucht das als „außerhalb".
 */
export function liesVorgang(doc: Document, kennung: string, konto: string): KontextEreignis {
  const wurzel = flaechen(doc).find((el) => el.getAttribute(BEREICH_ATTRIBUT) === kennung);
  if (!wurzel) {
    return { quelle: { art: "vorgang", kennung: "" }, konto, felder: [] };
  }
  const felder: Feld[] = [];
  for (const el of Array.from(wurzel.querySelectorAll<Eingabe>("input, textarea, select"))) {
    if (felder.length >= MAX_FELDER) {
      break;
    }
    const name = el.getAttribute("name") ?? el.id;
    if (!name || ausgeschlossen(el)) {
      continue;
    }
    const einheiten = (el.getAttribute(EINHEIT_ATTRIBUT) ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    felder.push({
      name,
      bezeichnung: bezeichnungVon(el, doc) || name,
      wert: el.value.slice(0, MAX_WERT),
      ...(el.hasAttribute(EINHEIT_ATTRIBUT) ? { einheitErwartet: true, einheiten } : {}),
    });
  }
  return { quelle: { art: "vorgang", kennung }, konto, felder };
}
