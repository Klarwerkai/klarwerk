import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useVorlesen } from "../components/fragen/useVorlesen";
import { Button } from "../components/ui";
import { aufRechtekontextwechsel } from "../lib/rechtekontext";
import { type SpeechRec, diktatSprache, makeRec } from "../lib/speechDictation";
import { hasSpeechRecognition } from "../lib/speechSupport";
import { kioskTexte } from "./texte";

interface Profil {
  profilId: string;
  revision: number;
  zugang: "sitzung";
}
interface Antwort {
  result: {
    answer?: string;
    answered: boolean;
    evidence: {
      grade: string;
      sourcesConflicted: boolean;
      conflictsUnproven: boolean;
    };
  };
  kiosk: { quellen: { koId: string; fassung: number }[] };
}
type Phase = "pruefen" | "gesperrt" | "bereit" | "hoeren" | "laden" | "lesen" | "fehler";

/** R-1648: eigene Lesefläche ohne Shell, lokale Ablage oder schreibende Aktionen. */
export default function Kiosk(): JSX.Element {
  const { i18n } = useTranslation();
  const t = kioskTexte(i18n.language);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [phase, setPhase] = useState<Phase>("pruefen");
  const [frage, setFrage] = useState("");
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [meldung, setMeldung] = useState("");
  const rec = useRef<SpeechRec | null>(null);
  const lauf = useRef<AbortController | null>(null);
  const aktiv = useRef(false);
  const generation = useRef(0);
  const vorlesen = useVorlesen();
  const kannSprechen = hasSpeechRecognition(window) && vorlesen.moeglich;
  const sprechtext = (a: Antwort): string => {
    const e = a.result.evidence;
    return [
      a.result.answered ? a.result.answer : t.luecke,
      e.grade !== "verified" && a.result.answered ? t.vorbehalt : "",
      e.sourcesConflicted || e.conflictsUnproven ? t.konflikt : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const mikrofonAus = useCallback((): void => {
    const r = rec.current;
    rec.current = null;
    if (r) {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      r.stop();
    }
  }, []);
  const stoppen = useCallback((): void => {
    aktiv.current = false;
    generation.current += 1;
    lauf.current?.abort();
    mikrofonAus();
    vorlesen.stoppen();
    setPhase("bereit");
  }, [mikrofonAus, vorlesen.stoppen]);
  useEffect(() => {
    let lebt = true;
    api
      .get<Profil>("/kiosk/profil")
      .then((p) => {
        if (lebt) {
          setProfil(p);
          setPhase("bereit");
        }
      })
      .catch(() => {
        if (lebt) setPhase("gesperrt");
      });
    const abmelden = aufRechtekontextwechsel(() => {
      stoppen();
      setAntwort(null);
      setFrage("");
      setProfil(null);
      setPhase("gesperrt");
    });
    return () => {
      lebt = false;
      abmelden();
      stoppen();
    };
  }, [stoppen]);

  const senden = async (text: string): Promise<void> => {
    if (!profil || !aktiv.current) return;
    mikrofonAus();
    vorlesen.stoppen();
    setFrage(text);
    setAntwort(null);
    setPhase("laden");
    const meine = ++generation.current;
    const controller = new AbortController();
    lauf.current = controller;
    try {
      const a = await api.postAbbrechbar<Antwort>(
        "/kiosk/fragen",
        {
          question: text,
          profilId: profil.profilId,
          revision: profil.revision,
          locale: i18n.language.startsWith("en")
            ? "en"
            : i18n.language.startsWith("nl")
              ? "nl"
              : "de",
        },
        controller.signal,
      );
      if (generation.current !== meine || !aktiv.current) return;
      setAntwort(a);
      setPhase("lesen");
      vorlesen.umschalten(sprechtext(a));
    } catch {
      if (generation.current !== meine) return;
      aktiv.current = false;
      setMeldung(t.fehler);
      setPhase("fehler");
    }
  };
  const hoeren = (): void => {
    if (!aktiv.current || rec.current) return;
    const r = makeRec(
      (text) => {
        if (rec.current !== r || !aktiv.current) return;
        mikrofonAus();
        const befehl = text
          .trim()
          .toLocaleLowerCase()
          .replace(/[.!?]+$/g, "");
        if (["stopp", "stop"].includes(befehl)) {
          stoppen();
          return;
        }
        if (["noch einmal", "again", "opnieuw"].includes(befehl) && antwort) {
          setPhase("lesen");
          vorlesen.umschalten(sprechtext(antwort));
          return;
        }
        if (text.trim()) void senden(text.trim());
      },
      (beendet) => {
        if (rec.current !== beendet) return;
        rec.current = null;
        aktiv.current = false;
        setPhase("fehler");
        setMeldung(t.mikrofon);
      },
      diktatSprache(i18n.language),
    );
    if (!r) {
      aktiv.current = false;
      setMeldung(t.fehlt);
      setPhase("fehler");
      return;
    }
    rec.current = r;
    try {
      r.start();
      setPhase("hoeren");
    } catch {
      mikrofonAus();
      aktiv.current = false;
      setMeldung(t.mikrofon);
      setPhase("fehler");
    }
  };
  const weiterHoeren = useRef(hoeren);
  weiterHoeren.current = hoeren;
  // Das Mikrofon bleibt während Frageabruf und Sprachausgabe aus (keine Rückkopplung).
  useEffect(() => {
    if (phase === "lesen" && !vorlesen.liest && aktiv.current) weiterHoeren.current();
  }, [phase, vorlesen.liest]);
  const gesperrt = phase === "gesperrt" || phase === "pruefen";
  return (
    <main className="min-h-screen bg-surface text-text p-6 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">{t.titel}</h1>
          <p>{t.hinweis}</p>
        </header>
        <output aria-live="polite">
          {phase === "gesperrt" ? t.gesperrt : phase === "fehler" ? meldung : t[phase]}
        </output>
        {!gesperrt && (
          <>
            <p>{t.anleitung}</p>
            {!kannSprechen ? (
              <p role="alert">{t.fehlt}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-12 px-5"
                  disabled={phase === "hoeren" || phase === "laden" || phase === "lesen"}
                  onClick={() => {
                    aktiv.current = true;
                    setMeldung("");
                    hoeren();
                  }}
                >
                  {t.start}
                </Button>
                <Button type="button" className="min-h-12 px-5" onClick={stoppen}>
                  {t.stop}
                </Button>
                {antwort && (
                  <Button
                    type="button"
                    className="min-h-12 px-5"
                    disabled={phase === "lesen" || phase === "laden"}
                    onClick={() => {
                      mikrofonAus();
                      vorlesen.stoppen();
                      aktiv.current = true;
                      setPhase("lesen");
                      vorlesen.umschalten(sprechtext(antwort));
                    }}
                  >
                    {t.wieder}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {frage && (
          <section aria-label={t.frage}>
            <h2 className="font-semibold">{t.frage}</h2>
            <p>{frage}</p>
          </section>
        )}
        {antwort && (
          <section aria-label={t.antwort} className="space-y-4">
            <h2 className="font-semibold">{t.antwort}</h2>
            <p className="whitespace-pre-wrap text-lg">{sprechtext(antwort)}</p>
            <details>
              <summary>{t.quellen}</summary>
              <ul>
                {antwort.kiosk.quellen.map((q) => (
                  <li key={q.koId}>
                    {q.koId} · {t.fassung} {q.fassung}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}
