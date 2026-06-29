// SCRUM-312/313: wiederverwendbare KI-Nachbearbeitungsbox — geführte Aktionen + freie Anweisung +
// Vorschau mit bewusster Übernahme (Ersetzen/Anhängen/Verwerfen). Schreibt NICHT still in den Text;
// `runAssist` nutzt den vorhandenen reasoner.assist-Endpunkt (optionale instruction). Kein Auto-Submit,
// keine Auto-Validierung. Nutzt die DOM-freien Helfer aus lib/captureAiAssist. Genutzt von Capture
// (Freitext/Reasoner-Draft) UND KO-Detail-Edit (Aussage überarbeiten).
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  ASSIST_ACTIONS,
  type AssistApplyMode,
  applyAssist,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
import { Button } from "./ui";

export function AiAssistBox({
  text,
  runAssist,
  onApply,
}: {
  text: string;
  runAssist: (text: string, instruction?: string) => Promise<string>;
  onApply: (next: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [free, setFree] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [boxErr, setBoxErr] = useState<string | null>(null);
  const disabled = pending || text.trim().length === 0;

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
    onApply(applyAssist(mode, text, preview));
    setPreview(null);
  };

  return (
    <div className="mt-2 rounded-card border border-hairline bg-page p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles size={13} className="text-ai" />
        <span className="text-[12.5px] font-semibold text-ink">{t("capture.ai.title")}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t("capture.ai.hint")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ASSIST_ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            disabled={disabled}
            onClick={() => void run(t(assistActionInstructionKey(a)))}
            className="rounded-pill border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
          >
            {t(assistActionLabelKey(a))}
          </button>
        ))}
      </div>
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
        </div>
      ) : null}
    </div>
  );
}
