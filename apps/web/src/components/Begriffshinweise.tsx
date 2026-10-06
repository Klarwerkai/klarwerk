// Firmenwörterbuch im Editor — die Begriffshinweise unter dem Schreibfeld.
//
// NUR IM FALL: Ohne Hinweis steht hier nichts. Der Abgleich läuft kurz nach dem letzten
// Tastendruck gegen `POST /api/begriffe/pruefen` (deterministisch, ohne KI) und zeigt je Fundstelle
// die gepflegte Vorzugsbezeichnung, die Definition und den Eintrag, aus dem der Hinweis stammt.
//
// BEWUSST ÜBERNEHMEN ODER VERWERFEN: Übernehmen ersetzt genau die angezeigte Stelle
// (`lib/begriffshinweise.ts`); Verwerfen lässt den Text unverändert und blendet nur diesen Hinweis
// aus. Es gibt keinen „alle ersetzen"-Weg — eine Massenkorrektur ist ausdrücklich kein Ziel.
//
// KEINE SACHAUSSAGE: Die Fläche sagt in einem festen Satz, dass sie nur Benennungen prüft. Dass
// kein Hinweis erscheint, heisst nicht, dass der Text fachlich stimmt; Prüfung und
// Konflikterkennung des Hauses bleiben dafür zuständig.
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type BegriffsHinweis, begriffeApi } from "../api/begriffe";
import { ApiError } from "../api/client";
import {
  fundumgebung,
  hatPruefbarenText,
  hinweisUebernehmen,
  segmenteAusHtml,
  verwerfKennung,
} from "../lib/begriffshinweise";

/** Wartezeit nach dem letzten Tastendruck, bevor geprüft wird. */
export const BEGRIFFSPRUEFUNG_VERZOEGERUNG_MS = 900;

interface Stand {
  segmente: string[];
  hinweise: BegriffsHinweis[];
}

export function Begriffshinweise({
  bodyHtml,
  kontext,
  onUebernehmen,
}: {
  bodyHtml: string;
  /** Der fachliche Geltungsbereich des Textes (z. B. der Bereich des Entwurfs) — oder keiner. */
  kontext: string | null;
  onUebernehmen: (html: string) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [stand, setStand] = useState<Stand | null>(null);
  const [stoerung, setStoerung] = useState(false);
  const [veraltet, setVeraltet] = useState(false);
  const [verworfen, setVerworfen] = useState<ReadonlySet<string>>(new Set());
  const lauf = useRef(0);

  useEffect(() => {
    const segmente = segmenteAusHtml(bodyHtml);
    lauf.current += 1;
    const dieserLauf = lauf.current;
    if (!hatPruefbarenText(segmente)) {
      setStand(null);
      setStoerung(false);
      return;
    }
    const frist = setTimeout(() => {
      begriffeApi
        .pruefen(segmente, kontext)
        .then((ergebnis) => {
          if (dieserLauf !== lauf.current) {
            return;
          }
          // Eine Antwort ohne Hinweisliste ist keine Antwort dieses Wegs — dann steht hier nichts.
          const hinweise = Array.isArray(ergebnis?.hinweise) ? ergebnis.hinweise : [];
          setStand({ segmente, hinweise });
          setStoerung(false);
          setVeraltet(false);
        })
        .catch((fehler: unknown) => {
          if (dieserLauf !== lauf.current) {
            return;
          }
          setStand(null);
          // Ohne Leserecht oder ohne Sitzung gibt es hier nichts zu sagen; eine echte Störung
          // (Server, Netz) wird benannt statt verschwiegen.
          const status = fehler instanceof ApiError ? fehler.status : 0;
          setStoerung(status === 0 || status >= 500);
        });
    }, BEGRIFFSPRUEFUNG_VERZOEGERUNG_MS);
    return () => clearTimeout(frist);
  }, [bodyHtml, kontext]);

  const sichtbar = (stand?.hinweise ?? []).filter(
    (h) => !verworfen.has(verwerfKennung(h, stand?.segmente[h.segment] ?? "")),
  );

  if (stoerung) {
    return (
      <output data-testid="begriffshinweise-stoerung" className="block text-[12px] text-muted">
        {t("begriffe.hinweise.stoerung")}
      </output>
    );
  }
  if (!stand || sichtbar.length === 0) {
    return null;
  }

  const uebernehmen = (h: BegriffsHinweis): void => {
    const ergebnis = hinweisUebernehmen(bodyHtml, h, stand.segmente);
    if (ergebnis.lage === "veraltet") {
      setVeraltet(true);
      return;
    }
    // Die übrigen Hinweise DESSELBEN Segments zeigen jetzt auf verschobene Stellen — sie fallen
    // weg, bis die nächste Prüfung (sie folgt auf die Änderung) sie neu liefert.
    setStand({
      segmente: stand.segmente,
      hinweise: stand.hinweise.filter((x) => x.segment !== h.segment),
    });
    onUebernehmen(ergebnis.html);
  };

  const verwerfen = (h: BegriffsHinweis): void => {
    setVerworfen((alt) => new Set(alt).add(verwerfKennung(h, stand.segmente[h.segment] ?? "")));
  };

  return (
    <section
      data-testid="begriffshinweise"
      aria-label={t("begriffe.hinweise.titel")}
      className="rounded-card border border-hairline bg-page p-2.5"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">
          {t("begriffe.hinweise.titelAnzahl", { anzahl: sichtbar.length })}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-2">
        {t("begriffe.hinweise.keineSachaussage")}
      </p>
      {veraltet ? (
        <p data-testid="begriffshinweise-veraltet" className="mt-1 text-[11.5px] text-muted">
          {t("begriffe.hinweise.veraltet")}
        </p>
      ) : null}
      <ul className="mt-1.5 flex flex-col gap-2">
        {sichtbar.map((h) => {
          const umgebung = fundumgebung(stand.segmente[h.segment] ?? "", h.start, h.ende);
          const eintragPfad = `/begriffe?begriff=${encodeURIComponent(h.begriffId)}&fassung=${h.begriffVersion}`;
          return (
            <li
              key={`${h.begriffId}-${h.segment}-${h.start}`}
              data-testid="begriffshinweis"
              className="rounded-btn border border-hairline bg-surface p-2"
            >
              <p className="text-[12.5px] text-text">
                {t("begriffe.hinweise.vorschlag", { gefunden: h.gefunden, vorzug: h.vorzug })}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {umgebung.vor}
                <mark className="rounded-sm bg-trust-warn-bg px-0.5 text-text">
                  {umgebung.fund}
                </mark>
                {umgebung.nach}
              </p>
              {h.definition ? (
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {t("begriffe.hinweise.definition", { definition: h.definition })}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-muted-2">
                {t("begriffe.hinweise.herkunft", {
                  bereich: h.geltungsbereich,
                  version: h.begriffVersion,
                })}{" "}
                <a
                  href={eintragPfad}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t("begriffe.hinweise.eintragOeffnen")}
                </a>
              </p>
              {h.mehrdeutig ? (
                <p className="mt-0.5 text-[11px] text-muted-2">
                  {t("begriffe.hinweise.mehrdeutig")}
                </p>
              ) : null}
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  data-testid="begriffshinweis-uebernehmen"
                  onClick={() => uebernehmen(h)}
                  className="rounded-btn bg-ink px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
                >
                  {t("begriffe.hinweise.uebernehmen")}
                </button>
                <button
                  type="button"
                  data-testid="begriffshinweis-verwerfen"
                  onClick={() => verwerfen(h)}
                  className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
                >
                  {t("begriffe.hinweise.verwerfen")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
