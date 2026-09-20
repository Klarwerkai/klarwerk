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
// LADEN: der Einstieg liest JETZT etwas, also hat er auch eine Ladefläche — die der Liste. Das
// Formular darunter bleibt davon unberührt; es hängt an keinem Bestand und wird nicht gesperrt,
// solange die Liste noch lädt. Erst die geöffnete Anweisung hat einen Lesestand, und ihre Zustände
// (laden, leer, Fehler, Cache, offline) verantwortet unverändert `GesamtanweisungSeite`.
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AnweisungListeneintrag } from "../../api/endpoints";
import { useRole } from "../../app/RoleContext";
import { ROLE_RANK } from "../../app/navigation";
import { useOnline } from "../../shell/Meldungen";
import { GesamtanweisungSeite } from "./GesamtanweisungSeite";
import { fehlerSchluessel } from "./api";
import { useAnweisungAnlegen, useAnweisungsListe } from "./hooks";
import { anzeigelage, standSchluessel } from "./zustand";

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

export function GesamtanweisungBereich(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const { role } = useRole();
  const online = useOnline();

  if (id) {
    return (
      <section data-testid={`${BEREICH_MARKE}-anweisung`}>
        <GesamtanweisungSeite
          anweisungId={id}
          darfEntscheiden={darfEntscheidenAls(ROLE_RANK[role])}
          offline={!online}
        />
      </section>
    );
  }
  return <Einstieg offline={!online} />;
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
function Listeneintrag({ eintrag }: { eintrag: AnweisungListeneintrag }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-testid={`${LISTE_MARKE}-eintrag`} data-anweisung={eintrag.id}>
      <Link
        to={`${GESAMTANWEISUNG_PFAD}/${eintrag.id}`}
        data-testid={`${LISTE_MARKE}-oeffnen`}
        data-anweisung={eintrag.id}
      >
        {eintrag.titel}
      </Link>
      <p data-testid={`${LISTE_MARKE}-stand`}>
        {t("ga.liste.stand")}: {t(`ga.stand.${eintrag.stand}`)}
      </p>
      <p data-testid={`${LISTE_MARKE}-urheber`}>
        {t("ga.liste.urheber")}: {eintrag.urheber}
      </p>
      <p data-testid={`${LISTE_MARKE}-geaendert`}>
        {t("ga.liste.geaendert")}: {eintrag.geaendertAm}
      </p>
      <p data-testid={`${LISTE_MARKE}-bausteine`}>
        {t("ga.liste.bausteine", { anzahl: eintrag.sichtbareBausteine })}
      </p>
      {/* DIE KENNZEICHNUNG NENNT DIE ZAHL: „unvollständig" allein lässt offen, ob ein Satz oder ein
          halbes Dokument fehlt. Dieselbe Regel wie im Lesestand (`ga.verborgene`). Sie hängt an
          `unvollstaendig` ODER an der Zahl — beide kommen aus derselben Zählung des Servers, und wenn
          sie je auseinanderliefen, soll die Kennzeichnung erscheinen und nicht ausfallen. */}
      {eintrag.unvollstaendig || eintrag.verborgeneBausteine > 0 ? (
        <p data-testid={`${LISTE_MARKE}-unvollstaendig`}>
          {t("ga.liste.unvollstaendig", { anzahl: eintrag.verborgeneBausteine })}
        </p>
      ) : null}
    </li>
  );
}

function Bestandsliste({ offline }: { offline: boolean }): JSX.Element {
  const { t } = useTranslation();
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
      <section data-testid={LISTE_MARKE}>
        <h2>{t("ga.liste.titel")}</h2>
        <p aria-live="polite" data-testid={`${LISTE_MARKE}-laedt`}>
          {t("ga.liste.laedt")}
        </p>
      </section>
    );
  }

  if (lage.art === "fehler") {
    // Fehlersatz und GAR KEINE Bestandsaussage. Der Leersatz erscheint hier ausdrücklich NICHT.
    return (
      <section data-testid={LISTE_MARKE}>
        <h2>{t("ga.liste.titel")}</h2>
        <p role="alert" data-testid={`${LISTE_MARKE}-fehler`}>
          {t(lage.offline ? "ga.offline" : "ga.liste.fehler")}
        </p>
      </section>
    );
  }

  if (lage.art === "leer" || !eintraege) {
    // ERFOLGREICH UND LEER — eine belegte Aussage, und deshalb darf sie hier stehen.
    return (
      <section data-testid={LISTE_MARKE}>
        <h2>{t("ga.liste.titel")}</h2>
        <p data-testid={`${LISTE_MARKE}-leer`}>{t("ga.liste.leer")}</p>
      </section>
    );
  }

  const standzeile = standSchluessel(lage);
  const zeit = juengsteAenderung(eintraege);
  return (
    <section data-testid={LISTE_MARKE}>
      <h2>{t("ga.liste.titel")}</h2>
      {standzeile && zeit ? (
        <p data-testid={`${LISTE_MARKE}-zeit`}>{t(standzeile, { zeit })}</p>
      ) : null}
      {lage.auffrischungGescheitert || lage.offline ? (
        // Die Zeilen BLEIBEN stehen und der Fehler ist trotzdem sichtbar — nichts wird als frisch
        // ausgegeben (Lehre 03.09., JOB 3027/3025/3037).
        <p role="alert" data-testid={`${LISTE_MARKE}-fehler`}>
          {t(lage.offline ? "ga.offline" : "ga.liste.fehler")}
        </p>
      ) : null}
      <ul data-testid={`${LISTE_MARKE}-eintraege`}>
        {eintraege.map((eintrag) => (
          <Listeneintrag key={eintrag.id} eintrag={eintrag} />
        ))}
      </ul>
    </section>
  );
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
function Einstieg({ offline }: { offline: boolean }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const anlegen = useAnweisungAnlegen();
  const [titel, setTitel] = useState("");

  async function absenden(event: FormEvent): Promise<void> {
    event.preventDefault();
    const bereinigt = titel.trim();
    if (bereinigt.length === 0 || anlegen.isPending) {
      return;
    }
    try {
      const angelegt = await anlegen.mutateAsync({ titel: bereinigt });
      // Erst NACH der bestätigten Anlage weitergehen — mit der Kennung, die der Server vergeben
      // hat. Eine selbst erzeugte wäre eine Behauptung über einen Bestand, den diese Fläche nicht
      // kennt.
      navigate(`${GESAMTANWEISUNG_PFAD}/${angelegt.id}`);
    } catch {
      // Die Absage steht unten am Formular (`anlegen.error`); der Titel bleibt stehen.
    }
  }

  return (
    <section data-testid={BEREICH_MARKE}>
      <h1>{t("ga.bereich.titel")}</h1>
      <p data-testid={`${BEREICH_MARKE}-einleitung`}>{t("ga.bereich.einleitung")}</p>
      <Bestandsliste offline={offline} />
      <form data-testid={`${BEREICH_MARKE}-anlegen`} onSubmit={absenden}>
        <label htmlFor="ga-bereich-titel">{t("ga.kopf.titel")}</label>
        <input
          id="ga-bereich-titel"
          name="titel"
          value={titel}
          required
          onChange={(e) => setTitel(e.target.value)}
        />
        <button type="submit" disabled={titel.trim().length === 0 || anlegen.isPending}>
          {t("ga.bereich.anlegen")}
        </button>
      </form>
      {offline ? <p data-testid={`${BEREICH_MARKE}-offline`}>{t("ga.offline")}</p> : null}
      {anlegen.error ? (
        <p role="alert" data-testid={`${BEREICH_MARKE}-fehler`}>
          {t(fehlerSchluessel(anlegen.error))}
        </p>
      ) : null}
    </section>
  );
}
