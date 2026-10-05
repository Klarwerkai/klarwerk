// ================================================================================================
// AUFTRAG-mega67 BLOCK C + D — DER ZUGANGS-BEREICH. ZUSTAND, KEIN FORMULAR.
// ================================================================================================
//
// DIE FRAGE, DIE DIESE FLÄCHE BEANTWORTET: „Warum geht diese Kachel nicht?" Bis mega66 stand die
// Antwort nirgends. Für genau EINE Kachel sagte „nicht konfiguriert" sie; für Confluence gab es sie
// nur als 503 aus einem echten Admin-POST — also erst NACH dem Versuch.
//
// ================================================================================================
// KEIN EINGABEFELD. NICHT EINES. — und das ist keine Sparsamkeit, sondern die Bauform.
// ================================================================================================
//
// Pedi hat am 30.07. die UMGEBUNGSVARIABLE gewählt (C2): eigener Namensraum, Origin-Pinning,
// Redaction, die keinen Tokenrest in eine Fehlermeldung lässt. Damit gibt es hier NICHTS
// entgegenzunehmen. Ein Feld, das ein Geheimnis annimmt, ohne es sicher abzulegen, wäre schlimmer
// als keines — und mit dieser Entscheidung braucht es das Feld nie. Deshalb rendert diese Datei
// kein <input>, kein <form> und keinen Speichern-Knopf; es gibt auch keinen Aufrufweg dorthin.
//
// UND KEINE MASKE MIT LÄNGE. Ein „••••••••" neben dem Namen sähe hilfreich aus und verriete die
// Länge des Geheimnisses. Es steht Ja oder Nein, sonst nichts (der Vertrag trägt gar keinen Wert,
// s. api/types.ts ImportAccessStatus).
//
// KEIN AUFRUF AN CONFLUENCE, um den Zustand zu bestimmen — kein neuer Egress, keine
// Verbindungsprüfung auf Verdacht. Was ohne Aufruf ablesbar ist, steht hier; was nicht, bleibt
// ehrlich leer.
//
// JOB-924 D6: `lastConnectedAt` ist nicht mehr immer null — der letzte erfolgreiche Importlauf ist
// ohne jeden Aufruf ablesbar (`ImportRun.completedAt` bei `COMPLETED`). Er ist damit genau die
// Sorte Tatsache, die diese Fläche zeigen darf: belegt, lokal, rückblickend. Was er NICHT sagt —
// ob die Verbindung in diesem Augenblick steht —, sagt der Text ausdrücklich dazu.
//
// KEINE ADMIN-FLÄCHE DANEBEN: Der Entwurf (C3) schlug eine Verwaltung im Admin-Bereich vor. Weil die
// Zugangsdaten nur noch auf dem Server gesetzt werden, gibt es NICHTS zu verwalten — die Teilung
// entfällt, und der Verweis dorthin wäre ein Verweis auf eine leere Seite.
//
// ================================================================================================
// R-0134 / R-1005 — DER EINE KNOPF: DEN IMPORT EIN- UND AUSSCHALTEN.
// ================================================================================================
//
// Hier steht seither GENAU EIN Knopf, und er nimmt kein Geheimnis entgegen: er legt den
// Betreiberschalter um (`PUT /api/import/confluence/schalter`, nur `{ an }`). Er erscheint nur, wenn
// der Server einen Betreiberschalter meldet UND die Installation den Import freigibt — sonst
// könnte er nichts bewirken. Die Sperre setzen die Importrouten am Server durch; dieser Knopf ist
// die Bedienung dazu, nicht die Sperre selbst. Weiterhin kein Eingabefeld, kein Formular, kein Wert.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useImportAccessConfluence } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import {
  IMPORT_ACCESS_BLOCKER_TEXT,
  IMPORT_ACCESS_SWITCHED_OFF_TEXT,
  IMPORT_ACCESS_TEXT,
  betreiberHatAusgeschaltet,
  importAccessState,
} from "../lib/importAccessState";
import { formatKoTimestamp } from "../lib/koDates";
import { Button, Card } from "./ui";

const TONE_CLASS: Record<"pos" | "warn" | "neutral", string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-hairline-soft text-muted",
};

export function ImportAccessPanel(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  // Die Route verlangt `users.manage` — wer es nicht trägt, fragt gar nicht erst (kein 403-Rauschen,
  // dieselbe Regel wie bei useReasonerConfig). Der Import selbst ist ohnehin admin-gebunden.
  const zugang = useImportAccessConfluence(role === "admin");
  const qc = useQueryClient();
  // R-0134 / R-1005: Umlegen des Betreiberschalters. Die Antwort IST die neue Auskunft — sie ersetzt
  // den Stand im Abfragespeicher, den auch die Lauf-Karte liest (Stufe2.tsx, ImportRunPanel).
  const umlegen = useMutation({
    mutationFn: (an: boolean) => endpoints.importAccess.confluenceSchalter(an),
    onSuccess: (neu) => {
      qc.setQueryData(["import-access", "confluence"], neu);
    },
  });
  if (!zugang.data) {
    // Keine Auskunft — dann auch keine Behauptung. Eine Fläche, die „unbekannt" anzeigt, wäre für
    // eine Beitragende nur Rauschen über etwas, das sie ohnehin nicht ändern kann.
    return null;
  }
  const daten = zugang.data;
  // AUFTRAG-mega69 B3: die Ableitung kennt nur noch die drei Zustände, die diese Fläche wirklich
  // zeigen kann (bens sammel65-Auflage 3 — das frühere feste "active" hier war der Beleg, dass
  // „not-built" nie erreichbar war).
  const state = importAccessState({
    enabled: daten.enabled,
    credentialsUsable: daten.credentialsUsable,
  });
  // „Vom Betreiber ausgeschaltet" hat einen eigenen Text — der für „nicht freigegeben" schickt zum
  // Server, dieser hier zum Knopf darunter.
  const betreiberAus = betreiberHatAusgeschaltet(daten.betreiber);
  const text = betreiberAus ? IMPORT_ACCESS_SWITCHED_OFF_TEXT : IMPORT_ACCESS_TEXT[state];
  const betreiber = daten.betreiber;
  const schalterFehler =
    umlegen.error instanceof ApiError && umlegen.error.code === "IMPORT_NOT_RELEASED"
      ? "imp.access.schalter.nichtFreigegeben"
      : umlegen.error
        ? "imp.access.schalter.fehler"
        : null;
  const blockerKey = daten.blocker ? IMPORT_ACCESS_BLOCKER_TEXT[daten.blocker] : undefined;
  // JOB-924 D6: fail-closed — ein unparsebarer Wert wird zu `null` und damit zum Unbekannt-Satz.
  const zuletzt = formatKoTimestamp(daten.lastConnectedAt, i18n.language);
  return (
    <Card className="mb-5">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("imp.access.title")} · {t("imp.gallery.src.confluence")}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          data-testid="import-access-state"
          data-state={betreiberAus ? "switched-off" : state}
          className={`inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold ${TONE_CLASS[text.tone]}`}
        >
          {t(text.titleKey)}
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t(text.bodyKey)}</p>
      {/* R-0134 / R-1005: der Betreiberschalter — nur wenn der Server ihn meldet UND die
          Installation den Import freigibt. Ohne Freigabe könnte der Knopf nichts bewirken. */}
      {betreiber?.freigegeben ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant={betreiber.an ? "outline" : "primary"}
            data-testid="import-access-schalter"
            data-an={betreiber.an ? "yes" : "no"}
            disabled={umlegen.isPending}
            onClick={() => umlegen.mutate(!betreiber.an)}
          >
            {t(betreiber.an ? "imp.access.schalter.aus" : "imp.access.schalter.an")}
          </Button>
          <span className="text-[12px] text-muted">{t("imp.access.schalter.hinweis")}</span>
        </div>
      ) : null}
      {schalterFehler ? (
        <p
          data-testid="import-access-schalter-fehler"
          className="mt-1 text-[12.5px] leading-relaxed text-trust-crit-text"
        >
          {t(schalterFehler)}
        </p>
      ) : null}
      {/* Der Zusatzgrund NUR dann, wenn er etwas erklärt: „alle vier stehen und es geht trotzdem
          nicht" wäre sonst von „eine fehlt" ununterscheidbar. */}
      {blockerKey ? (
        <p
          data-testid="import-access-blocker"
          className="mt-1 text-[12.5px] leading-relaxed text-muted"
        >
          {t(blockerKey)}
        </p>
      ) : null}

      <div className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("imp.access.varsTitle")}
      </div>
      <ul className="mt-1 space-y-1">
        {daten.credentials.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {/* Der NAME der Umgebungsvariablen — nach Pedis Entscheidung gehört er hierher, weil er
                der einzige Weg ist, den Zustand zu ändern. Der WERT nie. */}
            <code className="rounded-btn bg-hairline-soft px-1.5 py-0.5 font-mono text-[11px] text-ink">
              {c.name}
            </code>
            <span
              data-testid={`import-access-var-${c.name}`}
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
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{t("imp.access.whereSet")}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("imp.access.whoMay")}</p>
      {/* JOB-924 D6: DIE ZEILE STEHT IMMER — nur ihr Inhalt hängt vom Bestand ab. Eine fehlende
          Zeile läse sich wie „nie verbunden", und das wäre eine Behauptung.
          Der Wertfall nennt den Zeitpunkt RÜCKBLICKEND und sagt ausdrücklich dazu, dass er über
          den jetzigen Zustand nichts aussagt — das wüsste nur ein Aufruf, und den macht diese
          Fläche nicht.
          `formatKoTimestamp` ist die im Bestand geltende Zeitregel (Datum + Uhrzeit ohne Sekunden,
          Zeitzone des Betrachters, lokalisiert). Gibt sie `null` zurück — unparsebarer Altwert —,
          steht der Unbekannt-Satz da und NICHT die rohe Zeichenkette: eine unlesbare ISO-Zeile in
          der falschen Zone wäre schlechter als ein ehrliches „nicht belegt". */}
      <p
        data-testid="import-access-lastconnected"
        className="mt-1 text-[12px] leading-relaxed text-muted-2"
      >
        {zuletzt === null
          ? t("imp.access.lastConnectedUnknown")
          : t("imp.access.lastConnected", { date: zuletzt })}
      </p>
    </Card>
  );
}
