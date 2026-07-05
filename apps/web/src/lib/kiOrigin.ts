// Pedi 05.07.: Herkunftsland der KI für die Header-Pille — DSGVO-Bestätigung gibt es NUR für
// eine interne KI aus Europa, alles andere ist ehrlich „nein".
// INTERIM: Zuordnung nach Anbieter-/Modell-Kennung (nur eindeutig bekannte Präfixe, sonst
// „Herkunft unbekannt" — nichts raten). SPÄTER: das Herkunftsland übermittelt zentral die
// KI-Zugangs-Steuerung (Nerds Part steuert alle KI-Zugänge); dann fliegt diese Tabelle raus.
// DOM-frei und testbar — nur Ableitung, keine Anzeige.

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
export const KI_ORIGIN_TEXT = {
  us: "country.us",
  de: "country.de",
  fr: "country.fr",
  cn: "country.cn",
  unknown: "country.unknown",
  ownSystem: "country.ownSystem",
} as const;

export interface KiOrigin {
  countryKey: string;
  // true = Europa, false = außerhalb, null = unbekannt (zählt bei der DSGVO-Frage wie „nein").
  eu: boolean | null;
}

// Nur klar zuordenbare Kennungen — lieber „unbekannt" als eine falsche Flagge.
const ORIGIN_RULES: ReadonlyArray<{ match: RegExp; countryKey: string; eu: boolean }> = [
  { match: /anthropic|claude/, countryKey: KI_ORIGIN_TEXT.us, eu: false },
  { match: /openai|gpt-/, countryKey: KI_ORIGIN_TEXT.us, eu: false },
  { match: /google|gemini/, countryKey: KI_ORIGIN_TEXT.us, eu: false },
  { match: /meta|llama/, countryKey: KI_ORIGIN_TEXT.us, eu: false },
  { match: /mistral|mixtral/, countryKey: KI_ORIGIN_TEXT.fr, eu: true },
  { match: /aleph|luminous/, countryKey: KI_ORIGIN_TEXT.de, eu: true },
  { match: /qwen|deepseek/, countryKey: KI_ORIGIN_TEXT.cn, eu: false },
];

export function kiOrigin(id: string | null | undefined): KiOrigin {
  if (!id) {
    return { countryKey: KI_ORIGIN_TEXT.unknown, eu: null };
  }
  // „ollama" (lokale Laufzeit) enthält „llama" — die Laufzeit-Kennung wird vor der Zuordnung
  // entfernt, sonst gälte jedes lokale Modell fälschlich als Meta/USA. Das Modell dahinter
  // (z. B. ollama:llama3 → llama3) bleibt erhalten und wird korrekt zugeordnet.
  const s = id.toLowerCase().replace(/ollama/g, " ");
  for (const rule of ORIGIN_RULES) {
    if (rule.match.test(s)) {
      return { countryKey: rule.countryKey, eu: rule.eu };
    }
  }
  return { countryKey: KI_ORIGIN_TEXT.unknown, eu: null };
}
