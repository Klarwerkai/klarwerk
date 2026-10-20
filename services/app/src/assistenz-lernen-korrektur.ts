// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · EQF-06-K03/K10 (Aufnahme 16.10.2026) — WAS
// MEINT DIE PERSON MIT IHRER KORREKTUR?
// ================================================================================================
//
// Die Person korrigiert einen Schritt mit ihren eigenen Worten. Diese Datei deutet drei Bedeutungen,
// regelbasiert und ohne KI (der Satz verlässt den Server nicht):
//
//   · „Das gilt nur heute“ (nur dieses Mal, einmalig, ausnahmsweise) → EINMALIGKEIT: der Schritt
//     gehört nicht zur Routine (`schritt_entfernen`).
//   · „Gehört immer dazu“ (jedes Mal, immer so) → REGEL: ein Entscheidungspunkt aus „nicht in jeder
//     Vorführung“ wird fester Schritt (`als_regel`); ein Wert wird je Lauf erfragt, nie aus der einen
//     Vorführung übernommen. Ein schon fester Schritt bleibt, wie er ist.
//   · „Hier entscheide ich selbst“ (das entscheide ich) → MANUELLER ENTSCHEIDUNGSPUNKT
//     (`als_entscheidung`).
//
// Unklar ist ein Satz, der keine, mehrere oder eine verneinte Bedeutung trägt („nicht nur heute“):
// dann wird nachgefragt — mit den drei Bedeutungen als Wahl —, nicht geraten. Jede gedeutete
// Korrektur trägt ihre Quelle (`KorrekturQuelle`: Bedeutung, Wortlaut, Zeitpunkt, Schritt), damit
// sie in Vorschau, Routine und Fassungsverlauf zugeordnet bleibt.
import {
  type Aenderung,
  type FunktionsSchritt,
  type KorrekturBedeutung,
  type KorrekturQuelle,
  siehtGeheimAus,
} from "./assistenz-lernen";

export const KORREKTUR_BEDEUTUNGEN: readonly KorrekturBedeutung[] = [
  "einmaligkeit",
  "regel",
  "entscheidungspunkt",
];

const WORTLAUT_MAX = 300;

/** Ganze Wendungen, je Bedeutung — als Wortgrenzen-Muster ohne Groß-/Kleinschreibung. */
function wendungen(...teile: string[]): RegExp {
  return new RegExp(`\\b(${teile.join("|")})\\b`, "i");
}

const MUSTER: Readonly<Record<KorrekturBedeutung, RegExp>> = {
  einmaligkeit: wendungen(
    "nur\\s+(heute|dieses\\s+mal|diesmal|einmal|jetzt)",
    "einmalig",
    "ausnahmsweise",
  ),
  regel: wendungen("geh(ö|oe)rt\\s+immer\\s+dazu", "immer\\s+dazu", "jedes\\s+mal", "immer\\s+so"),
  entscheidungspunkt: wendungen(
    "entscheide\\s+ich(\\s+(selbst|selber|das))?",
    "das\\s+entscheide\\s+ich",
    "ich\\s+entscheide(\\s+(selbst|selber))?",
  ),
};

/** Eine Verneinung vor der Bedeutung („nicht nur heute“, „nicht immer“) wird nicht gedeutet. */
const VERNEINT = /\bnicht\s+(nur|immer|jedes|ich)\b|\bkein(e|en)?\s+(regel|ausnahme)\b/i;

export const BEDEUTUNG_TEXT: Readonly<Record<KorrekturBedeutung, string>> = {
  einmaligkeit: "Einmaligkeit — gehört nicht zur Routine",
  regel: "Regel — gehört bei jedem Lauf dazu",
  entscheidungspunkt: "Hier entscheidest du selbst",
};

export type KorrekturDeutung =
  | { readonly ok: true; readonly aenderung: Aenderung; readonly quelle: KorrekturQuelle }
  | {
      readonly ok: false;
      readonly grund: "unklar" | "nicht_moeglich" | "eingabe";
      readonly text: string;
      readonly optionen: readonly KorrekturBedeutung[];
    };

/** Die Bedeutung eines Satzes — oder `null`, wenn keine oder mehrere zutreffen. */
export function bedeutungAus(satz: string): KorrekturBedeutung | null {
  if (VERNEINT.test(satz)) {
    return null;
  }
  const treffer = KORREKTUR_BEDEUTUNGEN.filter((b) => MUSTER[b].test(satz));
  return treffer.length === 1 ? (treffer[0] as KorrekturBedeutung) : null;
}

function benennung(s: FunktionsSchritt): string {
  return s.ziel?.name ?? s.vorlage?.ziel?.name ?? s.feld ?? s.art;
}

/**
 * Deutet die Korrektur `satz` zu Schritt `schritt`. Statt eines Satzes darf die Person die
 * Bedeutung auch ausdrücklich wählen (`gewaehlt`, etwa nach einer Rückfrage) — die Quelle trägt
 * dann ihren Satz oder die Wahl.
 */
export function deuteKorrektur(
  satz: string,
  schritt: FunktionsSchritt,
  am: string,
  gewaehlt?: KorrekturBedeutung,
): KorrekturDeutung {
  const wortlaut = satz.replace(/\s+/g, " ").trim();
  if (wortlaut === "" || wortlaut.length > WORTLAUT_MAX || siehtGeheimAus(wortlaut)) {
    const text = "Bitte die Korrektur in einem kurzen Satz ohne Zugangsdaten sagen.";
    return { ok: false, grund: "eingabe", text, optionen: KORREKTUR_BEDEUTUNGEN };
  }
  const bedeutung = gewaehlt ?? bedeutungAus(wortlaut);
  if (bedeutung === null) {
    const text =
      "Wie meinst du das? Gilt der Schritt nur dieses Mal, gehört er immer dazu, oder entscheidest " +
      "du hier selbst?";
    return { ok: false, grund: "unklar", text, optionen: KORREKTUR_BEDEUTUNGEN };
  }
  const nr = schritt.nr;
  const quelle: KorrekturQuelle = { bedeutung, wortlaut, am, schritt: benennung(schritt), nr };
  if (bedeutung === "einmaligkeit") {
    return { ok: true, aenderung: { art: "schritt_entfernen", nr, quelle }, quelle };
  }
  if (bedeutung === "entscheidungspunkt") {
    const frage = `Hier entscheidest du selbst („${quelle.schritt}“).`;
    return { ok: true, aenderung: { art: "als_entscheidung", nr, frage, quelle }, quelle };
  }
  // Regel: ein Entscheidungspunkt ohne Vorlage (unklare Handlung, geschütztes Feld) wird nie fest.
  if (schritt.art === "entscheidung" && !schritt.vorlage) {
    const text =
      "Diesen Schritt kann ich nicht fest übernehmen (unklare Handlung oder geschütztes Feld). " +
      "Er bleibt ein Punkt, an dem du selbst entscheidest.";
    const optionen: KorrekturBedeutung[] = ["einmaligkeit", "entscheidungspunkt"];
    return { ok: false, grund: "nicht_moeglich", text, optionen };
  }
  return { ok: true, aenderung: { art: "als_regel", nr, quelle }, quelle };
}

/** Die Korrekturen mit Quelle aus einer Folge von Änderungen — in ihrer Reihenfolge. */
export function korrekturQuellen(aenderungen: readonly Aenderung[]): KorrekturQuelle[] {
  return aenderungen.flatMap((a) => (a.quelle ? [a.quelle] : []));
}

/** Eine Zeile in einfacher Sprache für Vorschau und Fassungsverlauf. */
export function korrekturZeile(q: KorrekturQuelle): string {
  const datum = q.am.slice(0, 10);
  const was = `Schritt ${q.nr} „${q.schritt}“: ${BEDEUTUNG_TEXT[q.bedeutung]}`;
  return `${was} — deine Worte: „${q.wortlaut}“ (${datum})`;
}
