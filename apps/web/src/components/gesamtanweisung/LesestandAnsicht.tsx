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
//   · Farbe allein sprechen lassen — jeder Zustand trägt Text;
//   · (FE-001) eine Kennung oder eine rohe ISO-Zeit in den Lesefluss stellen — Namen kommen aus dem
//     Verzeichnis (`nameVon`), Zeitpunkte über `formatKoTimestamp`, wie auf den Hauptseiten.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnweisungLesestand, BausteinLesestand } from "../../api/types";
import type { NameResolver } from "../../lib/koAuthor";
import { formatKoTimestamp } from "../../lib/koDates";
import { SanitizedHtml } from "../SanitizedHtml";
// JOB 4233: die ANZEIGE- UND STRUKTURREGELN der Gliederung kommen aus der EINEN Stelle des Hauses
// und werden nicht nachgebaut — `d44LeisteZeigen` („ohne Überschrift keine Leiste, aber KEINE
// Mindestzahl") und `d44SichtbareEintraege` („gezählt wird alles, GEZEIGT wird, was Text hat",
// `d44Struktur.ts:85-103`). NICHT geholt wird `d44Gliederung`: jene Regex liest HTML als Text, und
// genau daran sind in der Lesefläche der Bibliothek zwei Runden gescheitert
// (`bibliothek/BibliothekLesen.tsx:73-79`).
import { type D44Eintrag, d44LeisteZeigen, d44SichtbareEintraege } from "../d44Struktur";
import { VoraussetzungFeld } from "./VoraussetzungFeld";
import {
  CHIP,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_NEBEN,
  MELDUNG_FEHLER,
  MELDUNG_HINWEIS,
} from "./gestaltung";
import { type Anzeigelage, mengenSchluessel, standSchluessel } from "./zustand";

/** Was ein Baustein an Bearbeitung zulässt. Fehlt es, ist die Liste reine Lesefläche. */
export interface Bausteinbearbeitung {
  readonly verschieben: (bausteinId: string, richtung: -1 | 1) => void;
  readonly voraussetzung: (bausteinId: string, wert: string | null) => void;
  readonly gesperrt: boolean;
  /** FE-001 · Meldet je Abschnitt, ob seine Voraussetzung noch nicht übernommen ist. */
  readonly meldeUngespeichert?: (bausteinId: string, ungespeichert: boolean) => void;
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
        <nav
          aria-label={t("ga.baustein.gliederung")}
          data-testid={`${LESESTAND_MARKE}-gliederung`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-muted"
        >
          <span className="font-semibold">{t("ga.baustein.gliederung")}:</span>
          <ul className="flex flex-wrap gap-x-2">
            {d44SichtbareEintraege(eintraege).map((eintrag) => (
              <li key={`${eintrag.position}-${eintrag.text}`}>{eintrag.text}</li>
            ))}
          </ul>
        </nav>
      ) : null}
      {/* REINE ANZEIGE: kein Editor, kein Feld, kein Weg zurück in den Bestand (Lieferung 7). */}
      <div
        ref={setKnoten}
        data-testid={`${LESESTAND_MARKE}-text`}
        className="space-y-1.5 [&_h2]:mt-2 [&_h2]:font-semibold [&_h3]:mt-1.5 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
      >
        <SanitizedHtml html={rumpfHtml} />
      </div>
    </>
  );
}

function BausteinZeile({
  baustein,
  nummer,
  anzahl,
  bearbeiten,
  nameVon,
}: {
  baustein: BausteinLesestand;
  /** Die Stelle in der Folge, ab 1 — so, wie ein Mensch zählt. */
  nummer: number;
  anzahl: number;
  bearbeiten?: Bausteinbearbeitung;
  nameVon: NameResolver;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const titel = baustein.herkunft?.titel ?? t("fe001.abschnitt.ohneHerkunft");
  const datum = baustein.herkunft
    ? (formatKoTimestamp(baustein.herkunft.fassungAm, i18n.language) ??
      t("ga.baustein.fassungAmUnbekannt"))
    : null;
  return (
    <li
      data-testid={`${LESESTAND_MARKE}-baustein`}
      data-baustein={baustein.id}
      className="space-y-2 border-t border-hairline pt-4 first:border-t-0 first:pt-0"
    >
      <h4 className="text-[15px] font-semibold text-ink">
        {t("fe001.abschnitt.ueberschrift", { nummer, titel })}
      </h4>
      <p className={HINWEIS} data-testid={`${LESESTAND_MARKE}-herkunft`}>
        {t("ga.baustein.fassung", { version: baustein.koVersion })}
        {baustein.herkunft ? (
          <>
            {" · "}
            {t("ga.baustein.herkunft", {
              titel: baustein.herkunft.titel,
              autor: nameVon(baustein.herkunft.autor),
            })}
            {" · "}
            {datum}
          </>
        ) : null}
      </p>
      {baustein.herkunft ? null : (
        // Wissenslücke statt Erfindung: es wird NICHT auf die heutige Fassung ausgewichen.
        <p className={MELDUNG_HINWEIS}>{t("ga.baustein.herkunftUnbekannt")}</p>
      )}
      {baustein.aktualisierungsvorschlag ? (
        <p className={MELDUNG_HINWEIS} data-testid={`${LESESTAND_MARKE}-vorschlag`}>
          {t("ga.baustein.aktualisierung", {
            version: baustein.aktualisierungsvorschlag.aufVersion,
          })}
        </p>
      ) : null}
      {baustein.nachweisHash === null ? (
        <p className={HINWEIS}>{t("ga.baustein.nachweisFehlt")}</p>
      ) : null}
      {baustein.voraussetzung ? (
        <p className="text-[13px] text-text">
          <span className="font-semibold">{t("ga.voraussetzung.label")}:</span>{" "}
          {baustein.voraussetzung}
        </p>
      ) : null}
      {/* `?? null`: ein fehlendes Feld ist unbekannt, nicht leer (`api/types.ts`, `rumpfHtml`). */}
      <div className="text-[14px] leading-relaxed text-text">
        <BausteinText rumpfHtml={baustein.rumpfHtml ?? null} />
      </div>
      <ul className={`${HINWEIS} list-none`}>
        <Menge schluessel="ga.baustein.tabellen" werte={baustein.inhalt.tabellenUeberschriften} />
        <Menge schluessel="ga.baustein.abbildungen" werte={baustein.inhalt.abbildungen} />
      </ul>
      {bearbeiten ? (
        <div className="space-y-2 rounded-btn bg-page p-2.5">
          <p className="flex flex-wrap gap-2">
            <button
              type="button"
              className={KNOPF_NEBEN}
              onClick={() => bearbeiten.verschieben(baustein.id, -1)}
              disabled={bearbeiten.gesperrt || nummer === 1}
              aria-label={t("fe001.ordnen.hochAria", { titel })}
            >
              {t("ga.ordnen.hoch")}
            </button>
            <button
              type="button"
              className={KNOPF_NEBEN}
              onClick={() => bearbeiten.verschieben(baustein.id, 1)}
              disabled={bearbeiten.gesperrt || nummer === anzahl}
              aria-label={t("fe001.ordnen.runterAria", { titel })}
            >
              {t("ga.ordnen.runter")}
            </button>
          </p>
          <VoraussetzungFeld
            bausteinId={baustein.id}
            wert={baustein.voraussetzung}
            gesperrt={bearbeiten.gesperrt}
            uebernehmen={(wert) => bearbeiten.voraussetzung(baustein.id, wert)}
            {...(bearbeiten.meldeUngespeichert
              ? { meldeUngespeichert: bearbeiten.meldeUngespeichert }
              : {})}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Eine Kopfangabe der Anleitung — leer heisst „noch nicht beschrieben", nie ein leerer Doppelpunkt. */
function Kopfangabe({ schluessel, wert }: { schluessel: string; wert: string }): JSX.Element {
  const { t } = useTranslation();
  const text = wert.trim();
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        {t(schluessel)}
      </dt>
      <dd className={text ? "text-[14px] leading-relaxed text-text" : HINWEIS}>
        {text || t("fe001.lesestand.nichtBeschrieben")}
      </dd>
    </div>
  );
}

/** Das entstehende Dokument: Titel, Kopfangaben, dann die Abschnitte (als Kinder). */
function Dokument({
  stand,
  children,
}: {
  stand: AnweisungLesestand;
  children: JSX.Element;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <article
      className="space-y-4 rounded-card border border-hairline bg-page p-4 sm:p-5"
      data-testid={`${LESESTAND_MARKE}-dokument`}
    >
      <h3 className="text-xl font-semibold text-ink">{stand.titel}</h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Kopfangabe schluessel="ga.kopf.zweck" wert={stand.zweck} />
        <Kopfangabe schluessel="ga.kopf.geltungsbereich" wert={stand.geltungsbereich} />
        <Kopfangabe schluessel="ga.kopf.voraussetzungen" wert={stand.voraussetzungen} />
      </dl>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        {t("ga.bausteine")} · {stand.bausteine.length}
      </p>
      {children}
    </article>
  );
}

export function LesestandAnsicht({
  lage,
  stand,
  zeit,
  bearbeiten,
  nameVon,
}: {
  lage: Anzeigelage;
  stand: AnweisungLesestand | undefined;
  /** Der Zeitpunkt, auf den sich der angezeigte Stand bezieht. */
  zeit: string;
  bearbeiten?: Bausteinbearbeitung;
  /**
   * FE-001 · Namen aus dem Verzeichnis. Fehlt er (die Ansicht wird auch ohne Abfragen gezeichnet),
   * steht der ehrliche Ersatz „nicht abrufbar" — nie die Kennung.
   */
  nameVon?: NameResolver;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const namen: NameResolver = nameVon ?? (() => t("ko.authorUnavailable"));

  if (lage.art === "laden") {
    // KEINE Mengen-, Vollständigkeits- oder Gleichheitsaussage — nur, dass geladen wird.
    return (
      <section data-testid={LESESTAND_MARKE} className={KARTE}>
        <p aria-live="polite" className={HINWEIS}>
          {t("ga.laedt")}
        </p>
      </section>
    );
  }

  if (lage.art === "fehler") {
    // Fehlersatz und GAR NICHTS über Vollständigkeit, Gleichheit oder Freigabe.
    return (
      <section data-testid={LESESTAND_MARKE} className={KARTE}>
        <p role="alert" className={MELDUNG_FEHLER}>
          {t(lage.offline ? "ga.offline" : "ga.fehler")}
        </p>
      </section>
    );
  }

  if (!stand) {
    return (
      <section data-testid={LESESTAND_MARKE} className={KARTE}>
        <h2 className={KARTEN_TITEL}>{t("fe001.lesestand.titel")}</h2>
        <p className={MELDUNG_HINWEIS}>{t("ga.leer")}</p>
      </section>
    );
  }

  if (lage.art === "leer") {
    // FE-001 · AUCH DIE LEERE ANLEITUNG ZEIGT IHREN KOPF: wer Zweck und Geltungsbereich gerade
    // gespeichert hat, soll sie in der Lesefassung sehen — nicht erst nach dem ersten Abschnitt.
    // Weiterhin KEIN Prüfvermerk, keine Standzeile und kein Wort über Vollständigkeit.
    return (
      <section data-testid={LESESTAND_MARKE} aria-labelledby="ga-lesestand-titel" className={KARTE}>
        <h2 id="ga-lesestand-titel" className={KARTEN_TITEL}>
          {t("fe001.lesestand.titel")}
        </h2>
        <Dokument stand={stand}>
          <p className={MELDUNG_HINWEIS}>{t("ga.leer")}</p>
        </Dokument>
      </section>
    );
  }

  const standzeile = standSchluessel(lage);
  // Ein Zeitpunkt, den ein Mensch liest — nie die rohe ISO-Zeichenkette im Lesefluss.
  const lesbareZeit = formatKoTimestamp(zeit, i18n.language) ?? t("fe001.zeitUnbekannt");
  return (
    <section data-testid={LESESTAND_MARKE} aria-labelledby="ga-lesestand-titel" className={KARTE}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ga-lesestand-titel" className={KARTEN_TITEL}>
          {t("fe001.lesestand.titel")}
        </h2>
        <span className={CHIP} data-testid={`${LESESTAND_MARKE}-stand`}>
          {t(`ga.stand.${stand.stand}`)}
        </span>
      </div>
      {standzeile ? (
        <p className={HINWEIS} data-testid={`${LESESTAND_MARKE}-zeit`}>
          {t(standzeile, { zeit: lesbareZeit })}
        </p>
      ) : null}
      {lage.auffrischungGescheitert || lage.offline ? (
        // Der alte Stand BLEIBT stehen und der Fehler ist trotzdem sichtbar — er wird nicht als
        // frisch ausgegeben (Lehre 03.09., JOB 3027/3025/3037).
        <p role="alert" className={MELDUNG_FEHLER}>
          {t(lage.offline ? "ga.offline" : "ga.fehler")}
        </p>
      ) : null}
      <p className={HINWEIS}>{t("fe001.lesestand.einleitung")}</p>
      {stand.unvollstaendig ? (
        <p
          data-testid={`${LESESTAND_MARKE}-unvollstaendig`}
          role="alert"
          className={MELDUNG_HINWEIS}
        >
          {t("ga.unvollstaendig")} {t("ga.verborgene", { anzahl: stand.verborgeneBausteine })}
        </p>
      ) : null}

      <Dokument stand={stand}>
        {stand.bausteine.length === 0 ? (
          <p className={HINWEIS}>{t("ga.leer")}</p>
        ) : (
          <ol className="space-y-4">
            {stand.bausteine.map((baustein, index) => (
              <BausteinZeile
                key={baustein.id}
                baustein={baustein}
                nummer={index + 1}
                anzahl={stand.bausteine.length}
                nameVon={namen}
                {...(bearbeiten ? { bearbeiten } : {})}
              />
            ))}
          </ol>
        )}
      </Dokument>
      {/* Der Lückenvermerk kommt vom Server und steht sichtbar — kein grüner Haken. */}
      <p data-testid={`${LESESTAND_MARKE}-pruefanbindung`} className={MELDUNG_HINWEIS}>
        {t("ga.pruefanbindung")}
      </p>
    </section>
  );
}
