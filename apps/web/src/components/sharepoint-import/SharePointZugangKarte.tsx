// ================================================================================================
// JOB 4086 — DER ZUGANGS-ZUSTAND VON SHAREPOINT. ZUSTAND, KEIN FORMULAR.
// ================================================================================================
//
// Dieselbe Bauform und dieselbe Zusage wie `components/ImportAccessPanel.tsx` für Confluence, und
// aus denselben Gründen:
//
//   KEIN EINGABEFELD. NICHT EINES. Die Zugangsdaten stehen ausschliesslich in der Umgebung des
//   Servers (Pedis Entscheidung vom 30.07. für Confluence, hier wortgleich übernommen). Damit gibt
//   es hier NICHTS entgegenzunehmen — kein `<input>`, kein `<form>`, keinen Speichern-Knopf und
//   keinen Aufrufweg dorthin.
//
//   UND KEINE MASKE MIT LÄNGE. Ein „••••••••" neben dem Namen sähe hilfreich aus und verriete die
//   Länge des Geheimnisses. Es steht Ja oder Nein, sonst nichts — der Vertrag trägt gar kein Feld,
//   in das ein Wert passte.
//
//   KEIN AUFRUF AN DIE GEGENSTELLE, um den Zustand zu bestimmen. Was ohne Abruf ablesbar ist,
//   steht hier; was nicht, bleibt ehrlich leer.
//
// ================================================================================================
// WARUM DIE ABLEITUNG GETEILT IST UND DIE TEXTE NICHT.
// ================================================================================================
//
// `importAccessState` (lib/importAccessState.ts) ist quellneutral: Schalter aus ⇒ „disabled",
// sonst entscheidet der Zugangszustand zwischen „ready" und „no-credentials". Diese Regel gilt für
// jedes Quellsystem, und sie wird deshalb BENUTZT und nicht abgeschrieben.
//
// Die TEXTE dort sind es nicht: `imp.access.disabled.body` sagt wörtlich „Der Confluence-Import
// ist hier nicht eingeschaltet". Sie für SharePoint mitzubenutzen hiesse, dem Menschen etwas über
// ein anderes System zu erzählen. Was quellneutral FORMULIERT ist — die Variablenliste, der
// Blocker-Grund, „wo wird das gesetzt", „zuletzt erfolgreich" —, wird dagegen unverändert geteilt.
//
// ================================================================================================
// ADMIN-02 — FÜNF TATSACHEN, FÜNF ABSCHNITTE. KEINE STEHT FÜR EINE ANDERE.
// ================================================================================================
//
// Bis hierher stand hier ein Abzeichen („Eingeschaltet, Zugangsdaten hinterlegt") und darunter der
// Rückblick auf den letzten Import. Wer das las, konnte „hinterlegt" für „funktioniert" halten und
// einen alten Import für einen Verbindungsnachweis. Jetzt steht jede Tatsache in EIGENEM Abschnitt:
//
//   1. WAS DIE ANBINDUNG KANN     — Import, Metadatenübernahme, Dokumentvorschau, Office-Bearbeitung
//                                   getrennt benannt (Produktfähigkeit, gilt für jede Installation).
//   2. FREISCHALTUNG              — der Schalter DIESER Installation.
//   3. ANGABEN                    — welche Variable steht (Ja/Nein, nie ein Wert).
//   4. LETZTER VERBINDUNGSTEST    — Zeitpunkt, geprüfter Umfang, Ergebnis, nächster Schritt; und der
//                                   Knopf, der ihn BEWUSST startet, mit dem Satz, was er bewirkt.
//   5. LETZTER ERFOLGREICHER IMPORT — ausdrücklich als historischer Nachweis überschrieben.
//
// Das Abzeichen oben trägt den EINEN abgeleiteten Zustand (`lib/integrationStatus.ts`) — derselbe,
// den die Systemkachel der Galerie zeigt. Zwei Flächen, eine Ableitung.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  IMPORT_ACCESS_BLOCKER_TEXT,
  type ImportAccessState,
  importAccessState,
} from "../../lib/importAccessState";
import {
  INTEGRATION_STATUS_TEXT,
  VERBINDUNGSTEST_TEXT,
  VERBINDUNGSTEST_UMFANG_TEXT,
  integrationStatus,
  juengererNachweis,
  naechsterSchrittKey,
} from "../../lib/integrationStatus";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button, Card } from "../ui";
import { type SharePointZugang, sharepointApi } from "./api";

// Dieselben drei Tonwerte wie im Confluence-Kasten. Sie stehen hier als eigenes Literal, weil
// `ImportAccessPanel.tsx` Zielpfad eines anderen Auftrags ist — eine gemeinsame Konstante wäre die
// bessere Form und ist als REST benannt, nicht heimlich unterlassen.
const TONE_CLASS: Record<"pos" | "warn" | "neutral", string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-hairline-soft text-muted",
};

/** Je Zustand ein EIGENER, für SharePoint geschriebener Text — keiner geliehen. */
const ZUGANG_TEXT: Record<ImportAccessState, { bodyKey: string }> = {
  // ADMIN-02: der Satz für „ready" sagt jetzt ausdrücklich, dass hinterlegt nicht erreichbar heisst
  // — und wo man es prüft. Der alte Satz („lässt sich von hier aus nicht prüfen") stimmt seit dem
  // Verbindungstest nicht mehr; sein Schlüssel bleibt in der Sprachdatei (nur additive Änderungen).
  ready: { bodyKey: "integrationen.zugang.bereitMitTest" },
  "no-credentials": { bodyKey: "imp.sharepoint.zugang.ohneDaten.text" },
  disabled: { bodyKey: "imp.sharepoint.zugang.aus.text" },
};

/** Was die Anbindung kann — vier getrennte Fähigkeiten, je ein eigener Satz. */
const FAEHIGKEITEN = [
  { id: "import", key: "integrationen.faehigkeit.import" },
  { id: "metadaten", key: "integrationen.faehigkeit.metadaten" },
  { id: "vorschau", key: "integrationen.faehigkeit.vorschau" },
  { id: "office", key: "integrationen.faehigkeit.office" },
] as const;

export function SharePointZugangKarte({ zugang }: { zugang: SharePointZugang }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  // ADMIN-02: der Verbindungstest. Nach dem Test wird die Auskunft neu geholt — sie trägt das
  // festgehaltene Ergebnis, und genau das sieht man auch nach einem Neuladen der Seite.
  const pruefen = useMutation({
    mutationFn: () => sharepointApi.verbindungstest(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sharepoint-zugang"] });
    },
  });
  const state = importAccessState({
    enabled: zugang.enabled,
    credentialsUsable: zugang.credentialsUsable,
  });
  // Der gerade gemessene Test gilt sofort; die Auskunft holt ihn danach ohnehin nach. Gewählt wird
  // der jüngere — nie ein älterer über einen neueren.
  const test = juengererNachweis(pruefen.data, zugang.letzterVerbindungstest);
  const status = integrationStatus({
    enabled: zugang.enabled,
    credentialsUsable: zugang.credentialsUsable,
    letzterVerbindungstest: test,
  });
  const statusText = INTEGRATION_STATUS_TEXT[status];
  const blockerKey = zugang.blocker ? IMPORT_ACCESS_BLOCKER_TEXT[zugang.blocker] : undefined;
  // Fail-closed: ein unparsebarer Wert wird `null` und damit zum Unbekannt-Satz — eine unlesbare
  // Rohzeile in der falschen Zeitzone wäre schlechter als ein ehrliches „nicht belegt".
  const zuletzt = formatKoTimestamp(zugang.lastConnectedAt, i18n.language);
  const testZeit = test ? formatKoTimestamp(test.geprueftAm, i18n.language) : null;
  // Der nächste Schritt folgt dem ZUSTAND: ausgeschaltet/ohne Angaben/ungeprüft haben ihren Satz,
  // ein geprüfter oder gescheiterter Stand den Satz seines Testergebnisses.
  const schrittKey = naechsterSchrittKey("sharepoint", status, test);
  return (
    <Card className="mb-4">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("imp.access.title")} · {t("imp.gallery.src.sharepoint")}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          data-testid="sharepoint-zugang-state"
          data-state={state}
          data-status={status}
          className={`inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold ${TONE_CLASS[statusText.tone]}`}
        >
          {t(statusText.key)}
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
        {t(ZUGANG_TEXT[state].bodyKey)}
      </p>
      {/* Der Zusatzgrund NUR dann, wenn er etwas erklärt: „alle stehen und es geht trotzdem nicht"
          wäre sonst von „eine fehlt" ununterscheidbar. */}
      {blockerKey ? (
        <p
          data-testid="sharepoint-zugang-blocker"
          className="mt-1 text-[12.5px] leading-relaxed text-muted"
        >
          {t(blockerKey)}
        </p>
      ) : null}
      {/* ADMIN-02: der konkrete nächste Schritt — zu JEDEM Zustand einer, nie ein leeres Bild. */}
      <p
        data-testid="sharepoint-naechster-schritt"
        data-schritt={schrittKey}
        className="mt-1.5 rounded-btn bg-hairline-soft px-2.5 py-1.5 text-[12.5px] leading-relaxed text-text"
      >
        {t("integrationen.naechsterSchritt")} {t(schrittKey)}
      </p>

      {/* 1 — WAS DIE ANBINDUNG KANN. Produktfähigkeit, unabhängig von dieser Installation. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("integrationen.faehigkeit.titel")}
      </div>
      <ul data-testid="sharepoint-faehigkeiten" className="mt-1 space-y-0.5">
        {FAEHIGKEITEN.map((f) => (
          <li key={f.id} data-faehigkeit={f.id} className="text-[12px] leading-relaxed text-muted">
            {t(f.key)}
          </li>
        ))}
      </ul>

      {/* 2 — FREISCHALTUNG IN DIESER INSTALLATION. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("integrationen.freischaltung.titel")}
      </div>
      {zugang.enabled ? (
        <p
          data-testid="sharepoint-freischaltung"
          data-an="yes"
          className="mt-1 font-mono text-[11px] font-semibold text-trust-pos-text"
        >
          {t("integrationen.freischaltung.an")}
        </p>
      ) : (
        <p
          data-testid="sharepoint-freischaltung"
          data-an="no"
          className="mt-1 font-mono text-[11px] font-semibold text-muted-2"
        >
          {t("integrationen.freischaltung.aus")}
        </p>
      )}

      {/* 3 — ANGABEN. Namen und Ja/Nein, nie ein Wert. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("imp.access.varsTitle")}
      </div>
      <ul className="mt-1 space-y-1">
        {zugang.credentials.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {/* Der NAME der Umgebungsvariablen gehört hierher, weil er der einzige Weg ist, den
                Zustand zu ändern. Der WERT nie. */}
            <code className="rounded-btn bg-hairline-soft px-1.5 py-0.5 font-mono text-[11px] text-ink">
              {c.name}
            </code>
            <span
              data-testid={`sharepoint-zugang-var-${c.name}`}
              data-present={c.present ? "yes" : "no"}
              className={`font-mono text-[10px] font-semibold ${
                c.present ? "text-trust-pos-text" : "text-muted-2"
              }`}
            >
              {t(c.present ? "imp.access.varPresent" : "imp.access.varMissing")}
            </span>
          </li>
        ))}
      </ul>

      {/* 4 — LETZTER VERBINDUNGSTEST. Bewusst gestartet, mit erklärter Wirkung. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("integrationen.test.titel")}
      </div>
      <div data-testid="sharepoint-verbindungstest" aria-live="polite">
        {test !== null && testZeit !== null ? (
          <p
            data-testid="sharepoint-verbindungstest-zeile"
            data-ergebnis={test.ergebnis}
            data-umfang={test.umfang}
            className="mt-1 text-[12.5px] leading-relaxed text-text"
          >
            {t("integrationen.test.zeile", {
              zeit: testZeit,
              umfang: t(VERBINDUNGSTEST_UMFANG_TEXT[test.umfang]),
              ergebnis: t(VERBINDUNGSTEST_TEXT[test.ergebnis].ergebnisKey),
            })}
          </p>
        ) : (
          <p
            data-testid="sharepoint-verbindungstest-keiner"
            className="mt-1 text-[12.5px] leading-relaxed text-muted"
          >
            {t("integrationen.test.keiner")}
          </p>
        )}
        {pruefen.isError ? (
          <p
            data-testid="sharepoint-verbindungstest-fehler"
            className="mt-1 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
          >
            {t("integrationen.test.fehler")}
          </p>
        ) : null}
      </div>
      <p
        data-testid="sharepoint-verbindungstest-wirkung"
        className="mt-1 text-[12px] leading-relaxed text-muted"
      >
        {t("integrationen.test.wirkung")}
      </p>
      <div className="mt-1.5">
        <Button
          variant="outline"
          data-testid="sharepoint-verbindungstest-starten"
          disabled={pruefen.isPending}
          onClick={() => pruefen.mutate()}
        >
          {pruefen.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ShieldCheck size={14} />
          )}
          {pruefen.isPending ? t("integrationen.test.laeuft") : t("integrationen.test.knopf")}
        </Button>
      </div>

      {/* 5 — LETZTER ERFOLGREICHER IMPORT, ausdrücklich HISTORISCH. DIE ZEILE STEHT IMMER — nur ihr
          Inhalt hängt vom Bestand ab. Eine fehlende Zeile läse sich wie „nie verbunden", und das wäre
          eine Behauptung. Der Wertfall nennt den Zeitpunkt RÜCKBLICKEND: ob die Verbindung JETZT
          steht, sagt nur der Verbindungstest darüber. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("integrationen.historie.titel")}
      </div>
      <p
        data-testid="sharepoint-zugang-lastconnected"
        className="mt-1 text-[12px] leading-relaxed text-muted-2"
      >
        {zuletzt === null
          ? t("imp.access.lastConnectedUnknown")
          : t("imp.access.lastConnected", { date: zuletzt })}
      </p>

      {/* ZUSTÄNDIGKEIT — wer den Zustand ändern kann und wo. Nicht geheim, ohne einen einzigen Wert. */}
      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("integrationen.zustaendig.titel")}
      </div>
      <div data-testid="sharepoint-zustaendigkeit">
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("imp.access.whereSet")}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("imp.access.whoMay")}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {t("integrationen.zustaendig.test")}
        </p>
      </div>
    </Card>
  );
}
