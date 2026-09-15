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
import { useTranslation } from "react-i18next";
import {
  IMPORT_ACCESS_BLOCKER_TEXT,
  type ImportAccessState,
  importAccessState,
} from "../../lib/importAccessState";
import { formatKoTimestamp } from "../../lib/koDates";
import { Card } from "../ui";
import type { SharePointZugang } from "./api";

// Dieselben drei Tonwerte wie im Confluence-Kasten. Sie stehen hier als eigenes Literal, weil
// `ImportAccessPanel.tsx` Zielpfad eines anderen Auftrags ist — eine gemeinsame Konstante wäre die
// bessere Form und ist als REST benannt, nicht heimlich unterlassen.
const TONE_CLASS: Record<"pos" | "warn" | "neutral", string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-hairline-soft text-muted",
};

/** Je Zustand ein EIGENER, für SharePoint geschriebener Text — keiner geliehen. */
const ZUGANG_TEXT: Record<
  ImportAccessState,
  { titleKey: string; bodyKey: string; tone: "pos" | "warn" | "neutral" }
> = {
  ready: {
    titleKey: "imp.sharepoint.zugang.ready.titel",
    bodyKey: "imp.sharepoint.zugang.ready.text",
    tone: "pos",
  },
  "no-credentials": {
    titleKey: "imp.sharepoint.zugang.ohneDaten.titel",
    bodyKey: "imp.sharepoint.zugang.ohneDaten.text",
    tone: "warn",
  },
  disabled: {
    titleKey: "imp.sharepoint.zugang.aus.titel",
    bodyKey: "imp.sharepoint.zugang.aus.text",
    tone: "neutral",
  },
};

export function SharePointZugangKarte({ zugang }: { zugang: SharePointZugang }): JSX.Element {
  const { t, i18n } = useTranslation();
  const state = importAccessState({
    enabled: zugang.enabled,
    credentialsUsable: zugang.credentialsUsable,
  });
  const text = ZUGANG_TEXT[state];
  const blockerKey = zugang.blocker ? IMPORT_ACCESS_BLOCKER_TEXT[zugang.blocker] : undefined;
  // Fail-closed: ein unparsebarer Wert wird `null` und damit zum Unbekannt-Satz — eine unlesbare
  // Rohzeile in der falschen Zeitzone wäre schlechter als ein ehrliches „nicht belegt".
  const zuletzt = formatKoTimestamp(zugang.lastConnectedAt, i18n.language);
  return (
    <Card className="mb-4">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("imp.access.title")} · {t("imp.gallery.src.sharepoint")}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          data-testid="sharepoint-zugang-state"
          data-state={state}
          className={`inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold ${TONE_CLASS[text.tone]}`}
        >
          {t(text.titleKey)}
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t(text.bodyKey)}</p>
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
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{t("imp.access.whereSet")}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("imp.access.whoMay")}</p>
      {/* DIE ZEILE STEHT IMMER — nur ihr Inhalt hängt vom Bestand ab. Eine fehlende Zeile läse sich
          wie „nie verbunden", und das wäre eine Behauptung. Der Wertfall nennt den Zeitpunkt
          RÜCKBLICKEND: ob die Verbindung JETZT steht, wüsste nur ein Abruf, und den macht diese
          Fläche nicht. */}
      <p
        data-testid="sharepoint-zugang-lastconnected"
        className="mt-1 text-[12px] leading-relaxed text-muted-2"
      >
        {zuletzt === null
          ? t("imp.access.lastConnectedUnknown")
          : t("imp.access.lastConnected", { date: zuletzt })}
      </p>
    </Card>
  );
}
