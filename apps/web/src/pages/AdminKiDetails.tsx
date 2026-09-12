// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „KI".
//
// Was hier steht, stand vorher als Kartenwand in `Admin.tsx`. Der Umbau verlegt sie hinter die
// Zeilen der Einstellungen: eine Zeile mit Wert, ein Chevron, DIESE Karte — vollständig, mit allen
// Feldern, Knöpfen und Ergebnissen. Verloren geht nichts; die Hilfetexte (die Körper der früheren
// Hilfe-Zeichen und die Einleitungsabsätze) wandern in das eine „?"-Menü je Karte (Lieferung 9).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api } from "../api/client";
import { endpoints } from "../api/endpoints";
import type {
  ExternalKnowledgeStage,
  ReasonerCloudAnbieter,
  ReasonerConfigStatus,
  ReasonerProbeResult,
} from "../api/types";
import { useToast } from "../app/ToastContext";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, TextInput } from "../components/ui";
import i18n from "../i18n";
import {
  type AiAccessState,
  aiAccessRows,
  anbieterAusClientName,
  anbieterName,
  anbieterUndModell,
} from "../lib/aiOverview";
// AUFTRAG kimodus-live: Topbar-/Status-Queries nach dem Übernehmen live invalidieren.
import { invalidateAiState } from "../lib/aiStateInvalidate";
import { type KiTestArt, type KiTestBefund, kiTestBefund } from "../lib/kiTestBefund";
import { parseNeededValidations } from "../lib/reviewerMinimum";
import { maxRawAttachmentMb } from "../lib/uploadLimits";

// KI-Verwaltung v1 (Pedi 02.07.): Zuordnung global + je Aufgabe.
// PMO-FEA-0006 'extract' · WP-BILD-1c 'describe' · WP-IC-4 'group'.
const AI_TASKS = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

// SCRUM-414: die vier Stufen des Reglers „externe Wissensabfrage" in Anzeige-Reihenfolge.
const EXTERNAL_STAGES: readonly ExternalKnowledgeStage[] = [
  "blocked",
  "search_on_click",
  "search_attach",
  "open",
];

// SCRUM-413: Status-Töne der KI-Zugänge — Ampel nur als ECHTER Status (CI-konform).
const ACCESS_STATE_TONE: Record<AiAccessState, string> = {
  active: "bg-trust-pos-bg text-trust-pos-text",
  available: "bg-page text-muted",
  missing: "bg-trust-warn-bg text-trust-warn-text",
  planned: "bg-page text-muted-2",
};

// ================================================================================================
// JOB 3134 (KI-WAHL, Pedis Entscheidung 42) — DIE AUSWAHL NENNT DIE ANBIETER, UND SIE BESTIMMT SIE.
// ================================================================================================
//
// DER BEFUND: im Dropdown stand „Extern · Cloud-LLM (Claude)", in der Statuszeile „ChatGPT" — der
// Auswahlwert `cloud` kannte keinen Anbieter, und WER dahinter arbeitete, entschied der Server nach
// einer Vorzugsregel. Jetzt sind ChatGPT (OpenAI) und Claude (Anthropic) ZWEI Einträge, je mit dem
// Modell aus der Serverkonfiguration; ein nicht eingerichteter Anbieter steht ausgegraut da und sagt,
// was fehlt (Env-Name, nie ein Schlüssel). Der Name kommt aus derselben Ableitung wie Statuszeile
// und Zugangsliste (`lib/aiOverview`), damit die drei Stellen nicht auseinanderlaufen können.

/** Die Auswahlwerte in Anzeige-Reihenfolge — die beiden Anbieter zwischen Auto und Intern. */
const ANBIETER_WAHL: readonly ReasonerCloudAnbieter[] = ["openai", "anthropic"];

/** Ein Zuordnungs-Entwurf gleicht dem gesendeten, wenn er dieselben Einträge trägt. */
function gleichePerTask(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

/**
 * Die Optionen für ein Auswahlfeld (global oder je Aufgabe) — EINE Liste für beide, damit die
 * Feinabstimmung nie einen Anbieter kennt, den das globale Feld nicht kennt (und umgekehrt).
 */
function WahlOptionen({ konfig }: { konfig: ReasonerConfigStatus }): JSX.Element {
  const { t } = useTranslation();
  const autoName = konfig.autoAnbieter ? anbieterName(konfig.autoAnbieter) : null;
  // Älterer Server ohne `cloudProviders`: nur der EINE genannte Cloud-Client ist bekannt.
  const genannt = konfig.cloudConfigured
    ? anbieterAusClientName(konfig.model ?? konfig.provider)
    : undefined;
  return (
    <>
      <option value="auto">
        {autoName
          ? `${t("adm.ai.choice.auto")} — ${t("adm.ai.choice.autoMit", { name: autoName })}`
          : t("adm.ai.choice.auto")}
      </option>
      {ANBIETER_WAHL.map((anbieter) => {
        const status = konfig.cloudProviders?.[anbieter];
        const eingerichtet = status ? status.configured : genannt === anbieter;
        const name = anbieterName(anbieter);
        if (!eingerichtet) {
          return (
            <option key={anbieter} value={anbieter} disabled>
              {t("adm.ai.choice.anbieterUnavailable", { name })}
            </option>
          );
        }
        const clientName = status?.name ?? konfig.model ?? konfig.provider;
        return (
          <option key={anbieter} value={anbieter}>
            {t("adm.ai.choice.anbieter", { name: anbieterUndModell(clientName) })}
          </option>
        );
      })}
      {/* Pedi 05.07. (VIP): interne Option immer SICHTBAR — deaktiviert, solange kein
        eigener LLM verbunden ist. */}
      {konfig.localConfigured ? (
        <option value="local">{t("adm.ai.choice.local")}</option>
      ) : (
        <option value="local" disabled>
          {t("adm.ai.choice.localUnavailable")}
        </option>
      )}
      <option value="deterministic">{t("adm.ai.choice.deterministic")}</option>
    </>
  );
}

// ================================================================================================
// JOB 3420 (UX-10b) — EIN FEHLERKASTEN, DER SAGT, WORAN ES LAG.
// ================================================================================================
//
// VORHER: sechs Stellen dieser Datei (`:268`, `:273`, `:292`, `:297`, `:328`, `:357`) schickten ihr
// Scheitern durch DENSELBEN Schlüssel `adm.ai.testFail`, an dem der Anthropic-Schlüsseltipp fest
// hing. Fünf davon hatten mit einem Cloud-Schlüssel nichts zu tun.
//
// JETZT: Aus dem Prüfergebnis macht GENAU EINE Stelle einen Rat — `lib/kiTestBefund.ts`. Diese
// Komponente zeigt ihn nur an; sie entscheidet nichts und liest kein Feld selbst. Was sie zeigt:
// den neutralen Rahmen mit der unveränderten Rohmeldung (nur wenn ein Ergebnis VORLIEGT), die
// gemessene Ursache, die wörtlich zitierte Begründung des Anbieters (nur wenn er eine mitschickte),
// den nächsten Schritt (nur wenn einer belegt ist) und das Angebot zu wiederholen.
function KiFehlerkasten({
  testId,
  befund,
  detail,
  veraltet,
  zeit,
  wiederholen,
  laeuft,
}: {
  testId: string;
  befund: KiTestBefund;
  /** Die Rohmeldung des Servers — `null`, wenn gar kein Prüfergebnis vorliegt (Fall „anfrage"). */
  detail: string | null;
  /** Steht hier der Befund des VORIGEN Laufs, während ein neuer läuft? */
  veraltet: boolean;
  /** Zeitstempel (`at`) des gezeigten Befundes — `null`, wenn keiner vorliegt. */
  zeit: string | null;
  wiederholen: () => void;
  laeuft: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
    >
      {/* Auftrag §9: ein stehen gebliebener Befund wird als der ÄLTERE kenntlich gemacht — mit
        seinem Zeitstempel, wenn er einen trägt. Dieselbe Form wie der Standhinweis der
        Einstellungen (`components/einstellungen/Abfragehuelle.tsx:160-170`). */}
      {veraltet ? (
        <p data-testid={`${testId}-aelter`} className="mb-0.5 font-semibold">
          {zeit === null
            ? t("adm.ai.befund.aelterOhneZeit")
            : t("adm.ai.befund.aelter", {
                zeit: new Date(zeit).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
        </p>
      ) : null}
      {detail === null ? null : <p>{t("adm.ai.testFail", { detail })}</p>}
      <p className="mt-0.5 font-semibold">{t(befund.ursacheKey, befund.ursacheWerte)}</p>
      {befund.anbieterGrund === null ? null : (
        <p className="mt-0.5">{t("adm.ai.befund.zitat", { grund: befund.anbieterGrund })}</p>
      )}
      {befund.ratKey === null ? null : <p className="mt-0.5">{t(befund.ratKey)}</p>}
      {befund.wiederholbar ? (
        <button
          type="button"
          disabled={laeuft}
          onClick={wiederholen}
          className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
        >
          <KeyRound size={12} />
          {laeuft ? t("adm.ai.testRunning") : t("adm.ai.wiederholen")}
        </button>
      ) : null}
    </div>
  );
}

/** Was zuletzt gemessen wurde — der Stoff, aus dem der Kasten seine Anzeige baut. */
interface KiFehlerstand {
  readonly befund: KiTestBefund;
  readonly detail: string | null;
  readonly zeit: string | null;
}

// ================================================================================================
// JOB 3420 · RUNDE 2 (BENs Korrekturpflicht 1) — DER KNOPF, DEN MAN GERADE GEDRÜCKT HAT, BLEIBT DA.
// ================================================================================================
//
// DER GEMESSENE FEHLER DER RUNDE 1: Der Fehlerkasten hing unmittelbar an `mutation.data` bzw.
// `mutation.isError`. TanStack Query räumt beides beim erneuten `mutate()` ab (Zustand `pending`
// trägt `data: undefined, error: null`) — der Kasten verschwand also GENAU in dem Moment, in dem
// sein Wiederholen-Knopf gedrückt wurde. Der zugesagte Laufzustand („teste …", deaktiviert) war
// darum unerreichbar; BEN hat das mit einer verzögerten zweiten Antwort belegt
// (`kastenVorhanden:false`, jobs/3420/runde-1/ben.md).
//
// DESHALB WOHNT DAS GEDÄCHTNIS HIER, eine Ebene über der Bedingung: dieser Bereich ist IMMER
// gemountet und entscheidet selbst, was er zeigt. Läuft eine Wiederholung, bleibt der zuletzt
// gemessene Befund sichtbar und wird als der ÄLTERE ausgewiesen (Auftrag §9; dieselbe Hausregel wie
// beim Standhinweis der Einstellungen: niemals leeren, sondern den Stand benennen). Endet ein Lauf
// OHNE Fehler, ist der alte Befund weg — er gälte sonst für eine Messung, die es nicht mehr gibt.
function KiFehlerbereich({
  testIdBasis,
  art,
  ergebnis,
  anfrageFehler,
  laeuft,
  wiederholen,
}: {
  /** `ki-fehler-cloud` → Ergebnisfall; der Anfragefall hängt `-anfrage` an (Bestandskennungen). */
  testIdBasis: string;
  art: KiTestArt;
  /**
   * Das Prüfergebnis, wenn eines vorliegt — die beiden Selbsttests haben keines. `| undefined`
   * ausgeschrieben: `exactOptionalPropertyTypes` (tsconfig) unterscheidet „Feld fehlt" von „Feld
   * ist undefined", und die Aufrufer reichen hier `mutation.data` durch.
   */
  ergebnis?: ReasonerProbeResult | undefined;
  anfrageFehler: boolean;
  laeuft: boolean;
  wiederholen: () => void;
}): JSX.Element | null {
  const gemerkt = useRef<KiFehlerstand | null>(null);
  const aktuell: KiFehlerstand | null =
    ergebnis !== undefined && !ergebnis.ok
      ? {
          befund: kiTestBefund({ ergebnis, anfrageFehler: false, art }),
          detail: ergebnis.detail,
          zeit: ergebnis.at,
        }
      : anfrageFehler
        ? { befund: kiTestBefund({ anfrageFehler: true, art }), detail: null, zeit: null }
        : null;
  if (aktuell !== null) {
    gemerkt.current = aktuell;
  } else if (!laeuft) {
    gemerkt.current = null;
  }
  const zeigen = aktuell ?? (laeuft ? gemerkt.current : null);
  if (zeigen === null) {
    return null;
  }
  return (
    <KiFehlerkasten
      testId={zeigen.befund.fall === "anfrage" ? `${testIdBasis}-anfrage` : testIdBasis}
      befund={zeigen.befund}
      detail={zeigen.detail}
      veraltet={aktuell === null}
      zeit={zeigen.zeit}
      wiederholen={wiederholen}
      laeuft={laeuft}
    />
  );
}

// ================================================================================================
// JOB 3783 · DIE ADMINFREIGABE FÜR DIE ÖFFENTLICHE KI — UND DIE FOLGESCHALTUNG, DIE NICHTS VERLIERT.
// ================================================================================================
//
// DER ZUSTAND VORHER: der Kern sperrt seit `1.0.0-beta.1.326` („nur `true` zählt",
// `services/reasoner/src/service.ts:658-660`), der Schreibweg existiert
// (`PUT /api/reasoner/config`, Rumpffeld `kiFreigabe`) — aber `kiFreigabe` kam in `apps/web/src`
// NULL mal vor. Niemand konnte die öffentliche KI freischalten, ohne die Schnittstelle von Hand zu
// rufen.
//
// DER FEHLER, AN DEM JOB 3501 DREIMAL GESCHEITERT IST (Prüferurteil, Runde 3, wörtlich): „verwirft
// die PUT-Antwort und wartet die Aktualisierung nicht ab. Danach sind die Schalter wieder bedienbar
// und schreiben einen veralteten Zielstand."
//
// Das ist kein Anzeigefehler, sondern ein Zustandsfehler: die Basis der nächsten Schaltung kam aus
// der ABFRAGE. Die hinkt nach einem erfolgreichen PUT so lange hinterher, wie das Nachladen
// braucht — und ein zweiter Klick in diesem Fenster schrieb den Stand von VOR dem ersten zurück.
//
// DIE KORREKTUR HAT GENAU EINEN SATZ: die Basis jeder Schaltung ist die zuletzt vom Server
// BESTÄTIGTE Antwort, nie der Nachhall der Abfrage. Drei Teile tragen ihn:
//
//   1  Der PUT antwortet mit dem frischen `configStatus` (`reasoner-routes.ts:863`). Diese Antwort
//      wird ÜBERNOMMEN (`bestaetigt`) und ist ab da die Basis — für Anzeige UND Rumpf des nächsten
//      PUT. Das Nachladen darf beliebig lange dauern.
//   2  Die Bestätigung gilt, bis die Abfrage sie EINGEHOLT hat. Dass ein danach eintreffender Abruf
//      nicht älter sein kann, trägt `invalidateQueries` unmittelbar nach der Bestätigung: es bricht
//      einen laufenden Abruf ab und startet ihn neu (`cancelRefetch` ist die Vorgabe). Ein Abruf,
//      der VOR dem PUT begann und dessen Antwort den Stand von vorher trägt, kommt damit nicht
//      mehr an. GEMESSEN, nicht geglaubt: Fall V5 in `tests/admin-ki-oberflaeche/`.
//   3  Scheitert das Nachladen, sagt die Fläche das und SPERRT weitere Änderungen — sie rät nicht.
//
// WARUM DIE SCHALTER SONST BEDIENBAR BLEIBEN (Auftrag §6 verbietet „ohne verlässlichen Stand"):
// weil ein verlässlicher Stand VORLIEGT — die bestätigte Antwort des Servers selbst.
//
// WAS HIER NICHT PASSIERT: kein zweites Protokoll (der Server schreibt es, `FREIGABE_ZIEL`), keine
// zweite Rechteprüfung als Ersatz (der Server prüft `users.manage`), kein Eingriff in den Kern.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS RUNDE 1 ÜBERSEHEN HAT: ES SIND ZWEI SCHREIBER AUF DERSELBEN KONFIGURATION.
// ------------------------------------------------------------------------------------------------
//
// Runde 1 hat das Zeitfenster zwischen PUT und Nachladen geschlossen — aber nur für die Abfrage.
// Der Prüfer hat den zweiten Schreiber gefunden und den Verlust GEMESSEN (BEN, Runde 1, wörtlich):
//
//   „Eine verspätete Zuordnungs-PUT-Antwort kann eine bestätigte Freigabe überschreiben; die
//    nächste Schaltung löscht sie tatsächlich." · „Beide Mutationen können gleichzeitig laufen."
//    · „Antwortankunft wird dadurch mit Aktualität verwechselt."
//
// SEIN ABLAUF, Schritt für Schritt — und warum am Ende `[false,true]` im Protokoll stand:
//   1  Zuordnung speichern. Der Server verarbeitet den PUT; seine Antwort trägt die Freigabe von
//      JETZT (`{false,false}`) und bleibt unterwegs hängen.
//   2  Öffentliche KI einschalten. Dieser PUT kommt durch, der Server steht auf `{true,false}`,
//      die Karte übernimmt die Bestätigung. Alle GETs hängen.
//   3  Die ALTE Zuordnungsantwort trifft ein. Runde 1 übernahm sie vorbehaltlos
//      (`setBestaetigt(standAus(daten))`, Zeile 516) — die Basis fiel auf `{false,false}` zurück.
//   4  Vertrauliches bestätigen. Der Rumpf entsteht aus dieser zurückgefallenen Basis und schreibt
//      `{oeffentlicheKi:false, vertraulicheInhalte:true}`. Die Freigabe war nicht nur falsch
//      angezeigt, sie war WEG — im unabhängigen GET und im echten Audit.
//
// DIE KORREKTUR HAT WIEDER GENAU EINEN SATZ: Zuordnung und Freigabe sind EIN Schreibkanal mit EINER
// Nummernfolge. Daraus folgen die zwei Zusagen, die der Prüfer verlangt:
//
//   A  EIN SCHREIBEN ZUR ZEIT. Solange irgendein PUT auf `reasoner.config` unterwegs ist, ist der
//      geltende Stand offen — dann sperren BEIDE Bedienungen einander, nicht nur sich selbst
//      (Auftrag §4: „weitere Änderungen bis zu einem verlässlichen Stand sperren"). Die Sperre
//      hängt nicht am `disabled`-Merkmal allein: `schreibnummer()` zieht sie synchron beim Auslösen,
//      also auch dann, wenn zwei Klicks in dasselbe Bild fallen und noch kein `disabled` steht.
//      Schritt 2 des Ablaufs oben ist damit gar nicht mehr möglich.
//   B  EINE ANTWORT ZÄHLT NUR VORWÄRTS. Übernommen wird eine PUT-Antwort nur, wenn ihre Nummer
//      nicht kleiner ist als die der geltenden Bestätigung. Ankunft ist nicht Aktualität; die
//      Nummer wird beim ABSENDEN gezogen. Schritt 3 des Ablaufs oben liefe damit ins Leere.
//
// A allein würde BENs Ablauf schon brechen. B steht daneben, weil A eine Bedienregel ist und B eine
// Zustandsregel: solange nur A trüge, hinge die Richtigkeit des gespeicherten Standes daran, dass
// keine Bedienung je an der Sperre vorbeikommt. Mit B ist das Zurückfallen strukturell unmöglich.

/** Die beiden Schalter der Adminfreigabe — genau der Rumpf, den `PUT /api/reasoner/config` kennt. */
interface KiFreigabeStand {
  readonly oeffentlicheKi: boolean;
  readonly vertraulicheInhalte: boolean;
}

/**
 * Der bestätigte Stand der Karte: Zuordnung UND Freigabe, so wie der Server sie zuletzt meldete.
 *
 * Die Zuordnung gehört dazu, weil der Schreibweg EINER ist: ein fehlendes `global` liest der Server
 * als „auto" (`reasoner-routes.ts:799`). Ein Freigabe-PUT, der die Zuordnung aus einer veralteten
 * Abfrage mitschickte, stellte sie nebenbei zurück — derselbe Fehler, anderes Feld.
 */
interface KiStand {
  readonly global: string;
  readonly perTask: Record<string, string>;
  readonly freigabe: KiFreigabeStand;
}

/** Eine stabile leere Zuordnung — sonst bekäme jeder Rendergang ein neues Objekt. */
const KEINE_AUFGABEN: Record<string, string> = {};

/**
 * Die Freigabe aus einer Serverantwort — „nur `true` zählt", wortgleich zur Lesart des Servers
 * (`services/app/src/routes/reasoner-routes.ts:279-289` und `service.ts:658-660`): `false`,
 * „fehlt" und ein fremder Wert sind dasselbe, nämlich NICHT freigegeben.
 *
 * Gelesen wird aus `unknown` und nicht über den Clienttyp: `ReasonerConfigStatus.taskConfig`
 * (`api/types.ts:1845`) kennt das Feld heute nicht, und `api/types.ts` steht nicht in den
 * Zielpfaden dieses Auftrags. Die Laufzeitprüfung ist hier ohnehin der härtere Vertrag — ein
 * älterer Server schickt das Feld gar nicht.
 */
function freigabeAus(konfig: ReasonerConfigStatus | undefined): KiFreigabeStand {
  const taskConfig: Record<string, unknown> | undefined = konfig?.taskConfig;
  const roh = taskConfig?.kiFreigabe;
  const feld = typeof roh === "object" && roh !== null ? (roh as Record<string, unknown>) : {};
  return {
    oeffentlicheKi: feld.oeffentlicheKi === true,
    vertraulicheInhalte: feld.vertraulicheInhalte === true,
  };
}

/** Der Stand aus einer Serverantwort — aus der Abfrage ODER aus der Antwort eines PUT. */
function standAus(konfig: ReasonerConfigStatus | undefined): KiStand {
  return {
    global: konfig?.taskConfig.global ?? "auto",
    perTask: konfig?.taskConfig.perTask ?? KEINE_AUFGABEN,
    freigabe: freigabeAus(konfig),
  };
}

/**
 * RUNDE 2, Zusage B als Regel: zählt eine eingetroffene Schreibantwort vorwärts?
 *
 * `geltendeNummer` ist die der aktuellen Bestätigung (`null`: es gibt noch keine). Eine Antwort,
 * deren Nummer KLEINER ist, wurde vor der geltenden Bestätigung abgeschickt und trägt den Stand von
 * damals — sie wird verworfen, nicht übernommen. Gleichstand zählt (dieselbe Antwort, nichts Neues).
 *
 * Diese Regel steht als eigene Funktion, damit sie für sich messbar ist: der Schreibkanal
 * (`schreibnummer`) lässt immer nur EIN Schreiben zu und macht das Überholen im Betrieb unmöglich —
 * ohne eigene Prüfung wäre die Regel damit eine Behauptung ohne Beleg.
 */
export function antwortZaehlt(geltendeNummer: number | null, antwortNummer: number): boolean {
  return geltendeNummer === null || antwortNummer >= geltendeNummer;
}

function gleicheFreigabe(a: KiFreigabeStand, b: KiFreigabeStand): boolean {
  return a.oeffentlicheKi === b.oeffentlicheKi && a.vertraulicheInhalte === b.vertraulicheInhalte;
}

/** Hat die Abfrage den bestätigten Stand eingeholt — Zuordnung und Freigabe? */
function gleicherStand(a: KiStand, b: KiStand): boolean {
  return (
    a.global === b.global &&
    gleichePerTask(a.perTask, b.perTask) &&
    gleicheFreigabe(a.freigabe, b.freigabe)
  );
}

// ------------------------------------------------------------------------------------------------
// DIE SÄTZE DER FREIGABE — und warum sie in dieser Datei stehen.
// ------------------------------------------------------------------------------------------------
// Die Zielpfade dieses Auftrags sind diese Datei und `tests/admin-ki-oberflaeche/`; das Wörterbuch
// `apps/web/src/i18n.ts` gehört NICHT dazu. Die Sätze werden deshalb hier gehalten und als
// Ressourcenbündel nachgereicht: derselbe Namensraum („translation"), dieselben Schlüssel, dieselbe
// Prüfbarkeit über `i18n.getResource(<sprache>, "translation", <schlüssel>)`. `overwrite: false`
// heißt: zieht das Wörterbuch die Sätze später zu sich, gewinnt es — nicht diese Datei.
const FREIGABE_TEXTE_DE = {
  "adm.ai.freigabe.titel": "Freigabe für die öffentliche KI",
  "adm.ai.freigabe.oeffentlich": "Öffentliche KI erlauben",
  "adm.ai.freigabe.vertraulich": "Auch vertrauliche Inhalte an die öffentliche KI",
  "adm.ai.freigabe.stand": "Öffentliche KI: {{oeffentlich}} · Vertrauliches: {{vertraulich}}",
  "adm.ai.freigabe.an": "freigegeben",
  "adm.ai.freigabe.aus": "gesperrt",
  "adm.ai.freigabe.wirkungslos":
    "Ohne die Grundfreigabe wirkungslos — es geht nichts an eine öffentliche KI.",
  "adm.ai.freigabe.vertraulichWarnung":
    "Damit gehen auch als vertraulich eingestufte Texte an den externen Anbieter. Bitte ausdrücklich bestätigen.",
  "adm.ai.freigabe.vertraulichJa": "Ja, auch Vertrauliches freigeben",
  "adm.ai.freigabe.abbrechen": "Abbrechen",
  "adm.ai.freigabe.gespeichert": "Freigabe gespeichert.",
  "adm.ai.freigabe.nachladen": "Vom Server bestätigt — der Stand wird nachgeladen.",
  "adm.ai.freigabe.nachladenFehler":
    "Der Stand konnte nicht nachgeladen werden — weitere Änderungen sind bis dahin gesperrt.",
} as const;
const FREIGABE_TEXTE_EN = {
  "adm.ai.freigabe.titel": "Public AI clearance",
  "adm.ai.freigabe.oeffentlich": "Allow public AI",
  "adm.ai.freigabe.vertraulich": "Also send confidential content to the public AI",
  "adm.ai.freigabe.stand": "Public AI: {{oeffentlich}} · Confidential: {{vertraulich}}",
  "adm.ai.freigabe.an": "cleared",
  "adm.ai.freigabe.aus": "blocked",
  "adm.ai.freigabe.wirkungslos":
    "Without the basic clearance this has no effect — nothing goes to a public AI.",
  "adm.ai.freigabe.vertraulichWarnung":
    "This sends text classified as confidential to the external provider as well. Please confirm explicitly.",
  "adm.ai.freigabe.vertraulichJa": "Yes, also clear confidential content",
  "adm.ai.freigabe.abbrechen": "Cancel",
  "adm.ai.freigabe.gespeichert": "Clearance saved.",
  "adm.ai.freigabe.nachladen": "Confirmed by the server — reloading the state.",
  "adm.ai.freigabe.nachladenFehler":
    "The state could not be reloaded — further changes are blocked until it is.",
} as const;
const FREIGABE_TEXTE_NL = {
  "adm.ai.freigabe.titel": "Vrijgave voor de openbare AI",
  "adm.ai.freigabe.oeffentlich": "Openbare AI toestaan",
  "adm.ai.freigabe.vertraulich": "Ook vertrouwelijke inhoud naar de openbare AI",
  "adm.ai.freigabe.stand": "Openbare AI: {{oeffentlich}} · Vertrouwelijk: {{vertraulich}}",
  "adm.ai.freigabe.an": "vrijgegeven",
  "adm.ai.freigabe.aus": "geblokkeerd",
  "adm.ai.freigabe.wirkungslos":
    "Zonder de basisvrijgave heeft dit geen effect — er gaat niets naar een openbare AI.",
  "adm.ai.freigabe.vertraulichWarnung":
    "Hiermee gaat ook als vertrouwelijk aangemerkte tekst naar de externe aanbieder. Bevestig dit uitdrukkelijk.",
  "adm.ai.freigabe.vertraulichJa": "Ja, ook vertrouwelijke inhoud vrijgeven",
  "adm.ai.freigabe.abbrechen": "Annuleren",
  "adm.ai.freigabe.gespeichert": "Vrijgave opgeslagen.",
  "adm.ai.freigabe.nachladen": "Door de server bevestigd — de stand wordt opnieuw geladen.",
  "adm.ai.freigabe.nachladenFehler":
    "De stand kon niet opnieuw worden geladen — verdere wijzigingen zijn tot dan geblokkeerd.",
} as const;
i18n.addResourceBundle("de", "translation", FREIGABE_TEXTE_DE, true, false);
i18n.addResourceBundle("en", "translation", FREIGABE_TEXTE_EN, true, false);
i18n.addResourceBundle("nl", "translation", FREIGABE_TEXTE_NL, true, false);

/** Ein Schalter der Freigabe: Kästchen, Beschriftung — statische Klassen, kein Zustand in der Kette. */
const FREIGABE_ZEILE = "flex items-start gap-2 text-[12.5px] font-semibold text-text";
const FREIGABE_KASTEN = "mt-0.5 h-4 w-4 shrink-0 accent-ai disabled:opacity-50";

export function KiDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  const [aiGlobal, setAiGlobal] = useState<string | null>(null);
  const [aiPerTask, setAiPerTask] = useState<Record<string, string> | null>(null);
  // Pedi-Feedback 02.07. („etwas unübersichtlich"): Feinabstimmung je Einsatz eingeklappt.
  const [showAiDetail, setShowAiDetail] = useState(false);
  // JOB 3783: DER BESTÄTIGTE STAND (Begründung im Block über dieser Komponente). Er lebt, bis die
  // Abfrage ihn eingeholt hat — und nur er ist Basis von Anzeige und nächstem Rumpf. `nummer` ist
  // die des Schreibens, das ihn erzeugt hat (Runde 2, Zusage B).
  const [bestaetigt, setBestaetigt] = useState<{
    stand: KiStand;
    um: number;
    nummer: number;
  } | null>(null);
  // Runde 2, der EINE Schreibkanal für Zuordnung UND Freigabe. Beides sind Refs und keine Zustände:
  // sie müssen SYNCHRON beim Auslösen gelten, nicht erst im nächsten Bild — sonst käme ein zweiter
  // Klick, der in dasselbe Bild fällt, an der Sperre vorbei (Zusage A).
  const letzteNummer = useRef(0);
  /** Die Nummer des laufenden Schreibens — `null` heißt: der Kanal ist frei. */
  const laufendesSchreiben = useRef<number | null>(null);
  /**
   * Zieht die Nummer für ein Schreiben — oder `null`, wenn schon eines unterwegs ist. Wer hier
   * `null` bekommt, schreibt NICHT: der geltende Stand ist bis zur Antwort offen.
   */
  const schreibnummer = (): number | null => {
    if (laufendesSchreiben.current !== null) {
      return null;
    }
    letzteNummer.current += 1;
    laufendesSchreiben.current = letzteNummer.current;
    return letzteNummer.current;
  };
  /**
   * Eine bestätigte Antwort wird die neue Basis — aber nur VORWÄRTS (Zusage B). Die verspätete
   * Antwort eines früheren Schreibens trägt den Stand von damals; sie darf eine neuere Bestätigung
   * nicht ersetzen. Genau daran ist Runde 1 gescheitert (BENs Gegenprobe, Audit `[false,true]`).
   */
  const uebernehmen = (antwort: ReasonerConfigStatus, nummer: number): void => {
    setBestaetigt((alt) =>
      antwortZaehlt(alt?.nummer ?? null, nummer)
        ? { stand: standAus(antwort), um: Date.now(), nummer }
        : alt,
    );
  };
  /** Der Kanal wird frei, sobald das Schreiben beantwortet ist — erfolgreich oder nicht. */
  const kanalFreigeben = (nummer: number): void => {
    if (laufendesSchreiben.current === nummer) {
      laufendesSchreiben.current = null;
    }
  };
  // Die Ablösung, synchron vor dem Rendern (dieselbe Bauform wie das Störungsgedächtnis der Hülle,
  // `components/einstellungen/Abfragehuelle.tsx:130-135`). ZWEI Wege führen hinaus, beide sicher:
  //   · ein Abruf, der NACH der Bestätigung im Cache landete — weil `invalidateQueries` einen noch
  //     laufenden abbricht und neu startet, hat er auch nach ihr begonnen und ist nicht älter (V5);
  //   · ein Abruf, der denselben Stand meldet — dann ist die Bestätigung schlicht überflüssig.
  // Der zweite Weg ist nicht Zierde: in einem Lauf ohne echte Latenz können beide Zeitstempel in
  // dieselbe Millisekunde fallen, und die Karte behauptete sonst ewig „wird nachgeladen".
  if (
    bestaetigt !== null &&
    aiConfig.data !== undefined &&
    (aiConfig.dataUpdatedAt > bestaetigt.um ||
      gleicherStand(standAus(aiConfig.data), bestaetigt.stand))
  ) {
    setBestaetigt(null);
  }
  const basis = bestaetigt?.stand ?? standAus(aiConfig.data);
  const effGlobal = aiGlobal ?? basis.global;
  const effPerTask = aiPerTask ?? basis.perTask;
  // SCRUM-525 P.5 (WP-C): per Deploy-ENV festgelegt → die Karte sperrt die Auswahl und sagt es.
  const gesperrt = aiConfig.data?.policySource === "env";
  // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf; Ergebnis bleibt sichtbar stehen — bis die
  // Zuordnung gespeichert wird (JOB 3134): danach gälte es für einen anderen Anbieter.
  const aiTest = useMutation({ mutationFn: () => endpoints.reasoner.test() });
  const aiSave = useMutation({
    // JOB 3134: der Entwurf wird als PAYLOAD mitgegeben, nicht aus dem Zustand gelesen — nur so
    // weiss der Erfolgsfall unten, WAS gesendet wurde.
    // Runde 2: `nummer` reist als Variable mit, NICHT im Rumpf — `updateConfig` bekommt nur die
    // beiden Felder, die die Route kennt (`reasoner-routes.ts:744-751`).
    mutationFn: (payload: {
      global: string;
      perTask: Record<string, string>;
      nummer: number;
    }) => endpoints.reasoner.updateConfig({ global: payload.global, perTask: payload.perTask }),
    onSuccess: (daten, payload) => {
      kanalFreigeben(payload.nummer);
      void qc.invalidateQueries({ queryKey: ["reasonerConfig"] });
      // AUFTRAG kimodus-live: die Topbar-Badges hängen an EIGENEN Queries — ohne diese
      // Invalidierung springt die Topbar erst nach Hard-Reload auf den neuen Modus.
      invalidateAiState(qc);
      // JOB 3134: NUR den Entwurf verwerfen, der gesendet wurde. Eine WÄHREND des Speicherns
      // geänderte Wahl bliebe sonst still verloren (P03 Nachweis C) — sie bleibt als
      // „nicht gespeichert" stehen.
      setAiGlobal((aktuell) => (aktuell === null || aktuell === payload.global ? null : aktuell));
      setAiPerTask((aktuell) =>
        aktuell === null || gleichePerTask(aktuell, payload.perTask) ? null : aktuell,
      );
      // JOB 3783 (Korrekturpflicht 1 des Prüfers, „verwirft die PUT-Antwort", 3501 R3): auch DIESER
      // Weg übernimmt jetzt, was der Server bestätigt hat. `daten` ist der frische `configStatus`
      // (`reasoner-routes.ts:863`) — samt der Freigabe, die das Speichern der Zuordnung bewusst
      // NICHT mitschickt und die der Server deshalb unverändert lässt (Vertrag §3, JOB 3549).
      //
      // RUNDE 2: und zwar über `uebernehmen`, also nur VORWÄRTS. Verspätet eingetroffen trägt diese
      // Antwort eine Freigabe von vor der letzten Bestätigung — sie darf sie nicht zurücksetzen.
      uebernehmen(daten, payload.nummer);
      // JOB 3134: ein altes Prüfergebnis gilt nicht für die neue Zuordnung — weg damit, bis neu
      // geprüft wird (P03 Lieferumfang 3).
      aiTest.reset();
      push("success", t("adm.ai.saved"));
    },
    // Bei Speicherfehler bleibt der Entwurf stehen (Hinweis „nicht gespeichert") und der Server
    // behält den alten Stand — die Statuszeile zeigt weiter die gespeicherte Zuordnung.
    onError: (e, payload) => {
      kanalFreigeben(payload.nummer);
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });
  // JOB 3783: die ausdrückliche Bestätigung des ZWEITEN, teureren Schalters (Vertrag §5). Sie ist
  // ein Zwischenschritt der Fläche, keine zweite Entscheidung: gesendet wird erst auf „Ja".
  const [vertraulichFrage, setVertraulichFrage] = useState(false);
  // JOB 3783: der Schreibweg der Freigabe — DERSELBE Endpunkt wie die Zuordnung, kein zweiter
  // Adminweg (JOB 3549: „ein zweiter Adminweg wäre ein zweites Recht, ein zweites Protokoll").
  //
  // Er geht bewusst nicht über `endpoints.reasoner.updateConfig`: dessen Signatur
  // (`api/endpoints.ts:613`) kennt `kiFreigabe` nicht, und `api/endpoints.ts` steht nicht in den
  // Zielpfaden dieses Auftrags. Sein Platz dort steht in der Rückgabe unter ABWEICHUNGEN.
  const freigabeSpeichern = useMutation({
    mutationFn: (auftrag: { naechste: KiFreigabeStand; nummer: number }) =>
      api.put<ReasonerConfigStatus>("/reasoner/config", {
        // Die BESTÄTIGTE Zuordnung, nicht der Entwurf: ein Klick auf einen Freigabeschalter darf
        // keine ungespeicherte Anbieterwahl nebenbei übernehmen — und keine gespeicherte verlieren.
        // RUNDE 2: `basis` ist hier verlässlich, weil der Kanal frei war — es kann kein Schreiben
        // unterwegs sein, dessen Antwort diese Zuordnung gerade ändert.
        global: basis.global,
        perTask: basis.perTask,
        kiFreigabe: auftrag.naechste,
      }),
    onSuccess: (antwort, auftrag) => {
      kanalFreigeben(auftrag.nummer);
      uebernehmen(antwort, auftrag.nummer);
      setVertraulichFrage(false);
      // Unmittelbar nach der Bestätigung, und das ist Teil 2 des Zustandsmodells oben: ein noch
      // laufender Abruf wird abgebrochen und neu gestartet. Sonst käme seine VOR dem PUT erzeugte
      // Antwort später an und überholte die Bestätigung mit dem alten Stand (Fall V5).
      void qc.invalidateQueries({ queryKey: ["reasonerConfig"] });
      invalidateAiState(qc);
      push("success", t("adm.ai.freigabe.gespeichert"));
    },
    // 409 (ENV-Sperre), 503 (nicht protokollierbar) und jeder andere Fehler: die Freigabe hat NICHT
    // gewechselt, `bestaetigt` bleibt unberührt, und die Meldung des Servers steht an der Karte.
    onError: (e, auftrag) => {
      kanalFreigeben(auftrag.nummer);
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });
  /** Zuordnung speichern — über den EINEN Kanal, mit Nummer (Runde 2, Zusage A). */
  const zuordnungSpeichern = (): void => {
    const nummer = schreibnummer();
    if (nummer === null) {
      return;
    }
    aiSave.mutate({ global: effGlobal, perTask: effPerTask, nummer });
  };
  /** Freigabe schalten — derselbe Kanal, dieselbe Nummernfolge. */
  const freigabeSchalten = (naechste: KiFreigabeStand): void => {
    const nummer = schreibnummer();
    if (nummer === null) {
      return;
    }
    freigabeSpeichern.mutate({ naechste, nummer });
  };
  // Gescheitertes Nachladen heißt: die Karte kennt den geltenden Stand nicht mehr sicher. Dann wird
  // nicht geraten, sondern gesperrt (Auftrag §7c) — die Hülle hält die Daten daneben sichtbar.
  const nachladenGescheitert = aiConfig.isError;
  // RUNDE 2 (BEN: „Beide Mutationen können gleichzeitig laufen."): solange IRGENDEIN Schreiben auf
  // `reasoner.config` unterwegs ist, ist der geltende Stand offen — dann sperren Freigabe und
  // Zuordnung einander, nicht nur sich selbst.
  const schreibenLaeuft = aiSave.isPending || freigabeSpeichern.isPending;
  const schalterGesperrt = gesperrt || schreibenLaeuft || nachladenGescheitert;
  /** Der lesbare Name eines Auswahlwerts — für Hinweise neben dem Feld. */
  const wahlName = (wahl: string): string => {
    if (wahl === "openai" || wahl === "anthropic") {
      return anbieterName(wahl);
    }
    if (wahl === "auto" || wahl === "local" || wahl === "deterministic") {
      return t(`adm.ai.choice.${wahl}`);
    }
    return wahl;
  };
  // SCRUM-428: separater Key-Test für den eigenen lokalen LLM.
  const aiTestLocal = useMutation({ mutationFn: () => endpoints.reasoner.testLocal() });
  // SCRUM-493/494: End-to-End-Selbsttests der Konflikt- und Duplikat-Erkennung.
  const conflictSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.conflictSelfTest() });
  const dupSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.duplicateSelfTest() });
  const runSelfTests = (): void => {
    conflictSelfTest.mutate();
    dupSelfTest.mutate();
  };
  const selfTestPending = conflictSelfTest.isPending || dupSelfTest.isPending;

  return (
    <Detailkarte
      titel={t("adm.ai.title")}
      onZurueck={onZurueck}
      testId="detail-ki"
      hilfe={[
        { titel: t("adm.ai.title"), text: t("adm.ai.help") },
        { titel: t("adm.ai.title"), text: t("adm.ai.internExtern") },
      ]}
    >
      <Abfragehuelle abfrage={aiConfig}>
        {(konfig) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {/* JOB 3120 (UX-10 Teil 1): EIN DIENST, EIN NAME. Hier stand die rohe Client-Kennung
                (`anthropic:claude-sonnet-4-6`), während die Zugangsliste denselben Dienst schon
                „Claude (Anthropic) · claude-sonnet-4-6" nannte — dieselbe Karte, zwei Sprachen.
                `anbieterUndModell` (lib/aiOverview) ist die EINE Übersetzung; hier wird sie nur
                aufgerufen, nicht nachgebaut. Der Eingabewert ist bewusst DERSELBE Ausdruck wie in
                der Cloud-Zeile (`aiOverview.ts:69`), damit beide Stellen nicht auseinanderlaufen
                können. Der Betriebsweg (`mode`) bleibt eine EIGENE Aussage daneben — ein Dienst ist
                kein Modus. */}
              <p data-testid="ki-status" className="text-[12.5px] text-muted">
                {t("adm.ai.status", {
                  provider: anbieterUndModell(konfig.model ?? konfig.provider),
                  mode: konfig.mode === "model" ? t("adm.ai.modeModel") : t("adm.ai.modeDemo"),
                })}
              </p>
              {/* Key-Test (Pedi 02.07.): Anzeige ≠ Beweis — der Knopf macht den Echtaufruf. */}
              <button
                type="button"
                disabled={aiTest.isPending}
                onClick={() => aiTest.mutate()}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {aiTest.isPending ? t("adm.ai.testRunning") : t("adm.ai.test")}
              </button>
              {/* SCRUM-428: zweiter Knopf — echter Mini-Aufruf beim eigenen lokalen LLM. */}
              <button
                type="button"
                disabled={aiTestLocal.isPending}
                onClick={() => aiTestLocal.mutate()}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {aiTestLocal.isPending ? t("adm.ai.testRunning") : t("adm.ai.testLocal")}
              </button>
              {/* SCRUM-493/494: EIN Klick prüft BEIDE Erkennungsarten (Konflikt + Duplikat). */}
              <button
                type="button"
                disabled={selfTestPending}
                onClick={runSelfTests}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {selfTestPending ? t("adm.selfTest.running") : t("adm.selfTest.button")}
              </button>
            </div>
            {aiTest.data?.ok ? (
              <p className="rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[12px] text-trust-pos-text">
                {/* JOB 3120: derselbe Name wie in der Statuszeile darüber — auch hier ist
                    `provider` der Client-Name (`service.ts:847`), keine zweite Größe. */}
                {t("adm.ai.testOk", { provider: anbieterUndModell(aiTest.data.provider) })}
              </p>
            ) : null}
            {/* JOB 3420: eine frisch und erfolgreich beantwortete Messung — hier DARF die Karte
              eine Ursache nennen, und zwar die, die der Server gemessen hat. Der Bereich steht
              IMMER (auch während einer Wiederholung), er entscheidet selbst, was er zeigt. */}
            <KiFehlerbereich
              testIdBasis="ki-fehler-cloud"
              art="cloud"
              ergebnis={aiTest.data}
              anfrageFehler={aiTest.isError}
              laeuft={aiTest.isPending}
              wiederholen={() => aiTest.mutate()}
            />
            {/* SCRUM-428: Ergebnis des lokalen Key-Tests, gleiche ehrliche Darstellung. */}
            {aiTestLocal.data?.ok ? (
              <p className="rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[12px] text-trust-pos-text">
                {/* JOB 3120: dieselbe Ableitung. Der lokale Client heißt `local:<modell>` und hat
                    in der Tabelle bewusst KEINEN Eintrag — er bleibt darum wörtlich stehen (der
                    eigene Server ist kein Anbieter, dem man Texte „zeigt"). */}
                {t("adm.ai.testLocalOk", {
                  provider: anbieterUndModell(aiTestLocal.data.provider),
                })}
              </p>
            ) : null}
            {/* JOB 3420: `art: "local"` — hier erscheint in KEINEM Fall ein Cloud-Schlüsseltipp. */}
            <KiFehlerbereich
              testIdBasis="ki-fehler-local"
              art="local"
              ergebnis={aiTestLocal.data}
              anfrageFehler={aiTestLocal.isError}
              laeuft={aiTestLocal.isPending}
              wiederholen={() => aiTestLocal.mutate()}
            />
            {/* SCRUM-493: strukturiertes OK/FAIL des Konflikt-Selbsttests inkl. Provider + Streitpunkt. */}
            {conflictSelfTest.data ? (
              <div
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  conflictSelfTest.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                <p className="font-semibold">
                  {conflictSelfTest.data.ok ? "OK" : "FAIL"} · {t("adm.conflictSelfTest.label")}:{" "}
                  {t(conflictSelfTest.data.messageKey)}
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {/* JOB 3120: derselbe Name wie Statuszeile und Schlüsseltest. */}
                  {t("adm.conflictSelfTest.provider", {
                    provider: anbieterUndModell(conflictSelfTest.data.provider),
                  })}
                  {conflictSelfTest.data.hasKollision && conflictSelfTest.data.streitpunkt
                    ? ` · ${t("adm.conflictSelfTest.streitpunkt", {
                        streitpunkt: conflictSelfTest.data.streitpunkt,
                      })}`
                    : ""}
                </p>
              </div>
            ) : null}
            <KiFehlerbereich
              testIdBasis="ki-fehler-konflikt"
              art="selftest"
              anfrageFehler={conflictSelfTest.isError}
              laeuft={conflictSelfTest.isPending}
              wiederholen={() => conflictSelfTest.mutate()}
            />
            {/* SCRUM-494: strukturiertes OK/FAIL des Duplikat-Selbsttests inkl. Provider + Beziehung. */}
            {dupSelfTest.data ? (
              <div
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  dupSelfTest.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                <p className="font-semibold">
                  {dupSelfTest.data.ok ? "OK" : "FAIL"} · {t("adm.dupSelfTest.label")}:{" "}
                  {t(dupSelfTest.data.messageKey)}
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {/* JOB 3120: derselbe Name wie Statuszeile und Schlüsseltest. */}
                  {t("adm.conflictSelfTest.provider", {
                    provider: anbieterUndModell(dupSelfTest.data.provider),
                  })}
                  {dupSelfTest.data.duplicateCreated && dupSelfTest.data.relation
                    ? ` · ${t("adm.dupSelfTest.relation", { relation: dupSelfTest.data.relation })}`
                    : ""}
                </p>
              </div>
            ) : null}
            <KiFehlerbereich
              testIdBasis="ki-fehler-duplikat"
              art="selftest"
              anfrageFehler={dupSelfTest.isError}
              laeuft={dupSelfTest.isPending}
              wiederholen={() => dupSelfTest.mutate()}
            />
            {/* SCRUM-525 P.5 (WP-C): per Deploy-ENV festgelegt — die Auswahl ist gesperrt, und die
              Karte sagt, WELCHE Variable das tut (ein PUT liefert ohnehin 409). */}
            {gesperrt ? (
              <output
                data-testid="ki-env-gesperrt"
                className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
              >
                {t("adm.ai.envLocked")}
              </output>
            ) : null}
            {/* ==========================================================================
              JOB 3783 · DIE FREIGABE. Zwei Schalter, gespeist aus `taskConfig.kiFreigabe`,
              geschrieben über denselben Adminweg wie die Zuordnung. Die Basis ist `basis` —
              der bestätigte Stand, nicht `konfig`. Genau darin liegt der Unterschied zu
              JOB 3501: `konfig` hinkt nach einem PUT so lange nach, wie das Nachladen braucht.
              ========================================================================== */}
            <div className="space-y-1.5 border-t border-hairline pt-2.5">
              <p className="text-[12.5px] font-semibold text-text">{t("adm.ai.freigabe.titel")}</p>
              <label className={FREIGABE_ZEILE}>
                <input
                  type="checkbox"
                  data-testid="ki-freigabe-oeffentlich"
                  className={FREIGABE_KASTEN}
                  checked={basis.freigabe.oeffentlicheKi}
                  disabled={schalterGesperrt}
                  onChange={(e) =>
                    freigabeSchalten({ ...basis.freigabe, oeffentlicheKi: e.target.checked })
                  }
                />
                <span>{t("adm.ai.freigabe.oeffentlich")}</span>
              </label>
              <label className={FREIGABE_ZEILE}>
                <input
                  type="checkbox"
                  data-testid="ki-freigabe-vertraulich"
                  className={FREIGABE_KASTEN}
                  checked={basis.freigabe.vertraulicheInhalte}
                  disabled={schalterGesperrt}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Erweiterung: erst die Warnung, dann die ausdrückliche Bestätigung.
                      setVertraulichFrage(true);
                      return;
                    }
                    // Rücknahme führt in die sichere Richtung und braucht keine Rückfrage.
                    setVertraulichFrage(false);
                    freigabeSchalten({ ...basis.freigabe, vertraulicheInhalte: false });
                  }}
                />
                <span>{t("adm.ai.freigabe.vertraulich")}</span>
              </label>
              {/* Der zweite Schalter ohne den ersten ist WIRKUNGSLOS (`service.ts:658-660`) — das
                steht da, statt dass die Karte eine Wirkung behauptet, die es nicht gibt. Er bleibt
                trotzdem bedienbar: beide Einschaltreihenfolgen müssen möglich sein. */}
              {basis.freigabe.vertraulicheInhalte && !basis.freigabe.oeffentlicheKi ? (
                <output
                  data-testid="ki-freigabe-wirkungslos"
                  className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
                >
                  {t("adm.ai.freigabe.wirkungslos")}
                </output>
              ) : null}
              {vertraulichFrage ? (
                <div
                  data-testid="ki-freigabe-vertraulich-frage"
                  className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
                >
                  <p className="font-semibold">{t("adm.ai.freigabe.vertraulichWarnung")}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="ki-freigabe-vertraulich-ja"
                      disabled={schalterGesperrt}
                      onClick={() =>
                        freigabeSchalten({ ...basis.freigabe, vertraulicheInhalte: true })
                      }
                      className="inline-flex h-7 items-center rounded-btn border border-trust-warn-text/40 px-2.5 text-[11.5px] font-semibold hover:bg-trust-warn-text/10 disabled:opacity-50"
                    >
                      {t("adm.ai.freigabe.vertraulichJa")}
                    </button>
                    <button
                      type="button"
                      data-testid="ki-freigabe-vertraulich-nein"
                      onClick={() => setVertraulichFrage(false)}
                      className="inline-flex h-7 items-center rounded-btn px-2.5 text-[11.5px] font-semibold hover:bg-trust-warn-text/10"
                    >
                      {t("adm.ai.freigabe.abbrechen")}
                    </button>
                  </div>
                </div>
              ) : null}
              {/* Was GILT — aus dem bestätigten Stand, nicht aus dem Kästchen daneben. */}
              <output data-testid="ki-freigabe-stand" className="block text-[12px] text-muted">
                {t("adm.ai.freigabe.stand", {
                  oeffentlich: basis.freigabe.oeffentlicheKi
                    ? t("adm.ai.freigabe.an")
                    : t("adm.ai.freigabe.aus"),
                  vertraulich: basis.freigabe.vertraulicheInhalte
                    ? t("adm.ai.freigabe.an")
                    : t("adm.ai.freigabe.aus"),
                })}
              </output>
              {nachladenGescheitert ? (
                <output
                  data-testid="ki-freigabe-nachladen-fehler"
                  className="flex flex-wrap items-center gap-2 rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] font-semibold text-trust-warn-text"
                >
                  <span className="flex-1">{t("adm.ai.freigabe.nachladenFehler")}</span>
                  <button
                    type="button"
                    data-testid="ki-freigabe-erneut"
                    onClick={() => void aiConfig.refetch()}
                    className="inline-flex items-center rounded-btn px-2 py-0.5 hover:bg-trust-warn-text/10"
                  >
                    {t("loadstate.error.retry")}
                  </button>
                </output>
              ) : bestaetigt !== null ? (
                <output
                  data-testid="ki-freigabe-nachladen"
                  className="block text-[12px] text-muted-2"
                >
                  {t("adm.ai.freigabe.nachladen")}
                </output>
              ) : null}
              {freigabeSpeichern.isError ? (
                <p
                  data-testid="ki-freigabe-fehler"
                  className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
                >
                  {freigabeSpeichern.error instanceof ApiError
                    ? freigabeSpeichern.error.message
                    : t("state.error")}
                </p>
              ) : null}
            </div>
            {/* JOB 3134: ein abgelöster Wert (`cloud`/`model`) aus dem Bestand wurde beim Laden auf
              einen Anbieter überführt — sichtbar, nicht still; „übernehmen" schreibt den neuen Wert. */}
            {konfig.migration ? (
              <p
                data-testid="ki-migration"
                className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
              >
                {[
                  ...(konfig.migration.global
                    ? [
                        t("adm.ai.migrated", {
                          von: konfig.migration.global.von,
                          nach: wahlName(konfig.migration.global.nach),
                        }),
                      ]
                    : []),
                  ...Object.entries(konfig.migration.perTask).map(
                    ([task, m]) =>
                      `${t(`adm.ai.task.${task}`)}: ${t("adm.ai.migrated", {
                        von: m.von,
                        nach: wahlName(m.nach),
                      })}`,
                  ),
                ].join(" · ")}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-[11.5px] font-semibold text-muted">
                {t("adm.ai.global")}
                <select
                  data-testid="ki-wahl-global"
                  value={effGlobal}
                  disabled={gesperrt}
                  onChange={(e) => setAiGlobal(e.target.value)}
                  className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text disabled:opacity-60"
                >
                  <WahlOptionen konfig={konfig} />
                </select>
              </label>
            </div>
            {/* JOB 3134: abweichende Aufgaben stehen AUSGESCHRIEBEN unter dem globalen Feld — ein
              globales „aktiv" darf keine Aufgabe verstecken, die an einen anderen Anbieter geht. */}
            {Object.keys(konfig.taskConfig.perTask).length > 0 ? (
              <p data-testid="ki-abweichungen" className="text-[12px] text-muted">
                {t("adm.ai.deviation", {
                  list: Object.entries(konfig.taskConfig.perTask)
                    .map(([task, wahl]) => `${t(`adm.ai.task.${task}`)} → ${wahlName(wahl)}`)
                    .join(" · "),
                })}
              </p>
            ) : null}
            {/* AUFTRAG kimodus-live (Variante b): kein doppeldeutiger Zustand — geänderte, noch nicht
              übernommene Auswahl sagt es; nach dem Übernehmen steht „Übernommen ✓".
              JOB 3134: und sie sagt, WAS gewählt ist und WAS bis dahin aktiv bleibt. */}
            {aiGlobal !== null || aiPerTask !== null ? (
              <output
                data-testid="ki-ungespeichert"
                className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] font-semibold text-trust-warn-text"
              >
                {t("adm.ai.dirtyHint")}{" "}
                {t("adm.ai.dirtyActive", {
                  gewaehlt: wahlName(effGlobal),
                  aktiv: anbieterUndModell(konfig.model ?? konfig.provider),
                })}
              </output>
            ) : aiSave.isSuccess ? (
              <output className="block rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[12px] font-semibold text-trust-pos-text">
                {t("adm.ai.applied")}
              </output>
            ) : null}
            <button
              type="button"
              aria-expanded={showAiDetail || Object.keys(effPerTask).length > 0}
              onClick={() => setShowAiDetail((s) => !s)}
              className="flex w-full items-center justify-between gap-2 border-t border-hairline pt-2.5 text-left"
            >
              <span className="text-[12.5px] font-semibold text-text">
                {t("adm.ai.detail")}
                {Object.keys(effPerTask).length > 0 ? (
                  <span className="ml-1.5 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-muted-2">
                    {Object.keys(effPerTask).length}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] text-muted-2">{t("adm.ai.detailHint")}</span>
            </button>
            {showAiDetail || Object.keys(effPerTask).length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_TASKS.map((task) => (
                  <label key={task} className="block text-[11.5px] font-semibold text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`adm.ai.task.${task}`)}
                      <span
                        className={`rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                          aiConfig.data?.effective[task] === "model"
                            ? "bg-ai-surface-1 text-ai"
                            : "bg-page text-muted-2"
                        }`}
                      >
                        {/* SCRUM-424: ehrlich zeigen, WELCHE KI zuerst arbeitet. JOB 3134: mit
                          dem Anbieternamen — „extern" sagt nicht, wem die Texte gezeigt werden. */}
                        {t(
                          `adm.ai.eff.${
                            konfig.effectiveAnbieter?.[task] ??
                            konfig.effectiveProvider[task] ??
                            "deterministic"
                          }`,
                        )}
                      </span>
                    </span>
                    <select
                      data-testid={`ki-wahl-${task}`}
                      value={effPerTask[task] ?? ""}
                      disabled={gesperrt}
                      onChange={(e) => {
                        // JOB 3134 (Codex-Nachtrag, AdminKiDetails.tsx:325–334): „wie global" muss
                        // den Schlüssel WIRKLICH entfernen. Vorher wurde erst der ganze alte Stand
                        // übernommen und dann eine Kopie ohne den Schlüssel HINEINGEMISCHT — der
                        // alte Eintrag blieb erhalten, die Ausnahme war nie weg.
                        const naechster = { ...effPerTask };
                        if (e.target.value) {
                          naechster[task] = e.target.value;
                        } else {
                          delete naechster[task];
                        }
                        setAiPerTask(naechster);
                      }}
                      className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text disabled:opacity-60"
                    >
                      <option value="">{t("adm.ai.choice.inherit")}</option>
                      <WahlOptionen konfig={konfig} />
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {/* RUNDE 2: derselbe Kanal wie die Freigabe — dieser Knopf ruht auch, solange eine
                Freigabe unterwegs ist, und bei gescheitertem Nachladen (Auftrag §7c: „sperrt
                weitere Änderungen"). Sein Rumpf trägt `basis.perTask` mit; aus einer Abfrage, die
                den Stand nicht mehr sicher kennt, wäre das ein geratener Wert. */}
              <Button
                variant="primary"
                disabled={
                  gesperrt ||
                  schreibenLaeuft ||
                  nachladenGescheitert ||
                  (aiGlobal === null && aiPerTask === null)
                }
                onClick={zuordnungSpeichern}
              >
                <Sparkles size={14} />
                {t("adm.ai.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.ai.persistNote")}</span>
            </div>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-413: „Verfügbare KIs" — ehrliche Übersicht aus dem echten configStatus. */
export function KiZugaengeDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  return (
    <Detailkarte
      titel={t("adm.ai.accessTitle")}
      onZurueck={onZurueck}
      testId="detail-ki-zugaenge"
      hilfe={[{ titel: t("adm.ai.accessTitle"), text: t("adm.ai.accessHelp") }]}
    >
      <Abfragehuelle abfrage={aiConfig}>
        {(konfig) => (
          <ul className="space-y-2">
            {aiAccessRows(konfig).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-hairline p-2.5"
              >
                <span className="text-[13px] font-semibold text-text">
                  {t(`adm.ai.access.${row.id}`)}
                </span>
                {row.detail ? (
                  <span className="font-mono text-[11px] text-muted-2">{row.detail}</span>
                ) : null}
                <span
                  className={`ml-auto rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${ACCESS_STATE_TONE[row.state]}`}
                >
                  {t(`adm.ai.state.${row.state}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Abfragehuelle>
      <p className="text-[11px] text-muted-2">{t("adm.ai.accessNote")}</p>
    </Detailkarte>
  );
}

/** SCRUM-386: kundeneigene KI-Funktionen (Presets) für die Editor-Palette. */
export function KiFunktionenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const presetsQuery = useQuery({
    queryKey: ["reasoner", "assistPresets"],
    queryFn: endpoints.reasoner.assistPresets,
  });
  const [presetDraft, setPresetDraft] = useState<
    { id?: string; name: string; instruction: string }[] | null
  >(null);
  const effPresets = presetDraft ?? presetsQuery.data ?? [];
  const presetsSave = useMutation({
    mutationFn: () =>
      endpoints.reasoner.updateAssistPresets(
        effPresets.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name,
          instruction: p.instruction,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reasoner", "assistPresets"] });
      setPresetDraft(null);
      push("success", t("adm.presets.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.presets.title")}
      onZurueck={onZurueck}
      testId="detail-ki-funktionen"
      hilfe={[
        { titel: t("adm.presets.title"), text: t("adm.presets.help") },
        { titel: t("adm.presets.title"), text: t("adm.presets.hint") },
      ]}
    >
      {/* Die Hülle steht VOR der Liste und vor dem Speichern-Knopf: ohne geladenen Bestand wäre
          `effPresets` leer, „keine eigenen Funktionen" wäre eine Behauptung ohne Antwort — und ein
          Klick auf Speichern würde die serverseitige Liste mit dieser Leere überschreiben. */}
      <Abfragehuelle abfrage={presetsQuery}>
        {() => (
          <>
            {effPresets.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.presets.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {effPresets.map((p, i) => (
                  <li
                    key={p.id ?? `neu-${i}`}
                    className="rounded-card border border-hairline p-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <TextInput
                        value={p.name}
                        onChange={(e) =>
                          setPresetDraft(
                            effPresets.map((x, xi) =>
                              xi === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={t("adm.presets.name")}
                        aria-label={t("adm.presets.name")}
                      />
                      <TextInput
                        value={p.instruction}
                        onChange={(e) =>
                          setPresetDraft(
                            effPresets.map((x, xi) =>
                              xi === i ? { ...x, instruction: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={t("adm.presets.instruction")}
                        aria-label={t("adm.presets.instruction")}
                      />
                      <button
                        type="button"
                        title={t("adm.presets.remove")}
                        onClick={() => setPresetDraft(effPresets.filter((_, xi) => xi !== i))}
                        className="grid h-9 w-9 place-items-center justify-self-end rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                disabled={effPresets.length >= 12}
                onClick={() => setPresetDraft([...effPresets, { name: "", instruction: "" }])}
              >
                {t("adm.presets.add")}
              </Button>
              <Button
                variant="primary"
                disabled={presetsSave.isPending || presetDraft === null}
                onClick={() => presetsSave.mutate()}
              >
                <Sparkles size={14} />
                {t("adm.presets.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.presets.note")}</span>
            </div>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/**
 * SCRUM-395 + SCRUM-421: „Prüfungen und Grenzen" — Standard-Prüferanzahl und Upload-Grenzen. Beide
 * standen bisher im Reiter „Daten"; sie gehören zu dem, was die Prüfung und die KI verarbeiten.
 */
export function KiGrenzenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const valSettings = useQuery({
    queryKey: ["validation", "settings"],
    queryFn: endpoints.validation.settings,
  });
  const [defaultNeededDraft, setDefaultNeededDraft] = useState<string | null>(null);
  const saveDefaultNeeded = useMutation({
    mutationFn: () =>
      endpoints.validation.saveSettings(parseNeededValidations(defaultNeededDraft ?? "")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["validation", "settings"] });
      setDefaultNeededDraft(null);
      push("success", t("adm.val.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  // E2E-005 / bens Auflage D4: EXAKT derselbe Vertrag wie der Server — eine ECHTE ganze Zahl 1–5.
  // (`Number.parseInt` nahm „1.5"/„1x" fälschlich als 1 an; eine Quelle: parseNeededValidations.)
  const neededEffective =
    defaultNeededDraft ?? String(valSettings.data?.defaultNeededValidations ?? "");
  const neededParsed = parseNeededValidations(neededEffective);
  const neededValid = Number.isInteger(neededParsed) && neededParsed >= 1 && neededParsed <= 5;

  const uploadLimitsQ = useQuery({
    queryKey: ["upload-limits"],
    queryFn: endpoints.uploadLimits.get,
  });
  const [maxAttDraft, setMaxAttDraft] = useState<string | null>(null);
  const [maxMbDraft, setMaxMbDraft] = useState<string | null>(null);
  const saveUploadLimits = useMutation({
    mutationFn: () =>
      endpoints.uploadLimits.save({
        maxAttachments: Number.parseInt(
          maxAttDraft ?? String(uploadLimitsQ.data?.maxAttachments ?? 8),
          10,
        ),
        maxAttachmentBytes: Math.round(
          Number.parseFloat(
            maxMbDraft ??
              String((uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000),
          ) * 1_000_000,
        ),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["upload-limits"] });
      setMaxAttDraft(null);
      setMaxMbDraft(null);
      push("success", t("adm.upload.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("einst.ki.grenzen")}
      onZurueck={onZurueck}
      testId="detail-ki-grenzen"
      hilfe={[
        { titel: t("adm.val.title"), text: t("adm.val.help") },
        { titel: t("adm.val.title"), text: t("adm.val.hint") },
        { titel: t("adm.upload.title"), text: t("adm.upload.help") },
        { titel: t("adm.upload.title"), text: t("adm.upload.hint") },
      ]}
    >
      {/* Zwei Quellen, zwei Hüllen: die Prüferanzahl und die Upload-Grenzen scheitern unabhängig
          voneinander, und ein Feld ohne geladenen Wert wäre eine leere Behauptung. */}
      <Abfragehuelle abfrage={valSettings} testId="huelle-pruefanzahl">
        {() => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Field label={t("adm.val.label")}>
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  className="w-24"
                  value={neededEffective}
                  onChange={(e) => setDefaultNeededDraft(e.target.value)}
                  aria-label={t("adm.val.label")}
                  aria-invalid={!neededValid}
                  aria-describedby="adm-val-error"
                />
              </Field>
              <Button
                variant="primary"
                disabled={
                  saveDefaultNeeded.isPending || defaultNeededDraft === null || !neededValid
                }
                onClick={() => saveDefaultNeeded.mutate()}
              >
                {t("adm.val.save")}
              </Button>
            </div>
            {/* E2E-005: zugängliche, deutsche Fehlermeldung, sobald der Wert ungültig ist (z. B. 0). */}
            <output
              id="adm-val-error"
              aria-live="polite"
              className="block text-[12px] text-trust-crit-text"
            >
              {neededValid ? "" : t("adm.val.invalid")}
            </output>
          </>
        )}
      </Abfragehuelle>

      <Abfragehuelle abfrage={uploadLimitsQ} testId="huelle-uploadgrenzen">
        {() => (
          <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-4">
            <Field label={t("adm.upload.maxAttachments")}>
              <TextInput
                type="number"
                min={1}
                max={30}
                className="w-24"
                value={maxAttDraft ?? String(uploadLimitsQ.data?.maxAttachments ?? "")}
                onChange={(e) => setMaxAttDraft(e.target.value)}
                aria-label={t("adm.upload.maxAttachments")}
              />
            </Field>
            <Field label={t("adm.upload.maxMb")}>
              <TextInput
                type="number"
                min={0.1}
                step={0.1}
                className="w-24"
                value={
                  maxMbDraft ??
                  String((uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000)
                }
                onChange={(e) => setMaxMbDraft(e.target.value)}
                aria-label={t("adm.upload.maxMb")}
              />
              {/* AUFTRAG-mega15 Block E: der eingestellte Wert misst die ÜBERTRAGENE Daten-URL; hier
              steht, was das an reiner Dateigröße bedeutet — am gerade eingetippten Entwurfswert. */}
              <p data-testid="upload-raw-limit" className="mt-1 text-[11px] text-muted-2">
                {t("adm.upload.rawHint", {
                  raw: maxRawAttachmentMb(
                    Math.round(
                      Number.parseFloat(
                        maxMbDraft ??
                          String(
                            (uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000,
                          ),
                      ) * 1_000_000,
                    ) || 0,
                  ),
                })}
              </p>
            </Field>
            <Button
              variant="primary"
              disabled={saveUploadLimits.isPending || (maxAttDraft === null && maxMbDraft === null)}
              onClick={() => saveUploadLimits.mutate()}
            >
              {t("adm.upload.save")}
            </Button>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-414: Regler „externe Wissensabfrage" — vier Stufen von blockiert bis offen. */
export function KiExternDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const extPolicy = useQuery({
    queryKey: ["external", "policy"],
    queryFn: endpoints.external.policy,
  });
  const [extPolicyDraft, setExtPolicyDraft] = useState<ExternalKnowledgeStage | null>(null);
  const saveExtPolicy = useMutation({
    mutationFn: () => endpoints.external.savePolicy(extPolicyDraft ?? "search_on_click"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["external", "policy"] });
      setExtPolicyDraft(null);
      push("success", t("adm.ext.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.ext.title")}
      onZurueck={onZurueck}
      testId="detail-ki-extern"
      hilfe={[
        { titel: t("adm.ext.title"), text: t("adm.ext.help") },
        { titel: t("adm.ext.title"), text: t("adm.ext.hint") },
      ]}
    >
      <Abfragehuelle abfrage={extPolicy}>
        {(politik) => (
          <div className="space-y-1.5">
            {EXTERNAL_STAGES.map((stage) => {
              const active = (extPolicyDraft ?? politik.stage) === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setExtPolicyDraft(stage)}
                  aria-pressed={active}
                  className={`flex w-full items-start gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                    active ? "border-ink bg-hairline-soft" : "border-hairline hover:border-ink/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      active ? "border-ink bg-ink" : "border-hairline"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      {t(`adm.ext.stage.${stage}`)}
                    </span>
                    <span className="block text-[11.5px] text-muted">
                      {t(`adm.ext.stageHint.${stage}`)}
                    </span>
                  </span>
                </button>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                disabled={
                  saveExtPolicy.isPending ||
                  extPolicyDraft === null ||
                  extPolicyDraft === politik.stage
                }
                onClick={() => saveExtPolicy.mutate()}
              >
                {t("adm.ext.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.ext.note")}</span>
            </div>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung (UI in Prozent, Backend als Anteil 0..1). */
export function KiDupDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const dupSettingsQ = useQuery({
    queryKey: ["duplicates", "settings"],
    queryFn: endpoints.duplicates.settings,
  });
  const [dupThresholdDraft, setDupThresholdDraft] = useState<string | null>(null);
  const saveDupSettings = useMutation({
    mutationFn: () =>
      endpoints.duplicates.saveSettings(
        Math.round(
          Number.parseFloat(
            dupThresholdDraft ??
              String(Math.round((dupSettingsQ.data?.minConfidence ?? 0.5) * 100)),
          ),
        ) / 100,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["duplicates", "settings"] });
      setDupThresholdDraft(null);
      push("success", t("adm.dup.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.dup.title")}
      onZurueck={onZurueck}
      testId="detail-ki-dup"
      hilfe={[
        { titel: t("adm.dup.title"), text: t("adm.dup.help") },
        { titel: t("adm.dup.title"), text: t("adm.dup.hint") },
      ]}
    >
      <Abfragehuelle abfrage={dupSettingsQ}>
        {(einstellung) => (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("adm.dup.threshold")}>
              <TextInput
                type="number"
                min={5}
                max={99}
                step={1}
                className="w-24"
                value={dupThresholdDraft ?? String(Math.round(einstellung.minConfidence * 100))}
                onChange={(e) => setDupThresholdDraft(e.target.value)}
                aria-label={t("adm.dup.threshold")}
              />
            </Field>
            <Button
              variant="primary"
              disabled={saveDupSettings.isPending || dupThresholdDraft === null}
              onClick={() => saveDupSettings.mutate()}
            >
              {t("adm.dup.save")}
            </Button>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}
