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
//   · `/gesamtanweisungen`      → der EINSTIEG: eine Anweisung anlegen.
//   · `/gesamtanweisungen/:id`  → die ANWEISUNG: die Fläche aus 4154, mit ihrer Kennung.
// Ein innerer Schalter hätte denselben Ort für zwei Dinge benutzt; ein Mensch könnte die geöffnete
// Anweisung dann weder verlinken noch über den Zurück-Knopf wieder verlassen.
//
// ================================================================================================
// WAS DER EINSTIEG NICHT SAGT — UND WARUM DAS DIE WICHTIGSTE ZEILE DIESER DATEI IST
// ================================================================================================
//
// ER BEHAUPTET NICHT, ES GÄBE KEINE GESAMTANWEISUNG. Das wäre der naheliegende Leersatz, und er
// wäre unbelegt: einen Endpunkt, der die vorhandenen Anweisungen AUFZÄHLT, gibt es nicht
// (`services/app/src/routes/gesamtanweisung-routes.ts` kennt zehn Türen, und keine davon ist eine
// Liste). Diese Seite hat also gar keine Grundlage für eine Aussage über den Bestand — und
// Abschnitt 9 des Auftrags verbietet genau das: „Keine negative oder zeitabhängige Aussage ohne
// frische, erfolgreiche Datengrundlage."
//
// Sie sagt deshalb nur, was sie weiss und kann: dass man hier eine Anweisung anlegt, und dass eine
// vorhandene über ihre Kennung geöffnet wird. Das ist die Wissenslücke offen benannt statt
// überspielt. Eine Übersicht ist echte Restarbeit und steht so in der Rückgabe — sie braucht eine
// Route, die dieser Auftrag ausdrücklich nicht anlegen darf.
//
// LADEN: es gibt hier nichts zu laden. Der Einstieg liest nichts, also zeigt er auch keine
// Ladefläche und keine Platzhalterzahl — er ist ein Formular. Erst die Anweisung selbst hat einen
// Lesestand, und ihre Zustände (laden, leer, Fehler, Cache, offline) verantwortet unverändert
// `GesamtanweisungSeite` mit `anzeigelage` (`zustand.ts`).
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useRole } from "../../app/RoleContext";
import { ROLE_RANK } from "../../app/navigation";
import { useOnline } from "../../shell/Meldungen";
import { GesamtanweisungSeite } from "./GesamtanweisungSeite";
import { fehlerSchluessel } from "./api";
import { useAnweisungAnlegen } from "./hooks";

export const BEREICH_MARKE = "ga-bereich";

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

/**
 * Der Einstieg: eine Anweisung anlegen.
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
