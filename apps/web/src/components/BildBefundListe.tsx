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
//
// produkt:20261012:klara-ocr-tabellen (OCR-E03, Nacharbeit 6 — auf die gelieferte E01/E02-Fassung
// integriert): die bearbeitbare Tabelle zeigt die wirksame Berichtigung des Bildes
// (`tabelleMitBerichtigung`), speichert Änderungen über DENSELBEN Berichtigungsweg (Quelle und
// Bildfassung, `berichtigungsText`) und öffnet je Zelle ihre Stelle im Original.
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
  type TabellenZelle,
} from "../lib/bildAutomatik";
import { type MarkierungsGrundlage, markierung } from "../lib/bildFundstelle";
import {
  berichtigbar,
  korrekturQuelleFuer,
  ortKennung,
  quellenMitKorrekturen,
} from "../lib/bildKorrektur";
import {
  type BildKorrekturStand,
  aendereBildKorrektur,
  useBildKorrekturen,
  wiederholeBildKorrekturen,
} from "../lib/bildKorrekturenStand";
import { berichtigungsText, tabelleMitBerichtigung } from "../lib/bildTabelle";
import { MAX_PDF_PAGES } from "../lib/pdf";
import { BildFundstelleAnsicht, type FundstellenZiel } from "./BildFundstelleAnsicht";
import { BildTabelleBearbeiten, type NurAnsichtGrund } from "./BildTabelleBearbeiten";
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

/**
 * OCR-E03: warum Tabellenänderungen eines Bildes nicht dauerhaft gespeichert werden können —
 * `null`, wenn sie es können. Dieselben Bedingungen wie für „Text berichtigen“ (OCR-E02).
 */
function nurAnsichtGrund(
  korrekturQuelle: string | null | undefined,
  b: BildBefund,
  stand: BildKorrekturStand,
): NurAnsichtGrund | null {
  if (korrekturQuelle === undefined) {
    return "nicht-angebunden";
  }
  if (korrekturQuelle === null || !berichtigbar(b)) {
    return "ohne-quelle";
  }
  if (stand.status === "fehler") {
    return "fehler";
  }
  if (stand.status !== "bereit") {
    return "laedt";
  }
  return stand.darfBearbeiten ? null : "kein-recht";
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
  // OCR-E03: die Stelle einer Tabellenzelle im Original — über ihre Wörter, sonst über den Bereich,
  // in dem sie im Bild steht (unleserlich, ungeprüft, leer). Gemessen wird im selben Rahmen.
  const zeigeZelle = (
    b: BildBefund,
    index: number,
    zelle: TabellenZelle | undefined,
    text: string,
  ): void => {
    if (!zelle) {
      return;
    }
    const woerter = b.woerter ?? [];
    const eigene = zelle.woerter ?? [];
    const bereich = eigene.length > 0 ? undefined : (zelle.rahmen ?? zelle.bereich);
    const grundlage: MarkierungsGrundlage = bereich
      ? { woerter: [...woerter, { text, ...bereich }], rahmen: b.rahmen }
      : b;
    const indizes: (number | null)[] = bereich ? [woerter.length] : eigene;
    const roh = zelle.berichtigt?.roh ?? null;
    const original = rohBefund.befunde[index] ?? b;
    setZiel({
      schluessel: `${lauf ?? ""}|${index}|${b.inhaltskennung ?? ""}|zelle:${indizes.join(",")}|${text}`,
      src: originalVon ? originalVon(original, index) : null,
      quelle: befund.quelle,
      ort: ortText(b),
      wort: text,
      roh: roh !== null && roh !== text ? roh : null,
      markierung: markierung(grundlage, indizes.length > 0 ? indizes : [null]),
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
          // OCR-E03: die Tabelle mit der wirksamen Berichtigung dieses Bildes (OCR-E02).
          const abgleich =
            b.bildTabelle && b.korrektur
              ? tabelleMitBerichtigung(b.bildTabelle, b.text, b.woerter)
              : null;
          const tabelle = abgleich?.tabelle ?? b.bildTabelle ?? null;
          const grund = nurAnsichtGrund(korrekturQuelle, b, korrekturen);
          const kennung = b.inhaltskennung;
          const quelleVoll =
            typeof korrekturQuelle === "string"
              ? korrekturQuelleFuer(korrekturQuelle, b.fundstelle)
              : null;
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
              {/* OCR-E03: dieselbe Tabelle als bearbeitbares Raster mit leeren Zellen, Kopfzeile und
                  Kopierweg — mit der wirksamen Berichtigung und gespeichert über denselben Weg. */}
              {tabelle ? (
                <BildTabelleBearbeiten
                  tabelle={tabelle}
                  fundstelle={b.fundstelle}
                  inhaltskennung={kennung}
                  nichtZugeordnet={abgleich?.nichtZugeordnet}
                  speichern={
                    grund === null && quelleVoll !== null && kennung !== null
                      ? (werte) =>
                          aendereBildKorrektur({
                            aktion: "setzen",
                            quelle: quelleVoll,
                            inhaltskennung: kennung,
                            ort: ortKennung(b.fundstelle),
                            text: berichtigungsText(
                              b.textGekennzeichnet,
                              b.woerter,
                              tabelle,
                              werte,
                            ),
                          })
                      : undefined
                  }
                  nurAnsicht={grund}
                  zeigeStelle={(z, s, wert) => zeigeZelle(b, index, tabelle.zeilen[z]?.[s], wert)}
                />
              ) : null}
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
