// SCRUM-312/313: wiederverwendbare KI-Nachbearbeitungsbox — geführte Aktionen + freie Anweisung +
// Vorschau mit bewusster Übernahme (Ersetzen/Anhängen/Verwerfen). Schreibt NICHT still in den Text;
// `runAssist` nutzt den vorhandenen reasoner.assist-Endpunkt (optionale instruction). Kein Auto-Submit,
// keine Auto-Validierung. Nutzt die DOM-freien Helfer aus lib/captureAiAssist. Genutzt von Capture
// (Freitext/Reasoner-Draft) UND KO-Detail-Edit (Aussage überarbeiten).
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
// SCRUM-386: kundeneigene KI-Funktionen (Admin-Presets) zusätzlich zur Werks-Palette.
import { useAssistPresets } from "../api/hooks";
import {
  ASSIST_ACTIONS,
  type AssistApplyMode,
  applyAssist,
  assistActionHelpKey,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
import { shouldWarnBeforeReplace } from "../lib/editorApplySafety";
import { useAiAvailable } from "../lib/useAiAvailable";
import { AiModelInfo } from "./AiModelInfo";
import { AiUnavailableHint } from "./AiUnavailableHint";
import { HelpTip } from "./HelpTip";
import { Button } from "./ui";

export function AiAssistBox({
  text,
  runAssist,
  onApply,
  applyFn = applyAssist,
  hintKey = "capture.ai.hint",
  extraApplyActions = [],
  compact = false,
}: {
  text: string;
  runAssist: (text: string, instruction?: string) => Promise<string>;
  onApply: (next: string) => void;
  // SCRUM-315: optionale Übernahme-Logik. Default = Plaintext (Statement/Freitext, SCRUM-312/313).
  // Body-Nutzung übergibt eine HTML-sichere Variante (applyBodyAssist). Signatur bleibt gleich
  // (mode, original, suggestion) → keine Bruchstelle für die bestehenden Aufrufer.
  applyFn?: (mode: AssistApplyMode, original: string, suggestion: string) => string;
  // Optionaler kontextspezifischer Hinweistext (i18n-Key). Default = generischer capture.ai.hint.
  hintKey?: string;
  // SCRUM-316: optionale ZUSÄTZLICHE Übernahme-Aktionen (z. B. „als Info-Block anhängen"). Nur in der
  // Vorschau sichtbar; leer = keine extra Buttons → Statement/Freitext-Flows bleiben unverändert.
  // `apply(original, suggestion)` liefert den neuen Gesamtwert für onApply.
  extraApplyActions?: ReadonlyArray<{
    labelKey: string;
    apply: (original: string, suggestion: string) => string;
  }>;
  // SCRUM-384: kompakte Palette (ohne Titel/Hinweis) — für die ✨KI-Toolbar im Editor,
  // wo der Nutzer die Palette bereits bewusst geöffnet hat (ARGUS-Muster).
  compact?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  // SCRUM-386: eigene KI-Funktionen der Instanz — nach den Werks-Aktionen, gleicher Fluss
  // (Vorschau + bewusste Übernahme). Das ?-HelpTip zeigt die hinterlegte Anweisung offen an.
  const presets = useAssistPresets();
  const customPresets = presets.data ?? [];
  const [free, setFree] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [boxErr, setBoxErr] = useState<string | null>(null);
  // PAKET 1 (D-AISTATE, Pedi 23.07.): echte LLM-Nachbearbeitung — ohne nutzbares Modell HART
  // ausgrauen statt still in den wirkungslosen Fallback zu laufen.
  const assistAi = useAiAvailable("assist");
  const disabled = pending || text.trim().length === 0 || !assistAi.available;
  const warnBeforeReplace = shouldWarnBeforeReplace(text);

  const run = async (instruction?: string): Promise<void> => {
    setPending(true);
    setBoxErr(null);
    try {
      setPreview(await runAssist(text, instruction));
    } catch (e) {
      setBoxErr(e instanceof ApiError ? e.message : t("state.error"));
    } finally {
      setPending(false);
    }
  };
  const apply = (mode: AssistApplyMode): void => {
    if (preview === null) {
      return;
    }
    onApply(applyFn(mode, text, preview));
    setPreview(null);
  };
  const applyExtra = (apply: (original: string, suggestion: string) => string): void => {
    if (preview === null) {
      return;
    }
    onApply(apply(text, preview));
    setPreview(null);
  };

  return (
    <div className={compact ? "mt-2" : "mt-2 rounded-card border border-hairline bg-page p-3"}>
      {compact ? null : (
        <>
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-ai" />
            <span className="text-[12.5px] font-semibold text-ink">{t("capture.ai.title")}</span>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t(hintKey)}</p>
        </>
      )}
      {/* SCRUM-404 (Pedi 03.07.): ?-Hilfe an jeder Aktion — ein Satz, was sie tut.
          Pedi 04.07.: (!)-Info voran — welche KI diese Palette ausführt (Aufgabe „assist"). */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AiModelInfo task="assist" />
        {ASSIST_ACTIONS.map((a) => (
          <span key={a} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void run(t(assistActionInstructionKey(a)))}
              className="rounded-pill border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
            >
              {t(assistActionLabelKey(a))}
            </button>
            <HelpTip title={t(assistActionLabelKey(a))} body={t(assistActionHelpKey(a))} />
          </span>
        ))}
        {/* SCRUM-386: Admin-Presets — optisch als „eigene" Funktionen markiert (gestrichelt). */}
        {customPresets.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void run(p.instruction)}
              className="rounded-pill border border-dashed border-ai-dashed px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
            >
              {p.name}
            </button>
            <HelpTip
              title={p.name}
              body={t("capture.ai.customHelp", { instruction: p.instruction })}
            />
          </span>
        ))}
      </div>
      <AiUnavailableHint show={!assistAi.available} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder={t("capture.ai.freePlaceholder")}
          aria-label={t("capture.ai.freeLabel")}
          className="h-9 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-ink/30"
        />
        <Button
          variant="ghost"
          disabled={disabled || free.trim().length === 0}
          onClick={() => void run(free.trim())}
        >
          <Sparkles size={14} />
          {t("capture.ai.run")}
        </Button>
      </div>
      {boxErr ? <p className="mt-2 text-[12px] text-trust-crit-text">{boxErr}</p> : null}
      {preview !== null ? (
        <div className="mt-2 rounded-btn border border-ai/30 bg-surface p-2.5">
          <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
            {t("capture.ai.previewTitle")}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text">
            {preview}
          </p>
          {warnBeforeReplace ? (
            <p className="mt-2 rounded-btn border border-trust-warn/30 bg-trust-warn/10 px-2 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text">
              {t("editor.applySafety.replaceWarning")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => apply("replace")}>
              {t("capture.ai.replace")}
            </Button>
            <Button variant="ghost" onClick={() => apply("append")}>
              {t("capture.ai.append")}
            </Button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-[12px] font-semibold text-muted hover:text-text"
            >
              {t("capture.ai.discard")}
            </button>
          </div>
          {extraApplyActions.length > 0 ? (
            <div className="mt-2 border-t border-hairline pt-2">
              {/* SCRUM-343: strukturierte Übernahme-Modi klar gruppiert (als Abschnitt / als Block). */}
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                {t("capture.ai.applyAsLabel")}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {extraApplyActions.map((a) => (
                  <button
                    key={a.labelKey}
                    type="button"
                    onClick={() => applyExtra(a.apply)}
                    className="rounded-pill border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text"
                  >
                    {t(a.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
