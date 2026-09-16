// ==================================================================================================
// JOB 4154 · DER LESESTAND — HERKUNFT JE BAUSTEIN, UND KEINE BEHAUPTUNG ZU VIEL.
// ==================================================================================================
//
// REIN DARSTELLEND: die Lage kommt fertig herein (`zustand.ts`), die Daten auch. Damit ist jede
// der sieben Lagen aus Abschnitt 9 einzeln prüfbar, ohne Abfrage und ohne Netz.
//
// WAS DIESE ANSICHT NIE TUT:
//   · aus der gebundenen Fassung die heutige machen — sie zeigt `koVersion`, und ein
//     Aktualisierungsvorschlag steht DANEBEN, nicht darin;
//   · beim Fehler etwas über Vollständigkeit oder Gleichheit sagen;
//   · eine unbekannte Menge als leere ausgeben (`mengenSchluessel` trennt die drei Fälle);
//   · Farbe allein sprechen lassen — jeder Zustand trägt Text.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnweisungLesestand, BausteinLesestand } from "../../api/types";
import { SanitizedHtml } from "../SanitizedHtml";
// JOB 4233: die ANZEIGE- UND STRUKTURREGELN der Gliederung kommen aus der EINEN Stelle des Hauses
// und werden nicht nachgebaut — `d44LeisteZeigen` („ohne Überschrift keine Leiste, aber KEINE
// Mindestzahl") und `d44SichtbareEintraege` („gezählt wird alles, GEZEIGT wird, was Text hat",
// `d44Struktur.ts:85-103`). NICHT geholt wird `d44Gliederung`: jene Regex liest HTML als Text, und
// genau daran sind in der Lesefläche der Bibliothek zwei Runden gescheitert
// (`bibliothek/BibliothekLesen.tsx:73-79`).
import { type D44Eintrag, d44LeisteZeigen, d44SichtbareEintraege } from "../d44Struktur";
import { VoraussetzungFeld } from "./VoraussetzungFeld";
import { type Anzeigelage, mengenSchluessel, standSchluessel } from "./zustand";

/** Was ein Baustein an Bearbeitung zulässt. Fehlt es, ist die Liste reine Lesefläche. */
export interface Bausteinbearbeitung {
  readonly verschieben: (bausteinId: string, richtung: -1 | 1) => void;
  readonly voraussetzung: (bausteinId: string, wert: string | null) => void;
  readonly gesperrt: boolean;
}

export const LESESTAND_MARKE = "ga-lesestand";

function Menge({
  schluessel,
  werte,
}: {
  schluessel: "ga.baustein.tabellen" | "ga.baustein.abbildungen";
  werte: readonly string[] | null;
}): JSX.Element {
  const { t } = useTranslation();
  const auskunft = mengenSchluessel(werte);
  return <li>{t(schluessel, { werte: auskunft.werte ?? t(auskunft.schluessel) })}</li>;
}

// ==================================================================================================
// JOB 4233 · DER TEXT DER GEBUNDENEN FASSUNG
// ==================================================================================================
//
// Bis hierher zeigte diese Ansicht Herkunft und zwei Mengen — den eigentlichen Wortlaut nicht. Eine
// Anweisung, die man nicht lesen kann, ist keine Anweisung (`recherche/pruefung/BEFUNDE.md:11`).
//
// DREI ENTSCHEIDUNGEN, jede mit Grund:
//
// 1. GEZEICHNET WIRD MIT `SanitizedHtml` — dem EINEN Ort des Hauses mit `dangerouslySetInnerHTML`
//    (`components/SanitizedHtml.tsx:17`), der die Allowlist des Hauses fährt. Ein zweiter Ort wäre
//    eine zweite Sicherheitsentscheidung über dieselbe Frage.
//
// 2. DIE GLIEDERUNG KOMMT AUS DEM GERENDERTEN BAUM, nicht aus dem HTML-String: gezählt wird, was
//    wirklich dasteht, nachdem der Sanitizer gelaufen ist. Eine Überschrift in der Leiste, die im
//    Text gar nicht mehr existiert, wäre eine Zusage ohne Gegenstand — dieselbe Naht, an der die
//    Lesefläche der Bibliothek zweimal gebrochen ist. Die REGELN (zeigen/filtern) bleiben die
//    importierten.
//
// 3. `useEffect` UND NICHT `useLayoutEffect`: diese Leiste springt nirgendwohin (Lieferung 7 —
//    reine Anzeige), ein Bildaufbau ohne sie ist also folgenlos; und `LesestandAnsicht` wird auch
//    zu Server-Markup gezeichnet (`tests/wiki-gesamtanweisung/f9-zustandsmodell.test.tsx`), wo ein
//    `useLayoutEffect` nur eine Warnung erzeugte. KEINE Abhängigkeitsliste, dafür ein Vergleich am
//    ERGEBNIS: nur wenn sich die Einträge wirklich unterscheiden, wird der Zustand gesetzt — sonst
//    liefe die Schleife weiter, und ein Merkmal („der String hat sich nicht geändert") wäre wieder
//    die Stelle, an der Baum und Leiste auseinanderlaufen.

/** Die Überschriften des gezeichneten Rumpfs, in Dokumentreihenfolge. */
function ueberschriften(knoten: HTMLElement | null): D44Eintrag[] {
  if (!knoten) {
    return [];
  }
  // Auch h1 und h4–h6: der Sanitizer bildet sie auf h2/h3 ab (`lib/richText.ts`), aber eine
  // Überschrift, die dasteht und nicht in der Leiste auftaucht, wäre eine stille Lücke.
  return [...knoten.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")].map(
    (element, position) => ({
      ebene: Number(element.tagName.slice(1)) >= 3 ? 3 : 2,
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      position,
    }),
  );
}

function eintraegeGleich(a: readonly D44Eintrag[], b: readonly D44Eintrag[]): boolean {
  return (
    a.length === b.length &&
    a.every((e, i) => e.text === b[i]?.text && e.ebene === b[i]?.ebene && e.position === i)
  );
}

function BausteinText({ rumpfHtml }: { rumpfHtml: string | null }): JSX.Element {
  const { t } = useTranslation();
  const [knoten, setKnoten] = useState<HTMLDivElement | null>(null);
  const [eintraege, setEintraege] = useState<D44Eintrag[]>([]);
  useEffect(() => {
    const frisch = ueberschriften(knoten);
    setEintraege((vorher) => (eintraegeGleich(vorher, frisch) ? vorher : frisch));
  });

  // WISSENSLÜCKE STATT ERFINDUNG: kein leerer Kasten, der wie „kein Inhalt" aussieht, und kein
  // Ausweichen auf die heutige Fassung. `null` (unbekannt) und ein Rumpf ohne Zeichen tragen
  // denselben Satz — beides heisst für den Leser: hier ist nichts belegt.
  if (rumpfHtml === null || rumpfHtml.trim().length === 0) {
    return <p data-testid={`${LESESTAND_MARKE}-text-unbelegt`}>{t("ga.baustein.textUnbelegt")}</p>;
  }
  return (
    <>
      {d44LeisteZeigen(eintraege) ? (
        <nav aria-label={t("ga.baustein.gliederung")} data-testid={`${LESESTAND_MARKE}-gliederung`}>
          <ul>
            {d44SichtbareEintraege(eintraege).map((eintrag) => (
              <li key={`${eintrag.position}-${eintrag.text}`}>{eintrag.text}</li>
            ))}
          </ul>
        </nav>
      ) : null}
      {/* REINE ANZEIGE: kein Editor, kein Feld, kein Weg zurück in den Bestand (Lieferung 7). */}
      <div ref={setKnoten} data-testid={`${LESESTAND_MARKE}-text`}>
        <SanitizedHtml html={rumpfHtml} />
      </div>
    </>
  );
}

function BausteinZeile({
  baustein,
  bearbeiten,
}: {
  baustein: BausteinLesestand;
  bearbeiten?: Bausteinbearbeitung;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-testid={`${LESESTAND_MARKE}-baustein`} data-baustein={baustein.id}>
      <p>{t("ga.baustein.fassung", { version: baustein.koVersion })}</p>
      {baustein.herkunft ? (
        <p>
          {t("ga.baustein.herkunft", {
            titel: baustein.herkunft.titel,
            autor: baustein.herkunft.autor,
          })}
          {" · "}
          {baustein.herkunft.fassungAm ?? t("ga.baustein.fassungAmUnbekannt")}
        </p>
      ) : (
        // Wissenslücke statt Erfindung: es wird NICHT auf die heutige Fassung ausgewichen.
        <p>{t("ga.baustein.herkunftUnbekannt")}</p>
      )}
      {baustein.aktualisierungsvorschlag ? (
        <p data-testid={`${LESESTAND_MARKE}-vorschlag`}>
          {t("ga.baustein.aktualisierung", {
            version: baustein.aktualisierungsvorschlag.aufVersion,
          })}
        </p>
      ) : null}
      {baustein.nachweisHash === null ? <p>{t("ga.baustein.nachweisFehlt")}</p> : null}
      {baustein.voraussetzung ? (
        <p>
          {t("ga.voraussetzung.label")}: {baustein.voraussetzung}
        </p>
      ) : null}
      <ul>
        <Menge schluessel="ga.baustein.tabellen" werte={baustein.inhalt.tabellenUeberschriften} />
        <Menge schluessel="ga.baustein.abbildungen" werte={baustein.inhalt.abbildungen} />
      </ul>
      {/* `?? null`: ein fehlendes Feld ist unbekannt, nicht leer (`api/types.ts`, `rumpfHtml`). */}
      <BausteinText rumpfHtml={baustein.rumpfHtml ?? null} />
      {bearbeiten ? (
        <>
          <p>
            <button
              type="button"
              onClick={() => bearbeiten.verschieben(baustein.id, -1)}
              disabled={bearbeiten.gesperrt}
            >
              {t("ga.ordnen.hoch")}
            </button>
            <button
              type="button"
              onClick={() => bearbeiten.verschieben(baustein.id, 1)}
              disabled={bearbeiten.gesperrt}
            >
              {t("ga.ordnen.runter")}
            </button>
          </p>
          <VoraussetzungFeld
            bausteinId={baustein.id}
            wert={baustein.voraussetzung}
            gesperrt={bearbeiten.gesperrt}
            uebernehmen={(wert) => bearbeiten.voraussetzung(baustein.id, wert)}
          />
        </>
      ) : null}
    </li>
  );
}

export function LesestandAnsicht({
  lage,
  stand,
  zeit,
  bearbeiten,
}: {
  lage: Anzeigelage;
  stand: AnweisungLesestand | undefined;
  /** Der Zeitpunkt, auf den sich der angezeigte Stand bezieht. */
  zeit: string;
  bearbeiten?: Bausteinbearbeitung;
}): JSX.Element {
  const { t } = useTranslation();

  if (lage.art === "laden") {
    // KEINE Mengen-, Vollständigkeits- oder Gleichheitsaussage — nur, dass geladen wird.
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p aria-live="polite">{t("ga.laedt")}</p>
      </section>
    );
  }

  if (lage.art === "fehler") {
    // Fehlersatz und GAR NICHTS über Vollständigkeit, Gleichheit oder Freigabe.
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
      </section>
    );
  }

  if (lage.art === "leer" || !stand) {
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p>{t("ga.leer")}</p>
      </section>
    );
  }

  const standzeile = standSchluessel(lage);
  return (
    <section data-testid={LESESTAND_MARKE}>
      <h2>{stand.titel}</h2>
      <p data-testid={`${LESESTAND_MARKE}-stand`}>{t(`ga.stand.${stand.stand}`)}</p>
      {standzeile ? <p data-testid={`${LESESTAND_MARKE}-zeit`}>{t(standzeile, { zeit })}</p> : null}
      {lage.auffrischungGescheitert || lage.offline ? (
        // Der alte Stand BLEIBT stehen und der Fehler ist trotzdem sichtbar — er wird nicht als
        // frisch ausgegeben (Lehre 03.09., JOB 3027/3025/3037).
        <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
      ) : null}
      <p>
        {t("ga.kopf.zweck")}: {stand.zweck}
      </p>
      <p>
        {t("ga.kopf.geltungsbereich")}: {stand.geltungsbereich}
      </p>
      <p>
        {t("ga.kopf.voraussetzungen")}: {stand.voraussetzungen}
      </p>
      {stand.unvollstaendig ? (
        <p data-testid={`${LESESTAND_MARKE}-unvollstaendig`} role="alert">
          {t("ga.unvollstaendig")} {t("ga.verborgene", { anzahl: stand.verborgeneBausteine })}
        </p>
      ) : null}
      {/* Der Lückenvermerk kommt vom Server und steht sichtbar — kein grüner Haken. */}
      <p data-testid={`${LESESTAND_MARKE}-pruefanbindung`}>{t("ga.pruefanbindung")}</p>
      <h3>{t("ga.bausteine")}</h3>
      {stand.bausteine.length === 0 ? (
        <p>{t("ga.leer")}</p>
      ) : (
        <ol>
          {stand.bausteine.map((baustein) => (
            <BausteinZeile
              key={baustein.id}
              baustein={baustein}
              {...(bearbeiten ? { bearbeiten } : {})}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
