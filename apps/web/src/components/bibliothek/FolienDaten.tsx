// ================================================================================================
// KLARA POWERPOINT · PP-02 — DATEN AUF DEN FOLIEN: HERKUNFT DIREKT AN DER ZAHL.
// ================================================================================================
//
// Auftrag `produkt:20261015:klara-powerpoint-datenherkunft`. Die Fläche hängt am PowerPoint-Anhang
// im Artikel (`OfficeImArtikel`, Host H04) und nutzt dieselben Rechte. Der Weg (UI-02):
// Folie → Element → Zahl anklicken → Herkunft im Detailbereich (Quelle mit Fassung, Fundstelle,
// Erfassungsart, Rechenweg mit allen verwendeten Eingaben, Prüfstand je Dimension) → prüfen oder
// korrigieren → die Zahl mit diesem Stand weiterverwenden.
//
// Die Folie bleibt die Hauptfläche; die Herkunft steht daneben und lässt sich schließen (UI-03).
// Technische Kennungen erscheinen nur im Detailbereich, nicht an der Zahl.
//
// OCR: „Bildtext lesen“ nutzt die vorhandene Texterkennung (W01, `useBildAnalyse`) für GENAU das
// gewählte Bild — erkannt über die Inhaltskennung seiner Bytes, die der Server ebenfalls nachrechnet.
// Es entsteht keine zweite Engine; das Ergebnis bleibt „OCR-erkannt, nicht bestätigt“.
//
// PP-03 (produkt:20261015:klara-powerpoint-validierung): trägt die Sicht ihre `kontrolle`, gilt an
// der Zahl und im Detailbereich deren Zustand (`DatenKontrolle`) statt des bloßen Prüfstands — nie
// beide nebeneinander. Über der Folienliste steht die Datenlage; ihre Sichtbarkeitsregel kommt aus
// Setup › Klara und blendet nie Klärungen oder überholte Prüfungen aus.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type Berechnungsart,
  type DatenpunktSicht,
  type Dimension,
  type Erfassung,
  type Erfassungsauftrag,
  type FolieMitElementen,
  type FolienDatenLage,
  type FolienElement,
  type Zustand,
  datenFehler,
  praesentationDaten,
} from "../../api/praesentationDaten";
import {
  type BildBefund,
  type BildVorkommen,
  bildBytes,
  bildInhaltskennung,
  bildVorkommenAusRumpf,
} from "../../lib/bildAutomatik";
import { useBildAnalyse } from "../../lib/bildAutomatikLauf";
import { objectRawHref } from "../../lib/bodyFileLink";
import { useOffenePunkteWahl } from "../../lib/datenkontrolleEinstellung";
import { readPptxRich } from "../../lib/files";
import { formatKoTimestamp } from "../../lib/koDates";
import { DatenErgaenzung } from "./DatenErgaenzung";
import { DatenKontrolle, DatenLage } from "./DatenKontrolle";
import { FolienAenderungen } from "./FolienAenderungen";
import { FolienFassungen } from "./FolienFassungen";
import { usePowerPointBildtext } from "./PowerPointBildquellen";
import { VortragVorbereitung } from "./VortragVorbereitung";

const ZUSTANDSFARBE: Record<DatenpunktSicht["pruefstand"]["zustand"], string> = {
  erfasst: "text-muted",
  in_pruefung: "text-muted",
  klaerung: "text-trust-crit-text",
  validiert: "text-text",
  ueberpruefung_noetig: "text-trust-crit-text",
};

/** PP-03: der Zustand der Datenfassung — mit Kontrollen deren Zustand, sonst der Prüfstand. */
export function zustandVon(dp: DatenpunktSicht): Zustand {
  return dp.kontrolle?.zustand ?? dp.pruefstand.zustand;
}

/** Ein Fehler als Satz: die fachliche Begründung des Servers oder ein fester Text. */
function useFehlerText(): (fehler: unknown) => string {
  const { t } = useTranslation();
  return (fehler) => {
    const f = datenFehler(fehler);
    return f.text ?? t(f.schluessel);
  };
}

/** Die Datenpunkte, die an genau diesem Element dieses Anhangs gebunden sind. */
export function amElement(
  lage: Pick<FolienDatenLage, "koId" | "anhangId" | "datenpunkte">,
  sldId: string,
  shapeId: string,
): DatenpunktSicht[] {
  return lage.datenpunkte.filter((d) =>
    d.bindungen.some(
      (b) =>
        b.koId === lage.koId &&
        b.anhangId === lage.anhangId &&
        b.sldId === sldId &&
        b.shapeId === shapeId,
    ),
  );
}

/**
 * Das Bild eines Folienelements aus der Datei holen: dieselbe Lesekette wie die Bildautomatik
 * (`readPptxRich` → Vorkommen), ausgewählt über die Inhaltskennung der Bytes — nicht über eine
 * Position, die zwischen Lesern abweichen könnte. `null`, wenn das Bild dort nicht vorkommt.
 */
export async function bildVorkommenFuer(
  datei: File,
  folie: number,
  kennung: string,
): Promise<BildVorkommen | null> {
  const pptx = await readPptxRich(datei, "");
  const folieJeBild = new Map(pptx.imageSlides.map((x) => [x.imageId, x.slide] as const));
  const vorkommen = bildVorkommenAusRumpf(
    pptx.html,
    { name: datei.name, art: "pptx" },
    folieJeBild,
  ).filter((v) => v.fundstelle.folie === folie && !v.fundstelle.folienansicht);
  for (const v of vorkommen) {
    const bytes = bildBytes(v.src);
    if (bytes && (await bildInhaltskennung(bytes)) === kennung) {
      return v;
    }
  }
  return null;
}

export function FolienDaten({ koId, anhangId }: { koId: string; anhangId: string }): JSX.Element {
  const { t } = useTranslation();
  const fehlerText = useFehlerText();
  const qc = useQueryClient();
  const titelId = useId();
  // UI-06 (R17, R2): die Herkunft trägt eine Kennung, auf die die offene Zahl verweist; die Fläche
  // merkt sich die Zahl oder den Datenlage-Eintrag, an dem die Herkunft geöffnet wurde.
  const herkunftId = useId();
  const bereich = useRef<HTMLElement>(null);
  const oeffner = useRef<HTMLButtonElement | null>(null);
  const schluessel = ["ko", koId, "office", anhangId, "folien-daten"] as const;
  const lage = useQuery({
    queryKey: schluessel,
    queryFn: () => praesentationDaten.lage(koId, anhangId),
  });
  // Der Detailbereich führt einen Pfad: Zahl → Eingabe → Eingabe … mit „Zurück“.
  // Nacharbeit 2: ein Schritt nennt auch die Datenfassung — eine Eingabe öffnet sich in der Fassung,
  // mit der gerechnet wurde, nicht in ihrem heutigen Stand.
  const [pfad, setPfad] = useState<{ id: string; fassung?: number }[]>([]);
  const [erfassenAn, setErfassenAn] = useState<string | null>(null);
  const offenePunkte = useOffenePunkteWahl();
  const [dateiMeldung, setDateiMeldung] = useState<{
    koId: string;
    anhangId: string;
    text: string;
  } | null>(null);
  // UI-06 (Risiko R13): ein Einstieg aus der Datenlage oder an der Zahl setzt den Fokus auf die
  // Herkunft — auch wenn genau diese Zahl schon offen ist (sonst bliebe der Fokus im Schmalformat
  // weit oben, die Herkunft weit unten).
  const [fokusAnfrage, setFokusAnfrage] = useState(0);
  const oeffneVonListe = (id: string, ausloeser?: HTMLButtonElement) => {
    if (ausloeser) {
      oeffner.current = ausloeser;
    }
    setPfad([{ id }]);
    setFokusAnfrage((n) => n + 1);
  };

  const neuLaden = () => {
    void qc.invalidateQueries({ queryKey: schluessel });
    void qc.invalidateQueries({ queryKey: ["datenpunkt"] });
  };
  const dateiGespeichert = (text: string) => {
    setDateiMeldung({ koId, anhangId, text });
    void qc.invalidateQueries({ queryKey: ["ko", koId] });
    void qc.invalidateQueries({ queryKey: ["datenpunkt"] });
    bereich.current?.focus();
  };

  // UI-05/06 (R2, R18): Schließen gibt den Fokus an den Einstieg zurück. Ist der Datenlage-Eintrag
  // etwa nach einer Korrektur nicht mehr da, erhält ihn die Zahl desselben Datenpunkts.
  const schliesseHerkunft = () => {
    const wurzel = pfad[0]?.id;
    setPfad([]);
    const gemerkt = oeffner.current;
    const einstieg =
      gemerkt?.isConnected &&
      bereich.current?.contains(gemerkt) &&
      (gemerkt.dataset.datenpunkt === wurzel ||
        gemerkt.closest<HTMLElement>("li[data-offener-punkt]")?.dataset.offenerPunkt === wurzel)
        ? gemerkt
        : [
            ...(bereich.current?.querySelectorAll<HTMLButtonElement>("button[data-datenpunkt]") ??
              []),
          ].find((b) => b.dataset.datenpunkt === wurzel);
    einstieg?.focus();
  };

  const oeffneFolie = (sldId: string) => {
    const ziel = [...(bereich.current?.querySelectorAll<HTMLElement>("li[data-folie]") ?? [])].find(
      (e) => e.dataset.folie === sldId,
    );
    ziel?.focus();
    ziel?.scrollIntoView({ block: "nearest" });
  };
  const d = lage.data;
  const aktiv = pfad.at(-1) ?? null;
  return (
    <section
      ref={bereich}
      tabIndex={-1}
      data-folien-daten={anhangId}
      aria-labelledby={titelId}
      className="mt-3"
    >
      <h5 id={titelId} className="text-[12.5px] font-semibold text-text">
        {t("praesentationdaten.titel")}
      </h5>
      <p className="mt-0.5 text-[12px] text-muted">{t("praesentationdaten.hinweis")}</p>
      <output className="block text-[12px]" aria-live="polite">
        {dateiMeldung?.koId === koId && dateiMeldung.anhangId === anhangId ? dateiMeldung.text : ""}
      </output>
      {lage.isLoading ? (
        <output className="mt-1 block text-[12px] text-muted">
          {t("praesentationdaten.laedt")}
        </output>
      ) : null}
      {lage.isError ? (
        <p role="alert" className="mt-1 text-[12.5px] text-trust-crit-text">
          {fehlerText(lage.error)}
        </p>
      ) : null}
      {d ? (
        <VortragVorbereitung
          key={`${koId}:${anhangId}`}
          lage={d}
          oeffne={oeffneVonListe}
          oeffneFolie={oeffneFolie}
        />
      ) : null}
      {d?.datenlage ? (
        <DatenLage lage={d.datenlage} wahl={offenePunkte} oeffne={oeffneVonListe} />
      ) : null}
      {d && d.datenpunkte.length > 0 ? (
        <FolienAenderungen
          lage={d}
          gespeichert={dateiGespeichert}
          key={`${koId}:${anhangId}:${d.artikelFassung}:${d.dateiFassung}:${d.datenpunkte.map((p) => `${p.id}@${p.fassung}:${p.pruefungen.length}`).join(",")}`}
        />
      ) : null}
      {d ? (
        <FolienFassungen
          koId={koId}
          anhangId={anhangId}
          darfSpeichern={d.darfErfassen}
          gespeichert={dateiGespeichert}
          key={`fassungen:${koId}:${anhangId}:${d.artikelFassung}:${d.dateiFassung}`}
        />
      ) : null}
      {d ? (
        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <ol data-folien-liste="" className="min-w-0 space-y-2">
            {d.folien.map((f) => (
              <Folie
                key={f.sldId}
                lage={d}
                folie={f}
                aktiv={pfad.length === 1 ? (aktiv?.id ?? null) : null}
                oeffne={oeffneVonListe}
                erfassenAn={erfassenAn}
                setErfassenAn={setErfassenAn}
                nachErfassen={(neu) => {
                  setErfassenAn(null);
                  neuLaden();
                  setPfad([{ id: neu.id }]);
                }}
                nachErgaenzen={() => {
                  neuLaden();
                  void qc.invalidateQueries({ queryKey: ["ko", koId] });
                  void qc.invalidateQueries({ queryKey: ["kos"] });
                  void qc.invalidateQueries({ queryKey: ["library"] });
                }}
                herkunftId={herkunftId}
                schliesse={schliesseHerkunft}
                merkeOeffner={(zahl) => {
                  oeffner.current = zahl;
                }}
              />
            ))}
          </ol>
          {aktiv ? (
            <Herkunft
              key={`${aktiv.id}@${aktiv.fassung ?? "aktuell"}`}
              id={aktiv.id}
              {...(aktiv.fassung === undefined ? {} : { fassung: aktiv.fassung })}
              tiefe={pfad.length}
              fokusAnfrage={fokusAnfrage}
              darfErfassen={d.darfErfassen}
              darfFreigeben={d.darfFreigeben}
              oeffne={(id, fassung) =>
                setPfad((p) => [...p, fassung === undefined ? { id } : { id, fassung }])
              }
              zurueck={() => setPfad((p) => p.slice(0, -1))}
              schliessen={schliesseHerkunft}
              geaendert={neuLaden}
              elementId={herkunftId}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Folie({
  lage,
  folie,
  aktiv,
  oeffne,
  erfassenAn,
  setErfassenAn,
  nachErfassen,
  nachErgaenzen,
  herkunftId,
  schliesse,
  merkeOeffner,
}: {
  lage: FolienDatenLage;
  folie: FolieMitElementen;
  aktiv: string | null;
  oeffne: (id: string, ausloeser?: HTMLButtonElement) => void;
  erfassenAn: string | null;
  setErfassenAn: (schluessel: string | null) => void;
  nachErfassen: (neu: DatenpunktSicht) => void;
  nachErgaenzen: () => void;
  herkunftId: string;
  schliesse: () => void;
  merkeOeffner: (zahl: HTMLButtonElement) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li tabIndex={-1} data-folie={folie.sldId} className="rounded-card border border-hairline p-2">
      <p className="text-[12.5px] font-semibold text-text">
        {t("praesentationdaten.folie", { nummer: folie.position })}
        {folie.titel ? ` · ${folie.titel}` : ""}
        {folie.ausgeblendet ? ` · ${t("praesentationdaten.ausgeblendet")}` : ""}
      </p>
      {folie.elemente.length === 0 ? (
        <p className="mt-1 text-[12px] text-muted">{t("praesentationdaten.keineElemente")}</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {folie.elemente.map((e) => {
            const s = `${folie.sldId}:${e.shapeId}`;
            const daten = amElement(lage, folie.sldId, e.shapeId);
            return (
              <li key={e.shapeId} data-element={s} className="text-[12px]">
                <span className="text-muted">
                  {t(`praesentationdaten.element.${e.art}`)}
                  {e.name ? ` „${e.name}“` : ""}
                </span>
                {e.text ? <p className="whitespace-pre-line text-text">{e.text}</p> : null}
                {daten.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {daten.map((dp) => (
                      <Zahl
                        key={dp.id}
                        dp={dp}
                        gewaehlt={aktiv === dp.id}
                        oeffne={oeffne}
                        herkunftId={herkunftId}
                        schliesse={schliesse}
                        merkeOeffner={merkeOeffner}
                      />
                    ))}
                  </div>
                ) : null}
                {lage.darfErfassen ? (
                  erfassenAn === s ? (
                    <Erfassen
                      key={`${lage.objectId}:${s}`}
                      lage={lage}
                      folie={folie}
                      element={e}
                      abbrechen={() => setErfassenAn(null)}
                      fertig={nachErfassen}
                    />
                  ) : (
                    <button
                      type="button"
                      data-erfassen={s}
                      onClick={() => setErfassenAn(s)}
                      className="mt-1 rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-muted hover:text-text"
                    >
                      {e.art === "bild"
                        ? t("praesentationdaten.ausBildErfassen")
                        : t("praesentationdaten.erfassen")}
                    </button>
                  )
                ) : null}
                {lage.darfErfassen && e.art === "text" ? (
                  <DatenErgaenzung
                    lage={lage}
                    ort={{ anhangId: lage.anhangId, sldId: folie.sldId, shapeId: e.shapeId }}
                    herkunft={oeffne}
                    fertig={nachErgaenzen}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Die Zahl bzw. Aussage selbst: ein Klick öffnet ihre Herkunft, ein zweiter Klick auf die offene Zahl
 * schließt sie wieder — ein echter Umschalter, deshalb stimmt `aria-pressed` (UI-06, R17).
 */
function Zahl({
  dp,
  gewaehlt,
  oeffne,
  herkunftId,
  schliesse,
  merkeOeffner,
}: {
  dp: DatenpunktSicht;
  gewaehlt: boolean;
  oeffne: (id: string) => void;
  /** Kennung des Detailbereichs; die offene Zahl verweist mit `aria-controls` darauf. */
  herkunftId: string;
  schliesse: () => void;
  merkeOeffner: (zahl: HTMLButtonElement) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const erfassung = t(`praesentationdaten.erfassung.${dp.erfassung}`);
  const z = zustandVon(dp);
  const zustand = t(`praesentationdaten.zustand.${z}`);
  return (
    <button
      type="button"
      data-datenpunkt={dp.id}
      data-erfassung={dp.erfassung}
      data-zustand={z}
      aria-pressed={gewaehlt}
      aria-label={t("praesentationdaten.herkunftVon", { wert: dp.wert, erfassung, zustand })}
      aria-controls={gewaehlt ? herkunftId : undefined}
      onClick={(e) => {
        // Prüfbefund B7 (18.10.2026): auch beim Schließen DIESE Zahl merken — derselbe Datenpunkt kann
        // an mehreren Elementen stehen; der Fokus gehört an den Knopf, der geklickt wurde.
        merkeOeffner(e.currentTarget);
        if (gewaehlt) {
          schliesse();
          return;
        }
        oeffne(dp.id);
      }}
      className={`inline-flex items-center gap-1.5 rounded-btn border px-2 py-0.5 text-[12px] ${gewaehlt ? "border-ink" : "border-hairline"}`}
    >
      <span className="font-semibold text-text">{dp.wert}</span>
      <span className="text-muted">{erfassung}</span>
      <span className={ZUSTANDSFARBE[z]}>· {zustand}</span>
    </button>
  );
}

// ------------------------------------------------------------------------------------------------
// HERKUNFT — der Detailbereich
// ------------------------------------------------------------------------------------------------

function Herkunft({
  id,
  fassung,
  tiefe,
  fokusAnfrage = 0,
  darfErfassen: darfErfassenRecht,
  darfFreigeben,
  oeffne,
  zurueck,
  schliessen,
  geaendert,
  elementId,
}: {
  id: string;
  /** Eine bestimmte Datenfassung (Eingabe einer Berechnung); ohne Angabe der aktuelle Stand. */
  fassung?: number;
  tiefe: number;
  /** Zähler ausdrücklicher Einstiege aus Liste/Datenlage: jede Erhöhung setzt den Fokus erneut. */
  fokusAnfrage?: number;
  darfErfassen: boolean;
  darfFreigeben: boolean;
  oeffne: (id: string, fassung?: number) => void;
  zurueck: () => void;
  schliessen: () => void;
  geaendert: () => void;
  /** DOM-Kennung des Detailbereichs (Ziel von `aria-controls` an der offenen Zahl). */
  elementId: string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const fehlerText = useFehlerText();
  const qc = useQueryClient();
  const kopf = useRef<HTMLHeadingElement>(null);
  const schluessel = ["datenpunkt", id, fassung ?? "aktuell"] as const;
  const abfrage = useQuery({
    queryKey: schluessel,
    queryFn: () => praesentationDaten.datenpunkt(id, fassung),
  });
  const dp = abfrage.data;
  const datum = (iso: string) => formatKoTimestamp(iso, i18n.language) ?? "—";
  // Eine frühere Fassung ist Herkunft, kein Arbeitsstand: Prüfen und Korrigieren gelten nur dem
  // aktuellen Datenpunkt.
  const darfErfassen = darfErfassenRecht && dp?.historisch === undefined;

  // Den Fokus nur bei einem anderen Datenpunkt bzw. einer anderen Datenfassung setzen — nicht bei
  // jedem Neuabruf derselben Fassung (PP-03: die Kontrolle trägt je Abruf eine neue Berechnungszeit;
  // sonst verlöre ein offenes Korrekturfeld beim Fensterfokus den Fokus).
  const fokusSchluessel = dp ? `${dp.id}@${dp.fassung}` : null;
  useEffect(() => {
    if (fokusSchluessel && fokusAnfrage >= 0) {
      kopf.current?.focus();
    }
  }, [fokusSchluessel, fokusAnfrage]);

  // UI-06 (Risiko R15): nach Prüfen oder Korrigieren den neuen Zustand ansagen. Die Live-Region
  // steht von Anfang an da, damit Screenreader die Änderung tatsächlich ausgeben.
  const [ansage, setAnsage] = useState("");
  const uebernehmen = (neu: DatenpunktSicht) => {
    qc.setQueryData(schluessel, neu);
    setAnsage(
      t("datenkontrolle.ansage", {
        zustand: t(`praesentationdaten.zustand.${zustandVon(neu)}`),
        fassung: neu.fassung,
      }),
    );
    geaendert();
  };

  return (
    <aside
      id={elementId}
      data-herkunft={id}
      data-herkunft-fassung={dp?.fassung}
      aria-label={t("praesentationdaten.herkunft")}
      onKeyDown={(e) => {
        if (e.key !== "Escape") {
          return;
        }
        // UI-05 (R3): Escape gilt der Herkunft — es schließt nicht zusätzlich die Seitenhilfe oder
        // eine andere äußere Ebene, die auf Escape am Dokument hört.
        e.stopPropagation();
        // UI-05 (R4): Während einer Eingabe per Eingabemethode (IME) gehört Escape der Komposition.
        if (e.nativeEvent.isComposing || e.keyCode === 229) {
          return;
        }
        // UI-05 (R4): Eine begonnene, ungespeicherte Prüfung oder Korrektur verwirft Escape nicht
        // still; verwerfen bleibt dem ausdrücklichen „Abbrechen“ bzw. „Schließen“.
        if (e.currentTarget.querySelector("form[data-ungespeichert]")) {
          return;
        }
        schliessen();
      }}
      className="min-w-0 rounded-card border border-hairline p-3 text-[12px] lg:sticky lg:top-2 lg:self-start"
    >
      <output aria-live="polite" data-herkunft-ansage="" className="sr-only">
        {ansage}
      </output>
      <div className="flex flex-wrap items-center gap-2">
        {tiefe > 1 ? (
          <button
            type="button"
            data-herkunft-zurueck=""
            onClick={zurueck}
            className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-muted"
          >
            {t("praesentationdaten.zurueck")}
          </button>
        ) : null}
        <button
          type="button"
          data-herkunft-schliessen=""
          onClick={schliessen}
          className="ml-auto rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-muted"
        >
          {t("praesentationdaten.schliessen")}
        </button>
      </div>
      {abfrage.isError ? (
        <p role="alert" className="mt-2 text-trust-crit-text">
          {fehlerText(abfrage.error)}
        </p>
      ) : null}
      {dp ? (
        <>
          <h6 ref={kopf} tabIndex={-1} className="mt-2 text-[13px] font-semibold text-text">
            {dp.wert}
          </h6>
          {dp.historisch ? (
            <p data-herkunft-historisch="" className="mt-1 text-trust-crit-text">
              {t("praesentationdaten.historisch", {
                fassung: dp.fassung,
                aktuell: dp.historisch.aktuelleFassung,
              })}{" "}
              <button
                type="button"
                data-herkunft-aktuell-oeffnen=""
                onClick={() => oeffne(id)}
                className="underline"
              >
                {t("praesentationdaten.aktuelleOeffnen")}
              </button>
            </p>
          ) : null}
          <p data-herkunft-erfassung={dp.erfassung} className="mt-0.5 font-semibold">
            {t(`praesentationdaten.erfassung.${dp.erfassung}`)}
          </p>
          <p className="text-muted">{t(`praesentationdaten.erfassungsweg.${dp.erfassung}`)}</p>
          {dp.pruefstand.prognose ? (
            <p data-herkunft-prognose="" className="mt-1 text-trust-crit-text">
              {t("praesentationdaten.prognoseHinweis")}
            </p>
          ) : null}

          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <Angabe name={t("praesentationdaten.feld.einheit")} wert={dp.einheit ?? dp.waehrung} />
            <Angabe name={t("praesentationdaten.feld.zeitraum")} wert={dp.zeitraum} />
            <Angabe name={t("praesentationdaten.feld.bezugsgroesse")} wert={dp.bezugsgroesse} />
            <Angabe name={t("praesentationdaten.feld.datenfassung")} wert={String(dp.fassung)} />
            <Angabe
              name={t("praesentationdaten.feld.erfasst")}
              wert={`${dp.erfasstVon.name ?? dp.erfasstVon.id} · ${datum(dp.erfasstAm)}`}
            />
            <Angabe
              name={t("praesentationdaten.feld.schutzstufe")}
              wert={t(`praesentationdaten.schutz.${dp.schutzstufe}`)}
            />
          </dl>

          <Abschnitt titel={t("praesentationdaten.quelle")}>
            {dp.quelle === null ? (
              <p className="text-muted">{t("praesentationdaten.keineQuelle")}</p>
            ) : dp.quelle.lesbar ? (
              <p data-herkunft-quelle={dp.quelle.koId}>
                <Link to={`/wissen/${encodeURIComponent(dp.quelle.koId)}`} className="underline">
                  {dp.quelle.titel}
                </Link>
                {" · "}
                {t("praesentationdaten.quellfassung", {
                  fassung: dp.quelle.koFassung,
                  aktuell: dp.quelle.aktuelleFassung,
                })}
                {dp.quelle.anhangName ? ` · ${dp.quelle.anhangName}` : ""}
                {dp.quelle.dateiFassung ? (
                  <span className="block text-muted">
                    {t("praesentationdaten.dateifassung", {
                      kennung: dp.quelle.dateiFassung.slice(0, 12),
                    })}
                  </span>
                ) : null}
              </p>
            ) : (
              <p data-herkunft-quelle="verborgen" className="text-muted">
                {t("praesentationdaten.quelleVerborgen")}
              </p>
            )}
          </Abschnitt>

          <Abschnitt titel={t("praesentationdaten.fundstelle")}>
            <FundstelleText dp={dp} />
          </Abschnitt>

          {dp.rechenweg ? (
            <Abschnitt titel={t("praesentationdaten.rechenweg")}>
              <p data-herkunft-rechenweg={dp.rechenweg.art}>
                {t(`praesentationdaten.rechenart.${dp.rechenweg.art}`)}: {dp.rechenweg.formel}
              </p>
              <p className="text-muted">
                {t("praesentationdaten.rundung", {
                  roh: dp.rechenweg.roh,
                  stellen: dp.rechenweg.stellen,
                  ergebnis: dp.rechenweg.ergebnis,
                })}
              </p>
              <ol data-herkunft-eingaben="" className="mt-1 space-y-1">
                {/* Dieselbe Eingabe darf mehrfach vorkommen; die Stelle im Rechenweg ist ihr Schlüssel.
                    Ein Klick öffnet die VERWENDETE Fassung der Eingabe, nicht ihren heutigen Stand. */}
                {dp.rechenweg.eingaben
                  .map((e, stelle) => ({ e, stelle }))
                  .map(({ e, stelle }) =>
                    e.lesbar ? (
                      <li key={`eingabe-${stelle}`}>
                        <button
                          type="button"
                          data-eingabe={e.verwendet.datenpunktId}
                          data-eingabe-fassung={e.verwendet.fassung}
                          onClick={() => oeffne(e.verwendet.datenpunktId, e.verwendet.fassung)}
                          className="rounded-btn border border-hairline px-2 py-0.5 text-left"
                        >
                          <span className="font-semibold text-text">{e.verwendet.wert}</span>{" "}
                          <span className="text-muted">
                            {t(`praesentationdaten.erfassung.${e.datenpunkt.erfassung}`)} ·{" "}
                            {t("praesentationdaten.eingabeFassung", {
                              fassung: e.verwendet.fassung,
                            })}
                          </span>
                        </button>
                        {e.aktuell.fassung !== e.verwendet.fassung ? (
                          <span data-eingabe-geaendert="" className="ml-1 text-trust-crit-text">
                            {t("praesentationdaten.eingabeGeaendert", {
                              wert: e.aktuell.wert,
                              fassung: e.aktuell.fassung,
                            })}
                          </span>
                        ) : null}
                      </li>
                    ) : (
                      <li key={`eingabe-${stelle}`} data-eingabe="verborgen" className="text-muted">
                        {t("praesentationdaten.eingabeVerborgen")}
                      </li>
                    ),
                  )}
              </ol>
            </Abschnitt>
          ) : null}

          {dp.annahmen.length > 0 || dp.modellbezug ? (
            <Abschnitt titel={t("praesentationdaten.annahmen")}>
              <ul className="list-disc pl-4">
                {dp.annahmen.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {dp.modellbezug ? (
                <p className="text-muted">
                  {t("praesentationdaten.modellbezug", { bezug: dp.modellbezug })}
                </p>
              ) : null}
            </Abschnitt>
          ) : null}

          <Abschnitt titel={t("praesentationdaten.pruefstand")}>
            {dp.kontrolle ? (
              // PP-03: Prüfstand UND Kontrollen derselben Datenfassung — ersetzt die Liste unten.
              <div data-herkunft-zustand={dp.kontrolle.zustand}>
                <DatenKontrolle kontrolle={dp.kontrolle} eingebettet />
              </div>
            ) : (
              <>
                <p data-herkunft-zustand={dp.pruefstand.zustand} className="font-semibold">
                  {t(`praesentationdaten.zustand.${dp.pruefstand.zustand}`)}
                </p>
                <p className="text-muted">{dp.pruefstand.grund}</p>
                <ul data-herkunft-dimensionen="" className="mt-1 space-y-0.5">
                  {dp.pruefstand.dimensionen.map((x) => (
                    <li key={x.dimension} data-dimension={x.dimension} data-stand={x.stand}>
                      <span className="font-semibold text-text">
                        {t(`praesentationdaten.dimension.${x.dimension}`)}:
                      </span>{" "}
                      {t(`praesentationdaten.stand.${x.stand}`)}
                      {x.grund ? <span className="text-muted"> — {x.grund}</span> : null}
                      {x.pruefung ? (
                        <span className="text-muted">
                          {" "}
                          ({x.pruefung.name ?? x.pruefung.von}, {datum(x.pruefung.am)})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {dp.pruefstand.naechsteArbeit.length > 0 ? (
                  <>
                    <p className="mt-1 font-semibold">{t("praesentationdaten.naechsteArbeit")}</p>
                    <ul className="list-disc pl-4">
                      {dp.pruefstand.naechsteArbeit.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            )}
            {darfErfassen ? (
              <Pruefen dp={dp} darfFreigeben={darfFreigeben} fertig={uebernehmen} />
            ) : null}
          </Abschnitt>

          <Abschnitt titel={t("praesentationdaten.bindungen")}>
            {dp.bindungen.length === 0 ? (
              <p className="text-muted">{t("praesentationdaten.keineBindung")}</p>
            ) : (
              <ul data-herkunft-bindungen="" className="space-y-0.5">
                {dp.bindungen.map((b) => (
                  <li key={b.id} data-bindung={b.lage}>
                    {t("praesentationdaten.bindung", {
                      datei: b.anhangName ?? "",
                      nummer: b.folienPosition,
                      element: b.elementName,
                    })}
                    {b.zeile !== undefined
                      ? ` · ${t("praesentationdaten.zelle", { zeile: b.zeile, spalte: b.spalte })}`
                      : ""}
                    {" — "}
                    <span
                      className={b.lage === "abweichung" ? "text-trust-crit-text" : "text-muted"}
                    >
                      {t(`praesentationdaten.lage.${b.lage}`)}
                    </span>
                    {b.heute ? (
                      <span className="block text-muted">
                        {t("praesentationdaten.heute", { text: b.heute })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Abschnitt>

          {dp.korrekturen.length > 0 ? (
            <Abschnitt titel={t("praesentationdaten.korrekturen")}>
              <ol className="space-y-0.5">
                {dp.korrekturen.map((k) => (
                  <li key={k.fassung} data-korrektur={k.fassung}>
                    {t("praesentationdaten.korrekturZeile", {
                      fassung: k.fassung,
                      wer: k.name ?? k.von,
                      wann: datum(k.am),
                      grund: k.grund,
                    })}
                    {typeof k.vorher.wert === "string" ? (
                      <span className="text-muted">
                        {" "}
                        {t("praesentationdaten.vorher", { wert: k.vorher.wert })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Abschnitt>
          ) : null}

          {darfErfassen ? <Korrigieren dp={dp} fertig={uebernehmen} /> : null}
        </>
      ) : null}
    </aside>
  );
}

function Angabe({ name, wert }: { name: string; wert: string | undefined }): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <dt className="text-muted">{name}</dt>
      <dd className="text-text">{wert ?? t("praesentationdaten.nichtAngegeben")}</dd>
    </>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mt-2 border-t border-hairline pt-2">
      <p className="mb-0.5 font-semibold text-text">{titel}</p>
      {children}
    </div>
  );
}

function FundstelleText({ dp }: { dp: DatenpunktSicht }): JSX.Element {
  const { t } = useTranslation();
  const f = dp.fundstelle;
  switch (f.art) {
    case "folienelement":
      return (
        <p data-herkunft-fundstelle={f.art}>
          {t("praesentationdaten.fundstelleFolie", {
            nummer: f.folienPosition,
            titel: f.folienTitel,
            element: f.elementName,
          })}
          <span className="block text-muted">„{f.zitat}“</span>
        </p>
      );
    case "tabellenzelle":
      return (
        <p data-herkunft-fundstelle={f.art}>
          {t("praesentationdaten.fundstelleFolie", {
            nummer: f.folienPosition,
            titel: f.folienTitel,
            element: f.elementName,
          })}
          {" · "}
          {t("praesentationdaten.zelleMitKopf", {
            zeile: f.zeile,
            spalte: f.spalte,
            zeilenkopf: f.zeilenkopf,
            spaltenkopf: f.spaltenkopf,
          })}
          <span className="block text-muted">„{f.zitat}“</span>
        </p>
      );
    case "bild":
      return (
        <p data-herkunft-fundstelle={f.art}>
          {t("praesentationdaten.fundstelleBild", {
            nummer: f.folienPosition,
            titel: f.folienTitel,
            element: f.elementName,
          })}
          <span className="block text-muted">
            {t("praesentationdaten.bildKennung", { kennung: f.bildKennung.slice(0, 19) })}
          </span>
          <span className="block">
            {t("praesentationdaten.erkannterText")}{" "}
            <span className="whitespace-pre-line text-muted">„{f.ocrText}“</span>
          </span>
          {f.uebernahme ? (
            <span data-bildtext-uebernahme="" className="block text-muted">
              {t("praesentationdaten.bildtextRoh")} „{f.uebernahme.rohText}“
              {f.uebernahme.korrektur ? (
                <span className="block">
                  {t("praesentationdaten.bildtextKorrektur", {
                    am: f.uebernahme.korrektur.geaendertAm,
                  })}
                </span>
              ) : null}
            </span>
          ) : null}
          {f.unsicher ? (
            <span className="block text-trust-crit-text">
              {t("praesentationdaten.ocrUnsicher")}
            </span>
          ) : null}
        </p>
      );
    case "artikel":
      return (
        <p data-herkunft-fundstelle={f.art}>
          {t("praesentationdaten.fundstelleArtikel")}
          <span className="block text-muted">„{f.zitat}“</span>
        </p>
      );
    case "eingabe":
      return (
        <p data-herkunft-fundstelle={f.art}>
          {t("praesentationdaten.fundstelleEingabe", {
            wer: dp.erfasstVon.name ?? dp.erfasstVon.id,
          })}
          {f.beleg ? (
            <span className="block text-muted">
              {t("praesentationdaten.beleg", { beleg: f.beleg })}
            </span>
          ) : null}
        </p>
      );
    case "rechenweg":
      return <p data-herkunft-fundstelle={f.art}>{t("praesentationdaten.fundstelleRechenweg")}</p>;
  }
}

// ------------------------------------------------------------------------------------------------
// PRÜFEN UND KORRIGIEREN
// ------------------------------------------------------------------------------------------------

function Pruefen({
  dp,
  darfFreigeben,
  fertig,
}: {
  dp: DatenpunktSicht;
  darfFreigeben: boolean;
  fertig: (neu: DatenpunktSicht) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const fehlerText = useFehlerText();
  const dimensionen = dp.pruefstand.erforderlich.filter(
    (x) => x !== "fachliche_freigabe" || darfFreigeben,
  );
  const [dimension, setDimension] = useState<Dimension>(dimensionen[0] ?? "struktur");
  const [ergebnis, setErgebnis] = useState<"bestanden" | "klaerung">("bestanden");
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // UI-05 (R4): seit dem letzten Speichern etwas gewählt oder eingegeben — dann verwirft Escape nichts.
  const [beruehrt, setBeruehrt] = useState(false);
  const id = useId();

  async function senden(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      fertig(
        await praesentationDaten.pruefen(dp.id, {
          dimension,
          ergebnis,
          ...(grund.trim() ? { grund: grund.trim() } : {}),
          fassung: dp.fassung,
        }),
      );
      setGrund("");
      setBeruehrt(false);
    } catch (f) {
      setFehler(fehlerText(f));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form
      data-pruefen=""
      data-ungespeichert={beruehrt ? "" : undefined}
      onChange={() => setBeruehrt(true)}
      onSubmit={senden}
      className="mt-2 space-y-1"
    >
      <p className="font-semibold">{t("praesentationdaten.pruefungFesthalten")}</p>
      <label htmlFor={`${id}-d`} className="block text-muted">
        {t("praesentationdaten.dimensionWaehlen")}
      </label>
      <select
        id={`${id}-d`}
        value={dimension}
        onChange={(e) => setDimension(e.target.value as Dimension)}
        className="w-full rounded-btn border border-hairline px-1 py-0.5"
      >
        {dimensionen.map((x) => (
          <option key={x} value={x}>
            {t(`praesentationdaten.dimension.${x}`)}
          </option>
        ))}
      </select>
      <fieldset className="flex gap-3">
        <legend className="sr-only">{t("praesentationdaten.ergebnis")}</legend>
        {(["bestanden", "klaerung"] as const).map((x) => (
          <label key={x} className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`${id}-e`}
              value={x}
              checked={ergebnis === x}
              onChange={() => setErgebnis(x)}
            />
            {t(`praesentationdaten.stand.${x}`)}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-g`} className="block text-muted">
        {t("praesentationdaten.grund")}
      </label>
      <input
        id={`${id}-g`}
        value={grund}
        onChange={(e) => setGrund(e.target.value)}
        className="w-full rounded-btn border border-hairline px-1 py-0.5"
      />
      <p className="text-muted">
        {t("praesentationdaten.pruefungGiltFuer", { fassung: dp.fassung })}
      </p>
      {fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      <button
        type="submit"
        aria-disabled={laeuft}
        disabled={laeuft}
        className="rounded-btn border border-hairline px-2 py-0.5 font-semibold"
      >
        {t("praesentationdaten.pruefungSpeichern")}
      </button>
    </form>
  );
}

function Korrigieren({
  dp,
  fertig,
}: {
  dp: DatenpunktSicht;
  fertig: (neu: DatenpunktSicht) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const fehlerText = useFehlerText();
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState(dp.wert);
  const [einheit, setEinheit] = useState(dp.einheit ?? "");
  const [zeitraum, setZeitraum] = useState(dp.zeitraum ?? "");
  const [bezugsgroesse, setBezugsgroesse] = useState(dp.bezugsgroesse ?? "");
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // UI-05 (R4): seit dem Öffnen etwas eingegeben und nicht gespeichert — dann verwirft Escape nichts.
  const [beruehrt, setBeruehrt] = useState(false);
  const id = useId();

  async function senden(art: "werte" | "neuBerechnen" | "quelleAktualisieren") {
    if (!grund.trim()) {
      setFehler(t("praesentationdaten.grundFehlt"));
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      fertig(
        await praesentationDaten.korrigieren(dp.id, {
          fassung: dp.fassung,
          grund: grund.trim(),
          ...(art === "neuBerechnen" ? { neuBerechnen: true } : {}),
          ...(art === "quelleAktualisieren" ? { quelleAktualisieren: true } : {}),
          ...(art === "werte"
            ? {
                ...(dp.rechenweg ? {} : { wert }),
                einheit: einheit.trim() || null,
                zeitraum: zeitraum.trim() || null,
                bezugsgroesse: bezugsgroesse.trim() || null,
              }
            : {}),
        }),
      );
      setOffen(false);
      setGrund("");
      setBeruehrt(false);
    } catch (f) {
      setFehler(fehlerText(f));
    } finally {
      setLaeuft(false);
    }
  }

  if (!offen) {
    return (
      <button
        type="button"
        data-korrigieren-oeffnen=""
        onClick={() => setOffen(true)}
        className="mt-2 rounded-btn border border-hairline px-2 py-0.5 font-semibold text-muted"
      >
        {t("praesentationdaten.korrigieren")}
      </button>
    );
  }
  const feld = (name: string, wertNow: string, setze: (s: string) => void, nur = false) => (
    <>
      <label htmlFor={`${id}-${name}`} className="block text-muted">
        {t(`praesentationdaten.feld.${name}`)}
      </label>
      <input
        id={`${id}-${name}`}
        value={wertNow}
        readOnly={nur}
        onChange={(e) => setze(e.target.value)}
        className="w-full rounded-btn border border-hairline px-1 py-0.5"
      />
    </>
  );
  return (
    <form
      data-korrigieren=""
      data-ungespeichert={beruehrt ? "" : undefined}
      onChange={() => setBeruehrt(true)}
      onSubmit={(e) => {
        e.preventDefault();
        void senden("werte");
      }}
      className="mt-2 space-y-1 border-t border-hairline pt-2"
    >
      <p className="font-semibold">{t("praesentationdaten.korrigieren")}</p>
      {feld("wert", wert, setWert, dp.rechenweg !== null)}
      {feld("einheit", einheit, setEinheit)}
      {feld("zeitraum", zeitraum, setZeitraum)}
      {feld("bezugsgroesse", bezugsgroesse, setBezugsgroesse)}
      {feld("grund", grund, setGrund)}
      <p className="text-muted">{t("praesentationdaten.korrekturHinweis")}</p>
      {fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="submit"
          disabled={laeuft}
          className="rounded-btn border border-hairline px-2 py-0.5 font-semibold"
        >
          {t("praesentationdaten.korrekturSpeichern")}
        </button>
        {dp.rechenweg ? (
          <button
            type="button"
            data-neu-berechnen=""
            disabled={laeuft}
            onClick={() => void senden("neuBerechnen")}
            className="rounded-btn border border-hairline px-2 py-0.5 font-semibold"
          >
            {t("praesentationdaten.neuBerechnen")}
          </button>
        ) : null}
        {dp.erfassung === "direkt" ? (
          <button
            type="button"
            data-neu-lesen=""
            disabled={laeuft}
            onClick={() => void senden("quelleAktualisieren")}
            className="rounded-btn border border-hairline px-2 py-0.5 font-semibold"
          >
            {t("praesentationdaten.neuLesen")}
          </button>
        ) : null}
        <button
          type="button"
          data-korrigieren-abbrechen=""
          onClick={() => {
            // Prüfbefund P2 (18.10.2026): „Abbrechen“ verwirft die Eingaben wirklich — beim nächsten
            // Öffnen steht wieder der Datenpunkt da, nicht eine alte Eingabe, die als unberührt gälte.
            setWert(dp.wert);
            setEinheit(dp.einheit ?? "");
            setZeitraum(dp.zeitraum ?? "");
            setBezugsgroesse(dp.bezugsgroesse ?? "");
            setGrund("");
            setFehler(null);
            setOffen(false);
            setBeruehrt(false);
          }}
          className="rounded-btn border border-hairline px-2 py-0.5 text-muted"
        >
          {t("praesentationdaten.abbrechen")}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------------------------------------
// ERFASSEN AM ELEMENT
// ------------------------------------------------------------------------------------------------

function Erfassen({
  lage,
  folie,
  element,
  abbrechen,
  fertig,
}: {
  lage: FolienDatenLage;
  folie: FolieMitElementen;
  element: FolienElement;
  abbrechen: () => void;
  fertig: (neu: DatenpunktSicht) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const fehlerText = useFehlerText();
  const analyse = useBildAnalyse();
  const id = useId();
  const bild = element.art === "bild";
  const arten: Erfassung[] = bild ? ["ocr"] : ["direkt", "manuell", "berechnet", "prognose"];
  const [erfassung, setErfassung] = useState<Erfassung>(arten[0] ?? "manuell");
  const [art, setArt] = useState<"zahl" | "aussage">("zahl");
  const [zelle, setZelle] = useState("");
  const [wert, setWert] = useState("");
  const [einheit, setEinheit] = useState("");
  const [zeitraum, setZeitraum] = useState("");
  const [bezugsgroesse, setBezugsgroesse] = useState("");
  const [beleg, setBeleg] = useState("");
  const [rechenart, setRechenart] = useState<Berechnungsart>("summe");
  const [eingaben, setEingaben] = useState<string[]>([]);
  const [stellen, setStellen] = useState(0);
  const [annahmen, setAnnahmen] = useState("");
  const [modellbezug, setModellbezug] = useState("");
  const [bildbefund, setBildbefund] = useState<BildBefund | null>(null);
  const { ocr, wartet: bildWartet } = usePowerPointBildtext(
    lage,
    folie.position,
    element,
    bildbefund,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const zahlen = lage.datenpunkte.filter((d) => d.art === "zahl");
  const mitRechenweg =
    erfassung === "berechnet" || (erfassung === "prognose" && eingaben.length > 0);

  async function bildLesen() {
    const kennung = element.bild?.kennung;
    const href = objectRawHref(lage.objectId);
    if (!kennung || !href) {
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      const antwort = await fetch(href, { credentials: "same-origin" });
      const blob = antwort.ok ? await antwort.blob() : null;
      if (!blob) {
        setFehler(t("praesentationdaten.fehler.keinRecht"));
        return;
      }
      const v = await bildVorkommenFuer(
        new File([blob], lage.anhangName, { type: blob.type }),
        folie.position,
        kennung,
      );
      if (!v) {
        setFehler(t("praesentationdaten.bildNichtGefunden"));
        return;
      }
      const befund = await analyse.befundFuerBild(v);
      if (befund.status !== "gelesen" || befund.inhaltskennung !== kennung) {
        setFehler(t("praesentationdaten.bildNichtGelesen", { status: befund.status }));
        return;
      }
      setBildbefund(befund);
    } catch {
      setFehler(t("praesentationdaten.bildNichtGelesen", { status: "fehlgeschlagen" }));
    } finally {
      setLaeuft(false);
    }
  }

  async function senden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    const [z, s] = zelle.split(":").map(Number);
    const liste = annahmen
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);
    const auftrag: Erfassungsauftrag = {
      art: mitRechenweg ? "zahl" : art,
      wert: wert.trim(),
      erfassung,
      ort: {
        anhangId: lage.anhangId,
        sldId: folie.sldId,
        shapeId: element.shapeId,
        ...(z && s ? { zeile: z, spalte: s } : {}),
      },
      ...(einheit.trim() ? { einheit: einheit.trim() } : {}),
      ...(zeitraum.trim() ? { zeitraum: zeitraum.trim() } : {}),
      ...(bezugsgroesse.trim() ? { bezugsgroesse: bezugsgroesse.trim() } : {}),
      ...(erfassung === "ocr" && ocr ? { ocr } : {}),
      ...((erfassung === "manuell" || erfassung === "prognose") && beleg.trim()
        ? { beleg: beleg.trim() }
        : {}),
      ...(mitRechenweg ? { rechenweg: { art: rechenart, eingaben, stellen } } : {}),
      ...(erfassung === "prognose" && liste.length > 0 ? { annahmen: liste } : {}),
      ...(erfassung === "prognose" && modellbezug.trim()
        ? { modellbezug: modellbezug.trim() }
        : {}),
    };
    setLaeuft(true);
    try {
      fertig(await praesentationDaten.erfassen(lage.koId, auftrag));
    } catch (f) {
      setFehler(fehlerText(f));
    } finally {
      setLaeuft(false);
    }
  }

  const eingabe = (name: string, wertNow: string, setze: (s: string) => void) => (
    <>
      <label htmlFor={`${id}-${name}`} className="block text-muted">
        {t(`praesentationdaten.feld.${name}`)}
      </label>
      <input
        id={`${id}-${name}`}
        value={wertNow}
        onChange={(e) => setze(e.target.value)}
        className="w-full rounded-btn border border-hairline px-1 py-0.5"
      />
    </>
  );

  return (
    <form
      data-erfassen-formular={`${folie.sldId}:${element.shapeId}`}
      onSubmit={senden}
      className="mt-1 space-y-1 rounded-btn border border-hairline p-2"
    >
      <label htmlFor={`${id}-erfassung`} className="block text-muted">
        {t("praesentationdaten.erfassungWaehlen")}
      </label>
      <select
        id={`${id}-erfassung`}
        value={erfassung}
        onChange={(e) => setErfassung(e.target.value as Erfassung)}
        className="w-full rounded-btn border border-hairline px-1 py-0.5"
      >
        {arten.map((a) => (
          <option key={a} value={a}>
            {t(`praesentationdaten.erfassung.${a}`)}
          </option>
        ))}
      </select>
      <p className="text-muted">{t(`praesentationdaten.erfassungsweg.${erfassung}`)}</p>

      {element.art === "tabelle" && element.zellen ? (
        <>
          <label htmlFor={`${id}-zelle`} className="block text-muted">
            {t("praesentationdaten.zelleWaehlen")}
          </label>
          <select
            id={`${id}-zelle`}
            value={zelle}
            onChange={(e) => setZelle(e.target.value)}
            className="w-full rounded-btn border border-hairline px-1 py-0.5"
          >
            <option value="">{t("praesentationdaten.ganzeTabelle")}</option>
            {element.zellen.map((c) => (
              <option key={`${c.zeile}:${c.spalte}`} value={`${c.zeile}:${c.spalte}`}>
                {t("praesentationdaten.zelle", { zeile: c.zeile, spalte: c.spalte })}: {c.text}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {bild ? (
        <div className="space-y-1">
          <button
            type="button"
            data-bildtext-lesen=""
            disabled={laeuft || bildWartet || !!ocr}
            onClick={() => void bildLesen()}
            className="rounded-btn border border-hairline px-2 py-0.5 font-semibold"
          >
            {t(
              ocr
                ? "praesentationdaten.bildtextVorhanden"
                : bildWartet
                  ? "praesentationdaten.bildtextWartet"
                  : "praesentationdaten.bildtextLesen",
            )}
          </button>
          {ocr ? (
            <p data-ocr-text="" className="whitespace-pre-line text-muted">
              {t("praesentationdaten.erkannterText")} „{ocr.text}“
              <span className="block">{t("praesentationdaten.erfassungsweg.ocr")}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {!mitRechenweg ? (
        <fieldset className="flex gap-3">
          <legend className="sr-only">{t("praesentationdaten.art")}</legend>
          {(["zahl", "aussage"] as const).map((x) => (
            <label key={x} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name={`${id}-art`}
                value={x}
                checked={art === x}
                onChange={() => setArt(x)}
              />
              {t(`praesentationdaten.artName.${x}`)}
            </label>
          ))}
        </fieldset>
      ) : null}

      {eingabe("wert", wert, setWert)}
      {eingabe("einheit", einheit, setEinheit)}
      {eingabe("zeitraum", zeitraum, setZeitraum)}
      {eingabe("bezugsgroesse", bezugsgroesse, setBezugsgroesse)}

      {erfassung === "manuell" || erfassung === "prognose"
        ? eingabe("beleg", beleg, setBeleg)
        : null}

      {erfassung === "berechnet" || erfassung === "prognose" ? (
        <fieldset className="space-y-1">
          <legend className="text-muted">{t("praesentationdaten.rechenweg")}</legend>
          <select
            aria-label={t("praesentationdaten.rechenartWaehlen")}
            value={rechenart}
            onChange={(e) => setRechenart(e.target.value as Berechnungsart)}
            className="w-full rounded-btn border border-hairline px-1 py-0.5"
          >
            {(["summe", "differenz", "anteil_prozent"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`praesentationdaten.rechenart.${x}`)}
              </option>
            ))}
          </select>
          <p className="text-muted">{t("praesentationdaten.eingabenReihenfolge")}</p>
          {zahlen.length === 0 ? (
            <p className="text-muted">{t("praesentationdaten.keineEingaben")}</p>
          ) : (
            <ul className="space-y-0.5">
              {zahlen.map((z) => {
                const nr = eingaben.indexOf(z.id);
                return (
                  <li key={z.id}>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        data-eingabe-waehlen={z.id}
                        checked={nr >= 0}
                        onChange={(e) =>
                          setEingaben((alt) =>
                            e.target.checked ? [...alt, z.id] : alt.filter((x) => x !== z.id),
                          )
                        }
                      />
                      {nr >= 0 ? `${nr + 1}. ` : ""}
                      {z.wert}
                      {z.zeitraum ? ` (${z.zeitraum})` : ""} ·{" "}
                      {t(`praesentationdaten.erfassung.${z.erfassung}`)}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <label htmlFor={`${id}-stellen`} className="block text-muted">
            {t("praesentationdaten.stellen")}
          </label>
          <input
            id={`${id}-stellen`}
            type="number"
            min={0}
            max={6}
            value={stellen}
            onChange={(e) => setStellen(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
            className="w-20 rounded-btn border border-hairline px-1 py-0.5"
          />
        </fieldset>
      ) : null}

      {erfassung === "prognose" ? (
        <>
          <label htmlFor={`${id}-annahmen`} className="block text-muted">
            {t("praesentationdaten.annahmenEingeben")}
          </label>
          <textarea
            id={`${id}-annahmen`}
            value={annahmen}
            onChange={(e) => setAnnahmen(e.target.value)}
            rows={3}
            className="w-full rounded-btn border border-hairline px-1 py-0.5"
          />
          {eingabe("modellbezug", modellbezug, setModellbezug)}
        </>
      ) : null}

      {fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <button
          type="submit"
          data-erfassen-speichern=""
          disabled={laeuft || (bild && !ocr)}
          className="rounded-btn bg-ink px-2 py-0.5 font-semibold text-white"
        >
          {t("praesentationdaten.erfassenSpeichern")}
        </button>
        <button
          type="button"
          onClick={abbrechen}
          className="rounded-btn border border-hairline px-2 py-0.5 text-muted"
        >
          {t("praesentationdaten.abbrechen")}
        </button>
      </div>
    </form>
  );
}
