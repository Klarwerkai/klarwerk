// OCR-E03 · Eine bildhafte Tabelle als bearbeitbare Tabelle (Auftrag produkt:20261012:klara-ocr-tabellen).
//
//   · Zeilen und Spalten wie erkannt, leere Zellen leer, die Kopfzeile als Kopf (`<th>`).
//   · Jede Zelle ist ein Eingabefeld. Unsichere, unleserliche, leere und mehrdeutig zugeordnete
//     Zellen tragen ein sichtbares Wort (nicht nur eine Farbe) und `data-zustand`.
//   · Änderungen gehören zu genau diesem Bild (Inhaltskennung): ein anderes Bild beginnt ohne sie.
//     Befund und Originalbild bleiben unverändert; jede Zelle lässt sich zurücksetzen.
//   · „Tabelle kopieren“ legt die aktuelle Tabelle über die vorhandene Zwischenablage ab — als
//     HTML-Tabelle mit Herkunft (`<caption>`) und als tabulatorgetrennter Text (`lib/bildTabelle.ts`).
//   · Nacharbeit 6 (Elternlieferung OCR-E01/E02 integriert): mit `speichern` werden die Änderungen
//     als Berichtigung dieses Bildes gespeichert (OCR-E02: Quelle und Bildfassung, Rückgängig und
//     Zurücksetzen am Bildtext); berichtigte Zellen sind gekennzeichnet, mit dem Erkannten daneben.
//     Ohne `speichern` sagt `dauerhaft`, warum Änderungen nur in dieser Ansicht gelten. Mit
//     `zeigeStelle` öffnet jede Zelle ihre Stelle im Original (OCR-E01).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BildFundstelle, BildTabelle } from "../lib/bildAutomatik";
import type { KorrekturErgebnis } from "../lib/bildKorrekturenStand";
import {
  type KopierErgebnis,
  type TabellenStand,
  aendereZelle,
  aktuelleZellen,
  fundstellenText,
  kopiereTabelle,
  setzeZelleZurueck,
  standFuer,
  tabelleAlsHtml,
  tabelleAlsTsv,
} from "../lib/bildTabelle";

const KOPIERT: Record<KopierErgebnis, string> = {
  tabelle: "bildtabelle.kopiert.tabelle",
  "nur-text": "bildtabelle.kopiert.nurText",
  "nicht-verfuegbar": "bildtabelle.kopiert.nichtVerfuegbar",
  fehlgeschlagen: "bildtabelle.kopiert.fehlgeschlagen",
};

const ZUSTAND_TEXT: Record<"unsicher" | "unleserlich" | "ungeprueft" | "leer", string> = {
  unsicher: "bildtabelle.zelle.unsicher",
  unleserlich: "bildtabelle.zelle.unleserlich",
  ungeprueft: "bildtabelle.zelle.ungeprueft",
  leer: "bildtabelle.zelle.leer",
};

/** Warum Änderungen nicht dauerhaft gespeichert werden können. */
export type NurAnsichtGrund =
  | "nicht-angebunden"
  | "ohne-quelle"
  | "kein-recht"
  | "laedt"
  | "fehler";

const NUR_ANSICHT: Record<NurAnsichtGrund, string> = {
  "nicht-angebunden": "bildtabelle.nurAnsicht.nichtAngebunden",
  "ohne-quelle": "bildtabelle.nurAnsicht.ohneQuelle",
  "kein-recht": "bildtabelle.nurAnsicht.keinRecht",
  laedt: "bildtabelle.nurAnsicht.laedt",
  fehler: "bildtabelle.nurAnsicht.fehler",
};

// Je Art ein eigenes Glied: so engt `art` die Meldung eindeutig ein (nur „fehler“ trägt `grund`).
type SpeicherMeldung =
  | { art: "gespeichert" }
  | { art: "verweigert" }
  | { art: "fehler"; grund: string };

const KNOPF =
  "rounded-btn border border-hairline bg-surface px-2 py-0.5 font-semibold text-text hover:bg-hairline-soft disabled:opacity-40";

export function BildTabelleBearbeiten({
  tabelle,
  fundstelle,
  inhaltskennung,
  nichtZugeordnet = [],
  speichern,
  nurAnsicht,
  zeigeStelle,
}: {
  tabelle: BildTabelle;
  fundstelle: BildFundstelle;
  inhaltskennung: string | null;
  /** Teile einer gespeicherten Berichtigung ohne eindeutige Tabellenzelle. */
  nichtZugeordnet?: readonly string[] | undefined;
  /** Speichert die Tabelle als Berichtigung dieses Bildes (OCR-E02). */
  speichern?: ((werte: string[][]) => Promise<KorrekturErgebnis>) | undefined;
  /** Ohne `speichern`: warum Änderungen nur in dieser Ansicht gelten. */
  nurAnsicht?: NurAnsichtGrund | null | undefined;
  /** Öffnet die Stelle einer Zelle im Original (OCR-E01). */
  zeigeStelle?: ((zeile: number, spalte: number, wert: string) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [gemerkt, setGemerkt] = useState<TabellenStand | null>(null);
  const [kopiert, setKopiert] = useState<KopierErgebnis | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<SpeicherMeldung | null>(null);
  // Nur die Änderungen DIESES Bildes gelten; wechselt das Bild, beginnt der Stand leer.
  const stand = standFuer(gemerkt, inhaltskennung);
  const zellen = aktuelleZellen(tabelle, stand);
  const unsicher = tabelle.zeilen
    .flat()
    .filter((z) => z.zustand !== "sicher" && z.zustand !== "leer").length;
  const mehrdeutig = tabelle.zeilen.flat().filter((z) => z.mehrdeutig).length;
  const berichtigt = tabelle.zeilen.flat().some((z) => z.berichtigt !== undefined);
  const geaendert = Object.keys(stand.aenderungen).length;
  const werte = (): string[][] => zellen.map((zeile) => zeile.map((z) => z.wert));

  const aendern = (zeile: number, spalte: number, wert: string): void => {
    setGemerkt(aendereZelle(tabelle, stand, zeile, spalte, wert));
    setKopiert(null);
    setMeldung(null);
  };
  const zuruecksetzen = (zeile: number, spalte: number): void => {
    setGemerkt(setzeZelleZurueck(stand, zeile, spalte));
    setKopiert(null);
    setMeldung(null);
  };
  const kopieren = async (): Promise<void> => {
    const ort = fundstellenText(fundstelle);
    const beschriftung =
      ort.folie !== undefined
        ? t("bildtabelle.beschriftungFolie", { ...ort, interpolation: { escapeValue: false } })
        : t("bildtabelle.beschriftung", { ...ort, interpolation: { escapeValue: false } });
    const ablage = typeof navigator === "undefined" ? null : (navigator.clipboard ?? null);
    const Eintrag = (globalThis as { ClipboardItem?: new (d: Record<string, Blob>) => unknown })
      .ClipboardItem;
    const aktuell = werte();
    setKopiert(
      await kopiereTabelle(
        ablage,
        {
          html: tabelleAlsHtml(aktuell, tabelle.kopfzeilen, beschriftung),
          text: tabelleAlsTsv(aktuell),
        },
        Eintrag,
      ),
    );
  };
  const sichern = async (): Promise<void> => {
    if (!speichern) {
      return;
    }
    setSpeichert(true);
    setMeldung(null);
    const ergebnis = await speichern(werte());
    setSpeichert(false);
    if (ergebnis.art === "gespeichert") {
      // Die Tabelle zeigt jetzt die gespeicherte Berichtigung; offene Änderungen sind übernommen.
      setGemerkt({ inhaltskennung, aenderungen: {} });
      setMeldung({ art: "gespeichert" });
    } else if (ergebnis.art === "verweigert") {
      setMeldung({ art: "verweigert" });
    } else {
      setMeldung({ art: "fehler", grund: ergebnis.meldung });
    }
  };

  return (
    <section
      data-testid="bild-tabelle"
      data-zeilen={tabelle.zeilen.length}
      data-spalten={tabelle.spalten}
      data-kopfzeilen={tabelle.kopfzeilen}
      data-geaendert={geaendert}
      data-berichtigt={berichtigt ? "ja" : "nein"}
      data-dauerhaft={speichern ? "ja" : (nurAnsicht ?? "nein")}
      className="mt-1.5 rounded-card border border-hairline px-2 py-1.5"
    >
      <div className="font-semibold text-text">{t("bildtabelle.titel")}</div>
      <p className="text-muted">
        {t("bildtabelle.hinweis", { zeilen: tabelle.zeilen.length, spalten: tabelle.spalten })}
        {tabelle.kopfzeilen > 0 ? ` ${t("bildtabelle.kopfzeile")}` : ""}
      </p>
      <p className="text-muted">{t("bildtabelle.legende")}</p>
      {berichtigt ? (
        <p data-testid="bild-tabelle-berichtigt" className="font-semibold text-ai">
          {t("bildtabelle.berichtigtTabelle")}
        </p>
      ) : null}
      {nichtZugeordnet.length > 0 ? (
        <p data-testid="bild-tabelle-nicht-zugeordnet" className="text-trust-warn-text">
          {t("bildtabelle.nichtZugeordnet", {
            teile: nichtZugeordnet.join(" "),
            interpolation: { escapeValue: false },
          })}
        </p>
      ) : null}
      {unsicher > 0 ? (
        <p data-testid="bild-tabelle-unsicher" className="text-trust-warn-text">
          {t("bildtabelle.unsicher", { n: unsicher })}
        </p>
      ) : null}
      {mehrdeutig > 0 ? (
        <p data-testid="bild-tabelle-mehrdeutig" className="text-trust-warn-text">
          {t("bildtabelle.mehrdeutig", { n: mehrdeutig })}
        </p>
      ) : null}
      <div className="mt-1 overflow-x-auto">
        <table data-testid="bild-tabelle-raster" className="border-collapse">
          {[
            { teil: "kopf", von: 0, bis: tabelle.kopfzeilen },
            { teil: "rumpf", von: tabelle.kopfzeilen, bis: zellen.length },
          ].map(({ teil, von, bis }) => {
            if (bis <= von) {
              return null;
            }
            const Teil = teil === "kopf" ? "thead" : "tbody";
            return (
              <Teil key={teil}>
                {zellen.slice(von, bis).map((zeile, i) => {
                  const z = von + i;
                  return (
                    <tr key={`z${z}`} data-zeile={z}>
                      {zeile.map((zelle, s) => {
                        const Zelle = teil === "kopf" ? "th" : "td";
                        const ort = { zeile: z + 1, spalte: s + 1 };
                        return (
                          <Zelle
                            key={zelle.schluessel}
                            {...(teil === "kopf" ? { scope: "col" } : {})}
                            data-testid="bild-tabelle-zelle"
                            data-zeile={z}
                            data-spalte={s}
                            data-zustand={zelle.zustand}
                            data-mehrdeutig={zelle.mehrdeutig ? "ja" : "nein"}
                            data-bearbeitet={zelle.bearbeitet ? "ja" : "nein"}
                            data-berichtigt={zelle.berichtigt ? "ja" : "nein"}
                            className="border border-hairline px-1 py-0.5 text-left align-top font-normal"
                          >
                            <input
                              type="text"
                              value={zelle.wert}
                              aria-label={t("bildtabelle.zelle", ort)}
                              onChange={(e) => aendern(z, s, e.target.value)}
                              className={`w-full min-w-[5rem] bg-transparent text-text ${
                                teil === "kopf" ? "font-semibold" : ""
                              }`}
                            />
                            {zelle.zustand !== "sicher" && !zelle.bearbeitet ? (
                              <span className="block text-klein text-trust-warn-text">
                                {t(ZUSTAND_TEXT[zelle.zustand])}
                              </span>
                            ) : null}
                            {zelle.berichtigt && !zelle.bearbeitet ? (
                              <span
                                data-testid="bild-tabelle-zelle-berichtigt"
                                className="block text-klein text-ai"
                              >
                                {t("bildtabelle.zelle.berichtigt", {
                                  roh: zelle.roh ?? "",
                                  interpolation: { escapeValue: false },
                                })}
                              </span>
                            ) : null}
                            {zelle.mehrdeutig && !zelle.bearbeitet ? (
                              <span
                                className="block text-klein text-trust-warn-text"
                                title={t("bildtabelle.zelle.mehrdeutigLang")}
                              >
                                {t("bildtabelle.zelle.mehrdeutig")}
                              </span>
                            ) : null}
                            {zelle.bearbeitet ? (
                              <span className="block text-klein text-muted">
                                {t("bildtabelle.zelle.bearbeitet")}{" "}
                                <button
                                  type="button"
                                  data-testid="bild-tabelle-zelle-zuruecksetzen"
                                  aria-label={t("bildtabelle.zelle.zuruecksetzen", ort)}
                                  title={t("bildtabelle.zelle.zuruecksetzen", ort)}
                                  onClick={() => zuruecksetzen(z, s)}
                                  className="underline"
                                >
                                  ↺
                                </button>
                              </span>
                            ) : null}
                            {zeigeStelle ? (
                              <button
                                type="button"
                                data-testid="bild-tabelle-zelle-fundstelle"
                                aria-label={t("bildtabelle.zelle.fundstelle", ort)}
                                title={t("bildtabelle.zelle.fundstelle", ort)}
                                onClick={() => zeigeStelle(z, s, zelle.wert)}
                                className="block text-klein text-muted underline"
                              >
                                ⌖
                              </button>
                            ) : null}
                          </Zelle>
                        );
                      })}
                    </tr>
                  );
                })}
              </Teil>
            );
          })}
        </table>
      </div>
      {!speichern && nurAnsicht ? (
        <p data-testid="bild-tabelle-nur-ansicht" className="mt-1 text-muted">
          {t(NUR_ANSICHT[nurAnsicht])}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="bild-tabelle-kopieren"
          onClick={() => void kopieren()}
          className={KNOPF}
        >
          {t("bildtabelle.kopieren")}
        </button>
        {speichern && geaendert > 0 ? (
          <button
            type="button"
            data-testid="bild-tabelle-speichern"
            disabled={speichert}
            onClick={() => void sichern()}
            className={KNOPF}
          >
            {t("bildtabelle.speichern")}
          </button>
        ) : null}
        {geaendert > 0 ? (
          <button
            type="button"
            data-testid="bild-tabelle-verwerfen"
            onClick={() => {
              setGemerkt({ inhaltskennung, aenderungen: {} });
              setKopiert(null);
              setMeldung(null);
            }}
            className="rounded-btn border border-hairline px-2 py-0.5 text-muted hover:bg-hairline-soft"
          >
            {t("bildtabelle.allesZuruecksetzen")}
          </button>
        ) : null}
      </div>
      {meldung ? (
        meldung.art === "gespeichert" ? (
          <output
            data-testid="bild-tabelle-gespeichert"
            data-ergebnis="gespeichert"
            className="mt-1 block text-muted"
          >
            {t("bildtabelle.gespeichert")}
          </output>
        ) : (
          <p
            data-testid="bild-tabelle-gespeichert"
            data-ergebnis={meldung.art}
            role="alert"
            className="mt-1 text-trust-crit-text"
          >
            {meldung.art === "verweigert"
              ? t("bildtabelle.verweigert")
              : t("bildtabelle.speicherFehler", { grund: meldung.grund })}
          </p>
        )
      ) : null}
      <output
        aria-live="polite"
        data-testid="bild-tabelle-kopiert"
        data-ergebnis={kopiert ?? ""}
        className="mt-1 block text-muted"
      >
        {kopiert ? t(KOPIERT[kopiert]) : ""}
      </output>
    </section>
  );
}
