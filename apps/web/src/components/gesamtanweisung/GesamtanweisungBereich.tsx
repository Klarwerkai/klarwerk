// ==================================================================================================
// JOB 4156 · DIE SEITE — HIER WIRD AUS DER FLÄCHE VON 4154 EIN ORT IN DER APP.
// ==================================================================================================
//
// JOB 4154 hat `GesamtanweisungSeite` gebaut: den ganzen Weg eines Menschen an einer Stelle,
// fertig am Draht — aber mit einer PFLICHTEIGENSCHAFT `anweisungId`. Niemand konnte sie liefern,
// denn es gab weder eine Route noch einen Weg, eine Anweisung ANZULEGEN. Genau diese zwei Lücken
// schliesst diese Datei: sie ist das, was `apps/web/src/routes.tsx` mountet.
//
// ZWEI ZUSTÄNDE, UND SIE HÄNGEN AN DER ADRESSE — nicht an einem inneren Schalter:
//   · `/gesamtanweisungen`      → der EINSTIEG: der gespeicherte Bestand und darunter das Anlegen.
//   · `/gesamtanweisungen/:id`  → die ANWEISUNG: die Fläche aus 4154, mit ihrer Kennung.
// Ein innerer Schalter hätte denselben Ort für zwei Dinge benutzt; ein Mensch könnte die geöffnete
// Anweisung dann weder verlinken noch über den Zurück-Knopf wieder verlassen.
//
// ================================================================================================
// JOB 4357 · DER EINSTIEG ZEIGT JETZT DEN BESTAND — UND DAS IST DIE WICHTIGSTE ÄNDERUNG HIER.
// ================================================================================================
//
// HIER STAND BIS JOB 4357 DER ABSCHNITT „WAS DER EINSTIEG NICHT SAGT", und sein Kern war richtig:
// „ER BEHAUPTET NICHT, ES GÄBE KEINE GESAMTANWEISUNG. Das wäre der naheliegende Leersatz, und er
// wäre unbelegt: einen Endpunkt, der die vorhandenen Anweisungen AUFZÄHLT, gibt es nicht." Er nannte
// die Übersicht ausdrücklich als Restarbeit: „sie braucht eine Route, die dieser Auftrag nicht
// anlegen darf."
//
// DIESE ROUTE GIBT ES JETZT (`GET /api/gesamtanweisungen`, `services/app/src/routes/
// gesamtanweisung-routes.ts`), und damit ist die Voraussetzung eingelöst, unter der der alte
// Abschnitt selbst seinen Nachfolger vorgesehen hat. Der alte Weg wird deshalb NICHT daneben
// stehen gelassen: der Einstieg sagt jetzt etwas über den Bestand — aber ausschliesslich auf einer
// frischen, erfolgreichen Datengrundlage. Wie weit das trägt, entscheidet `anzeigelage`
// (`zustand.ts`) und nicht diese Datei:
//   · geladen, erfolgreich, leer  → ein Hinweissatz. Das ist eine BELEGTE Aussage.
//   · noch am Laden               → „Lädt …", und KEIN Wort über den Bestand.
//   · Fehler, offline, unbrauchbare Antwort → ein Fehlersatz, und KEIN Leersatz. „nichts
//     gespeichert" und „ich konnte nicht nachsehen" sind zwei Welten; ihre Verwechslung zahlt der
//     Mensch, indem er dieselbe Anweisung ein zweites Mal anlegt.
//
// DIE REIHENFOLGE IST TEIL DER ZUSAGE: erst der Bestand, dann „Neu anlegen". Wer wiederkommt, will
// weiterarbeiten, nicht neu anfangen — und wer neu anfangen will, findet das Formular direkt darunter.
//
// „NEU ANLEGEN" BLEIBT WIE BISHER an `ko.create` gebunden, über die Rollenschranke des Menüpunkts
// (`routes.tsx`, `GUARDED_ITEMS`) und über die Tür selbst. Hier wird dafür keine Zeile geändert und
// keine Rolle abgefragt: eine zweite Rechteentscheidung an dieser Stelle wäre die zweite Wahrheit.
//
// ================================================================================================
// FE-001 · DER EINSTIEG ERKLÄRT SICH — UND ER HEISST FÜR MENSCHEN „ARBEITSANLEITUNGEN".
// ================================================================================================
//
// Live-Befund des Beraters (26.09.2026): die Seite sagte nicht, wofür sie da ist, zeigte Urheber als
// UUID und Zeiten als ISO-Zeichenkette und stand als ungegliederte Textzeilen oben links. Jetzt:
//   · vier Antworten VOR jeder Eingabe — wofür, was mitbringen, was entsteht, erster Schritt — plus
//     ein Beispiel, das als Beispiel gekennzeichnet ist (kein vorhandener Demobestand behauptet);
//   · der Bestand als Karten mit anklickbarem Titel, Statuswort, Abschnittszahl, Name aus dem
//     Verzeichnis (`useAuthorName`, ehrlicher Ersatz statt Kennung) und lesbarer Zeit;
//   · „Neue Arbeitsanleitung erstellen" als EINE Hauptaktion mit erklärtem Titel und sichtbarem
//     Grund, solange der Titel fehlt.
// Die Reihenfolge Bestand → Anlegen bleibt (Begründung oben), Route und Drahtvertrag auch.
//
// LADEN: der Einstieg liest JETZT etwas, also hat er auch eine Ladefläche — die der Liste. Das
// Formular darunter bleibt davon unberührt; es hängt an keinem Bestand und wird nicht gesperrt,
// solange die Liste noch lädt. Erst die geöffnete Anweisung hat einen Lesestand, und ihre Zustände
// (laden, leer, Fehler, Cache, offline) verantwortet unverändert `GesamtanweisungSeite`.
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AnweisungListeneintrag } from "../../api/endpoints";
import { useSession } from "../../app/AuthContext";
import { useRole } from "../../app/RoleContext";
import { ROLE_RANK } from "../../app/navigation";
import type { NameResolver } from "../../lib/koAuthor";
import { formatKoTimestamp } from "../../lib/koDates";
import { useAuthorName } from "../../lib/useAuthorName";
import { useOnline } from "../../shell/Meldungen";
import { leerzustandsZeile } from "../EmptyStateCtas";
import { HelpTip } from "../HelpTip";
import { FreigabeStatus } from "./EntscheidungsVorlage";
import { GesamtanweisungSeite } from "./GesamtanweisungSeite";
import { fehlerSchluessel } from "./api";
import {
  FELD,
  FELD_LABEL,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_HAUPT,
  MELDUNG_FEHLER,
  MELDUNG_HINWEIS,
} from "./gestaltung";
import { useAnweisungAnlegen, useAnweisungsListe } from "./hooks";
import { type Freigaberechte, anzeigelage, standSchluessel } from "./zustand";

export const BEREICH_MARKE = "ga-bereich";

/** JOB 4357 · die Marke der Bestandsliste. Eine Stelle, damit Prüfstand und Fläche nicht abweichen. */
export const LISTE_MARKE = "ga-liste";

/** Der Pfadstamm dieses Bereichs. Eine Stelle, damit Route, Navigation und Sprung nicht auseinanderlaufen. */
export const GESAMTANWEISUNG_PFAD = "/gesamtanweisungen";

/**
 * Darf dieser Betrachter über die Gesamtfassung ENTSCHEIDEN?
 *
 * Die Route fordert dafür `ko.validate`, und das Rechtemodell gibt es controller und admin
 * (`services/rbac/src/policy.ts:33`). Hier wird es über den Rang gefragt und nicht über eine
 * zweite Rollenliste — eine abgeschriebene Aufzählung wäre am Tag ihrer Entstehung richtig und
 * danach still falsch.
 *
 * DIE ENTSCHEIDUNG FÄLLT WEITERHIN AM SERVER. Was hier entsteht, ist ausschliesslich die Frage, ob
 * die Entscheidungsknöpfe überhaupt angeboten werden; ein Mensch ohne das Recht bekommt sonst einen
 * Knopf, der nur 403 kann.
 */
function darfEntscheidenAls(rang: number): boolean {
  return rang >= ROLE_RANK.controller;
}

/**
 * PRÜFSTATUS-ANZEIGE · die Rechte des Betrachters für den nächsten Schritt — in Übersicht UND
 * Detail aus derselben Stelle. Vorlegen fordert `ko.create` (experte und höher, `policy.ts`),
 * Entscheiden `ko.validate` (siehe oben). Auch hier fällt die Entscheidung am Server; gefragt wird
 * nur, welcher Schritt angeboten und erklärt wird.
 */
function freigaberechteAls(rang: number): Freigaberechte {
  return { darfVorlegen: rang >= ROLE_RANK.experte, darfEntscheiden: darfEntscheidenAls(rang) };
}

export function GesamtanweisungBereich(): JSX.Element {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const { role } = useRole();
  const online = useOnline();
  const rechte = freigaberechteAls(ROLE_RANK[role]);

  if (id) {
    return (
      <section
        data-testid={`${BEREICH_MARKE}-anweisung`}
        className="mx-auto max-w-4xl space-y-3 pt-6"
      >
        {/* FE-001: die statische Seitenhilfe der Detailseite — sie braucht kein Modell. */}
        <HelpTip title={t("fe001.hilfe.detailTitel")} body={t("fe001.hilfe.detail")} />
        <Link
          to={GESAMTANWEISUNG_PFAD}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-text hover:underline"
          data-testid={`${BEREICH_MARKE}-zurueck`}
        >
          {t("fe001.zurUebersicht")}
        </Link>
        <GesamtanweisungSeite
          anweisungId={id}
          darfEntscheiden={rechte.darfEntscheiden}
          darfVorlegen={rechte.darfVorlegen}
          offline={!online}
        />
      </section>
    );
  }
  return <Einstieg offline={!online} rechte={rechte} />;
}

// ==================================================================================================
// JOB 4357 · DIE BESTANDSLISTE
// ==================================================================================================
//
// WARUM SIE IN DIESER DATEI WOHNT UND NICHT IN EINER EIGENEN, ausgeschrieben statt verschwiegen:
// `tests/wiki-gesamtanweisung/f6-ohne-ki.test.ts:150-158` hält ein REGISTER aller Dateien dieses
// Bedienordners und vergleicht es mit dem Verzeichnisinhalt — eine neue Datei hier macht ihn rot,
// und `tests/wiki-gesamtanweisung/**` gehört nicht zu den Zielpfaden dieses Auftrags (er darf an
// bestehenden Fällen nichts ändern, Abnahmekriterium 5). Die Liste gehört ohnehin genau hierhin: sie
// ist der erste Teil DES EINSTIEGS und hat keinen zweiten Aufrufer.
//
// ------------------------------------------------------------------------------------------------
// EINE ANTWORT OHNE `eintraege` IST EIN FEHLER UND KEINE LEERE LISTE
// ------------------------------------------------------------------------------------------------
// Der Typ der Antwort ist eine Behauptung über sie, nicht ihr Beweis. Käme etwas anderes zurück —
// ein Zwischenspeicher, eine Anmeldeumleitung, ein künftiger Umbau des Servers —, dann ist der
// Bestand UNBEKANNT. Ein `?? []` an dieser Stelle wäre der teuerste Zeichenzug der ganzen Lieferung:
// er zeigte eine ausgefallene Auskunft als „es ist nichts gespeichert".

/**
 * Der Bestand aus einer Antwort — oder `undefined`, wenn die Antwort keinen trägt.
 *
 * `undefined` heisst UNBEKANNT und nicht „leer". Die beiden dürfen nie zusammenfallen; dieselbe
 * Trennung wie `mengenSchluessel` (`zustand.ts`) sie für unbekannte Mengen führt.
 */
export function bestandAus(antwort: unknown): AnweisungListeneintrag[] | undefined {
  if (!antwort || typeof antwort !== "object") {
    return undefined;
  }
  const eintraege = (antwort as { eintraege?: unknown }).eintraege;
  return Array.isArray(eintraege) ? (eintraege as AnweisungListeneintrag[]) : undefined;
}

/**
 * Der Zeitpunkt, auf den sich die gezeigte Liste bezieht: die jüngste Änderung darin.
 *
 * DIESELBE WAHL WIE IM LESESTAND (`GesamtanweisungSeite`: `stand?.geaendertAm`) und aus demselben
 * Grund: es ist ein Zeitpunkt AUS DEN DATEN und keine Uhrzeit des Abrufs. Eine Abrufzeit würde
 * behaupten, der Bestand sei in diesem Augenblick nachgesehen worden — auch dann, wenn die Antwort
 * aus dem Zwischenspeicher kam.
 *
 * Leerer Bestand → leere Zeichenkette, und die Standzeile entfällt dann ganz. Ein „Stand von" über
 * nichts wäre eine Aussage ohne Gegenstand.
 */
export function juengsteAenderung(eintraege: readonly AnweisungListeneintrag[]): string {
  let jung = "";
  for (const eintrag of eintraege) {
    if (typeof eintrag.geaendertAm === "string" && eintrag.geaendertAm > jung) {
      jung = eintrag.geaendertAm;
    }
  }
  return jung;
}

/**
 * Das Merkmal, das eine unbrauchbare Antwort in den Fehlerzweig schickt.
 *
 * Ein eigener Wert und keine `Error`-Instanz: `anzeigelage` fragt ausschliesslich `!= null`
 * (`zustand.ts:47`), und ein `new Error(...)` legte einen Stapelabzug an, den niemand liest. Der
 * Grund steht als Text darin, damit er in einer Fehlersuche lesbar ist.
 */
const ANTWORT_OHNE_BESTAND = {
  grund: "Die Antwort trägt kein Feld eintraege — der Bestand ist damit unbekannt, nicht leer.",
} as const;

/**
 * EINE ZEILE DER LISTE.
 *
 * DER TITEL IST DER LINK, und das ist die ganze Tastaturzusage dieser Lieferung: ein `<Link>` ist ein
 * `<a href="…">` — Tab erreicht es ohne Zutun, Enter öffnet es ohne eigenen Tastenbehandler, der
 * Fokusring des Hauses greift von selbst (`index.css`, `*:focus-visible`), und die Adresse ist
 * kopierbar. Ein `<div onClick>` mit `tabIndex` und `onKeyDown` wäre eine zweite Auslegung von
 * „aktivieren" und die Stelle, an der die Bedienung ohne Maus eines Tages still verschwindet
 * (JOB 4223 R1, gemessen: ein Fall mit `tabIndex={-1}` blieb grün, weil ein Klick den Weg trug).
 *
 * KEIN BAUSTEIN-TITEL UND KEINE FASSUNGSKENNUNG: die Zeile zeigt den Kopf und zwei Zahlen. Was der
 * Betrachter nicht sehen darf, kann hier nicht durchsickern, weil der Server es gar nicht schickt
 * (`AnweisungListeneintrag`, `services/knowledge-object/src/gesamtanweisung-types.ts`).
 */
function Listeneintrag({
  eintrag,
  nameVon,
  rechte,
}: {
  eintrag: AnweisungListeneintrag;
  nameVon: NameResolver;
  rechte: Freigaberechte;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = formatKoTimestamp(eintrag.geaendertAm, i18n.language);
  return (
    <li
      data-testid={`${LISTE_MARKE}-eintrag`}
      data-anweisung={eintrag.id}
      // STATUS-FREIGABE: die Objektgrenze für Klaras Zeige-Modus (`lib/statusFreigabe.ts`).
      data-objekt="anleitung"
      className="rounded-card border border-hairline bg-page p-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to={`${GESAMTANWEISUNG_PFAD}/${eintrag.id}`}
          data-testid={`${LISTE_MARKE}-oeffnen`}
          data-anweisung={eintrag.id}
          className="text-[15px] font-semibold text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink"
        >
          {eintrag.titel}
        </Link>
      </div>
      {/* PRÜFSTATUS-ANZEIGE: derselbe Block wie im Kopf der Detailansicht (`GesamtanweisungSeite`). */}
      <div className="mt-1">
        <FreigabeStatus
          marke={LISTE_MARKE}
          eingabe={{
            stand: eintrag.stand,
            version: eintrag.version,
            geaendertAm: eintrag.geaendertAm,
            abschnitte: eintrag.sichtbareBausteine + eintrag.verborgeneBausteine,
            unvollstaendig: eintrag.unvollstaendig || eintrag.verborgeneBausteine > 0,
            entscheidung: eintrag.entscheidung,
          }}
          rechte={rechte}
        />
      </div>
      <p className={`${HINWEIS} mt-1 flex flex-wrap gap-x-2 gap-y-0.5`}>
        <span data-testid={`${LISTE_MARKE}-bausteine`}>
          {t("ga.liste.bausteine", { anzahl: eintrag.sichtbareBausteine })}
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid={`${LISTE_MARKE}-urheber`}>
          {t("ga.liste.urheber")}: {nameVon(eintrag.urheber)}
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid={`${LISTE_MARKE}-geaendert`}>
          {t("ga.liste.geaendert")}: {zeit ?? t("fe001.zeitUnbekannt")}
        </span>
      </p>
      {/* DIE KENNZEICHNUNG NENNT DIE ZAHL: „unvollständig" allein lässt offen, ob ein Satz oder ein
          halbes Dokument fehlt. Dieselbe Regel wie im Lesestand (`ga.verborgene`). Sie hängt an
          `unvollstaendig` ODER an der Zahl — beide kommen aus derselben Zählung des Servers, und wenn
          sie je auseinanderliefen, soll die Kennzeichnung erscheinen und nicht ausfallen. */}
      {eintrag.unvollstaendig || eintrag.verborgeneBausteine > 0 ? (
        <p data-testid={`${LISTE_MARKE}-unvollstaendig`} className={`${MELDUNG_HINWEIS} mt-2`}>
          {t("ga.liste.unvollstaendig", { anzahl: eintrag.verborgeneBausteine })}
        </p>
      ) : null}
    </li>
  );
}

/**
 * FE-001 · Die Zeilen — ein eigenes Bauteil, damit das Namensverzeichnis NUR gelesen wird, wenn es
 * Zeilen gibt. Ein leerer oder unbekannter Bestand braucht keine Namen, und der Einstieg ruft dann
 * weiterhin genau eine Adresse (`tests/wiki-gesamtanweisung-abnahme/a10-…`, Kalibrierung).
 */
function Eintragsliste({
  eintraege,
  rechte,
}: {
  eintraege: readonly AnweisungListeneintrag[];
  rechte: Freigaberechte;
}): JSX.Element {
  const nameVon = useAuthorName();
  return (
    <ul data-testid={`${LISTE_MARKE}-eintraege`} className="space-y-2">
      {eintraege.map((eintrag) => (
        <Listeneintrag key={eintrag.id} eintrag={eintrag} nameVon={nameVon} rechte={rechte} />
      ))}
    </ul>
  );
}

function Bestandsliste({
  offline,
  rechte,
}: {
  offline: boolean;
  rechte: Freigaberechte;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const abfrage = useAnweisungsListe();

  const eintraege = bestandAus(abfrage.data);
  // Eine Antwort DA, aber ohne Bestand: Fehler, nicht leer. Begründung im Abschnitt oben.
  const unbrauchbar = abfrage.data !== undefined && eintraege === undefined;
  const lage = anzeigelage<readonly AnweisungListeneintrag[]>(
    {
      daten: eintraege,
      laedt: abfrage.isLoading,
      fehler: abfrage.error ?? (unbrauchbar ? ANTWORT_OHNE_BESTAND : null),
      aktualisiert: abfrage.isFetching,
      offline,
    },
    (liste) => liste.length === 0,
  );

  if (lage.art === "laden") {
    // KEIN Satz über den Bestand — nur, dass nachgesehen wird.
    return (
      <section data-testid={LISTE_MARKE} aria-labelledby="ga-liste-titel" className={KARTE}>
        <h2 id="ga-liste-titel" className={KARTEN_TITEL}>
          {t("ga.liste.titel")}
        </h2>
        <p aria-live="polite" className={HINWEIS} data-testid={`${LISTE_MARKE}-laedt`}>
          {t("ga.liste.laedt")}
        </p>
      </section>
    );
  }

  if (lage.art === "fehler") {
    // Fehlersatz und GAR KEINE Bestandsaussage. Der Leersatz erscheint hier ausdrücklich NICHT.
    return (
      <section data-testid={LISTE_MARKE} aria-labelledby="ga-liste-titel" className={KARTE}>
        <h2 id="ga-liste-titel" className={KARTEN_TITEL}>
          {t("ga.liste.titel")}
        </h2>
        <p role="alert" className={MELDUNG_FEHLER} data-testid={`${LISTE_MARKE}-fehler`}>
          {t(lage.offline ? "ga.offline" : "ga.liste.fehler")}
        </p>
      </section>
    );
  }

  if (lage.art === "leer" || !eintraege) {
    // ERFOLGREICH UND LEER — eine belegte Aussage, und deshalb darf sie hier stehen.
    return (
      <section data-testid={LISTE_MARKE} aria-labelledby="ga-liste-titel" className={KARTE}>
        <h2 id="ga-liste-titel" className={KARTEN_TITEL}>
          {t("ga.liste.titel")}
        </h2>
        <p className={MELDUNG_HINWEIS} data-testid={`${LISTE_MARKE}-leer`}>
          {t("ga.liste.leer")}
        </p>
        {/* R-0956 (Nacharbeit 7): die leere Liste ordnet in den Wissenskreis ein. */}
        {leerzustandsZeile(t, "anleitung")}
      </section>
    );
  }

  const standzeile = standSchluessel(lage);
  const zeit = formatKoTimestamp(juengsteAenderung(eintraege), i18n.language);
  return (
    <section data-testid={LISTE_MARKE} aria-labelledby="ga-liste-titel" className={KARTE}>
      <h2 id="ga-liste-titel" className={KARTEN_TITEL}>
        {t("ga.liste.titel")}
      </h2>
      {standzeile && zeit ? (
        <p className={HINWEIS} data-testid={`${LISTE_MARKE}-zeit`}>
          {t(standzeile, { zeit })}
        </p>
      ) : null}
      {lage.auffrischungGescheitert || lage.offline ? (
        // Die Zeilen BLEIBEN stehen und der Fehler ist trotzdem sichtbar — nichts wird als frisch
        // ausgegeben (Lehre 03.09., JOB 3027/3025/3037).
        <p role="alert" className={MELDUNG_FEHLER} data-testid={`${LISTE_MARKE}-fehler`}>
          {t(lage.offline ? "ga.offline" : "ga.liste.fehler")}
        </p>
      ) : null}
      <Eintragsliste eintraege={eintraege} rechte={rechte} />
    </section>
  );
}

// ==================================================================================================
// RESTPRÜFUNG (A7) · DER UNBESTÄTIGTE TITEL ÜBERSTEHT DAS NEULADEN
// ==================================================================================================
//
// Lehnt der Server die Anlage ab (Journalbetrieb: `ANWEISUNG_ABLAGE_FLUECHTIG`), bleibt der Titel
// stehen — aber bis hierher nur im Arbeitsspeicher der Seite. Ein Neuladen nahm ihn still mit, und
// genau das ist der Verlust, den A7 ausschliesst: die Arbeit ist UNBESTÄTIGT, nicht verzichtbar.
//
// DER MERKER IST TAB-GEBUNDEN UND JE KONTO GETRENNT (`sessionStorage`, Schlüssel mit der
// Nutzerkennung): die Abmeldung leert `sessionStorage` nicht, und ein zweites Konto im selben Tab
// sähe sonst den Titel des ersten. Ohne angemeldetes Konto wird nichts gemerkt. Er ist KEIN zweiter
// Bestand: er nennt keine Kennung, erscheint nie in der Liste und wird nach der BESTÄTIGTEN Anlage
// gelöscht — erst die Antwort des Servers macht aus dem Titel eine Anweisung.
//
// Gesperrter Speicher (privater Modus, Richtlinie) ist kein Fehler der Fläche: dann gilt der
// bisherige Stand, der Titel lebt bis zum Neuladen.
const TITEL_MERKER = "kw.ga.anlegen.titel.";

function merkerLesen(schluessel: string | null): string {
  if (!schluessel) {
    return "";
  }
  try {
    return window.sessionStorage.getItem(schluessel) ?? "";
  } catch {
    return "";
  }
}

function merkerSchreiben(schluessel: string | null, wert: string): void {
  if (!schluessel) {
    return;
  }
  try {
    if (wert.length > 0) {
      window.sessionStorage.setItem(schluessel, wert);
    } else {
      window.sessionStorage.removeItem(schluessel);
    }
  } catch {
    // Siehe oben: ohne Speicher bleibt der Titel bis zum Neuladen stehen.
  }
}

/**
 * Der Titel des Anlegeformulars — gemerkt bis zur bestätigten Anlage.
 *
 * GESCHRIEBEN WIRD IM SETTER und nicht in einem Effekt: ein Effekt über `titel` liefe auch mit dem
 * leeren Anfangswert, bevor die Sitzung bekannt ist, und löschte den gemerkten Titel, ehe er
 * gelesen wurde. ANGEZEIGT UND GESCHRIEBEN wird immer unter dem Schlüssel der gerade bestätigten
 * Sitzung — auch wenn sie bei montierter Fläche wechselt.
 */
function useUnbestaetigterTitel(): [string, (wert: string) => void, () => void] {
  const { user } = useSession();
  const schluessel = user ? `${TITEL_MERKER}${user.id}` : null;
  // DER TITEL GEHÖRT EINEM KONTO: der Zustand trägt den Schlüssel, unter dem er entstand.
  const [lage, setLage] = useState(() => ({ schluessel, titel: merkerLesen(schluessel) }));

  // BEN R1 (BEN-1): wechselt die bestätigte Sitzung bei montierter Fläche von A zu B, darf As Titel
  // weder stehen bleiben noch mit der nächsten Eingabe unter Bs Schlüssel landen. Deshalb wird der
  // Zustand bei jedem Schlüsselwechsel NOCH IM SELBEN ZEICHNEN verworfen und aus dem Merker des
  // neuen Kontos gelesen — kein Effekt, der erst nach einem Zeichnen mit dem fremden Titel liefe.
  // Was ohne bestätigte Sitzung getippt wurde, geht dabei verloren: es gehört keinem Konto.
  let aktuell = lage;
  if (lage.schluessel !== schluessel) {
    aktuell = { schluessel, titel: merkerLesen(schluessel) };
    setLage(aktuell);
  }

  return [
    aktuell.titel,
    (wert: string) => {
      // Geschrieben wird unter dem Schlüssel DIESES Zeichnens, und der Zustand merkt ihn sich mit.
      setLage({ schluessel, titel: wert });
      merkerSchreiben(schluessel, wert);
    },
    () => merkerSchreiben(schluessel, ""),
  ];
}

/**
 * Der Einstieg: der gespeicherte Bestand, darunter das Anlegen.
 *
 * SCHEITERT DAS ANLEGEN, BLEIBT DER TITEL STEHEN und die Absage steht als EIN Satz in
 * Anwendersprache daneben — der Knopf bleibt bedienbar, der erneute Versuch ist also erreichbar
 * und nicht hinter einem Neuladen versteckt. Eine leere Fläche mit rotem Rand wäre beides nicht.
 * Dieselbe Regel wie im Aufnahmeformular (`BausteinAufnahme.tsx:59`).
 *
 * OFFLINE IST DERSELBE WEG: kein eigener Zweig, keine gesperrte Fläche. Der Versuch scheitert, und
 * `fehlerSchluessel` liefert dafür den Offline-Satz — dieselbe EINE Deutung wie überall in diesem
 * Bereich (`api.ts`). Der Hinweis erscheint VOR dem Versuch nur als Zustandsangabe, nicht als Sperre:
 * die Verbindung kann zwischen Anzeige und Klick zurückkommen.
 *
 * DIE LISTE STEHT ÜBER DEM FORMULAR und ist von ihm vollständig getrennt: ihr Fehler sperrt das
 * Anlegen nicht (man kann anlegen, ohne den Bestand zu kennen), und ihr Ladezustand verzögert es
 * nicht. Zwei Gegenstände, zwei Zustände, zwei Meldungen.
 */
function Einstieg({
  offline,
  rechte,
}: {
  offline: boolean;
  rechte: Freigaberechte;
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const anlegen = useAnweisungAnlegen();
  const [titel, setTitel, titelVergessen] = useUnbestaetigterTitel();

  async function absenden(event: FormEvent): Promise<void> {
    event.preventDefault();
    const bereinigt = titel.trim();
    if (bereinigt.length === 0 || anlegen.isPending) {
      return;
    }
    try {
      const angelegt = await anlegen.mutateAsync({ titel: bereinigt });
      // Bestätigt — ab hier ist der Titel Teil einer Anweisung und nicht mehr unbestätigte Arbeit.
      titelVergessen();
      // Erst NACH der bestätigten Anlage weitergehen — mit der Kennung, die der Server vergeben
      // hat. Eine selbst erzeugte wäre eine Behauptung über einen Bestand, den diese Fläche nicht
      // kennt.
      navigate(`${GESAMTANWEISUNG_PFAD}/${angelegt.id}`);
    } catch {
      // Die Absage steht unten am Formular (`anlegen.error`); der Titel bleibt stehen.
    }
  }

  const titelLeer = titel.trim().length === 0;
  return (
    <section data-testid={BEREICH_MARKE} className="mx-auto max-w-4xl space-y-5 pt-6 pb-10">
      <HelpTip title={t("fe001.hilfe.uebersichtTitel")} body={t("fe001.hilfe.uebersicht")} />
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-ink">{t("ga.bereich.titel")}</h1>
        <p
          data-testid={`${BEREICH_MARKE}-einleitung`}
          className="text-[14px] leading-relaxed text-text"
        >
          {t("ga.bereich.einleitung")}
        </p>
        <dl className="grid gap-3 sm:grid-cols-3" data-testid={`${BEREICH_MARKE}-orientierung`}>
          {(["mitbringen", "ergebnis", "ersterSchritt"] as const).map((frage) => (
            <div key={frage} className="rounded-card border border-hairline bg-page p-3">
              <dt className="text-[12.5px] font-semibold text-text">
                {t(`fe001.einstieg.${frage}.frage`)}
              </dt>
              <dd className={`${HINWEIS} mt-1`}>{t(`fe001.einstieg.${frage}.antwort`)}</dd>
            </div>
          ))}
        </dl>
        <p className={HINWEIS} data-testid={`${BEREICH_MARKE}-beispiel`}>
          {t("fe001.einstieg.beispiel")}
        </p>
      </header>
      <Bestandsliste offline={offline} rechte={rechte} />
      <form
        data-testid={`${BEREICH_MARKE}-anlegen`}
        onSubmit={absenden}
        aria-labelledby="ga-bereich-anlegen-titel"
        className={KARTE}
      >
        <h2 id="ga-bereich-anlegen-titel" className={KARTEN_TITEL}>
          {t("ga.bereich.anlegen")}
        </h2>
        <div>
          <label htmlFor="ga-bereich-titel" className={FELD_LABEL}>
            {t("fe001.anlegen.titelLabel")}
          </label>
          <input
            id="ga-bereich-titel"
            name="titel"
            value={titel}
            required
            aria-describedby="ga-bereich-titel-hinweis"
            onChange={(e) => setTitel(e.target.value)}
            className={FELD}
          />
          <p id="ga-bereich-titel-hinweis" className={`${HINWEIS} mt-1`}>
            {t("fe001.anlegen.titelHinweis")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={KNOPF_HAUPT}
            disabled={titelLeer || anlegen.isPending}
            aria-describedby={titelLeer ? "ga-bereich-sperre" : undefined}
          >
            {t("ga.bereich.anlegen")}
          </button>
          {titelLeer ? (
            <p id="ga-bereich-sperre" className={HINWEIS} data-testid={`${BEREICH_MARKE}-sperre`}>
              {t("fe001.anlegen.titelFehlt")}
            </p>
          ) : anlegen.isPending ? (
            <p className={HINWEIS} aria-live="polite">
              {t("fe001.anlegen.laeuft")}
            </p>
          ) : null}
        </div>
        {offline ? (
          <p className={MELDUNG_HINWEIS} data-testid={`${BEREICH_MARKE}-offline`}>
            {t("ga.offline")}
          </p>
        ) : null}
        {anlegen.error ? (
          <p role="alert" className={MELDUNG_FEHLER} data-testid={`${BEREICH_MARKE}-fehler`}>
            {t(fehlerSchluessel(anlegen.error))}
          </p>
        ) : null}
      </form>
    </section>
  );
}
