import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { diktatSprache } from "../../lib/speechDictation";
import { cleanForSpeech, pickVoice, vorlesenMoeglich } from "../../lib/vorlesen";

// ================================================================================================
// R-1053 — DIE ANTWORT DES SYSTEMS WIRD VORGELESEN.
// ================================================================================================
// Dieselbe Browser-Sprachausgabe wie Klara, Interviewfrage und Seitentutorial (`lib/vorlesen.ts`):
// nur `window.speechSynthesis`, kein externer Dienst, nichts startet ohne Klick. Der Haken hält nur
// „liest gerade" — der Text kommt beim Klick herein. Die Erkennungssprache ist dieselbe BCP-47-
// Abbildung wie beim Diktat (`diktatSprache`), damit de/en/nl gleich behandelt werden.
//
// Zwei Zusagen, die der Haken selbst trägt:
//   · Der Abbau der Fläche beendet das Vorlesen — wer die Seite verlässt, hört nichts mehr.
//   · `stoppen` ist für die Fläche da, wenn der vorgelesene Inhalt nicht mehr gilt (neue Antwort).
export interface Vorlesen {
  moeglich: boolean;
  liest: boolean;
  umschalten: (text: string) => void;
  stoppen: () => void;
}

/** Markdown-Zeichen und Fussnotenmarken klingen gesprochen wie Störgeräusche. */
export function antwortFuersVorlesen(text: string): string {
  return cleanForSpeech(
    text
      .replace(/\[\^?\d+\]/g, "")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[*_`>]/g, ""),
  );
}

export function useVorlesen(): Vorlesen {
  const { i18n } = useTranslation();
  const [liest, setLiest] = useState(false);
  const moeglich = vorlesenMoeglich();

  const stoppen = useCallback((): void => {
    if (vorlesenMoeglich()) {
      window.speechSynthesis.cancel();
    }
    setLiest(false);
  }, []);

  useEffect(() => () => stoppen(), [stoppen]);

  const umschalten = (text: string): void => {
    if (!moeglich) {
      return;
    }
    if (liest) {
      stoppen();
      return;
    }
    const sprache = diktatSprache(i18n.language);
    const u = new SpeechSynthesisUtterance(antwortFuersVorlesen(text));
    u.lang = sprache;
    const stimme = pickVoice(sprache.slice(0, 2).toLowerCase());
    if (stimme) {
      u.voice = stimme;
    }
    u.onend = () => setLiest(false);
    u.onerror = () => setLiest(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setLiest(true);
  };

  return { moeglich, liest, umschalten, stoppen };
}
