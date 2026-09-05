import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SpeechRec, diktatSprache, makeRec } from "../../lib/speechDictation";
import { hasSpeechRecognition } from "../../lib/speechSupport";

// ================================================================================================
// JOB 3064 H5 — EIN MIKROFON, EINE VERDRAHTUNG.
// ================================================================================================
// Das Zielbild gibt BEIDEN Frage-Feldern ein Mikrofon: dem Startfeld (`Main.dc.html` Z.41) und dem
// Feld unter der Antwort (`Fragen.dc.html` Z.47). Die Verdrahtung dafür stand bis hierher INLINE in
// `pages/Ask.tsx` (Basisstand :158–225). Sie ein zweites Mal auf der Startseite abzuschreiben wäre
// genau die Drift, gegen die JOB 3038 die Rekorder-Fabrik überhaupt zusammengezogen hat.
//
// Der Haken ist deshalb ein UMZUG, kein Zusatz: `Ask.tsx` hält diesen Zustand nicht mehr selbst.
// Beide Eigenschaften aus JOB 3038, die den Zustand erst brauchbar machen, reisen mit:
//   · Der Abschluss ist IDENTITÄTSGEBUNDEN — ein verspätetes `end` einer früheren, schon
//     gescheiterten Aufnahme trifft auf `!==` und geht wirkungslos zurück, statt der inzwischen
//     laufenden Aufnahme ihren Stoppweg zu nehmen (JOB 3038 R3, gemessen als F8).
//   · Der Abbau der Fläche beendet eine laufende Aufnahme — wer die Seite verlässt, nimmt sonst
//     den einzigen sichtbaren Stoppweg mit und der Mikrofonzugriff läuft weiter (F7).
//
// Das Stoppen löst KEINE Modellanfrage aus: der Haken kennt das Absenden gar nicht.
export interface Diktat {
  /** Kann dieser Browser überhaupt erkennen? Synchron — der Knopf ist da oder gar nicht. */
  moeglich: boolean;
  laeuft: boolean;
  umschalten: () => void;
}

export function useDiktat(anhaengen: (text: string) => void): Diktat {
  const { i18n } = useTranslation();
  const [laeuft, setLaeuft] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  // Der Rückruf darf nicht in der Abhängigkeitsliste des Abbaus hängen; er wird nur beim Erkennen
  // gelesen und soll immer der aktuelle sein.
  const anhaengenRef = useRef(anhaengen);
  anhaengenRef.current = anhaengen;
  const moeglich = hasSpeechRecognition(window);

  useEffect(() => {
    return () => {
      const rec = recRef.current;
      if (!rec) {
        return;
      }
      // Die Rückmeldungen werden VOR dem Stoppen gelöst: gleich gibt es diese Fläche nicht mehr,
      // und ihr Zustand ist dann niemandes Zustand.
      recRef.current = null;
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      rec.stop();
    };
  }, []);

  const umschalten = (): void => {
    if (laeuft) {
      recRef.current?.stop();
      return;
    }
    const rec = makeRec(
      (text) => anhaengenRef.current(text),
      (beendet) => {
        if (recRef.current !== beendet) {
          return;
        }
        recRef.current = null;
        setLaeuft(false);
      },
      diktatSprache(i18n.language),
    );
    if (!rec) {
      return;
    }
    recRef.current = rec;
    rec.start();
    setLaeuft(true);
  };

  return { moeglich, laeuft, umschalten };
}
