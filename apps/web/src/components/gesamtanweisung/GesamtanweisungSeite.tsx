// ==================================================================================================
// JOB 4154 · DIE FLÄCHE — AUFNEHMEN, ORDNEN, LESEN, VERGLEICHEN, VORLEGEN. OHNE KI.
// ==================================================================================================
//
// Der ganze Weg eines Menschen an EINER Stelle. Sie hält den Zustand der Bedienung (was ist gewählt,
// was wurde zuletzt versucht) und reicht die Daten an vier rein darstellende Bauteile weiter — die
// sind deshalb einzeln und ohne Netz prüfbar.
//
// IN DER APP ERREICHBAR über `/gesamtanweisungen/:id` (`routes.tsx`, Hülle `GesamtanweisungBereich`)
// — der frühere Vermerk „noch nicht erreichbar" ist seit JOB 4156/4309 überholt.
//
// FE-001 · NUTZERSEITIG HEISST DAS „ARBEITSANLEITUNG". (Der Weg zurück zur Übersicht und die
// Seitenhilfe stehen in der Hülle: diese Fläche bleibt ohne Router montierbar.) Route, Kennungen und Drahtvertrag bleiben
// „gesamtanweisung"; geändert haben sich Texte, Gliederung und Bedienung. Die Seite beginnt jetzt mit
// dem Titel der Anleitung, einem Weg zurück zur Übersicht und den vier Schritten in der Reihenfolge,
// in der ein neuer Mensch sie geht: beschreiben → Abschnitte hinzufügen → lesen und ordnen →
// vorlegen. Namen kommen aus dem Verzeichnis (`useAuthorName`), Zeiten über `formatKoTimestamp`.
//
// DIE VERSION REIST MIT JEDEM SCHREIBWEG. Sie kommt aus dem zuletzt GELESENEN Stand, nicht aus einer
// eigenen Zählung: der Server bestätigt nur genau den unverändert vorgelegten Prüfstand, und eine
// selbst hochgezählte Nummer wäre eine Behauptung über einen Bestand, den diese Fläche nicht kennt.
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { formatKoTimestamp } from "../../lib/koDates";
import { useAuthorName } from "../../lib/useAuthorName";
import { BausteinAufnahme } from "./BausteinAufnahme";
import { EntscheidungsVorlage, FreigabeStatus } from "./EntscheidungsVorlage";
import { KopfBearbeitung } from "./KopfBearbeitung";
import { LesestandAnsicht } from "./LesestandAnsicht";
import { VergleichAnsicht, vergleichsauswahl } from "./VergleichAnsicht";
import {
  aufnahmeFehlerSchluessel,
  fehlerSchluessel,
  istOhneVerbindung,
  istUnbekannteFassung,
} from "./api";
import { HINWEIS, MELDUNG_FEHLER } from "./gestaltung";
import {
  useAnweisung,
  useAnweisungStaende,
  useAnweisungVergleich,
  useBausteinAufnehmen,
  useEntscheiden,
  useFassungUebernehmen,
  useKopfAendern,
  useReihenfolgeSetzen,
  useVoraussetzungSetzen,
  useVorlegen,
} from "./hooks";
import {
  type Freigaberechte,
  type Sperre,
  anzeigelage,
  entscheidungSperre,
  lesestandLeer,
  schreibSperre,
} from "./zustand";

export const SEITE_MARKE = "ga-seite";

/**
 * FE-001 · Eine ENTSCHIEDENE Anleitung wird nicht mehr geändert (`nurAenderbar`,
 * `gesamtanweisung-service.ts`). Bisher bot die Fläche trotzdem Aufnehmen und Ordnen an, und erst der
 * Server sagte nein — mit dem Konfliktsatz „zwischenzeitlich geändert", der hier nicht zutrifft. Die
 * Sperre steht jetzt VOR dem Versuch, mit dem wirklichen Grund. Die Regel bleibt die des Servers.
 */
function mitStandsperre(sperre: Sperre, stand: string | undefined): Sperre {
  if (!sperre.gesperrt && stand === "entschieden") {
    return { gesperrt: true, grund: "fe001.sperre.entschieden" };
  }
  return sperre;
}

/**
 * PRÜFSTATUS-ANZEIGE (Ben R1, BEN-01) · Ohne `ko.create` nimmt der Server KEINEN Schreibweg dieser
 * Fläche an (`gesamtanweisung-routes.ts`: Kopf, Aufnehmen, Ordnen, Voraussetzung, Vorlegen). Die
 * Fläche bot sie trotzdem an, während der Statusblock „nur lesen" sagte. Die Sperre steht jetzt
 * VOR dem Versuch, mit dem wirklichen Grund. Die Regel bleibt die des Servers.
 */
function mitRechtesperre(sperre: Sperre, darfVorlegen: boolean): Sperre {
  if (!sperre.gesperrt && !darfVorlegen) {
    return { gesperrt: true, grund: "fe001.sperre.keinErfassungsrecht" };
  }
  return sperre;
}

/**
 * Die neue Folge nach einem Schritt nach oben oder unten.
 *
 * Rein und hier, weil sie zum Zustand dieser Fläche gehört: am Rand passiert NICHTS (der erste
 * Baustein kann nicht höher). Ein stillschweigendes Herumwandern wäre eine Änderung, die niemand
 * angeordnet hat.
 */
export function verschobeneFolge(
  ids: readonly string[],
  bausteinId: string,
  richtung: -1 | 1,
): string[] {
  const index = ids.indexOf(bausteinId);
  const ziel = index + richtung;
  if (index < 0 || ziel < 0 || ziel >= ids.length) {
    return [...ids];
  }
  const neu = [...ids];
  const [heraus] = neu.splice(index, 1);
  neu.splice(ziel, 0, heraus as string);
  return neu;
}

export function GesamtanweisungSeite({
  anweisungId,
  darfEntscheiden,
  darfVorlegen = true,
  offline = false,
}: {
  anweisungId: string;
  darfEntscheiden: boolean;
  /**
   * PRÜFSTATUS-ANZEIGE · das Vorlegerecht (`ko.create`) — es bestimmt nur den ERKLÄRTEN nächsten
   * Schritt. Ohne Angabe gilt das bisherige Verhalten dieser Fläche (Vorlegen wird angeboten); die
   * Hülle `GesamtanweisungBereich` übergibt es aus der Rolle.
   */
  darfVorlegen?: boolean;
  /** Ausdrücklich übergeben statt geraten — die Hülle weiss es, dieses Bauteil nicht. */
  offline?: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const nameVon = useAuthorName();
  const anweisung = useAnweisung(anweisungId);
  const staende = useAnweisungStaende(anweisungId);
  const [von, setVon] = useState<number | null>(null);
  const [bis, setBis] = useState<number | null>(null);
  const staendeListe = Array.isArray(staende.data?.staende) ? staende.data.staende : undefined;
  const auswahl = vergleichsauswahl({
    staende: staendeListe,
    staendeFehler: staende.isError,
    staendeLaeuft: staende.fetchStatus === "fetching",
    offline,
    von,
    bis,
  });
  // Abgefragt wird NUR, wenn wirklich zwei verschiedene Stände gewählt sind — sonst gäbe es keinen
  // Abruf, und die Ansicht darf auch kein „Lädt …" zeigen (FE-001, `VergleichAnsicht.tsx`).
  const vergleich = useAnweisungVergleich(
    anweisungId,
    auswahl === "bereit" ? von : null,
    auswahl === "bereit" ? bis : null,
  );

  const aufnehmen = useBausteinAufnehmen(anweisungId);
  const ordnen = useReihenfolgeSetzen(anweisungId);
  const voraussetzung = useVoraussetzungSetzen(anweisungId);
  const vorlegen = useVorlegen(anweisungId);
  const entscheiden = useEntscheiden(anweisungId);
  const kopfAendern = useKopfAendern(anweisungId);
  const uebernehmen = useFassungUebernehmen(anweisungId);

  const lage = anzeigelage(
    {
      daten: anweisung.data,
      laedt: anweisung.isLoading,
      fehler: anweisung.error,
      aktualisiert: anweisung.isFetching,
      offline,
    },
    lesestandLeer,
  );
  const vergleichslage = anzeigelage(
    {
      daten: vergleich.data,
      laedt: vergleich.isLoading && auswahl === "bereit",
      fehler: vergleich.error,
      aktualisiert: vergleich.isFetching,
      offline,
    },
    () => false,
  );
  const stand = anweisung.data;
  // ZWEI SPERREN, nicht eine: auf der leeren Anweisung darf man BEARBEITEN (sonst käme nie ein
  // erster Baustein hinein), aber nicht VORLEGEN (es gäbe nichts zu entscheiden).
  const bearbeiten = mitRechtesperre(
    mitStandsperre(schreibSperre(lage), stand?.stand),
    darfVorlegen,
  );
  // RUNDE 2 (E8): ungespeicherte Kopfangaben sperren Vorlegen und Entscheiden — vorgelegt würde
  // sonst ein Stand, der nicht der ist, den der Mensch gerade vor sich sieht.
  const [kopfUngespeichert, setKopfUngespeichert] = useState(false);
  // LAUF 4 (Bens Befund BEN-02, E8): dasselbe gilt für eine noch nicht übernommene Voraussetzung
  // eines Abschnitts. Gemerkt wird je Abschnitt, damit ein zweites Feld das erste nicht freigibt.
  // (Bewusst ein Eintrag je Abschnitt statt einer Mengenregel: die gibt es schon in
  // `bibliothek/MehrAbschnitte.tsx`, und eine Abschrift stünde als Fremddoppelung im Register.)
  const [offeneVoraussetzungen, setOffeneVoraussetzungen] = useState<
    Readonly<Record<string, boolean>>
  >({});
  const meldeVoraussetzung = useCallback((bausteinId: string, ungespeichert: boolean) => {
    setOffeneVoraussetzungen((bisher) =>
      (bisher[bausteinId] ?? false) === ungespeichert
        ? bisher
        : { ...bisher, [bausteinId]: ungespeichert },
    );
  }, []);
  const voraussetzungOffen = Object.values(offeneVoraussetzungen).some(Boolean);
  const grundsperre = entscheidungSperre(lage);
  // RUNDE 3 (E8): wer nicht alle Abschnitte sieht, legt nicht das Ganze vor. Die Rechteregel
  // bleibt die des Servers; hier steht nur der sichtbare Grund VOR dem Versuch.
  const unvollstaendig =
    anweisung.data !== undefined &&
    (anweisung.data.unvollstaendig || anweisung.data.verborgeneBausteine > 0);
  const sperre: Sperre = grundsperre.gesperrt
    ? grundsperre
    : unvollstaendig
      ? { gesperrt: true, grund: "fe001.sperre.unvollstaendig" }
      : kopfUngespeichert
        ? { gesperrt: true, grund: "fe001.sperre.kopfUngespeichert" }
        : voraussetzungOffen
          ? { gesperrt: true, grund: "fe001.sperre.voraussetzungUngespeichert" }
          : grundsperre;

  const version = stand?.version ?? null;
  // Ein Objekt je Lesestand, nicht je Zeichnung: sonst übernähme die Kopfbearbeitung bei jedem
  // Zeichnen denselben Stand erneut.
  const kopf = useMemo(
    () =>
      stand
        ? {
            titel: stand.titel,
            zweck: stand.zweck,
            geltungsbereich: stand.geltungsbereich,
            voraussetzungen: stand.voraussetzungen,
          }
        : null,
    [stand],
  );
  // JOB 4233: die Absage „diese Fassung gibt es nicht" gehört ANS FORMULAR und nicht in die
  // Entscheidungsvorlage — dort stünde sie neben „Vorlegen" und sagte einem Menschen, der gerade
  // gar nichts vorlegt, etwas über seinen Tippfehler. Jeder andere Aufnahmefehler (403, Konflikt,
  // offline) bleibt wie bisher auch dort sichtbar.
  const aufnahmeFehler = aufnehmen.error ?? null;
  const letzterFehler =
    entscheiden.error ??
    uebernehmen.error ??
    vorlegen.error ??
    voraussetzung.error ??
    ordnen.error ??
    (istUnbekannteFassung(aufnahmeFehler) ? null : aufnahmeFehler) ??
    null;
  const geaendertAm = stand ? formatKoTimestamp(stand.geaendertAm, i18n.language) : null;
  const rechte: Freigaberechte = { darfVorlegen, darfEntscheiden };
  // LESEN-INHALT-ZUERST · Eine FREIGEGEBENE Anleitung („entschieden") wird gelesen, nicht gebaut:
  // sie öffnet mit Titel, Status und ihrer gültigen Lesefassung. Die Entstehungsschritte, die
  // Kopfangaben, das Aufnehmen und die Entscheidung liegen danach in EINER zugeklappten Zeile
  // „Bearbeiten und Freigabe" — erreichbar und unverändert (Sperren und Rechte wie bisher), nur nicht
  // mehr VOR dem Inhalt. Der Vergleich der Stände (die Historie) bleibt offen darunter. Für Entwurf,
  // vorgelegt und abgelehnt bleibt die Arbeitsreihenfolge, wie sie ist: dort wird noch gebaut.
  const freigegeben = stand?.stand === "entschieden";

  const schritte = (
    <ol
      className={`${HINWEIS} grid gap-1 sm:grid-cols-2`}
      aria-label={t("fe001.schritte.titel")}
      data-testid={`${SEITE_MARKE}-schritte`}
    >
      <li>{t("fe001.schritte.eins")}</li>
      <li>{t("fe001.schritte.zwei")}</li>
      <li>{t("fe001.schritte.drei")}</li>
      <li>{t("fe001.schritte.vier")}</li>
    </ol>
  );

  const kopfBearbeitung = (
    <KopfBearbeitung
      kopf={kopf}
      gesperrt={bearbeiten.gesperrt || version === null}
      grund={bearbeiten.grund}
      fehler={kopfAendern.error ? fehlerSchluessel(kopfAendern.error) : null}
      meldeUngespeichert={setKopfUngespeichert}
      speichern={async (eingabe) => {
        if (version === null) {
          return false;
        }
        try {
          await kopfAendern.mutateAsync({ version, kopf: eingabe });
          return true;
        } catch {
          // Der Text bleibt im Feld — nichts gilt als gespeichert.
          return false;
        }
      }}
    />
  );

  const bausteinAufnahme = (
    <BausteinAufnahme
      gesperrt={version === null || bearbeiten.gesperrt}
      grund={bearbeiten.grund}
      fehler={aufnahmeFehler ? aufnahmeFehlerSchluessel(aufnahmeFehler) : null}
      gebunden={stand?.bausteine ?? []}
      nameVon={nameVon}
      aufnehmen={async (eingabe) => {
        if (version === null) {
          return false;
        }
        try {
          await aufnehmen.mutateAsync({ version, ...eingabe });
          return true;
        } catch {
          // Die Auswahl bleibt stehen — nichts gilt als gespeichert.
          return false;
        }
      }}
    />
  );

  const lesefassung = (
    <LesestandAnsicht
      lage={lage}
      stand={stand}
      zeit={stand?.geaendertAm ?? ""}
      nameVon={nameVon}
      bearbeiten={{
        verschieben: (bausteinId, richtung) => {
          if (version === null || !stand) {
            return;
          }
          const folge = verschobeneFolge(
            stand.bausteine.map((b) => b.id),
            bausteinId,
            richtung,
          );
          ordnen.mutate({ version, reihenfolge: folge });
        },
        voraussetzung: (bausteinId, wert) => {
          if (version !== null) {
            voraussetzung.mutate({ version, bausteinId, voraussetzung: wert });
          }
        },
        gesperrt: bearbeiten.gesperrt || version === null,
        meldeUngespeichert: meldeVoraussetzung,
      }}
      // QUELLENÄNDERUNGEN: NICHT an `bearbeiten.gesperrt` — die Standsperre „entschieden" gilt
      // dem Ordnen, nicht der bewussten Übernahme (danach ist die Anleitung wieder Entwurf).
      // Die RECHTESPERRE gilt dagegen auch hier (Ben, nacharbeit-9): die Übernahme verlangt am
      // Server `ko.create` wie jeder andere Schreibweg dieser Fläche (`gesamtanweisung-routes.ts`).
      aenderung={{
        fassungenLaden: endpoints.ko.versions,
        uebernehmen: (bausteinId, aufVersion) => {
          if (version !== null && darfVorlegen) {
            uebernehmen.mutate({ version, bausteinId, aufVersion });
          }
        },
        gesperrt:
          mitRechtesperre(schreibSperre(lage), darfVorlegen).gesperrt ||
          version === null ||
          uebernehmen.isPending,
      }}
    />
  );

  const entscheidungsVorlage = (
    <EntscheidungsVorlage
      stand={stand?.stand ?? "entwurf"}
      sperre={sperre}
      darfEntscheiden={darfEntscheiden}
      darfVorlegen={darfVorlegen}
      vorlegen={() => {
        if (version !== null) {
          vorlegen.mutate({ version });
        }
      }}
      entscheiden={(wahl) => {
        if (version !== null) {
          entscheiden.mutate({ version, entscheidung: wahl });
        }
      }}
      fehlerSatz={letzterFehler ? fehlerSchluessel(letzterFehler) : null}
    />
  );

  return (
    <div data-testid={SEITE_MARKE} className="space-y-5 pb-10">
      <header className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          {t("ga.titel")}
        </p>
        <h1
          className="hyphens-auto break-words text-2xl font-semibold text-ink"
          data-testid={`${SEITE_MARKE}-titel`}
        >
          {stand?.titel ?? t("ga.titel")}
        </h1>
        {stand ? (
          // PRÜFSTATUS-ANZEIGE: derselbe Block wie in der Übersicht (`GesamtanweisungBereich`).
          <FreigabeStatus
            marke={SEITE_MARKE}
            eingabe={{
              stand: stand.stand,
              version: stand.version,
              geaendertAm: stand.geaendertAm,
              abschnitte: stand.bausteine.length + stand.verborgeneBausteine,
              unvollstaendig,
            }}
            rechte={rechte}
          />
        ) : null}
        {stand ? (
          <p className={`${HINWEIS} flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>{t("fe001.meta.erstelltVon", { name: nameVon(stand.urheber) })}</span>
            <span aria-hidden="true">·</span>
            <span>
              {t("fe001.meta.geaendert", { zeit: geaendertAm ?? t("fe001.zeitUnbekannt") })}
            </span>
          </p>
        ) : null}
        {freigegeben ? null : schritte}
      </header>
      {offline || istOhneVerbindung(anweisung.error) ? (
        <p role="alert" className={MELDUNG_FEHLER} data-testid={`${SEITE_MARKE}-offline`}>
          {t("ga.offline")}
        </p>
      ) : null}

      {freigegeben ? (
        <>
          {lesefassung}
          <details
            data-testid={`${SEITE_MARKE}-bearbeiten`}
            className="rounded-card border border-hairline bg-surface px-4"
          >
            <summary className="cursor-pointer py-3 text-[13px] font-semibold text-text">
              {t("lesereihenfolge.anleitung.bearbeiten")}
            </summary>
            <div className="space-y-5 border-t border-hairline-soft py-4">
              {schritte}
              {kopfBearbeitung}
              {bausteinAufnahme}
              {entscheidungsVorlage}
            </div>
          </details>
        </>
      ) : (
        <>
          {kopfBearbeitung}
          {bausteinAufnahme}
          {lesefassung}
          {entscheidungsVorlage}
        </>
      )}

      <VergleichAnsicht
        lage={vergleichslage}
        vergleich={vergleich.data}
        staende={staendeListe ?? []}
        von={von}
        bis={bis}
        waehleVon={setVon}
        waehleBis={setBis}
        auswahl={auswahl}
        // LAUF 4 (BEN-01, E7): scheitert das Nachladen, obwohl eine ältere Liste im Zwischenspeicher
        // liegt, bleibt der Fehler sichtbar — neben der alten Liste, nicht an ihrer Stelle.
        staendeAuffrischungFehler={staende.isError && staendeListe !== undefined}
        abrufLaeuft={vergleich.isFetching}
        staendeNeuLaden={() => void staende.refetch()}
      />
    </div>
  );
}
