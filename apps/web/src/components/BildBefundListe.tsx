// OCR-02 · Der Befund des automatischen Bildlesens einer Quelle — sichtbar, mit Fundstelle je Bild
// und ehrlichem Gesamtstatus. Laufende, teilweise und fehlgeschlagene Analysen erscheinen nie als
// „vollständig gelesen" (Logik in `lib/bildAutomatik.ts`, `quellenStatus`). Je Bild stehen Text,
// erkannte Tabelle und Bildinhalt (W02) — oder der konkrete Grund, warum etwas fehlt.
//
// produkt:20261012:klara-ocr-fundstellen-korrekturen:
//   · OCR-E01 — jedes Wort des Bildtexts öffnet sein Original (`originalVon`) mit markierter Stelle
//     (`BildFundstelleAnsicht`), per Maus und Tastatur; ohne verlässliche Position das ganze Bild.
//   · OCR-E02 — mit `korrekturQuelle` lässt sich der Text berichtigen, rückgängig machen und auf den
//     Rohbefund zurücksetzen (`BildTextBerichtigung`); angezeigt wird die wirksame Fassung, der
//     Rohbefund steht daneben. `null` heißt: diese Fläche hat (noch) keine Quelle, an die eine
//     Berichtigung gebunden werden könnte — das steht dann da. `onBerichtigt` meldet jede Änderung
//     des wirksamen Textes eines Bildes (z. B. damit der Dateiimport seinen Text nachführt).
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BILD_HOECHSTZAHL_JE_QUELLE,
  type BildBefund,
  type BildBefundStatus,
  type BildFundstelle,
  type BildinhaltStatus,
  type QuellenBefund,
  type QuellenHinweis,
  type QuellenStatus,
} from "../lib/bildAutomatik";
import { markierung } from "../lib/bildFundstelle";
import { berichtigbar, korrekturQuelleFuer, quellenMitKorrekturen } from "../lib/bildKorrektur";
import { useBildKorrekturen, wiederholeBildKorrekturen } from "../lib/bildKorrekturenStand";
import { MAX_PDF_PAGES } from "../lib/pdf";
import { BildFundstelleAnsicht, type FundstellenZiel } from "./BildFundstelleAnsicht";
import { BildTextBerichtigung } from "./BildTextBerichtigung";
import { BildTextStellen } from "./BildTextStellen";

const STATUS_SCHLUESSEL: Record<BildBefundStatus, string> = {
  wartet: "bildautomatik.status.wartet",
  laeuft: "bildautomatik.status.laeuft",
  gelesen: "bildautomatik.status.gelesen",
  "kein-text": "bildautomatik.status.keinText",
  fehlgeschlagen: "bildautomatik.status.fehlgeschlagen",
  "nicht-verfuegbar": "bildautomatik.status.nichtVerfuegbar",
  "kein-zugriff": "bildautomatik.status.keinZugriff",
  zeitueberschreitung: "bildautomatik.status.zeitueberschreitung",
  "nicht-analysiert": "bildautomatik.status.nichtAnalysiert",
};

const QUELLEN_SCHLUESSEL: Record<Exclude<QuellenStatus, "ohne-bilder">, string> = {
  laeuft: "bildautomatik.quelle.laeuft",
  vollstaendig: "bildautomatik.quelle.vollstaendig",
  teilweise: "bildautomatik.quelle.teilweise",
  fehlgeschlagen: "bildautomatik.quelle.fehlgeschlagen",
  "nicht-verfuegbar": "bildautomatik.quelle.nichtVerfuegbar",
  aus: "bildautomatik.quelle.aus",
};

const HINWEIS_SCHLUESSEL: Record<QuellenHinweis, string> = {
  "pptx-layout-nicht-erfasst": "bildautomatik.hinweis.pptxLayout",
  "grenze-erreicht": "bildautomatik.hinweis.grenze",
  ladefrist: "bildautomatik.hinweis.ladefrist",
  // OCR-03: das Profil des Kontos war nicht lesbar — nicht automatisch gelesen.
  "einstellung-unbekannt": "klarabildkontext.hinweis.einstellungUnbekannt",
  // OCR-E04: PDF über der Seitengrenze — die übrigen Seiten fehlen.
  "pdf-seiten-fehlen": "pdfscan.hinweis.seitenFehlen",
};

/** Warum der Bildinhalt fehlt — je Zustand ein eigener Satz. */
const BILDINHALT_FEHLT: Record<Exclude<BildinhaltStatus, "beschrieben">, string> = {
  "nicht-zulaessig": "bildautomatik.bildinhalt.nichtZulaessig",
  "nicht-verfuegbar": "bildautomatik.bildinhalt.nichtVerfuegbar",
  fehlgeschlagen: "bildautomatik.bildinhalt.fehlgeschlagen",
  "nicht-angebunden": "bildautomatik.bildinhalt.nichtAngebunden",
  "nicht-analysiert": "bildautomatik.bildinhalt.nichtAnalysiert",
};

export function bildStatusSchluessel(status: BildBefundStatus): string {
  return STATUS_SCHLUESSEL[status];
}

/** Schlüssel und Werte der sichtbaren Fundstelle („Folie 2, Bild 1", bei Bildanhängen der Name). */
export function fundstelleBaustein(
  f: BildFundstelle,
  quelle?: string,
): {
  key: string;
  params: Record<string, number | string>;
} {
  // OCR-E04: eine PDF-Seite — Textebene („Seite 2“) bzw. die gelesene Seite („Seite 2, erkannt“).
  if (f.seite !== undefined) {
    return {
      key: f.seitenteil === "bild" ? "pdfscan.fundstelle.seiteErkannt" : "pdfscan.fundstelle.seite",
      params: { seite: f.seite },
    };
  }
  if (f.folie !== undefined && f.folienansicht) {
    return { key: "bildautomatik.fundstelle.folienansicht", params: { folie: f.folie } };
  }
  if (f.folie !== undefined) {
    return {
      key: "bildautomatik.fundstelle.folie",
      params: { folie: f.folie, bild: f.bildAufFolie ?? 1 },
    };
  }
  if (f.art === "bild" && quelle !== undefined && f.quelle !== quelle) {
    return { key: "bildautomatik.fundstelle.datei", params: { name: f.quelle } };
  }
  return { key: "bildautomatik.fundstelle.bild", params: { bild: f.bild } };
}

interface Zelle {
  nr: string;
  text: string;
}

interface TabellenZeile {
  nr: string;
  zellen: Zelle[];
}

/** Zeilen und Zellen einer erkannten Tabelle mit ihrer Position als Kennung (sie haben keine andere). */
function nummeriert(tabelle: string[][]): TabellenZeile[] {
  const zeilen: TabellenZeile[] = [];
  for (let z = 0; z < tabelle.length; z += 1) {
    const zellen: Zelle[] = [];
    for (let s = 0; s < (tabelle[z]?.length ?? 0); s += 1) {
      zellen.push({ nr: `s${s}`, text: tabelle[z]?.[s] ?? "" });
    }
    zeilen.push({ nr: `z${z}`, zellen });
  }
  return zeilen;
}

function istFertig(b: BildBefund): boolean {
  return b.status === "gelesen" || b.status === "kein-text";
}

/** Abgeschlossen, aber ohne beschriebenen Bildinhalt. */
function ohneBildinhalt(b: BildBefund): boolean {
  const laeuft = b.status === "laeuft" || b.status === "wartet";
  return !laeuft && b.bildinhalt.status !== "beschrieben";
}

function BefundTabelle({ tabelle }: { tabelle: string[][] }): JSX.Element {
  const { t } = useTranslation();
  return (
    <table data-testid="bild-befund-tabelle" className="mt-1 border-collapse">
      <caption className="text-left text-muted">{t("bildautomatik.tabelle")}</caption>
      <tbody>
        {nummeriert(tabelle).map((zeile) => (
          <tr key={zeile.nr}>
            {zeile.zellen.map((zelle) => (
              <td key={zelle.nr} className="border border-hairline px-1.5 py-0.5">
                {zelle.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Das Originalbild eines Befunds: data-URL bzw. die berechtigte Adresse, sonst `null`. */
export type OriginalVon = (befund: BildBefund, index: number) => string | null;

/** Meldet die Änderung des wirksamen Textes eines Bildes (Berichtigung gesetzt, rückgängig, zurück). */
export type BerichtigtMelder = (neu: string, bisher: string, befund: BildBefund) => void;

/** `lauf` zählt die Eingänge dieser Fläche — ein neuer Eingang derselben Datei ist ein neuer Lauf. */
export function BildBefundListe({
  befund: rohBefund,
  lauf,
  originalVon,
  korrekturQuelle,
  onBerichtigt,
}: {
  befund: QuellenBefund;
  lauf?: number | undefined;
  originalVon?: OriginalVon | undefined;
  korrekturQuelle?: string | null | undefined;
  onBerichtigt?: BerichtigtMelder | undefined;
}) {
  const { t } = useTranslation();
  const korrekturen = useBildKorrekturen(typeof korrekturQuelle === "string");
  const befund = useMemo(
    () => quellenMitKorrekturen([rohBefund], korrekturQuelle, korrekturen.korrekturen)[0],
    [rohBefund, korrekturQuelle, korrekturen.korrekturen],
  );
  const [ziel, setZiel] = useState<FundstellenZiel | null>(null);
  const melderRef = useRef(onBerichtigt);
  melderRef.current = onBerichtigt;
  const bisherRef = useRef(new Map<string, string>());
  // OCR-E02: jede Änderung des wirksamen Textes eines Bildes melden (nicht das erste Erscheinen).
  useEffect(() => {
    for (const b of befund?.befunde ?? []) {
      if (!berichtigbar(b)) {
        continue;
      }
      const schluessel = `${lauf ?? ""}|${b.fundstelle.bild}|${b.inhaltskennung}`;
      const vorher = bisherRef.current.get(schluessel);
      bisherRef.current.set(schluessel, b.textGekennzeichnet);
      if (vorher !== undefined && vorher !== b.textGekennzeichnet) {
        melderRef.current?.(b.textGekennzeichnet, vorher, b);
      }
    }
  }, [befund, lauf]);
  if (!befund || befund.status === "ohne-bilder") {
    return null;
  }
  const ortText = (b: BildBefund): string => {
    const ort = fundstelleBaustein(b.fundstelle, befund.quelle);
    return String(t(ort.key, ort.params));
  };
  const zeige = (b: BildBefund, index: number, wort: number | null, text: string): void => {
    const roh = b.korrektur && wort !== null ? (b.woerter?.[wort]?.text ?? null) : null;
    const original = rohBefund.befunde[index] ?? b;
    setZiel({
      schluessel: `${lauf ?? ""}|${index}|${b.inhaltskennung ?? ""}|${wort ?? "-"}|${text}`,
      src: originalVon ? originalVon(original, index) : null,
      quelle: befund.quelle,
      ort: ortText(b),
      wort: text,
      roh: roh !== null && roh !== text ? roh : null,
      markierung: markierung(b, [wort]),
    });
  };
  const mitText = befund.befunde.some((b) => b.textGekennzeichnet.length > 0);
  const einBerichtigbares = befund.befunde.some(berichtigbar);
  const fertig = befund.befunde.filter(istFertig).length;
  const verloren = befund.nichtGelesen.reduce((n, x) => n + x.anzahl, 0);
  const gesamt = befund.befunde.length + verloren;
  const ohneInhalt = befund.befunde.filter(ohneBildinhalt).length;
  return (
    <section
      data-testid="bild-befunde"
      data-status={befund.status}
      data-lauf={lauf}
      className="rounded-card border border-hairline px-3 py-2 text-[12px] leading-relaxed"
    >
      <div className="font-mono text-klein uppercase tracking-wider text-muted-2">
        {t("bildautomatik.titel")}
      </div>
      {/* `<output>` trägt implizit `role="status"` (biome useSemanticElements, Hausmuster wie in
          `CaptureFileImport.tsx`); `block`, weil `<output>` sonst inline steht. */}
      <output aria-live="polite" className="mt-1 block font-semibold text-text">
        {befund.status === "laeuft" && gesamt === 0
          ? t("bildautomatik.quelle.laedt", { name: befund.quelle })
          : t(QUELLEN_SCHLUESSEL[befund.status], { name: befund.quelle, fertig, gesamt })}
      </output>
      {befund.nichtGelesen.length > 0 || befund.hinweise.length > 0 || ohneInhalt > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-muted">
          {befund.nichtGelesen.map((x) => (
            <li key={`verloren-${x.folie ?? "ohne"}`} data-testid="bild-befund-verloren">
              {x.folie !== undefined
                ? t("bildautomatik.hinweis.nichtGelesenFolie", {
                    folie: x.folie,
                    anzahl: x.anzahl,
                  })
                : t("bildautomatik.hinweis.nichtGelesen", { anzahl: x.anzahl })}
            </li>
          ))}
          {befund.hinweise.map((h) => (
            <li key={h} data-testid="bild-befund-hinweis" data-hinweis={h}>
              {t(HINWEIS_SCHLUESSEL[h], {
                max: BILD_HOECHSTZAHL_JE_QUELLE,
                seiten: MAX_PDF_PAGES,
                fehlend: befund.fehlendeSeiten ?? 0,
              })}
            </li>
          ))}
          {ohneInhalt > 0 ? (
            <li data-testid="bild-befund-hinweis">
              {t("bildautomatik.hinweis.bildinhaltFehlt", { anzahl: ohneInhalt })}
            </li>
          ) : null}
        </ul>
      ) : null}
      {mitText ? <p className="mt-1 text-muted-2">{t("bildfundstelle.text.hinweis")}</p> : null}
      {korrekturQuelle === null && einBerichtigbares ? (
        <p data-testid="bild-berichtigung-ohne-quelle" className="mt-1 text-muted">
          {t("bildfundstelle.korrektur.ohneQuelle")}
        </p>
      ) : null}
      {typeof korrekturQuelle === "string" && einBerichtigbares ? (
        korrekturen.status === "laedt" ? (
          <p data-testid="bild-berichtigung-stand" className="mt-1 text-muted">
            {t("bildfundstelle.korrektur.laedt")}
          </p>
        ) : korrekturen.status === "fehler" ? (
          <p data-testid="bild-berichtigung-stand" className="mt-1 text-trust-warn-text">
            {t("bildfundstelle.korrektur.ladeFehler")}{" "}
            <button
              type="button"
              data-testid="bild-berichtigung-erneut"
              onClick={() => wiederholeBildKorrekturen()}
              className="font-semibold underline"
            >
              {t("bildfundstelle.korrektur.erneutLaden")}
            </button>
          </p>
        ) : korrekturen.status === "bereit" && !korrekturen.darfBearbeiten ? (
          <p data-testid="bild-berichtigung-kein-recht" className="mt-1 text-muted">
            {t("bildfundstelle.korrektur.keinRecht")}
          </p>
        ) : null
      ) : null}
      <ol className="mt-2 space-y-1.5">
        {befund.befunde.map((b, index) => {
          const ort = fundstelleBaustein(b.fundstelle, befund.quelle);
          return (
            <li
              key={`${b.fundstelle.bild}-${b.fundstelle.imageId ?? ""}-${b.fundstelle.quelle}`}
              data-testid="bild-befund"
              data-status={b.status}
              data-folie={b.fundstelle.folie ?? ""}
              data-bildinhalt={b.bildinhalt.status}
            >
              <span className="font-semibold text-text">{t(ort.key, ort.params)}</span>
              {" · "}
              <span className="text-muted">{t(STATUS_SCHLUESSEL[b.status])}</span>
              {b.grund === "automatik-aus" ? (
                <span data-testid="bild-befund-automatik-aus" className="text-muted-2">
                  {" · "}
                  {t("klarabildkontext.grund.automatikAus")}
                </span>
              ) : null}
              {b.wiederverwendet ? (
                <span className="text-muted-2"> · {t("bildautomatik.wiederverwendet")}</span>
              ) : null}
              {b.textGekennzeichnet ? (
                <BildTextStellen
                  text={b.textGekennzeichnet}
                  woerter={b.woerter}
                  onWaehle={(stelle) => zeige(b, index, stelle.wort, stelle.text)}
                />
              ) : null}
              {b.unsicher.length > 0 ? (
                <p className="text-trust-warn-text">
                  {t("bildautomatik.unsicher", { n: b.unsicher.length })}
                </p>
              ) : null}
              {b.tabelle ? <BefundTabelle tabelle={b.tabelle} /> : null}
              {typeof korrekturQuelle === "string" ? (
                <BildTextBerichtigung
                  befund={b}
                  quelle={korrekturQuelleFuer(korrekturQuelle, b.fundstelle)}
                  stand={korrekturen}
                  ort={ortText(b)}
                />
              ) : null}
              {b.bildinhalt.status === "beschrieben" ? (
                <p data-testid="bild-befund-inhalt" className="mt-0.5 text-text">
                  <span className="font-semibold">{t("bildautomatik.bildinhalt.titel")}</span>{" "}
                  {b.bildinhalt.text}
                  {b.korrektur?.beschreibungNichtAngeglichen ? (
                    <span
                      data-testid="bild-befund-inhalt-vor-berichtigung"
                      className="block text-trust-warn-text"
                    >
                      {t("bildfundstelle.korrektur.beschreibungVorBerichtigung")}
                    </span>
                  ) : null}
                </p>
              ) : b.status !== "laeuft" && b.status !== "wartet" ? (
                <p data-testid="bild-befund-inhalt-fehlt" className="mt-0.5 text-muted">
                  {t(BILDINHALT_FEHLT[b.bildinhalt.status])}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {ziel ? (
        <BildFundstelleAnsicht key={ziel.schluessel} ziel={ziel} onClose={() => setZiel(null)} />
      ) : null}
    </section>
  );
}
