// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) · KLARA LIEST VOR — einstellbar und stoppbar.
// ================================================================================================
//
// Dieselbe Sprachausgabe wie Fragen-Seite, Interviewfrage und Seitentutorial (`lib/vorlesen.ts`,
// `components/fragen/useVorlesen.ts`): nur `window.speechSynthesis`, kein externer Dienst, dieselbe
// Stimmwahl und Textbereinigung. Neu ist nur, was Klara braucht:
//   · EIN Zustand für alle Vorleseknöpfe in Klaras Fläche — welche Nachricht gerade gelesen wird, damit
//     genau deren Knopf „Vorlesen stoppen“ zeigt;
//   · die Einstellung „Antworten automatisch vorlesen“ (aus, solange die Person sie nicht einschaltet)
//     und das Tempo, im Browser gemerkt — es sind Bedienvorlieben, keine Inhalte.
// Ausserhalb von React aus demselben Grund wie `zustand.ts`: die Hülle montiert Klara neu.
import { useSyncExternalStore } from "react";
import { diktatSprache } from "../../lib/speechDictation";
import { pickVoice, vorlesenMoeglich } from "../../lib/vorlesen";
import { antwortFuersVorlesen } from "../fragen/useVorlesen";

export type Tempo = "langsam" | "normal" | "schnell";
export const TEMPI: readonly Tempo[] = ["langsam", "normal", "schnell"];
const RATE: Record<Tempo, number> = { langsam: 0.8, normal: 1, schnell: 1.25 };

export interface VorleseZustand {
  /** Kennung dessen, was gerade gelesen wird — oder `null`. */
  liest: string | null;
  auto: boolean;
  tempo: Tempo;
}

const SPEICHER = "klarwerk.klara.sprachausgabe";

function leseEinstellung(): Pick<VorleseZustand, "auto" | "tempo"> {
  try {
    const roh = JSON.parse(localStorage.getItem(SPEICHER) ?? "null") as {
      auto?: unknown;
      tempo?: unknown;
    } | null;
    return {
      auto: roh?.auto === true,
      tempo: TEMPI.includes(roh?.tempo as Tempo) ? (roh?.tempo as Tempo) : "normal",
    };
  } catch {
    return { auto: false, tempo: "normal" };
  }
}

let zustand: VorleseZustand = { liest: null, ...leseEinstellung() };
const hoerer = new Set<() => void>();
/** Jede Ausgabe bekommt eine Nummer: das späte `end` einer abgebrochenen räumt keine neue ab. */
let lauf = 0;

function setze(neu: Partial<VorleseZustand>): void {
  zustand = { ...zustand, ...neu };
  for (const h of hoerer) {
    h();
  }
}

function merke(): void {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify({ auto: zustand.auto, tempo: zustand.tempo }));
  } catch {
    // Ohne Speicher gilt die Einstellung bis zum Neuladen.
  }
}

export function leseVorlesen(): VorleseZustand {
  return zustand;
}

export function useKlaraVorlesen(): VorleseZustand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    leseVorlesen,
    leseVorlesen,
  );
}

export function stoppeVorlesen(): void {
  lauf += 1;
  if (vorlesenMoeglich()) {
    window.speechSynthesis.cancel();
  }
  if (zustand.liest !== null) {
    setze({ liest: null });
  }
}

/** Liest `text` vor. `false`, wenn der Browser nicht vorlesen kann — dann bleibt alles Text. */
export function vorlesen(id: string, text: string, sprache: string): boolean {
  if (!vorlesenMoeglich()) {
    return false;
  }
  stoppeVorlesen();
  const meiner = lauf;
  const bcp = diktatSprache(sprache);
  const u = new SpeechSynthesisUtterance(antwortFuersVorlesen(text));
  u.lang = bcp;
  u.rate = RATE[zustand.tempo];
  const stimme = pickVoice(bcp.slice(0, 2).toLowerCase());
  if (stimme) {
    u.voice = stimme;
  }
  const ende = (): void => {
    if (lauf === meiner && zustand.liest === id) {
      setze({ liest: null });
    }
  };
  u.onend = ende;
  u.onerror = ende;
  window.speechSynthesis.speak(u);
  setze({ liest: id });
  return true;
}

/** Ein Knopf: liest, oder stoppt, wenn er selbst gerade liest. */
export function vorlesenUmschalten(id: string, text: string, sprache: string): void {
  if (zustand.liest === id) {
    stoppeVorlesen();
    return;
  }
  vorlesen(id, text, sprache);
}

export function setzeAutoVorlesen(auto: boolean): void {
  setze({ auto });
  merke();
  if (!auto) {
    stoppeVorlesen();
  }
}

export function setzeTempo(tempo: Tempo): void {
  setze({ tempo });
  merke();
}
