import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KoStatus } from "../../../api/types";
import type { LiveVerdict } from "../../../lib/intakeSimilarity";
import { umfangErklaerung } from "../../../lib/vorschauUmfang";
import { StatusPill } from "../../trust/StatusPill";

// JOB 3045: DIE FUNDORTZEILE — wo der Treffer liegt (Kategorie) und wie er dasteht (Zustand).
// Damit entscheidet ein Mensch beim Tippen „ergänzen oder neu?", ohne den fremden Eintrag erst in
// einem zweiten Tab zu öffnen.
//
// EHRLICHKEIT VOR OPTIK — die null-Regel des Serververtrags gilt SICHTBAR, nicht nur im Typ:
//   koCategory === null  → das Kategoriestück fehlt vollständig
//   koStatus   === null  → das Zustandsstück fehlt vollständig
//   beide null           → diese Zeile wird GAR NICHT gerendert
// In keinem dieser Fälle steht ein Platzhalter, kein „—", kein „unbekannt", kein „keine Kategorie".
//
// DAS ORTS-LABEL GEHÖRT ZUR KATEGORIE, NICHT ZUR ZEILE (JOB 3045 R2, Korrekturpflicht 1 von BEN).
// In Runde 2 stand das Label fest am Zeilenanfang. Bei `koCategory === null` und belegtem Zustand
// las die Fläche dann „Liegt in: Offen" (en „Sits in: Open") — der Zustand wurde als ORT
// beschriftet, also eine Aussage, die der Bestand nie gemacht hat. Label und Kategorie sind deshalb
// EIN Stück: fällt die Kategorie weg, fällt das Label mit. Der Zustand steht dann allein als
// `StatusPill` da — die im Produkt übliche, selbsterklärende Darstellung eines Zustands.
//
// Der Zustand steht in der BESTEHENDEN `StatusPill` (Farbe je Zustand); der rohe `KoStatus` reist
// bis hierher, abgeleitet wird nichts. Die Kategorie ist ein roher Bestandswert, unübersetzt.
//
// P-M3b (Runde 2, BEN-3) — DAS WORT IST DAS DER TREFFERLISTE, NICHT DAS DES STATUSFELDS. Web und
// Word-Panel zeigen denselben Prüfstand: „Validiert“ und „noch nicht geprüft“ (Pedi 05.09., M3
// „Haben wir das schon?“; im Panel `askStatusValidiert`/`bestandNochNichtGeprueft`). Das allgemeine
// „Offen“ der StatusPill sagte hier dasselbe mit einem anderen Wort. Geprüft gegen EINE Tabelle:
// tests/erfassungs-konfliktpruefung/pruefstand-wortlaut.test.tsx.
const PRUEFSTAND_KEY: Record<KoStatus, string> = {
  offen: "intake.live.pruefstand.offen",
  validiert: "intake.live.pruefstand.validiert",
};
function Fundort({
  koStatus,
  koCategory,
}: {
  koStatus: KoStatus | null;
  koCategory: string | null;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (koStatus === null && koCategory === null) {
    return null;
  }
  return (
    <div
      data-testid="live-fundort"
      className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted"
    >
      {koCategory === null ? null : (
        <>
          <span>{t("intake.live.fundort")}</span>
          <span className="font-medium">{koCategory}</span>
        </>
      )}
      {koStatus === null ? null : (
        <StatusPill status={koStatus} label={t(PRUEFSTAND_KEY[koStatus])} />
      )}
    </div>
  );
}

// SCRUM-527 (WP2-Design): die „Das System denkt mit"-Zone — die Hauptattraktion, kein grauer Spinner.
// Sie reagiert sichtbar/lebendig auf den Entwurfstext: idle (hört zu), checking (ehrlicher Lauf-Zustand
// mit pulsierenden Punkten), empty / similar / conflict. never block, only show honest status. Reine
// Präsentation: der Verdict kommt vom gekapselten Hook (useLiveKnowledgeCheck) bzw. im Test gemockt.
//
// JOB 3556 (LIVE-CHECK-VERDRAHTUNG A) — DIESE ZONE SPRICHT NICHT MEHR ÜBER DEN PRÜFSTATUS.
// Seit JOB 3427 sagt der PRÜFSTATUS seinen Satz beim Aufrufer (`Blatt.tsx`, `blatt-live-ausfall`),
// getrennt vom Treffer und ohne die unbelegte Zusatzbehauptung „Ähnliches gefunden? Nein". Die
// Zweige `pending`/`unavailable` und ihre Texte waren damit unerreichbar geworden — sie sind
// entfernt, und der TYP hält es fest: was diese Zone nicht mehr darstellen kann, kann ihr auch
// niemand mehr übergeben. Ein unerreichbarer Zweig wäre sonst genau die Leiche, die beim nächsten
// Umbau wieder mitgepflegt wird.
//
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — KEINE BESTANDWEITE NEUHEIT MEHR. Hier stand „Das ist
// neu — dazu gibt es noch nichts. Du bist die erste Person." Belegt war das nie: der Server
// vergleicht höchstens eine begrenzte Vorauswahl. Lauf und leeres Ergebnis heissen jetzt „Vorschau",
// und das leere Ergebnis nennt genau den Umfang, den die Antwort trägt (`umfangErklaerung`).
export function LiveReactionZone({
  verdict,
}: {
  verdict: Exclude<LiveVerdict, { status: "pending" } | { status: "unavailable" }>;
}): JSX.Element {
  const { t } = useTranslation();

  // Lebendiger Lauf-Zustand: drei pulsierende Punkte statt totem Ladebalken.
  if (verdict.status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-card border border-ai/20 bg-ai/5 px-4 py-3 text-[13px] text-ai">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:300ms]" />
        </span>
        <span>{t("vorschau.laeuft")}</span>
      </div>
    );
  }

  if (verdict.status === "empty") {
    return (
      <div
        data-testid="live-vorschau-leer"
        data-umfang={verdict.coverage.kind}
        className="rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] text-text"
      >
        {umfangErklaerung(t, verdict.coverage)}
      </div>
    );
  }

  if (verdict.status === "similar") {
    return (
      <div className="rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] text-text">
        <span className="text-muted">{t("intake.live.similarLead")}</span>{" "}
        {/* SCRUM-527 (Iteration 1): das bestehende KO in einem NEUEN TAB öffnen — der Entwurf im
            Erfassungsfeld geht so NICHT verloren, und /wissen/:id rendert regulär. */}
        <Link
          to={`/wissen/${verdict.match.koId}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ai hover:underline"
        >
          {verdict.match.title}
        </Link>
        <span className="ml-1.5 text-muted">{t("intake.live.similarAsk")}</span>
        <Fundort koStatus={verdict.match.koStatus} koCategory={verdict.match.koCategory} />
      </div>
    );
  }

  if (verdict.status === "conflict") {
    return (
      <div className="rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg px-4 py-3 text-[13px] text-trust-crit-text">
        <span>{t("intake.live.conflictLead")}</span>{" "}
        <Link
          to={`/wissen/${verdict.match.koId}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline hover:opacity-80"
        >
          {verdict.match.title}
        </Link>
        <Fundort koStatus={verdict.match.koStatus} koCategory={verdict.match.koCategory} />
      </div>
    );
  }

  // idle — ruhiges „hört zu", damit die Zone nie tot wirkt.
  return <div className="px-1 py-2 text-[12.5px] italic text-muted-2">{t("intake.live.idle")}</div>;
}
