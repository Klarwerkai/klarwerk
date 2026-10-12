// OCR-03 · Klara zu diesem Inhalt fragen — der Dokumenttext UND der automatisch erkannte Inhalt der
// Bilder sind ein Kontext (`lib/klaraBildKontext.ts`). Steht neben dem Befund des automatischen
// Bildlesens (Editor, Dateiimport, Office im Artikel).
//
//   · Frage und Zusammenfassung laufen über den vorhandenen assist-Weg der Fläche
//     (`ImageDescribeContext`, dieselbe Provenienz und Vertraulichkeitsregel wie die
//     Bildbeschreibung). Ohne diesen Weg oder ohne Modell gibt es keine formulierte Antwort — das
//     steht da.
//   · Die Fundstellen einer Frage werden immer deterministisch bestimmt und neben der Antwort
//     genannt (Bild bzw. Folie), unabhängig davon, ob das Modell sie nennt.
//   · Liest die Fläche noch oder ist eine Quelle nur teilweise gelesen, steht das VOR der Frage und
//     an der Antwort — sie gibt sich nie als vollständig aus.
//   · Die Antwort ist eine Anzeige: sie schreibt nichts in Text, Datei oder Bild.
//   · Nacharbeit 4 (Bens Befund „antwort-kontext“): Antwort UND laufende Anfrage gehören zu genau
//     einem Kontext — Konto, Quelle (vom Aufrufer, `kontextSchluessel`) und die Bilder der Quelle.
//     Wechselt er, verschwindet die alte Antwort; eine verspätete Rückgabe (Erfolg, Fehler,
//     Abschluss) einer überholten Anfrage wird verworfen. Ändert sich nur der Text derselben Quelle,
//     bleibt die Antwort stehen, ist aber sichtbar als „vor der Änderung“ gekennzeichnet.
import { Sparkles } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { useImageDescribeWennVorhanden } from "../app/ImageDescribeContext";
import { useAssistenzStand } from "../lib/assistenzProfil";
import type { BildFundstelle, BildQuelleEingang, QuellenBefund } from "../lib/bildAutomatik";
import {
  type Belegstelle,
  type KlaraAuftrag,
  type Uebersetze,
  belegstellen,
  beruecksichtigteBilder,
  klaraAnweisung,
  klaraBildKontext,
} from "../lib/klaraBildKontext";
import { fundstelleBaustein } from "./BildBefundListe";

interface Ergebnis {
  auftrag: KlaraAuftrag;
  frage: string;
  /** Die formulierte Antwort — `null` ohne Modell bzw. ohne Weg. */
  antwort: string | null;
  fehler: string | null;
  belege: Belegstelle[];
  /** Orte der Bilder, deren Text bzw. Inhalt im Kontext stand. */
  bilder: string[];
  /** Der Stand, auf dem die Antwort beruht. */
  vollstaendig: boolean;
  offen: number;
  gesamt: number;
  /** Der Kontext, zu dem diese Antwort gehört (Konto, Quelle, Bilder). */
  schluessel: string;
  /** Der Text der Quelle, auf dem die Antwort beruht. */
  dokumentText: string;
}

/** Konto, Quelle und die Bilder der Quelle — ändert sich eines, gilt eine Antwort nicht mehr. */
export function antwortKontext(
  kontoId: string | null,
  kontextSchluessel: string,
  quellen: readonly QuellenBefund[],
): string {
  const bilder = quellen.flatMap((q) =>
    q.befunde.map((b) => `${q.quelle}|${b.fundstelle.bild}|${b.fundstelle.imageId ?? ""}`),
  );
  return `${kontoId ?? "-"}::${kontextSchluessel}::${bilder.join(",")}`;
}

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40";

export function KlaraBildKontextFrage({
  kontextSchluessel,
  dokumentTextVon,
  quellen,
  aktuell,
}: {
  /** Die Quelle und ihr Lauf beim Aufrufer (z. B. `datei:3`, `office:<anhang>:<fassung>`). */
  kontextSchluessel: string;
  /** Der übrige Text der Quelle — erst beim Fragen gelesen (der Editor ändert ihn je Tastendruck). */
  dokumentTextVon: () => string;
  quellen: readonly QuellenBefund[];
  /** Der Eingang, aus dem die Befunde stammen müssen (andere fallen aus dem Kontext). */
  aktuell?: readonly BildQuelleEingang[] | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const weg = useImageDescribeWennVorhanden();
  const kontoId = useAssistenzStand().kontoId;
  const feldId = useId();
  const [frage, setFrage] = useState("");
  // Für welchen Kontext gerade eine Anfrage läuft — `null`: keine.
  const [laeuftFuer, setLaeuftFuer] = useState<string | null>(null);
  const [ergebnisRoh, setErgebnis] = useState<Ergebnis | null>(null);
  const schluessel = antwortKontext(kontoId, kontextSchluessel, quellen);
  const schluesselRef = useRef(schluessel);
  schluesselRef.current = schluessel;
  const anfrageRef = useRef(0);
  // Nur die Antwort DIESES Kontexts wird gezeigt; eine ältere bleibt unsichtbar und wird ersetzt.
  const ergebnis = ergebnisRoh?.schluessel === schluessel ? ergebnisRoh : null;
  const laeuft = laeuftFuer === schluessel;
  const ue = useMemo<Uebersetze>(
    () => (schluessel, werte) => String(t(schluessel, werte ?? {})),
    [t],
  );
  const ortVon = useMemo(
    () => (f: BildFundstelle, quelle: string) => {
      const b = fundstelleBaustein(f, quelle);
      return String(t(b.key, b.params));
    },
    [t],
  );
  // Für den sichtbaren Stand genügen die Bildbefunde; der Dokumenttext kommt erst beim Fragen dazu.
  const kontext = useMemo(
    () => klaraBildKontext("", quellen, ue, ortVon, aktuell),
    [quellen, ue, ortVon, aktuell],
  );
  if (kontext.gesamt === 0) {
    return null;
  }
  const modell = Boolean(weg?.frage) && weg?.frageVerfuegbar !== false;

  const stelle = async (auftrag: KlaraAuftrag): Promise<void> => {
    const f = frage.trim();
    if (auftrag === "frage" && f.length === 0) {
      return;
    }
    // Der Stand JETZT — die Antwort wird mit genau ihm gekennzeichnet.
    const fuer = schluessel;
    anfrageRef.current += 1;
    const anfrage = anfrageRef.current;
    // Gilt die Rückgabe noch? Nur für die letzte Anfrage UND denselben Kontext.
    const giltNoch = (): boolean =>
      anfrageRef.current === anfrage && schluesselRef.current === fuer;
    const dokumentText = dokumentTextVon();
    const k = klaraBildKontext(dokumentText, quellen, ue, ortVon, aktuell);
    const basis: Ergebnis = {
      schluessel: fuer,
      dokumentText,
      auftrag,
      frage: f,
      antwort: null,
      fehler: null,
      belege: auftrag === "frage" ? belegstellen(f, dokumentText, k) : [],
      bilder: beruecksichtigteBilder(k).map((e) => `${e.quelle} · ${e.ort}`),
      vollstaendig: k.vollstaendig,
      offen: k.offen,
      gesamt: k.gesamt,
    };
    if (!modell || !weg?.frage) {
      setLaeuftFuer(null);
      setErgebnis(basis);
      return;
    }
    setLaeuftFuer(fuer);
    setErgebnis(null);
    try {
      const r = await weg.frage(k.kontext, klaraAnweisung(auftrag, f, k, ue));
      if (giltNoch()) {
        setErgebnis({ ...basis, antwort: r.demo ? null : r.text.trim() || null });
      }
    } catch (fehler) {
      if (giltNoch()) {
        const grund = fehler instanceof ApiError ? fehler.message : String(t("state.error"));
        setErgebnis({ ...basis, fehler: grund });
      }
    } finally {
      // Eine überholte Anfrage beendet nichts: weder den Ladezustand einer neueren noch den eines
      // anderen Kontexts.
      if (anfrageRef.current === anfrage) {
        setLaeuftFuer(null);
      }
    }
  };
  // Derselbe Kontext, aber der Text der Quelle hat sich seit der Antwort geändert.
  const veraltet = ergebnis !== null && dokumentTextVon() !== ergebnis.dokumentText;

  const standText = kontext.vollstaendig
    ? t("klarabildkontext.stand.vollstaendig", { gesamt: kontext.gesamt })
    : kontext.laeuft
      ? t("klarabildkontext.stand.laeuft", { gelesen: kontext.gelesen, gesamt: kontext.gesamt })
      : t("klarabildkontext.stand.teilweise", { gelesen: kontext.gelesen, gesamt: kontext.gesamt });

  return (
    <section
      data-testid="klara-bild-kontext"
      data-vollstaendig={kontext.vollstaendig ? "true" : "false"}
      data-laeuft={kontext.laeuft ? "true" : "false"}
      className="mt-2 rounded-card border border-hairline px-3 py-2 text-[12px] leading-relaxed"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles size={13} className="text-ai" aria-hidden="true" />
        <span className="text-[12.5px] font-semibold text-ink">
          {t("klarabildkontext.frage.titel")}
        </span>
      </div>
      <p className="mt-0.5 text-muted">{t("klarabildkontext.frage.erklaerung")}</p>
      <p
        data-testid="klara-bild-kontext-stand"
        className={kontext.vollstaendig ? "mt-1 text-text" : "mt-1 text-trust-warn-text"}
      >
        {standText}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={feldId} className="sr-only">
          {t("klarabildkontext.frage.label")}
        </label>
        <input
          id={feldId}
          data-testid="klara-bild-kontext-frage"
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !laeuft) {
              e.preventDefault();
              void stelle("frage");
            }
          }}
          placeholder={t("klarabildkontext.frage.platzhalter")}
          className="h-9 min-w-0 flex-1 rounded-input border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-ink/30"
        />
        <button
          type="button"
          data-testid="klara-bild-kontext-fragen"
          disabled={laeuft || frage.trim().length === 0}
          onClick={() => void stelle("frage")}
          className={KNOPF}
        >
          {t("klarabildkontext.frage.fragen")}
        </button>
        <button
          type="button"
          data-testid="klara-bild-kontext-zusammenfassen"
          disabled={laeuft}
          onClick={() => void stelle("zusammenfassung")}
          className={KNOPF}
        >
          {t("klarabildkontext.frage.zusammenfassen")}
        </button>
      </div>
      {laeuft ? (
        <output className="mt-2 block text-muted">{t("klarabildkontext.frage.laeuft")}</output>
      ) : null}
      {ergebnis && !laeuft ? (
        <div
          data-testid="klara-bild-kontext-antwort"
          data-auftrag={ergebnis.auftrag}
          data-veraltet={veraltet ? "true" : "false"}
          className="mt-2 rounded-btn border border-ai/30 bg-surface p-2.5"
        >
          <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
            {ergebnis.auftrag === "frage"
              ? t("klarabildkontext.antwort.titel")
              : t("klarabildkontext.antwort.zusammenfassungTitel")}
          </div>
          {veraltet ? (
            <p data-testid="klara-bild-kontext-veraltet" className="mt-1 text-trust-warn-text">
              {t("klarabildkontext.antwort.veraltet")}
            </p>
          ) : null}
          {!ergebnis.vollstaendig ? (
            <p
              data-testid="klara-bild-kontext-unvollstaendig"
              className="mt-1 text-trust-warn-text"
            >
              {t("klarabildkontext.antwort.unvollstaendig", {
                offen: ergebnis.offen,
                gesamt: ergebnis.gesamt,
              })}
            </p>
          ) : null}
          {ergebnis.antwort ? (
            <p
              data-testid="klara-bild-kontext-antworttext"
              className="mt-1 whitespace-pre-wrap text-[13px] text-text"
            >
              {ergebnis.antwort}
            </p>
          ) : ergebnis.fehler ? (
            <p role="alert" className="mt-1 text-trust-crit-text">
              {t("klarabildkontext.antwort.fehler", { grund: ergebnis.fehler })}
            </p>
          ) : (
            <p data-testid="klara-bild-kontext-ohne-modell" className="mt-1 text-muted">
              {ergebnis.auftrag === "frage"
                ? t("klarabildkontext.antwort.ohneModell")
                : t("klarabildkontext.antwort.ohneModellZusammenfassung")}
            </p>
          )}
          {ergebnis.auftrag === "frage" ? (
            <div data-testid="klara-bild-kontext-belege" className="mt-2">
              <div className="font-semibold text-text">{t("klarabildkontext.belege.titel")}</div>
              {ergebnis.belege.length === 0 ? (
                <p className="text-muted">{t("klarabildkontext.belege.keine")}</p>
              ) : (
                <ul className="mt-0.5 space-y-1">
                  {ergebnis.belege.map((b) => (
                    <li
                      key={`${b.art}-${b.quelle}-${b.ort}-${b.auszug}`}
                      data-testid="klara-bild-kontext-beleg"
                      data-art={b.art}
                    >
                      <span className="font-semibold text-text">
                        {b.art === "bild"
                          ? `${b.quelle} · ${b.ort}`
                          : t("klarabildkontext.belege.dokument")}
                      </span>
                      {": "}
                      <span className="text-muted">{b.auszug}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p data-testid="klara-bild-kontext-bilder" className="mt-2 text-muted">
              {ergebnis.bilder.length > 0
                ? t("klarabildkontext.belege.beruecksichtigt", { orte: ergebnis.bilder.join("; ") })
                : t("klarabildkontext.belege.keineBilder")}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
