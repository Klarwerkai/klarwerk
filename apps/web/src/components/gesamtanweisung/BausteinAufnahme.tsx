// ==================================================================================================
// JOB 4154 · EINE VORHANDENE FASSUNG AUFNEHMEN — EINTRAG UND FASSUNG, BEIDES PFLICHT.
// FE-001   · … UND ZWAR ÜBER EINE MENSCHLICHE AUSWAHL, NICHT ÜBER GETIPPTE KENNUNGEN.
// ==================================================================================================
//
// Bis FE-001 fragte dieses Formular die rohe Eintragskennung, eine Fassungsnummer und einen
// optionalen Nachweiswert ab. Ein neuer Mensch kennt keins davon (Live-Befund des Beraters,
// 26.09.2026). Jetzt sucht er nach Titel oder Begriff, sieht eine Vorschau und wählt eine konkrete,
// vorhandene Fassung bewusst aus. Die Kennung reist unsichtbar mit.
//
// DIE FASSUNG BLEIBT EINE EIGENE, BEWUSSTE WAHL — und das ist kein Komfortverzicht. Wer nur den
// Eintrag wählen könnte, bekäme „die aktuelle Fassung" — und damit genau die stille Ersetzung, die
// der Startvertrag verbietet. Deshalb ist keine Fassung vorausgewählt, und der Knopf nennt die
// gewählte Nummer.
//
// KEIN ZWEITER BESTAND, KEINE EIGENE RECHTEFRAGE: gesucht wird über den vorhandenen Suchweg
// (`GET /api/library/search`, `useLibrarySearch`), die Fassungen kommen aus `GET /api/kos/:id/
// versions` (`useKoVersions`). Beide Türen prüfen die Sichtbarkeit am Server; was dort fehlt, steht
// hier nicht. Angeboten werden NUR die gespeicherten Fassungen — genau die Menge, die der Server
// beim Aufnehmen als bindbar anerkennt (`fassungUnbekanntSatz`, `gesamtanweisung-service.ts`). Eine
// nicht vorhandene Fassung lässt sich so gar nicht erst wählen; lehnt der Server trotzdem ab, steht
// seine Absage am Formular.
//
// DER NACHWEISWERT IST NICHT WEG, SONDERN ZURÜCKGETRETEN: er belegt Unverändertheit im Vergleich
// (`inhaltsBefunde`). Niemand muss ihn kennen; wer ihn hat, trägt ihn unter „Für Fachleute" ein.
//
// OHNE KI und vollständig mit der Tastatur: echte `<form>`/`<input>`/`<button>`/Radio-Elemente.
// Enter im Suchfeld sucht; die Fassungen sind eine Radiogruppe (Pfeiltasten); der Aufnahmeknopf ist
// ein Submit. Eingaben bleiben beim Scheitern STEHEN — geleert wird erst nach bestätigtem Erfolg.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useKoVersions, useLibrarySearch } from "../../api/hooks";
import type { KnowledgeObject, KoVersionSnapshot } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";
import { SanitizedHtml } from "../SanitizedHtml";
import { istOhneVerbindung } from "./api";
import {
  BESTAETIGUNG,
  FELD,
  FELD_LABEL,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_HAUPT,
  KNOPF_NEBEN,
  MELDUNG_FEHLER,
  MELDUNG_HINWEIS,
} from "./gestaltung";

export const AUFNAHME_MARKE = "ga-aufnahme";

/** Ab so vielen Zeichen wird gesucht — dieselbe Schwelle wie die Zielsuche der Wissensbeziehungen. */
export const SUCHE_MINDESTLAENGE = 2;

/** So viele Treffer stehen höchstens da; mehr heisst: Begriff verfeinern. */
const TREFFER_HOECHSTENS = 20;

/** Der gewählte Eintrag — nur, was die Fläche zum Anzeigen und Absenden braucht. */
interface Gewaehlt {
  readonly id: string;
  readonly titel: string;
  /** Die heutige Fassung laut Suchtreffer — nur zur Kennzeichnung „aktuell", nie als Vorauswahl. */
  readonly aktuelleFassung: number;
}

/**
 * Die Fassungen aus einer Antwort — neueste zuerst, oder `undefined`, wenn die Antwort keine trägt.
 *
 * `undefined` heisst UNBEKANNT und nicht „keine Fassung": dieselbe Trennung wie `bestandAus` in
 * `GesamtanweisungBereich.tsx`.
 */
export function fassungenAus(antwort: unknown): KoVersionSnapshot[] | undefined {
  if (!Array.isArray(antwort)) {
    return undefined;
  }
  return (antwort as KoVersionSnapshot[])
    .filter((satz) => Number.isInteger(satz?.version) && satz.version > 0)
    .sort((a, b) => b.version - a.version);
}

/** Hat der Server den Zugang zu diesem Eintrag abgesagt (403) oder kennt er ihn nicht (mehr, 404)? */
function istZugangAbgesagt(fehler: unknown): boolean {
  return fehler instanceof ApiError && (fehler.status === 403 || fehler.status === 404);
}

/**
 * FE-001 E4 · Hat der LETZTE Abruf der Fassungen eine Zugangsabsage gebracht — egal, was noch im
 * Zwischenspeicher liegt?
 *
 * Befund der Cache-403-Gegenprobe (27.09.2026): react-query behält bei einem gescheiterten
 * Auffrischen die alten Daten. Die Fläche fragte den Fehler aber nur ab, wenn KEINE Daten da waren —
 * mit gemerkten Fassungen blieben Wahl, Vorschau und Aufnahme nach einer 403 bedienbar, nach einem
 * Reload dagegen gesperrt. Beide Lagen müssen gleich aussehen: eine Absage des Servers schlägt jeden
 * gemerkten Stand.
 *
 * `failureReason` mit dazu: er steht schon nach dem ERSTEN gescheiterten Versuch, während die
 * automatische Wiederholung noch läuft. Sonst bliebe die alte Wahl für diese Spanne bedienbar.
 * `error` bleibt beim erneuten Laden stehen, bis ein Abruf gelingt — erst dann wird wieder frei.
 */
function zugangAbgesagt(abfrage: {
  readonly error: unknown;
  readonly failureReason: unknown;
}): boolean {
  return istZugangAbgesagt(abfrage.error) || istZugangAbgesagt(abfrage.failureReason);
}

/** Eigener Schlüssel außerhalb von `["ko", …]`, damit kein Auffrischen der Eintragsdaten ihn trifft. */
function zugangsabsageSchluessel(id: string): readonly unknown[] {
  return ["fe001", "fassungen-zugangsabsage", id];
}

/**
 * Zeitpunkt der letzten Zugangsabsage für die Fassungen eines Eintrags, gemerkt im QueryClient.
 * Nie abgerufen (`enabled: false`) — nur per `setQueryData` gesetzt; `null` = keine Absage.
 * Unbegrenzt gehalten: eine Marke, die vor den gemerkten Fassungen verfällt, gäbe diese frei.
 */
function useZugangsabsage(id: string) {
  return useQuery<number | null>({
    queryKey: zugangsabsageSchluessel(id),
    queryFn: () => null,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

/** Warum die Fassungen nicht kamen — als i18n-Schlüssel. */
function fassungsFehlerSchluessel(fehler: unknown): string {
  if (istZugangAbgesagt(fehler)) {
    return "fe001.auswahl.fassungenVerborgen";
  }
  return istOhneVerbindung(fehler) ? "ga.offline" : "fe001.auswahl.fassungenFehler";
}

/** Ein kurzer Klartextauszug für die Trefferzeile — nie HTML, nie länger als eine Zeile Lesestoff. */
function auszug(eintrag: KnowledgeObject): string {
  const text = (eintrag.statement ?? "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function Treffer({
  suchbegriff,
  gewaehltId,
  gewaehltAbgesagt,
  waehle,
}: {
  suchbegriff: string;
  gewaehltId: string | null;
  /** Der Server hat die Fassungen des gewählten Eintrags abgesagt — dann kein „wähle unten". */
  gewaehltAbgesagt: boolean;
  waehle: (eintrag: Gewaehlt) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const bereit = suchbegriff.length >= SUCHE_MINDESTLAENGE;
  const suche = useLibrarySearch({ q: suchbegriff }, bereit);

  if (suchbegriff.length === 0) {
    return null;
  }
  if (!bereit) {
    return (
      <p className={HINWEIS} data-testid={`${AUFNAHME_MARKE}-suche-kurz`}>
        {t("fe001.auswahl.zuKurz", { anzahl: SUCHE_MINDESTLAENGE })}
      </p>
    );
  }
  // ZUERST der Fehler, dann „lädt": ein erneuter Versuch nach einem Fehler kann beides wahr machen,
  // und „sucht noch" verschwiege den eingetretenen Ausfall (dieselbe Reihenfolge wie `anzeigelage`).
  if (suche.data === undefined && suche.isError) {
    return (
      <div role="alert" className={MELDUNG_FEHLER} data-testid={`${AUFNAHME_MARKE}-suche-fehler`}>
        <p>{t(istOhneVerbindung(suche.error) ? "ga.offline" : "fe001.auswahl.sucheFehler")}</p>
        <button
          type="button"
          className={`${KNOPF_NEBEN} mt-2`}
          onClick={() => void suche.refetch()}
        >
          {t("fe001.auswahl.erneutSuchen")}
        </button>
      </div>
    );
  }
  if (suche.data === undefined) {
    return (
      <p aria-live="polite" className={HINWEIS} data-testid={`${AUFNAHME_MARKE}-suche-laedt`}>
        {t("fe001.auswahl.sucheLaeuft")}
      </p>
    );
  }
  const liste = Array.isArray(suche.data) ? suche.data : [];
  // RUNDE 3 (Bens Befund E4): eine GESCHEITERTE Auffrischung neben erhaltenen Treffern bleibt
  // sichtbar. Die Treffer bleiben stehen (sie sind der letzte bekannte Stand), aber sie werden nicht
  // als frisch ausgegeben — dieselbe Regel wie im Lesestand (Lehre 03.09., JOB 3027/3025/3037).
  const auffrischungGescheitert = suche.isError ? (
    <div
      role="alert"
      className={MELDUNG_FEHLER}
      data-testid={`${AUFNAHME_MARKE}-suche-auffrischung-fehler`}
    >
      <p>
        {t(istOhneVerbindung(suche.error) ? "ga.offline" : "fe001.auswahl.sucheAuffrischungFehler")}
      </p>
      <button type="button" className={`${KNOPF_NEBEN} mt-2`} onClick={() => void suche.refetch()}>
        {t("fe001.auswahl.erneutSuchen")}
      </button>
    </div>
  ) : null;
  if (liste.length === 0) {
    return (
      <div className="space-y-2">
        {auffrischungGescheitert}
        <p className={HINWEIS} data-testid={`${AUFNAHME_MARKE}-suche-leer`} aria-live="polite">
          {t("fe001.auswahl.keineTreffer", { begriff: suchbegriff })}
        </p>
      </div>
    );
  }
  const gezeigt = liste.slice(0, TREFFER_HOECHSTENS);
  return (
    <div className="space-y-2">
      {auffrischungGescheitert}
      <p className={HINWEIS} aria-live="polite" data-testid={`${AUFNAHME_MARKE}-suche-anzahl`}>
        {t("fe001.auswahl.trefferAnzahl", { count: liste.length })}
        {liste.length > gezeigt.length ? ` ${t("fe001.auswahl.mehrTreffer")}` : ""}
      </p>
      <ul className="space-y-1.5" data-testid={`${AUFNAHME_MARKE}-treffer`}>
        {gezeigt.map((eintrag) => {
          const aktiv = eintrag.id === gewaehltId;
          return (
            <li key={eintrag.id}>
              <button
                type="button"
                aria-pressed={aktiv}
                data-testid={`${AUFNAHME_MARKE}-treffer-eintrag`}
                data-ko={eintrag.id}
                onClick={() =>
                  waehle({
                    id: eintrag.id,
                    titel: eintrag.title,
                    aktuelleFassung: eintrag.version,
                  })
                }
                className={`w-full rounded-btn border px-3 py-2 text-left hover:bg-hairline-soft ${
                  aktiv ? "border-ink/40 bg-hairline-soft" : "border-hairline bg-surface"
                }`}
              >
                <span className="block text-[13px] font-semibold text-text">{eintrag.title}</span>
                {auszug(eintrag) ? (
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                    {auszug(eintrag)}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {aktiv
                    ? t(
                        gewaehltAbgesagt
                          ? "fe001.auswahl.gewaehltGesperrt"
                          : "fe001.auswahl.gewaehlt",
                      )
                    : t("fe001.auswahl.aktuelleFassung", { version: eintrag.version })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Fassungswahl({
  eintrag,
  abfrage,
  abgesagt,
  fassung,
  waehleFassung,
  gebunden,
  nameVon,
}: {
  eintrag: Gewaehlt;
  abfrage: ReturnType<typeof useKoVersions>;
  /** Zugang abgesagt und seither kein gelungener Abruf — siehe `BausteinAufnahme`. */
  abgesagt: boolean;
  fassung: number | null;
  waehleFassung: (version: number) => void;
  gebunden: readonly { koId: string; koVersion: number }[];
  nameVon: (id: string) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const fassungen = fassungenAus(abfrage.data);

  // Die Absage ZUERST und unabhängig vom Zwischenspeicher (FE-001 E4): keine Radios, keine Vorschau
  // aus gemerkten Daten, solange der Server den Zugang verweigert — und solange seit der Absage
  // kein Abruf gelungen ist.
  if (abgesagt) {
    return (
      <div
        role="alert"
        className={MELDUNG_FEHLER}
        data-testid={`${AUFNAHME_MARKE}-fassungen-fehler`}
        data-zugang="abgesagt"
      >
        <p>{t("fe001.auswahl.fassungenVerborgen")}</p>
        <button
          type="button"
          className={`${KNOPF_NEBEN} mt-2`}
          onClick={() => void abfrage.refetch()}
        >
          {t("fe001.auswahl.erneutLaden")}
        </button>
      </div>
    );
  }
  if (fassungen === undefined && (abfrage.isError || abfrage.data !== undefined)) {
    // Fehler ODER eine Antwort ohne Fassungsliste: beides heisst „unbekannt", nicht „keine".
    return (
      <div
        role="alert"
        className={MELDUNG_FEHLER}
        data-testid={`${AUFNAHME_MARKE}-fassungen-fehler`}
      >
        <p>{t(fassungsFehlerSchluessel(abfrage.error))}</p>
        <button
          type="button"
          className={`${KNOPF_NEBEN} mt-2`}
          onClick={() => void abfrage.refetch()}
        >
          {t("fe001.auswahl.erneutLaden")}
        </button>
      </div>
    );
  }
  if (fassungen === undefined) {
    return (
      <p aria-live="polite" className={HINWEIS} data-testid={`${AUFNAHME_MARKE}-fassungen-laedt`}>
        {t("fe001.auswahl.fassungenLaden")}
      </p>
    );
  }
  if (fassungen.length === 0) {
    return (
      <p className={MELDUNG_HINWEIS} data-testid={`${AUFNAHME_MARKE}-fassungen-leer`}>
        {t("fe001.auswahl.keineFassung")}
      </p>
    );
  }

  const vorschau = fassungen.find((satz) => satz.version === fassung);
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5" data-testid={`${AUFNAHME_MARKE}-fassungen`}>
        <legend className={FELD_LABEL}>
          {t("fe001.auswahl.fassungFrage", { titel: eintrag.titel })}
        </legend>
        <p className={HINWEIS}>{t("fe001.auswahl.fassungErklaerung")}</p>
        {fassungen.map((satz) => {
          const feldId = `ga-aufnahme-fassung-${satz.version}`;
          const datum = formatKoTimestamp(satz.at, i18n.language);
          const schonDa = gebunden.some(
            (b) => b.koId === eintrag.id && b.koVersion === satz.version,
          );
          return (
            <div key={satz.version} className="flex items-start gap-2">
              <input
                type="radio"
                id={feldId}
                name="ga-aufnahme-fassung"
                value={String(satz.version)}
                checked={fassung === satz.version}
                onChange={() => waehleFassung(satz.version)}
                className="mt-1"
                data-testid={`${AUFNAHME_MARKE}-fassung`}
              />
              <label htmlFor={feldId} className="text-[13px] leading-snug text-text">
                <span className="font-semibold">
                  {t("fe001.auswahl.fassungNummer", { version: satz.version })}
                </span>
                {satz.version === eintrag.aktuelleFassung ? (
                  <span className="ml-1 text-muted">{t("fe001.auswahl.aktuell")}</span>
                ) : null}
                <span className="block text-[12px] text-muted">
                  {datum ?? t("ga.baustein.fassungAmUnbekannt")}
                  {" · "}
                  {nameVon(satz.author)}
                  {schonDa ? ` · ${t("fe001.auswahl.schonEnthalten")}` : ""}
                </span>
              </label>
            </div>
          );
        })}
      </fieldset>

      {vorschau ? (
        <section
          aria-label={t("fe001.auswahl.vorschau")}
          className="rounded-card border border-hairline bg-page p-3"
          data-testid={`${AUFNAHME_MARKE}-vorschau`}
        >
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">
            {t("fe001.auswahl.vorschauVon", { version: vorschau.version })}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-text">{vorschau.snapshot?.title}</p>
          {vorschau.snapshot?.statement ? (
            <p className="mt-1 text-[13px] leading-relaxed text-text">
              {vorschau.snapshot.statement}
            </p>
          ) : null}
          {vorschau.snapshot?.bodyHtml ? (
            // Scrollbar, also per Tastatur erreichbar: eine Region, die nur mit der Maus rollt, wäre
            // für Tastaturnutzer abgeschnitten.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollbare Vorschau muss per Tastatur rollbar sein
            <div tabIndex={0} className="mt-2 max-h-56 overflow-y-auto text-[13px] leading-relaxed">
              <SanitizedHtml html={vorschau.snapshot.bodyHtml} />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function BausteinAufnahme({
  aufnehmen,
  gesperrt,
  grund,
  fehler = null,
  gebunden = [],
  nameVon,
}: {
  aufnehmen: (eingabe: {
    koId: string;
    koVersion: number;
    nachweisHash: string | null;
  }) => Promise<boolean>;
  gesperrt: boolean;
  /** Der Satz, der die Sperre erklärt. Eine Sperre ohne Grund wäre ein toter Knopf. */
  grund: string | null;
  /**
   * JOB 4233 · Der i18n-Schlüssel der letzten Absage dieses Formulars. `null` = keine.
   *
   * Er steht in einer Live-Region AM FORMULAR, weil er zur Auswahl gehört und nicht zum Lesestand.
   * Die Auswahl bleibt dabei stehen — nichts gilt als gespeichert.
   */
  fehler?: string | null;
  /** FE-001 · Was schon in der Anleitung steht — nur zur Kennzeichnung, nie als Sperre. */
  gebunden?: readonly { koId: string; koVersion: number }[];
  /** FE-001 · Namen aus dem Verzeichnis. Fehlt er, steht ein ehrlicher Ersatz statt einer Kennung. */
  nameVon?: (id: string) => string;
}): JSX.Element {
  const { t } = useTranslation();
  const [begriff, setBegriff] = useState("");
  const [gesucht, setGesucht] = useState("");
  const [gewaehlt, setGewaehlt] = useState<Gewaehlt | null>(null);
  const [fassung, setFassung] = useState<number | null>(null);
  const [nachweis, setNachweis] = useState("");
  const [bestaetigt, setBestaetigt] = useState<{ titel: string; version: number } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const namen = nameVon ?? (() => t("ko.authorUnavailable"));
  const queryClient = useQueryClient();
  // Hier und nicht in `Fassungswahl`: ob der Server den Zugang abgesagt hat, entscheidet auch über
  // den Aufnahmeknopf und seinen Sperrsatz. Leere Kennung = abgeschaltet (`enabled` im Hook).
  const fassungsAbfrage = useKoVersions(gewaehlt?.id ?? "");
  const jetztAbgesagt = gewaehlt !== null && zugangAbgesagt(fassungsAbfrage);

  // Je Eintrag: wann der Server zuletzt abgesagt hat. Die Absage gilt, bis danach ein Abruf GELINGT
  // (`dataUpdatedAt` jünger als die Absage). Ben-Befund Lauf 2: nach 403 → 500 zählte nur noch der
  // 500-Fehler, und die gemerkten Fassungen waren wieder wählbar. Ein gescheiterter Versuch ist
  // keine Bestätigung des Zugangs; allgemeine 500-Regeln legt das nicht fest.
  //
  // Die Marke liegt im QueryClient neben den gemerkten Fassungen, nicht im Komponentenzustand
  // (Ben-Befund Lauf 3, Runde 1): sonst ging sie beim erneuten Öffnen der Auswahl verloren, während
  // der Zwischenspeicher die alten Fassungen weiter anbot. So leben Marke und Fassungen gleich lang.
  const absageMarke = useZugangsabsage(gewaehlt?.id ?? "");
  const absageSeit = absageMarke.data ?? undefined;
  const nochAbgesagt = absageSeit !== undefined && fassungsAbfrage.dataUpdatedAt <= absageSeit;
  const abgesagt = jetztAbgesagt || nochAbgesagt;

  useEffect(() => {
    if (jetztAbgesagt && gewaehlt && !nochAbgesagt) {
      queryClient.setQueryData<number>(zugangsabsageSchluessel(gewaehlt.id), Date.now());
    }
  }, [jetztAbgesagt, nochAbgesagt, gewaehlt, queryClient]);

  // Eine vor der Absage getroffene Wahl gilt nicht weiter: nach einem wieder erfolgreichen Abruf
  // muss die Fassung erneut BEWUSST gewählt werden (FE-001 E4).
  useEffect(() => {
    if (abgesagt) {
      setFassung(null);
      setBestaetigt(null);
    }
  }, [abgesagt]);

  function suchen(event: FormEvent): void {
    event.preventDefault();
    const neu = begriff.trim();
    // Derselbe Begriff noch einmal heisst „noch einmal nachsehen" — nicht „nichts tun". Sonst
    // bliebe ein gescheiterter oder veralteter Stand stehen, obwohl der Mensch neu gesucht hat.
    if (neu === gesucht) {
      void queryClient.invalidateQueries({ queryKey: ["library", "search", { q: neu }] });
    }
    setGesucht(neu);
    setBestaetigt(null);
  }

  function waehle(eintrag: Gewaehlt): void {
    setGewaehlt(eintrag);
    // Eine andere Wahl ist eine neue Entscheidung: die Fassung des vorigen Eintrags gilt nicht mit.
    if (eintrag.id !== gewaehlt?.id) {
      setFassung(null);
    }
    setBestaetigt(null);
  }

  const bereit = gewaehlt !== null && fassung !== null && !abgesagt;

  async function absenden(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!gewaehlt || fassung === null || abgesagt || gesperrt || laeuft) {
      return;
    }
    setLaeuft(true);
    const erfolg = await aufnehmen({
      koId: gewaehlt.id,
      koVersion: fassung,
      nachweisHash: nachweis.trim().length > 0 ? nachweis.trim() : null,
    });
    setLaeuft(false);
    // NUR nach bestätigtem Erfolg leeren. Scheitert der Aufruf, steht die Auswahl noch da.
    if (erfolg) {
      setBestaetigt({ titel: gewaehlt.titel, version: fassung });
      setGewaehlt(null);
      setFassung(null);
      setNachweis("");
    }
  }

  // Warum der Aufnahmeknopf gerade nicht geht — immer als Satz, nie als stummer grauer Knopf.
  const sperrSatz = gesperrt
    ? grund
    : gewaehlt === null
      ? "fe001.auswahl.sperreEintrag"
      : abgesagt
        ? "fe001.auswahl.sperreZugriff"
        : fassung === null
          ? "fe001.auswahl.sperreFassung"
          : null;

  return (
    <section data-testid={AUFNAHME_MARKE} aria-labelledby="ga-aufnahme-titel" className={KARTE}>
      <h2 id="ga-aufnahme-titel" className={KARTEN_TITEL}>
        {t("ga.aufnahme.titel")}
      </h2>
      <p className={HINWEIS}>{t("fe001.auswahl.einleitung")}</p>

      <form onSubmit={suchen} data-testid={`${AUFNAHME_MARKE}-suche-form`}>
        <label htmlFor="ga-aufnahme-suche" className={FELD_LABEL}>
          {t("fe001.auswahl.sucheLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="ga-aufnahme-suche"
            name="suche"
            type="search"
            value={begriff}
            onChange={(e) => setBegriff(e.target.value)}
            aria-describedby="ga-aufnahme-suche-hinweis"
            className={`${FELD} min-w-0 flex-1 basis-56`}
          />
          <button type="submit" className={`${KNOPF_NEBEN} mt-1 min-h-9`}>
            {t("fe001.auswahl.suchen")}
          </button>
        </div>
        <p id="ga-aufnahme-suche-hinweis" className={`${HINWEIS} mt-1`}>
          {t("fe001.auswahl.sucheHinweis")}
        </p>
      </form>

      <Treffer
        suchbegriff={gesucht}
        gewaehltId={gewaehlt?.id ?? null}
        gewaehltAbgesagt={abgesagt}
        waehle={waehle}
      />

      <form
        onSubmit={absenden}
        className="space-y-3 border-t border-hairline pt-3"
        data-testid={`${AUFNAHME_MARKE}-bestaetigen`}
      >
        {gewaehlt ? (
          <Fassungswahl
            eintrag={gewaehlt}
            abfrage={fassungsAbfrage}
            abgesagt={abgesagt}
            fassung={fassung}
            waehleFassung={(version) => {
              setFassung(version);
              setBestaetigt(null);
            }}
            gebunden={gebunden}
            nameVon={namen}
          />
        ) : (
          <p className={HINWEIS} data-testid={`${AUFNAHME_MARKE}-nichts-gewaehlt`}>
            {t("fe001.auswahl.nochNichts")}
          </p>
        )}

        <details className="text-[12.5px]">
          <summary className="cursor-pointer font-semibold text-muted">
            {t("fe001.auswahl.fachleute")}
          </summary>
          <div className="mt-2">
            <label htmlFor="ga-aufnahme-nachweis" className={FELD_LABEL}>
              {t("ga.aufnahme.nachweis")}
            </label>
            <input
              id="ga-aufnahme-nachweis"
              name="nachweisHash"
              value={nachweis}
              onChange={(e) => setNachweis(e.target.value)}
              aria-describedby="ga-aufnahme-nachweis-hinweis"
              className={FELD}
            />
            <p id="ga-aufnahme-nachweis-hinweis" className={`${HINWEIS} mt-1`}>
              {t("fe001.auswahl.nachweisHinweis")}
            </p>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={KNOPF_HAUPT}
            disabled={!bereit || gesperrt || laeuft}
            aria-describedby={sperrSatz ? "ga-aufnahme-sperre" : undefined}
            data-testid={`${AUFNAHME_MARKE}-knopf`}
          >
            {bereit && gewaehlt && fassung !== null
              ? t("fe001.auswahl.aufnehmenMit", { version: fassung })
              : t("fe001.auswahl.aufnehmen")}
          </button>
          {sperrSatz ? (
            <p
              id="ga-aufnahme-sperre"
              className={HINWEIS}
              data-testid={`${AUFNAHME_MARKE}-sperre`}
              {...(gesperrt || abgesagt ? { role: "alert" } : {})}
            >
              {t(sperrSatz)}
            </p>
          ) : null}
        </div>
        <div aria-live="polite">
          {bestaetigt ? (
            <p className={BESTAETIGUNG} data-testid={`${AUFNAHME_MARKE}-erfolg`}>
              {t("fe001.auswahl.aufgenommen", {
                titel: bestaetigt.titel,
                version: bestaetigt.version,
              })}
            </p>
          ) : null}
        </div>
        {fehler ? (
          <p role="alert" className={MELDUNG_FEHLER} data-testid={`${AUFNAHME_MARKE}-fehler`}>
            {t(fehler)}
          </p>
        ) : null}
      </form>
    </section>
  );
}
