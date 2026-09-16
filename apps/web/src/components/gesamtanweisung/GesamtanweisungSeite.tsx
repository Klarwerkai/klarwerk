// ==================================================================================================
// JOB 4154 · DIE FLÄCHE — AUFNEHMEN, ORDNEN, LESEN, VERGLEICHEN, VORLEGEN. OHNE KI.
// ==================================================================================================
//
// Der ganze Weg eines Menschen an EINER Stelle. Sie hält den Zustand der Bedienung (was ist gewählt,
// was wurde zuletzt versucht) und reicht die Daten an vier rein darstellende Bauteile weiter — die
// sind deshalb einzeln und ohne Netz prüfbar.
//
// NOCH NICHT IN DER APP ERREICHBAR: `apps/web/src/routes.tsx` gehört dem Nachfolger
// WIKI-GESAMTANWEISUNG-ANSCHLUSS. Diese Fläche ist fertig und angebunden an den Draht; bis der
// Nachfolger gelaufen ist, führt kein Menüpunkt hierher, und niemand meldet „in der App erreichbar".
//
// DIE VERSION REIST MIT JEDEM SCHREIBWEG. Sie kommt aus dem zuletzt GELESENEN Stand, nicht aus einer
// eigenen Zählung: der Server bestätigt nur genau den unverändert vorgelegten Prüfstand, und eine
// selbst hochgezählte Nummer wäre eine Behauptung über einen Bestand, den diese Fläche nicht kennt.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BausteinAufnahme } from "./BausteinAufnahme";
import { EntscheidungsVorlage } from "./EntscheidungsVorlage";
import { LesestandAnsicht } from "./LesestandAnsicht";
import { VergleichAnsicht } from "./VergleichAnsicht";
import {
  aufnahmeFehlerSchluessel,
  fehlerSchluessel,
  istOhneVerbindung,
  istUnbekannteFassung,
} from "./api";
import {
  useAnweisung,
  useAnweisungStaende,
  useAnweisungVergleich,
  useBausteinAufnehmen,
  useEntscheiden,
  useReihenfolgeSetzen,
  useVoraussetzungSetzen,
  useVorlegen,
} from "./hooks";
import { anzeigelage, entscheidungSperre, lesestandLeer, schreibSperre } from "./zustand";

export const SEITE_MARKE = "ga-seite";

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
  offline = false,
}: {
  anweisungId: string;
  darfEntscheiden: boolean;
  /** Ausdrücklich übergeben statt geraten — die Hülle weiss es, dieses Bauteil nicht. */
  offline?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const anweisung = useAnweisung(anweisungId);
  const staende = useAnweisungStaende(anweisungId);
  const [von, setVon] = useState<number | null>(null);
  const [bis, setBis] = useState<number | null>(null);
  const vergleich = useAnweisungVergleich(anweisungId, von, bis);

  const aufnehmen = useBausteinAufnehmen(anweisungId);
  const ordnen = useReihenfolgeSetzen(anweisungId);
  const voraussetzung = useVoraussetzungSetzen(anweisungId);
  const vorlegen = useVorlegen(anweisungId);
  const entscheiden = useEntscheiden(anweisungId);

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
      laedt: vergleich.isLoading && von !== null && bis !== null,
      fehler: vergleich.error,
      aktualisiert: vergleich.isFetching,
      offline,
    },
    () => false,
  );
  // ZWEI SPERREN, nicht eine: auf der leeren Anweisung darf man BEARBEITEN (sonst käme nie ein
  // erster Baustein hinein), aber nicht VORLEGEN (es gäbe nichts zu entscheiden).
  const bearbeiten = schreibSperre(lage);
  const sperre = entscheidungSperre(lage);

  const stand = anweisung.data;
  const version = stand?.version ?? null;
  // JOB 4233: die Absage „diese Fassung gibt es nicht" gehört ANS FORMULAR und nicht in die
  // Entscheidungsvorlage — dort stünde sie neben „Vorlegen" und sagte einem Menschen, der gerade
  // gar nichts vorlegt, etwas über seinen Tippfehler. Jeder andere Aufnahmefehler (403, Konflikt,
  // offline) bleibt wie bisher auch dort sichtbar.
  const aufnahmeFehler = aufnehmen.error ?? null;
  const letzterFehler =
    entscheiden.error ??
    vorlegen.error ??
    voraussetzung.error ??
    ordnen.error ??
    (istUnbekannteFassung(aufnahmeFehler) ? null : aufnahmeFehler) ??
    null;

  return (
    <div data-testid={SEITE_MARKE}>
      <h1>{t("ga.titel")}</h1>
      {offline || istOhneVerbindung(anweisung.error) ? (
        <p role="alert" data-testid={`${SEITE_MARKE}-offline`}>
          {t("ga.offline")}
        </p>
      ) : null}

      <LesestandAnsicht
        lage={lage}
        stand={stand}
        zeit={stand?.geaendertAm ?? ""}
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
        }}
      />

      <BausteinAufnahme
        gesperrt={version === null || bearbeiten.gesperrt}
        grund={bearbeiten.grund}
        fehler={aufnahmeFehler ? aufnahmeFehlerSchluessel(aufnahmeFehler) : null}
        aufnehmen={async (eingabe) => {
          if (version === null) {
            return false;
          }
          try {
            await aufnehmen.mutateAsync({ version, ...eingabe });
            return true;
          } catch {
            // Die Eingabe bleibt stehen — nichts gilt als gespeichert.
            return false;
          }
        }}
      />

      <VergleichAnsicht
        lage={vergleichslage}
        vergleich={vergleich.data}
        staende={staende.data?.staende ?? []}
        von={von}
        bis={bis}
        waehleVon={setVon}
        waehleBis={setBis}
      />

      <EntscheidungsVorlage
        stand={stand?.stand ?? "entwurf"}
        sperre={sperre}
        darfEntscheiden={darfEntscheiden}
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
    </div>
  );
}
