import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import {
  AUFNAHME_HOECHSTDAUER_MS,
  aufnahmeMoeglich,
  base64AusDataUrl,
  basisMime,
  verschrifteAufnahme,
  waehleAufnahmeFormat,
} from "../../lib/sprachaufnahme";

// ================================================================================================
// AUFNAHME gesamt-sprachassistent · R-0104 — DER REKORDER FÜR ERFASSEN UND FRAGEN.
// ================================================================================================
//
// EIN Haken für beide Flächen, aus demselben Grund wie `components/start/useDiktat.ts`: zwei Kopien
// derselben Rekorderlogik driften. Was mit dem Text geschieht, entscheidet die Fläche über
// `anhaengen`; der Haken sendet nichts ab und sichert nichts.
//
// DREI ZUSAGEN, die er hält:
//   · Das Mikrofon geht aus, sobald die Aufnahme endet — auch beim Abbau der Fläche und nach der
//     Höchstdauer. Kein Mikrofon läuft weiter, nur weil der Stoppknopf verschwunden ist.
//   · `trennen()` macht eine laufende oder schon gesendete Aufnahme WIRKUNGSLOS. Das Blatt ruft es
//     an denselben Stellen wie die Diktat-Trennung (Laden, anderen Entwurf öffnen, verwerfen): ein
//     Transkript, das danach eintrifft, gehört keinem Blatt mehr (JOB 3141 R2, dieselbe Lehre).
//   · Ohne Text kein Text: der ehrliche Satz des Servers (kein Dienst, keine Freigabe, vertraulich)
//     steht als Hinweis da, erfunden wird nichts.

interface Rekorder {
  state: string;
  mimeType: string;
  start(): void;
  stop(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
}
interface RekorderKlasse {
  new (stream: MediaStream, optionen?: { mimeType?: string }): Rekorder;
  isTypeSupported?: (mime: string) => boolean;
}

export interface Sprachaufnahme {
  /** Kann dieser Browser aufnehmen? Ohne das steht kein Knopf da. */
  moeglich: boolean;
  laeuft: boolean;
  /** Die Aufnahme ist beim Server; der Knopf ist so lange gesperrt. */
  verarbeitet: boolean;
  umschalten: () => void;
  /** Hinweis oder Fehler der letzten Aufnahme — Klartext, `null` wenn nichts zu sagen ist. */
  meldung: string | null;
  /** Laufendes und Gesendetes wirkungslos machen (stabil über alle Darstellungen). */
  trennen: () => void;
}

/** Was zu GENAU EINER Aufnahme gehört — festgehalten an ihrem Ende, nie nachgelesen. */
interface Vorgang {
  generation: number;
  vertraulichkeit: string | undefined;
  sprache: string;
}

/** Eine getrennte Aufnahme wird nicht gesendet; dieser Abbruch ist kein Fehler für den Menschen. */
class AufnahmeGetrennt extends Error {}

function alsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => resolve(typeof leser.result === "string" ? leser.result : "");
    leser.onerror = () => reject(leser.error ?? new Error("FileReader"));
    leser.readAsDataURL(blob);
  });
}

export function useSprachaufnahme(optionen: {
  anhaengen: (text: string) => void;
  /** Die Stufe, unter der verschriftlicht wird. Fehlt sie, gilt der Inhalt als vertraulich. */
  vertraulichkeit?: string | undefined;
}): Sprachaufnahme {
  const { i18n, t } = useTranslation();
  const [laeuft, setLaeuft] = useState(false);
  const [verarbeitet, setVerarbeitet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const moeglich = aufnahmeMoeglich(globalThis);

  // Die Generation ist die Grenze: jede Trennung zählt sie hoch, und jede Rückmeldung einer
  // älteren Generation geht wirkungslos zurück.
  const generation = useRef(0);
  const rekorderRef = useRef<Rekorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fristRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startetRef = useRef(false);
  const optionenRef = useRef(optionen);
  optionenRef.current = optionen;
  const spracheRef = useRef(i18n.language);
  spracheRef.current = i18n.language;
  const tRef = useRef(t);
  tRef.current = t;

  const mikrofonAus = useCallback((): void => {
    if (fristRef.current !== null) {
      clearTimeout(fristRef.current);
      fristRef.current = null;
    }
    for (const spur of streamRef.current?.getTracks() ?? []) {
      spur.stop();
    }
    streamRef.current = null;
  }, []);

  const trennen = useCallback((): void => {
    generation.current += 1;
    const rekorder = rekorderRef.current;
    rekorderRef.current = null;
    if (rekorder) {
      rekorder.ondataavailable = null;
      rekorder.onstop = null;
      rekorder.onerror = null;
      if (rekorder.state !== "inactive") {
        rekorder.stop();
      }
    }
    mikrofonAus();
    setLaeuft(false);
    setVerarbeitet(false);
  }, [mikrofonAus]);

  // Der Abbau der Fläche ist eine Trennung.
  useEffect(() => trennen, [trennen]);

  // Nacharbeit 3 (Bens Befund zu Zeile 126): EIN VORGANG TRÄGT SEINE EIGENE STUFE. Generation,
  // Stufe und Sprache werden beim Ende der Aufnahme festgehalten (`onstop`, synchron) und reisen
  // mit — gelesen wird danach nichts mehr aus den AKTUELLEN Optionen. Wechselt das Blatt während
  // des Einlesens den Entwurf, kann dessen Stufe die alte Aufnahme deshalb nicht mehr erreichen.
  // Und die Generation wird VOR dem Versand geprüft, nicht erst danach: eine Aufnahme, die während
  // des asynchronen FileReader-Laufs getrennt wurde, geht gar nicht erst hinaus.
  const verschriftlichen = async (teile: Blob[], mime: string, vorgang: Vorgang): Promise<void> => {
    const meine = vorgang.generation;
    setVerarbeitet(true);
    try {
      const blob = new Blob(teile, { type: basisMime(mime) });
      const base64 = base64AusDataUrl(await alsDataUrl(blob));
      if (generation.current !== meine) {
        return;
      }
      const ergebnis = await verschrifteAufnahme(
        {
          mime,
          base64,
          sprache: vorgang.sprache,
          vertraulichkeit: vorgang.vertraulichkeit,
        },
        (rumpf) => {
          // Letzte Grenze unmittelbar vor dem Netz: getrennt heisst nicht gesendet.
          if (generation.current !== meine) {
            return Promise.reject(new AufnahmeGetrennt());
          }
          return endpoints.media.transcribe(rumpf);
        },
      );
      if (generation.current !== meine || ergebnis === null) {
        return;
      }
      if (ergebnis.art === "text") {
        optionenRef.current.anhaengen(ergebnis.text);
        setMeldung(null);
      } else {
        setMeldung(ergebnis.note);
      }
    } catch (fehler) {
      if (generation.current === meine) {
        setMeldung(
          fehler instanceof Error && fehler.message
            ? fehler.message
            : tRef.current("sprachaufnahme.fehler"),
        );
      }
    } finally {
      if (generation.current === meine) {
        setVerarbeitet(false);
      }
    }
  };

  const starten = async (): Promise<void> => {
    startetRef.current = true;
    try {
      await anlaufen();
    } finally {
      startetRef.current = false;
    }
  };

  const anlaufen = async (): Promise<void> => {
    const meine = generation.current;
    setMeldung(null);
    const g = globalThis as unknown as {
      MediaRecorder?: RekorderKlasse;
      navigator?: { mediaDevices?: MediaDevices };
    };
    const Klasse = g.MediaRecorder;
    const geraete = g.navigator?.mediaDevices;
    if (!Klasse || !geraete) {
      return;
    }
    let stream: MediaStream;
    try {
      stream = await geraete.getUserMedia({ audio: true });
    } catch {
      if (generation.current === meine) {
        setMeldung(tRef.current("sprachaufnahme.keinMikrofon"));
      }
      return;
    }
    if (generation.current !== meine) {
      // Während der Mikrofonfrage getrennt: sofort wieder freigeben.
      for (const spur of stream.getTracks()) {
        spur.stop();
      }
      return;
    }
    const format = waehleAufnahmeFormat((mime) => Klasse.isTypeSupported?.(mime) === true);
    let rekorder: Rekorder;
    try {
      rekorder = format ? new Klasse(stream, { mimeType: format }) : new Klasse(stream);
    } catch {
      for (const spur of stream.getTracks()) {
        spur.stop();
      }
      setMeldung(tRef.current("sprachaufnahme.fehler"));
      return;
    }
    streamRef.current = stream;
    rekorderRef.current = rekorder;
    const teile: Blob[] = [];
    rekorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        teile.push(e.data);
      }
    };
    rekorder.onerror = () => {
      if (rekorderRef.current !== rekorder) {
        return;
      }
      rekorderRef.current = null;
      mikrofonAus();
      setLaeuft(false);
      setMeldung(tRef.current("sprachaufnahme.fehler"));
    };
    rekorder.onstop = () => {
      if (rekorderRef.current !== rekorder) {
        return;
      }
      rekorderRef.current = null;
      mikrofonAus();
      setLaeuft(false);
      // Hier, synchron im Ende DIESER Aufnahme, wird der Vorgang festgehalten. Eine Trennung vorher
      // hätte `onstop` schon gelöst; also gehört die Stufe hier noch zu dem Blatt, das aufnahm.
      const vorgang: Vorgang = {
        generation: meine,
        vertraulichkeit: optionenRef.current.vertraulichkeit,
        sprache: spracheRef.current,
      };
      void verschriftlichen(teile, rekorder.mimeType || format || "", vorgang);
    };
    rekorder.start();
    setLaeuft(true);
    fristRef.current = setTimeout(() => {
      if (rekorderRef.current === rekorder && rekorder.state !== "inactive") {
        rekorder.stop();
      }
    }, AUFNAHME_HOECHSTDAUER_MS);
  };

  const umschalten = (): void => {
    // Während der Mikrofonfrage oder der Verschriftlichung startet kein zweiter Rekorder.
    if (verarbeitet || startetRef.current) {
      return;
    }
    const rekorder = rekorderRef.current;
    if (rekorder) {
      // Der Mensch hält selbst an: das ist KEINE Trennung — seine Aufnahme wird verschriftlicht.
      if (rekorder.state !== "inactive") {
        rekorder.stop();
      }
      return;
    }
    void starten();
  };

  return { moeglich, laeuft, verarbeitet, umschalten, meldung, trennen };
}
