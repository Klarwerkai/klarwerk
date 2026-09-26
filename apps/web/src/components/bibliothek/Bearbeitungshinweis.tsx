import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { LaufendeBearbeitung } from "../../api/types";

// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · DER BEARBEITUNGSHINWEIS AUF DER LESEFLÄCHE.
// ================================================================================================
//
// ZWEI HÄLFTEN, EIN ORT:
//   · `useEigeneBearbeitung` meldet die EIGENE Bearbeitung an, solange das Formular offen ist,
//     erneuert sie im Takt des Servers und beendet sie beim Schliessen (Speichern ODER Abbrechen —
//     beide laufen durch `bearbeitenBeenden`, das `edit` auf `null` setzt).
//   · `Bearbeitungshinweis` zeigt, wer ANDERES gerade bearbeitet, und sagt es, wenn diese
//     Bearbeitung endet.
//
// WAS DIESER BAUSTEIN NIE ANFASST: den Text im Formular. Er kennt `edit` nicht einmal. Ablauf,
// Wiederholung, Verbindungsabbruch, entzogenes Recht, ein fremdes Beenden — nichts davon kann
// ungesicherte Arbeit löschen, weil hier kein Weg zu ihr führt. Und er kennt den Speicherweg
// nicht: `expectedVersion` bleibt der einzige Schutz vor stillem Überschreiben; ein Hinweis
// erlaubt, verbietet oder wiederholt kein Speichern.

/** So oft fragt die Fläche nach, wer gerade bearbeitet — Beginn und Ende sollen zeitnah ankommen. */
const LAGE_TAKT_MS = 5_000;
/** Bei unterbrochener Verbindung versucht die eigene Anmeldung es in diesem Abstand erneut. */
const WIEDERHOLUNG_MS = 5_000;
/** Solange der Server keinen Takt genannt hat, gelten seine Vorgabewerte. */
const VORGABE_ERNEUERN_S = 30;
const VORGABE_ABLAUF_S = 120;

const lageSchluessel = (koId: string): readonly unknown[] => ["bearbeitungen", koId];

/** Die Lage der EIGENEN Bearbeitung, wie sie die Fläche zeigt. */
export type EigeneLage = "aus" | "aktiv" | "unterbrochen" | "zurueck" | "ohneRecht";

function neueSitzung(): string {
  const zufall =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return zufall.replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * Meldet die eigene Bearbeitung an, solange `offen` gilt.
 *
 * `onRueckkehr` läuft, wenn nach einer Unterbrechung die erste Erneuerung wieder durchkommt: dann
 * wird der tatsächliche Serverstand neu gelesen (der Eintrag kann sich inzwischen bewegt haben).
 * Der Text im Formular bleibt dabei, wo er ist; kommt ein fremder Stand dazu, entscheidet beim
 * Speichern wie immer `expectedVersion`.
 */
export function useEigeneBearbeitung(
  koId: string,
  offen: boolean,
  onRueckkehr: () => void,
): { sitzung: string | null; lage: EigeneLage; ablaufSekunden: number } {
  const qc = useQueryClient();
  const [sitzung, setSitzung] = useState<string | null>(null);
  const [lage, setLage] = useState<EigeneLage>("aus");
  const [ablaufSekunden, setAblaufSekunden] = useState(VORGABE_ABLAUF_S);
  const rueckkehrRef = useRef(onRueckkehr);
  rueckkehrRef.current = onRueckkehr;

  useEffect(() => {
    if (!offen) {
      return;
    }
    const meine = neueSitzung();
    setSitzung(meine);
    setLage("aktiv");
    let vorbei = false;
    let unterbrochen = false;
    let zurueckGemeldet = false;
    let taktMs = VORGABE_ERNEUERN_S * 1000;
    let wecker: ReturnType<typeof setTimeout> | undefined;
    const plane = (ms: number): void => {
      if (wecker !== undefined) {
        clearTimeout(wecker);
      }
      wecker = setTimeout(() => void melden(), ms);
    };
    const melden = async (): Promise<void> => {
      try {
        const antwort = await endpoints.ko.bearbeitungMelden(koId, meine);
        if (vorbei) {
          return;
        }
        taktMs = Math.max(1, antwort.erneuernSekunden) * 1000;
        setAblaufSekunden(antwort.ablaufSekunden);
        if (unterbrochen) {
          unterbrochen = false;
          zurueckGemeldet = true;
          setLage("zurueck");
          rueckkehrRef.current();
        } else if (zurueckGemeldet) {
          zurueckGemeldet = false;
          setLage("aktiv");
        }
        void qc.invalidateQueries({ queryKey: lageSchluessel(koId) });
        plane(taktMs);
      } catch (e) {
        if (vorbei) {
          return;
        }
        // Recht entzogen, abgemeldet oder Eintrag nicht mehr sichtbar: hier hilft kein weiterer
        // Versuch. Die Anmeldung endet — der Text im Formular bleibt, wo er ist.
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          setLage("ohneRecht");
          return;
        }
        // Alles andere ist eine unterbrochene Verbindung (oder ein vorübergehender Serverfehler):
        // der Hinweis läuft am Server ab, wenn es dabei bleibt, und die nächste gelungene
        // Erneuerung setzt ihn wieder.
        unterbrochen = true;
        setLage("unterbrochen");
        plane(Math.min(taktMs, WIEDERHOLUNG_MS));
      }
    };
    const wiederDa = (): void => {
      plane(0);
    };
    window.addEventListener("online", wiederDa);
    void melden();
    return () => {
      vorbei = true;
      if (wecker !== undefined) {
        clearTimeout(wecker);
      }
      window.removeEventListener("online", wiederDa);
      setSitzung(null);
      setLage("aus");
      // Bewusstes Beenden (Speichern, Abbrechen, Wechsel des Eintrags): der Hinweis geht sofort.
      // Scheitert das, läuft er am Server ab — es gibt nichts, das hier festhängen könnte.
      void endpoints.ko
        .bearbeitungBeenden(koId, meine)
        .catch(() => undefined)
        .finally(() => {
          void qc.invalidateQueries({ queryKey: lageSchluessel(koId) });
        });
    };
  }, [koId, offen, qc]);

  return { sitzung, lage, ablaufSekunden };
}

/** Wiedererkennung einer fremden Bearbeitung über zwei Abfragen hinweg (ohne fremde Kennung). */
const kennung = (b: LaufendeBearbeitung): string => `${b.name}\u0000${b.seit}`;

/**
 * Der sichtbare Hinweis. Er steht im Lesen UND im Bearbeiten an derselben Stelle über dem Inhalt.
 *
 * `eigeneSitzung` ist die Sitzung des Formulars in DIESEM Fenster: sie wird nicht angezeigt. Eine
 * andere Sitzung desselben Kontos (zweites Fenster) bekommt ihren eigenen Satz.
 */
export function Bearbeitungshinweis({
  koId,
  eigeneSitzung,
  eigeneLage,
  ablaufSekunden,
  onFremdesEnde,
}: {
  koId: string;
  eigeneSitzung: string | null;
  eigeneLage: EigeneLage;
  ablaufSekunden: number;
  /** Eine fremde Bearbeitung ist verschwunden — der Aufrufer liest den Eintrag neu. */
  onFremdesEnde: () => void;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const lage = useQuery({
    queryKey: lageSchluessel(koId),
    queryFn: () => endpoints.ko.bearbeitungen(koId),
    refetchInterval: LAGE_TAKT_MS,
    staleTime: 0,
    retry: false,
  });
  const [beendet, setBeendet] = useState<string[]>([]);
  const gesehen = useRef<Map<string, string> | null>(null);
  const endeRef = useRef(onFremdesEnde);
  endeRef.current = onFremdesEnde;

  // Antwortet der Server mit „nicht angemeldet", „kein Recht" oder „nicht sichtbar", ist auch ein
  // älterer Bestand nicht mehr zu zeigen: wer den Eintrag nicht (mehr) lesen darf, erfährt auch
  // nicht, wer ihn bearbeitet.
  const gesperrt = lage.error instanceof ApiError && [401, 403, 404].includes(lage.error.status);
  const alle = gesperrt ? [] : (lage.data?.bearbeitungen ?? []);
  const fremde = alle.filter((b) => !b.eigen);
  const eigeneAndere = alle.filter((b) => b.eigen && b.sitzung !== eigeneSitzung);
  const minuten = Math.max(1, Math.round((lage.data?.ablaufSekunden ?? ablaufSekunden) / 60));

  // DAS ENDE WIRD NUR AUS EINER FRISCHEN, GELUNGENEN ANTWORT ABGELEITET. Eine gescheiterte Abfrage
  // sagt nichts darüber, ob jemand aufgehört hat — sie liesse sonst jede Bearbeitung „enden",
  // sobald das eigene Netz wackelt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Auslöser ist der Zeitpunkt der Antwort.
  useEffect(() => {
    if (!lage.isSuccess || lage.isError) {
      return;
    }
    const jetzt = new Map(fremde.map((b) => [kennung(b), b.name] as const));
    const vorher = gesehen.current;
    gesehen.current = jetzt;
    if (vorher === null) {
      return;
    }
    const weg = [...vorher].filter(([k]) => !jetzt.has(k)).map(([, name]) => name);
    const neu = [...jetzt.values()];
    if (weg.length > 0) {
      setBeendet((alt) => [...alt.filter((n) => !neu.includes(n)), ...weg]);
      endeRef.current();
    } else if (neu.length > 0) {
      // Wer wieder bearbeitet, hat nicht mehr „beendet".
      setBeendet((alt) => alt.filter((n) => !neu.includes(n)));
    }
  }, [lage.dataUpdatedAt]);

  const uhrzeit = (iso: string): string =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const name = (b: LaufendeBearbeitung): string => b.name.trim() || t("bearbeitung.namenlos");

  const eigenerSatz =
    eigeneLage === "unterbrochen"
      ? t("bearbeitung.eigenUnterbrochen", { minuten })
      : eigeneLage === "zurueck"
        ? t("bearbeitung.eigenZurueck")
        : eigeneLage === "ohneRecht"
          ? t("bearbeitung.eigenOhneRecht")
          : null;
  // Die Abfrage ist gescheitert und es gibt keinen Bestand, auf den sich etwas sagen liesse — dann
  // wird das gesagt, statt „niemand" zu behaupten. Steht ein älterer Bestand da, bleibt er stehen.
  const unbekannt = lage.isError && !gesperrt && lage.data === undefined;

  if (
    fremde.length === 0 &&
    eigeneAndere.length === 0 &&
    beendet.length === 0 &&
    eigenerSatz === null &&
    !unbekannt
  ) {
    return null;
  }

  return (
    <div data-testid="bib-bearbeitungshinweis" className="space-y-2">
      {fremde.length > 0 ? (
        <section
          data-testid="bib-bearbeitung-fremd"
          aria-labelledby={`bib-bearbeitung-titel-${koId}`}
          className="rounded-btn border border-trust-warn-fill/30 bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text"
        >
          <h3 id={`bib-bearbeitung-titel-${koId}`} className="font-semibold">
            {t("bearbeitung.titel")}
          </h3>
          <ul aria-live="polite">
            {fremde.map((b) => (
              <li key={kennung(b)} data-testid="bib-bearbeitung-person">
                {t("bearbeitung.fremd", { name: name(b), seit: uhrzeit(b.seit) })}
              </li>
            ))}
          </ul>
          <p className="mt-1 opacity-90">{t("bearbeitung.erklaerung", { minuten })}</p>
        </section>
      ) : null}
      {eigeneAndere.length > 0 ? (
        <p
          data-testid="bib-bearbeitung-eigenes-fenster"
          className="rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] text-muted"
        >
          {t("bearbeitung.eigenesFenster")}
        </p>
      ) : null}
      {beendet.length > 0 ? (
        <div
          data-testid="bib-bearbeitung-beendet"
          aria-live="polite"
          className="flex flex-wrap items-start gap-2 rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] text-text"
        >
          <span className="min-w-0 flex-1">
            {beendet.map((n) => (
              <span key={n} className="block">
                {t("bearbeitung.beendet", { name: n.trim() || t("bearbeitung.namenlos") })}
              </span>
            ))}
          </span>
          <button
            type="button"
            data-testid="bib-bearbeitung-beendet-schliessen"
            onClick={() => setBeendet([])}
            className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t("bearbeitung.beendetSchliessen")}
          </button>
        </div>
      ) : null}
      {eigenerSatz !== null ? (
        <p
          data-testid="bib-bearbeitung-eigen"
          data-lage={eigeneLage}
          aria-live="polite"
          className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text"
        >
          {eigenerSatz}
        </p>
      ) : null}
      {unbekannt ? (
        <p data-testid="bib-bearbeitung-unbekannt" className="text-[12.5px] text-muted">
          {t("bearbeitung.unbekannt")}
        </p>
      ) : null}
    </div>
  );
}
