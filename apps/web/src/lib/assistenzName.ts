// produkt:20261010:assistenz-name-avatar — DIE REGEL FÜR DEN ANZEIGENAMEN, im Browser.
//
// Dieselbe Regel wie am Server (`pruefeAssistenzName` in `services/app/src/assistenz-profil.ts`;
// `tests/assistenz-profil/katalog.test.ts` hält beide gleich): eine Zeile Text, 1 bis 40 Zeichen.
// Bewusst KEINE Marken- oder Wortsperrliste — der Name ist persönliche Wahl.

export const ASSISTENZ_NAME_MAX = 40;

/**
 * Steuerzeichen (C0, DEL, C1) und die Unicode-Zeilen-/Absatztrenner. Über Zeichencodes geprüft,
 * nicht über ein Regex-Literal: die beiden Trenner dürfen nicht roh im Quelltext stehen.
 */
function istSteuerzeichen(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

export type NamensFehler = "nameLeer" | "nameLang" | "nameZeile";

export function pruefeName(roh: string): NamensFehler | null {
  const name = roh.normalize("NFC").trim();
  if (name.length === 0) {
    return "nameLeer";
  }
  if ([...name].length > ASSISTENZ_NAME_MAX) {
    return "nameLang";
  }
  for (let i = 0; i < name.length; i++) {
    if (istSteuerzeichen(name.charCodeAt(i))) {
      return "nameZeile";
    }
  }
  return null;
}
