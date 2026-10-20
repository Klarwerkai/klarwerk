// OCR-E06 · „Klara, was steht hier?“ — ein Bild der Quelle oder einen Bereich darin auswählen und
// Klara gezielt dazu fragen (Auftrag produkt:20261012:klara-ocr-bereichsfrage). Steht neben
// „Klara zu diesem Inhalt fragen“ (`KlaraBildKontextFrage`) an denselben Flächen: Editor
// (`BildBefundeImRumpf`), Dateiimport im Erfassen, Office im Artikel. Logik: `lib/klaraBereich.ts`.
//
//   · Ausgewählt wird in der Bildvorschau dieser Fläche: Bild wählen, dann ganz lassen oder mit
//     Maus/Finger ein Rechteck aufziehen. Eine native Bild- bzw. Bereichsauswahl in Word oder
//     PowerPoint ist nicht angebunden — das steht als Hostgrenze da.
//   · „Was steht hier?“ nutzt die vorhandene Lesung dieses Bildes (Automatik, gleiche Bildbytes);
//     fehlt sie (Automatik aus, noch nicht gelesen), wird GENAU DIESES Bild gelesen
//     (`BildAnalyse.lesungFuerBild`). Der erkannte Text der Auswahl steht immer da, ohne Modell.
//   · Die Erklärung läuft über den vorhandenen assist-Weg der Fläche (`ImageDescribeContext`,
//     dieselbe Provenienz und Vertraulichkeitsregel). Klara bekommt NUR die Auswahl — keinen
//     Dokumenttext, keine anderen Bilder; bei einem Bereich auch nicht die Bildbeschreibung.
//   · Nachfragen gehören zu genau einer Auswahl (Konto, Fläche/Lauf, Bild, Bereich). Wechselt sie,
//     verschwindet das Gespräch; eine verspätete Rückgabe einer überholten Anfrage wird verworfen.
//   · Gelesen wird nur: Bild, Datei und Befund bleiben unverändert.
import { Sparkles } from "lucide-react";
import { type PointerEvent, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { useImageDescribeWennVorhanden } from "../app/ImageDescribeContext";
import { useAssistenzStand } from "../lib/assistenzProfil";
import type {
  BildAnalyse,
  BildFundstelle,
  BildQuelleEingang,
  BildVorkommen,
  QuellenBefund,
} from "../lib/bildAutomatik";
import { leererBefund } from "../lib/bildAutomatik";
import {
  befundMitKorrektur,
  findeKorrektur,
  korrekturFingerabdruck,
  korrekturQuelleFuer,
  quellenMitKorrekturen,
} from "../lib/bildKorrektur";
import {
  korrekturStandBestaetigt,
  useBildKorrekturen,
  wiederholeBildKorrekturen,
} from "../lib/bildKorrekturenStand";
import {
  type BereichsErgebnis,
  type BildBereich,
  type Uebersetze,
  auswahlSchluessel,
  bereichAus,
  bereichsAnweisung,
  bereichsErgebnis,
  bereichsKontext,
  lesungInVorschau,
  lesungMitBerichtigung,
} from "../lib/klaraBereich";
import { bildStatusSchluessel, fundstelleBaustein } from "./BildBefundListe";

interface Eintrag {
  /** Die Nummer der Anfrage — eindeutig in dieser Fläche. */
  nr: number;
  frage: string;
  /** Die formulierte Erklärung — `null` ohne Modell, ohne Text oder bei Fehler. */
  antwort: string | null;
  fehler: string | null;
  /** Ohne lesbaren Text in der Auswahl wurde Klara gar nicht gefragt. */
  ohneText: boolean;
}

interface Gespraech {
  /** Die Auswahl, zu der Ergebnis und Fragen gehören (`auswahlSchluessel`). */
  schluessel: string;
  ergebnis: BereichsErgebnis;
  eintraege: Eintrag[];
}

/** Was gerade für welche Auswahl läuft: das Lesen des Bildes oder Klaras Antwort. */
interface Laeuft {
  schluessel: string;
  art: "lesen" | "antwort";
}

interface Auswahl {
  /** Fläche und Lauf, in dem gewählt wurde — ein neuer Lauf verwirft die Auswahl. */
  fuer: string;
  index: number;
  bereich: BildBereich | null;
}

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40";

/** Gehört der Befund zu diesem Bild (Quelle, Position, Anker)? */
function gleicheStelle(a: BildFundstelle, b: BildFundstelle): boolean {
  return (
    a.quelle === b.quelle &&
    a.bild === b.bild &&
    (a.imageId ?? "") === (b.imageId ?? "") &&
    a.folie === b.folie &&
    a.seite === b.seite
  );
}

export function KlaraBereichsfrage({
  analyse,
  kontextSchluessel,
  quellen: rohQuellen,
  aktuell,
  korrekturQuelle,
}: {
  /** Die Analyse der Fläche (`useBildAnalyse`) — dieselbe, die auch automatisch liest. */
  analyse: BildAnalyse;
  korrekturQuelle?: string | null | undefined;
  /** Die Quelle und ihr Lauf beim Aufrufer (wie bei `KlaraBildKontextFrage`). */
  kontextSchluessel: string;
  quellen: readonly QuellenBefund[];
  /** Der Eingang mit den Bildern der Quelle (Fundstelle und Bilddaten). */
  aktuell?: readonly BildQuelleEingang[] | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const weg = useImageDescribeWennVorhanden();
  const kontoId = useAssistenzStand().kontoId;
  const korrekturen = useBildKorrekturen(typeof korrekturQuelle === "string");
  const quellen = useMemo(
    () => quellenMitKorrekturen(rohQuellen, korrekturQuelle, korrekturen.korrekturen),
    [rohQuellen, korrekturQuelle, korrekturen.korrekturen],
  );
  const korrekturGesperrt =
    typeof korrekturQuelle === "string" && !korrekturStandBestaetigt(korrekturen);
  const feldId = useId();
  const [auswahlRoh, setAuswahl] = useState<Auswahl | null>(null);
  const [groesse, setGroesse] = useState<{ breite: number; hoehe: number } | null>(null);
  const [ziehen, setZiehen] = useState<BildBereich | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const bildRef = useRef<HTMLImageElement | null>(null);
  const [gespraechRoh, setGespraech] = useState<Gespraech | null>(null);
  const [laeuftRoh, setLaeuft] = useState<Laeuft | null>(null);
  const [nachfrage, setNachfrage] = useState("");
  const anfrageRef = useRef(0);
  const ue = useMemo<Uebersetze>(
    () => (schluessel, werte) => String(t(schluessel, werte ?? {})),
    [t],
  );

  const vorkommen = useMemo<BildVorkommen[]>(
    () => (aktuell ?? []).flatMap((e) => e.vorkommen),
    [aktuell],
  );
  const ortVon = (f: BildFundstelle): string => {
    const b = fundstelleBaustein(f, f.quelle);
    return `${f.quelle} · ${String(t(b.key, b.params))}`;
  };
  const vorkommenStand = useRef({ bilder: vorkommen, fassung: 0 });
  if (
    vorkommen.length !== vorkommenStand.current.bilder.length ||
    vorkommen.some((v, i) => {
      const alt = vorkommenStand.current.bilder[i];
      return !alt || !gleicheStelle(v.fundstelle, alt.fundstelle) || v.src !== alt.src;
    })
  ) {
    vorkommenStand.current = { bilder: vorkommen, fassung: vorkommenStand.current.fassung + 1 };
  }
  const auswahlKontext = `${kontextSchluessel}::${vorkommenStand.current.fassung}`;
  const auswahl =
    auswahlRoh && auswahlRoh.fuer === auswahlKontext && vorkommen[auswahlRoh.index]
      ? auswahlRoh
      : null;
  const gewaehlt = auswahl ? (vorkommen[auswahl.index] ?? null) : null;
  const schluessel =
    auswahl && gewaehlt
      ? auswahlSchluessel(
          kontoId,
          `${auswahlKontext}::${korrekturFingerabdruck(quellen)}::${JSON.stringify(korrekturen.korrekturen)}::${korrekturGesperrt}`,
          {
            fundstelle: gewaehlt.fundstelle,
            bereich: auswahl.bereich,
          },
        )
      : null;
  const schluesselRef = useRef(schluessel);
  schluesselRef.current = schluessel;
  const gespraech = gespraechRoh && gespraechRoh.schluessel === schluessel ? gespraechRoh : null;
  const gespraechRef = useRef(gespraech);
  gespraechRef.current = gespraech;
  const laeuft = laeuftRoh && laeuftRoh.schluessel === schluessel ? laeuftRoh.art : null;

  if (vorkommen.length === 0) {
    return null;
  }
  const modell = Boolean(weg?.frage) && weg?.frageVerfuegbar !== false;

  const waehle = (index: number): void => {
    setAuswahl({ fuer: auswahlKontext, index, bereich: null });
    setGroesse(null);
    setZiehen(null);
    setNachfrage("");
  };

  const ortDerAuswahl = (): string => {
    if (!gewaehlt || !auswahl) {
      return "";
    }
    const ort = ortVon(gewaehlt.fundstelle);
    return auswahl.bereich ? String(t("klarabereich.ort.bereich", { ort })) : ort;
  };

  const bildinhaltDerAuswahl = (): string | null => {
    if (!gewaehlt || !auswahl || auswahl.bereich) {
      return null;
    }
    for (const q of quellen) {
      const b = q.befunde.find((x) => gleicheStelle(x.fundstelle, gewaehlt.fundstelle));
      if (
        b &&
        !b.korrektur?.beschreibungNichtAngeglichen &&
        b.bildinhalt.status === "beschrieben"
      ) {
        return b.bildinhalt.text;
      }
    }
    return null;
  };

  const fuegeAn = (fuer: string, eintrag: Eintrag): void => {
    setGespraech((g) =>
      g && g.schluessel === fuer ? { ...g, eintraege: [...g.eintraege, eintrag] } : g,
    );
  };

  const frage = async (text: string): Promise<void> => {
    const f = text.trim();
    if (!auswahl || !gewaehlt || !schluessel || f.length === 0 || korrekturGesperrt) {
      return;
    }
    const fuer = schluessel;
    const bereich = auswahl.bereich;
    const ort = ortDerAuswahl();
    const bildinhalt = bildinhaltDerAuswahl();
    anfrageRef.current += 1;
    const anfrage = anfrageRef.current;
    const giltNoch = (): boolean =>
      anfrageRef.current === anfrage && schluesselRef.current === fuer;
    try {
      let ergebnis = gespraechRef.current?.ergebnis ?? null;
      const verlauf = (gespraechRef.current?.eintraege ?? []).flatMap((e) =>
        e.antwort ? [{ frage: e.frage, antwort: e.antwort }] : [],
      );
      if (!ergebnis) {
        // Erst lesen — die vorhandene Lesung dieses Bildes oder gezielt nur dieses Bild.
        setLaeuft({ schluessel: fuer, art: "lesen" });
        const lesung = await analyse.lesungFuerBild(gewaehlt);
        if (!giltNoch()) {
          return;
        }
        const befund = quellen
          .flatMap((q) => q.befunde)
          .find((b) => gleicheStelle(b.fundstelle, gewaehlt.fundstelle));
        const basis =
          befund?.inhaltskennung === lesung.inhaltskennung
            ? befund
            : leererBefund(gewaehlt.fundstelle, lesung.status, {
                inhaltskennung: lesung.inhaltskennung,
                text: lesung.text,
                textGekennzeichnet: lesung.textGekennzeichnet,
              });
        const berichtigt = korrekturQuelle
          ? befundMitKorrektur(
              basis,
              findeKorrektur(
                korrekturen.korrekturen,
                korrekturQuelleFuer(korrekturQuelle, gewaehlt.fundstelle),
                lesung.inhaltskennung,
              ),
            )
          : basis;
        const wirksam = lesungMitBerichtigung(lesung, berichtigt);
        ergebnis = bereichsErgebnis(bereich ? lesungInVorschau(wirksam) : wirksam, bereich);
        setGespraech({ schluessel: fuer, ergebnis, eintraege: [] });
      }
      const leer = { nr: anfrage, frage: f, antwort: null, fehler: null };
      if (ergebnis.status !== "gelesen") {
        fuegeAn(fuer, { ...leer, ohneText: true });
        return;
      }
      if (!modell || !weg?.frage) {
        fuegeAn(fuer, { ...leer, ohneText: false });
        return;
      }
      setLaeuft({ schluessel: fuer, art: "antwort" });
      try {
        const r = await weg.frage(
          bereichsKontext(ort, ergebnis, bildinhalt, verlauf, ue),
          bereichsAnweisung(f, ort, ue),
        );
        if (giltNoch()) {
          const antwort = r.demo ? null : r.text.trim() || null;
          fuegeAn(fuer, { ...leer, antwort, ohneText: false });
        }
      } catch (fehler) {
        if (giltNoch()) {
          const grund = fehler instanceof ApiError ? fehler.message : String(t("state.error"));
          fuegeAn(fuer, { ...leer, fehler: grund, ohneText: false });
        }
      }
    } finally {
      // Eine überholte Anfrage beendet weder den Ladezustand einer neueren noch den einer anderen
      // Auswahl.
      if (anfrageRef.current === anfrage) {
        setLaeuft(null);
      }
    }
  };

  // Zeigerposition → Pixel im Originalbild (die Wortrahmen der Engine haben denselben Maßstab).
  const punkt = (e: PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const bild = bildRef.current;
    if (!bild || !groesse) {
      return null;
    }
    const rahmen = bild.getBoundingClientRect();
    if (rahmen.width <= 0 || rahmen.height <= 0) {
      return null;
    }
    return {
      x: ((e.clientX - rahmen.left) / rahmen.width) * groesse.breite,
      y: ((e.clientY - rahmen.top) / rahmen.height) * groesse.hoehe,
    };
  };

  const zeigerAb = (e: PointerEvent<HTMLDivElement>): void => {
    const p = punkt(e);
    if (!p || laeuft) {
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ohne Zeigerfang zieht der Bereich trotzdem, solange der Zeiger über dem Bild bleibt.
    }
    startRef.current = p;
    setZiehen(null);
  };

  const zeigerZieht = (e: PointerEvent<HTMLDivElement>): void => {
    const start = startRef.current;
    const p = punkt(e);
    if (!start || !p || !groesse) {
      return;
    }
    setZiehen(bereichAus(start, p, groesse.breite, groesse.hoehe));
  };

  const zeigerAuf = (e: PointerEvent<HTMLDivElement>): void => {
    const start = startRef.current;
    startRef.current = null;
    const p = punkt(e);
    setZiehen(null);
    if (!start || !p || !groesse || !auswahl) {
      return;
    }
    const bereich = bereichAus(start, p, groesse.breite, groesse.hoehe);
    if (bereich) {
      setAuswahl({ ...auswahl, bereich });
      setNachfrage("");
    }
  };

  const rahmen = ziehen ?? auswahl?.bereich ?? null;
  const prozent = (v: number, max: number): string => `${(v / Math.max(1, max)) * 100}%`;

  return (
    <section
      data-testid="klara-bereich"
      className="mt-2 rounded-card border border-hairline px-3 py-2 text-[12px] leading-relaxed"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles size={13} className="text-ai" aria-hidden="true" />
        <span className="text-[12.5px] font-semibold text-ink">{t("klarabereich.titel")}</span>
      </div>
      <p className="mt-0.5 text-muted">{t("klarabereich.erklaerung")}</p>
      <p data-testid="klara-bereich-host" className="mt-0.5 text-muted-2">
        {t("klarabereich.host")}
      </p>
      {korrekturGesperrt ? (
        <output data-testid="klara-bereich-korrektur-wartet">
          {t(
            korrekturen.status === "fehler"
              ? "bildfundstelle.klara.ladeFehler"
              : "bildfundstelle.klara.wartet",
          )}
          {korrekturen.status === "fehler" ? (
            <button type="button" onClick={() => wiederholeBildKorrekturen()} className={KNOPF}>
              {t("bildfundstelle.korrektur.erneutLaden")}
            </button>
          ) : null}
        </output>
      ) : null}
      <ul className="mt-2 flex flex-wrap gap-2">
        {vorkommen.map((v, i) => {
          const ort = ortVon(v.fundstelle);
          return (
            <li key={`${v.fundstelle.quelle}-${v.fundstelle.bild}-${v.fundstelle.imageId ?? ""}`}>
              {v.src ? (
                <button
                  type="button"
                  data-testid="klara-bereich-bild"
                  data-bild={v.fundstelle.bild}
                  aria-pressed={auswahl?.index === i}
                  onClick={() => waehle(i)}
                  className={KNOPF}
                >
                  {t("klarabereich.bild.waehlen", { ort })}
                </button>
              ) : (
                <span className="text-muted">{t("klarabereich.bild.ohneVorschau", { ort })}</span>
              )}
            </li>
          );
        })}
      </ul>
      {auswahl && gewaehlt?.src ? (
        <div className="mt-2">
          <div
            data-testid="klara-bereich-vorschau"
            className="relative inline-block max-w-full cursor-crosshair select-none"
            style={{ touchAction: "none" }}
            onPointerDown={zeigerAb}
            onPointerMove={zeigerZieht}
            onPointerUp={zeigerAuf}
            onPointerCancel={() => {
              startRef.current = null;
              setZiehen(null);
            }}
          >
            <img
              ref={bildRef}
              src={gewaehlt.src}
              alt={t("klarabereich.vorschau.label", { ort: ortVon(gewaehlt.fundstelle) })}
              draggable={false}
              onLoad={(e) =>
                setGroesse({
                  breite: e.currentTarget.naturalWidth,
                  hoehe: e.currentTarget.naturalHeight,
                })
              }
              className="block max-h-72 max-w-full rounded-btn border border-hairline"
            />
            {rahmen && groesse ? (
              <div
                data-testid="klara-bereich-rahmen"
                className="pointer-events-none absolute border-2 border-dashed border-ai bg-ai/10"
                style={{
                  left: prozent(rahmen.x0, groesse.breite),
                  top: prozent(rahmen.y0, groesse.hoehe),
                  width: prozent(rahmen.x1 - rahmen.x0, groesse.breite),
                  height: prozent(rahmen.y1 - rahmen.y0, groesse.hoehe),
                }}
              />
            ) : null}
          </div>
          {groesse ? null : <p className="text-muted">{t("klarabereich.vorschau.laedt")}</p>}
          <p data-testid="klara-bereich-auswahl" className="mt-1 font-semibold text-text">
            {auswahl.bereich
              ? t("klarabereich.auswahl.bereich", {
                  ort: ortVon(gewaehlt.fundstelle),
                  ...auswahl.bereich,
                })
              : t("klarabereich.auswahl.ganz", { ort: ortVon(gewaehlt.fundstelle) })}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="klara-bereich-was-steht-hier"
              disabled={laeuft !== null || korrekturGesperrt}
              onClick={() => void frage(String(t("klarabereich.knopf.wasStehtHier")))}
              className={KNOPF}
            >
              {t("klarabereich.knopf.wasStehtHier")}
            </button>
            <button
              type="button"
              data-testid="klara-bereich-ganz"
              disabled={laeuft !== null || auswahl.bereich === null}
              onClick={() => setAuswahl({ ...auswahl, bereich: null })}
              className={KNOPF}
            >
              {t("klarabereich.knopf.ganz")}
            </button>
            <button
              type="button"
              data-testid="klara-bereich-aufheben"
              onClick={() => setAuswahl(null)}
              className={KNOPF}
            >
              {t("klarabereich.knopf.aufheben")}
            </button>
          </div>
        </div>
      ) : null}
      {laeuft ? (
        <output data-testid="klara-bereich-laeuft" className="mt-2 block text-muted">
          {laeuft === "lesen" ? t("klarabereich.laeuft.lesen") : t("klarabereich.laeuft.antwort")}
        </output>
      ) : null}
      {gespraech ? (
        <div
          data-testid="klara-bereich-ergebnis"
          data-status={gespraech.ergebnis.status}
          className="mt-2 rounded-btn border border-ai/30 bg-surface p-2.5"
        >
          <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
            {t("klarabereich.text.titel")}
          </div>
          {gespraech.ergebnis.status === "gelesen" ? (
            <pre
              data-testid="klara-bereich-text"
              className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[13px] text-text"
            >
              {gespraech.ergebnis.text}
            </pre>
          ) : (
            <p data-testid="klara-bereich-status" className="mt-0.5 text-trust-warn-text">
              {gespraech.ergebnis.status === "leer"
                ? t("klarabereich.status.leer")
                : gespraech.ergebnis.status === "unleserlich"
                  ? t("klarabereich.status.unleserlich")
                  : gespraech.ergebnis.status === "ohne-positionen"
                    ? t("klarabereich.status.ohnePositionen")
                    : t("klarabereich.status.nichtGelesen", {
                        status: String(t(bildStatusSchluessel(gespraech.ergebnis.lesung))),
                      })}
            </p>
          )}
          {gespraech.ergebnis.unsicher > 0 ? (
            <p className="text-trust-warn-text">
              {t("klarabereich.unsicher", { n: gespraech.ergebnis.unsicher })}
            </p>
          ) : null}
          <p data-testid="klara-bereich-herkunft" className="text-muted-2">
            {gespraech.ergebnis.wiederverwendet
              ? t("klarabereich.herkunft.wiederverwendet")
              : t("klarabereich.herkunft.gelesen")}
          </p>
          <ol className="mt-2 space-y-2">
            {gespraech.eintraege.map((e) => (
              <li key={e.nr} data-testid="klara-bereich-eintrag">
                <div className="font-semibold text-text">{e.frage}</div>
                {e.antwort ? (
                  <div>
                    <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
                      {t("klarabereich.antwort.titel")}
                    </div>
                    <p
                      data-testid="klara-bereich-antwort"
                      className="whitespace-pre-wrap text-[13px] text-text"
                    >
                      {e.antwort}
                    </p>
                  </div>
                ) : e.fehler ? (
                  <p role="alert" className="text-trust-crit-text">
                    {t("klarabereich.antwort.fehler", { grund: e.fehler })}
                  </p>
                ) : e.ohneText ? (
                  <p data-testid="klara-bereich-ohne-text" className="text-muted">
                    {t("klarabereich.antwort.keinText")}
                  </p>
                ) : (
                  <p data-testid="klara-bereich-ohne-modell" className="text-muted">
                    {t("klarabereich.antwort.ohneModell")}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor={feldId} className="sr-only">
              {t("klarabereich.nachfrage.label")}
            </label>
            <input
              id={feldId}
              data-testid="klara-bereich-nachfrage"
              value={nachfrage}
              onChange={(e) => setNachfrage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && laeuft === null) {
                  e.preventDefault();
                  void frage(nachfrage);
                  setNachfrage("");
                }
              }}
              placeholder={t("klarabereich.nachfrage.platzhalter")}
              className="h-9 min-w-0 flex-1 rounded-input border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-ink/30"
            />
            <button
              type="button"
              data-testid="klara-bereich-nachfragen"
              disabled={laeuft !== null || korrekturGesperrt || nachfrage.trim().length === 0}
              onClick={() => {
                void frage(nachfrage);
                setNachfrage("");
              }}
              className={KNOPF}
            >
              {t("klarabereich.knopf.nachfragen")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
