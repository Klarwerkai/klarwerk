// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — „Klammer 2.0, aber ehrlich". Klara drängt
// sich nie auf (öffnet nur auf Klick), rät nie (Antworten kommen ausschließlich aus der
// Hilfe-Registry) und sagt offen, wenn ihr ein Eintrag fehlt (Hilfe-Lücke). Stufe 1 kann:
// Seiten-Kontext (Du bist hier), aktives Element (data-help-Anker), Markierung erklären,
// Suche über alle Hilfetexte. Stufe 2 (geerdete LLM-Antworten) folgt auf dieser Basis.
import { useMutation } from "@tanstack/react-query";
import { HelpCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import {
  type ResolvedKlaraEntry,
  allFaqEntries,
  allKlaraEntries,
  klaraEntryById,
  pageEntryFor,
  pageTitleKeyForRoute,
  rankKlara,
  resolveKlaraEntries,
  searchKlara,
} from "../lib/klaraRegistry";
import { AiModelInfo } from "./AiModelInfo";

// Pedi 05.07. („die Voice ist furchtbar"): Die Browser-Standardstimme ist oft die schlechteste.
// Wir wählen die beste installierte Stimme je Sprache: Premium/Enhanced/Neural-Stimmen zuerst,
// dann Google-/Netzwerkstimmen, dann der Rest. Gibt es nur die Standardstimme, bleibt sie ehrlich
// die Grenze des Browsers — natürliche Stimmen kommen mit einem lokalen TTS-Server (Folge-Slice).
function pickVoice(langPrefix: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (matching.length === 0) {
    return null;
  }
  const score = (v: SpeechSynthesisVoice): number =>
    (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (v.localService ? 0 : 1);
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Text fürs Vorlesen bereinigen: Satzzeichen-Symbole und Pfeile werden gesprochen scheußlich.
function cleanForSpeech(text: string): string {
  return text
    .replace(/[„“”«»]/g, "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*→\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ein Hilfe-Ergebnis im Panel — Titel, Text, Absprung zur Route des Themas.
function KlaraResult({
  entry,
  onNavigate,
}: { entry: ResolvedKlaraEntry; onNavigate: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-hairline bg-page px-3 py-2.5">
      <div className="text-[12.5px] font-semibold text-text">{entry.title}</div>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{entry.body}</p>
      <Link
        to={entry.route}
        onClick={onNavigate}
        className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
      >
        {t("help.openRoute")} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function KlaraAssistant(): JSX.Element {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [selectionNote, setSelectionNote] = useState(false);
  // Zeige-Modus (Pedi 05.07.): beliebiges Element anklicken → erklären, ohne die Aktion auszulösen.
  const [inspecting, setInspecting] = useState(false);
  const [inspected, setInspected] = useState<{ label: string; entryId: string | null } | null>(
    null,
  );
  // Klara Stufe 2 (Pedi 05.07.): „Mit KI-Unterstützung suchen" — die Frage + die best-passenden
  // Hilfe-Schnipsel gehen an den Reasoner-Task answer; Antwort NUR daraus, sonst ehrliche Lücke.
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const [aiNoGrounding, setAiNoGrounding] = useState(false);
  const aiAsk = useMutation({
    mutationFn: (body: {
      question: string;
      snippets: { id: string; title: string; body: string }[];
      locale?: "de" | "en";
    }) => endpoints.help.explain(body),
  });

  // Vorlesen (Pedi 05.07., Muster SCRUM-403): Browser-Sprachausgabe, nur auf Klick, kein Auto-Play.
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const toggleSpeak = (id: string, text: string): void => {
    if (!ttsSupported) {
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    const en = i18n.language.startsWith("en");
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = en ? "en-US" : "de-DE";
    const voice = pickVoice(en ? "en" : "de");
    if (voice) {
      u.voice = voice;
    }
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeakingId(id);
  };

  // Stimmenliste vorwärmen — manche Browser liefern getVoices() erst nach dem voiceschanged-Event.
  useEffect(() => {
    if (!ttsSupported) {
      return;
    }
    const warm = (): void => {
      window.speechSynthesis.getVoices();
    };
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, [ttsSupported]);

  // Aktives Element verfolgen: jedes Element mit data-help-Anker meldet sich beim Fokus.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("[data-help]");
      const id = anchor?.getAttribute("data-help");
      if (id) {
        setFieldId(id);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // Seitenwechsel: Feld-Kontext zurücksetzen (der Anker gehört zur alten Seite).
  // biome-ignore lint/correctness/useExhaustiveDependencies: Absichts-Abhängigkeit — genau bei Routenwechsel zurücksetzen.
  useEffect(() => {
    setFieldId(null);
    setInspected(null);
    setInspecting(false);
    setAskedFor(null);
    setAiNoGrounding(false);
  }, [location.pathname]);

  // Escape schließt das Panel; beim Schließen/Verlassen stoppt ein laufendes Vorlesen.
  useEffect(() => {
    if (!open) {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, ttsSupported]);

  // Beim Unmount nie weitersprechen.
  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);

  // Zeige-Modus: capture-Listener fangen Klicks ab (die App-Aktion wird NICHT ausgelöst),
  // markieren das Element unter dem Zeiger und lösen es zur Erklärung auf. Esc beendet.
  useEffect(() => {
    if (!inspecting) {
      return;
    }
    document.body.classList.add("klara-inspect");
    let hovered: HTMLElement | null = null;
    const clearHover = (): void => {
      hovered?.classList.remove("klara-inspect-target");
      hovered = null;
    };
    const onOver = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-klara]")) {
        clearHover();
        return;
      }
      if (hovered !== target) {
        clearHover();
        hovered = target;
        target.classList.add("klara-inspect-target");
      }
    };
    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-klara]")) {
        return; // Klicks im Klara-Panel bleiben normal bedienbar.
      }
      event.preventDefault();
      event.stopPropagation();
      const anchor = target.closest("[data-help]");
      const entryId = anchor?.getAttribute("data-help") ?? null;
      // Beschriftung des Elements (oder des nächsten sinnvollen Trägers) als Such-Grundlage.
      const carrier =
        target.closest("button,a,label,summary,th,h1,h2,h3,[aria-label],[title]") ?? target;
      const label = (
        carrier.getAttribute("aria-label") ??
        carrier.getAttribute("title") ??
        carrier.textContent ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      setInspected({ label, entryId });
      setInspecting(false);
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setInspecting(false);
      }
    };
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      clearHover();
      document.body.classList.remove("klara-inspect");
    };
  }, [inspecting]);

  // Registry + FAQ (Berater 3a) einmal je Sprache auflösen — Suche/KI laufen auf echten Texten.
  const resolved = useMemo(
    () => [
      ...resolveKlaraEntries(allKlaraEntries(), (key) => t(key)),
      ...allFaqEntries(i18n.language),
    ],
    [t, i18n.language],
  );

  const page = pageEntryFor(location.pathname);
  const fieldEntry = fieldId ? klaraEntryById(fieldId) : null;
  const results = searchKlara(resolved, query);
  // „Zum Bereich"-Link unter der KI-Antwort (Pedi 05.07.): beste Quelle → direkter Absprung.
  // Lookup über den AUFGELÖSTEN Bestand, damit auch FAQ-Quellen (faq:*) Titel + Route liefern.
  const aiFirstSourceId = aiAsk.data?.answered ? aiAsk.data.sources[0] : undefined;
  const aiTargetEntry = aiFirstSourceId
    ? (resolved.find((e) => e.id === aiFirstSourceId) ?? null)
    : null;

  // Zeige-Modus-Auflösung: exakter Anker gewinnt; sonst Beschriftung als tolerante Suche.
  const inspectedEntry = inspected?.entryId ? klaraEntryById(inspected.entryId) : null;
  const inspectedHits =
    inspected && !inspectedEntry && inspected.label.length > 1
      ? searchKlara(resolved, inspected.label)
      : [];

  // KI-Suche: beste Hilfe-Schnipsel als einzige Antwort-Grundlage mitgeben; ohne Treffer
  // gibt es ehrlich KEINEN Modellaufruf (nichts, worauf die KI sich stützen könnte).
  const askAi = (): void => {
    const question = query.trim();
    if (question.length < 3 || aiAsk.isPending) {
      return;
    }
    const grounding = rankKlara(resolved, question, 12);
    setAskedFor(question);
    if (grounding.length === 0) {
      setAiNoGrounding(true);
      return;
    }
    setAiNoGrounding(false);
    aiAsk.mutate({
      question: question.slice(0, 300),
      snippets: grounding.map((e) => ({
        id: e.id,
        title: e.title.slice(0, 160),
        body: e.body.slice(0, 700),
      })),
      locale: i18n.language.startsWith("en") ? "en" : "de",
    });
  };

  // Markierung erklären: aktuelle Text-Auswahl wird zur Suchanfrage (ehrlich: nur Nachschlagen).
  const explainSelection = (): void => {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (text.length === 0) {
      setSelectionNote(true);
      return;
    }
    setSelectionNote(false);
    setQuery(text.slice(0, 80));
  };

  // Vorlesen-Knopf je Erklär-Block — erscheint nur, wenn der Browser Sprachausgabe kann.
  const speakButton = (id: string, title: string, body: string): JSX.Element | null =>
    ttsSupported ? (
      <button
        type="button"
        onClick={() => toggleSpeak(id, `${title}. ${body}`)}
        className="mt-1 inline-flex h-7 items-center rounded-btn border border-hairline px-2 text-[11px] font-semibold text-muted hover:border-ink/30 hover:text-text"
      >
        {speakingId === id ? t("klara.speakStop") : t("klara.speak")}
      </button>
    ) : null;

  return (
    <>
      <button
        type="button"
        data-klara="1"
        aria-label={t("klara.open")}
        title={t("klara.open")}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-ink text-page shadow-popover transition-opacity hover:opacity-85"
      >
        <HelpCircle size={20} />
      </button>
      {open ? (
        <section
          data-klara="1"
          aria-label={t("klara.title")}
          className="fixed bottom-20 right-5 z-40 flex max-h-[68vh] w-[340px] flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-popover"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-ink">{t("klara.title")}</div>
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                {t("klara.subtitle")}
              </div>
            </div>
            <button
              type="button"
              aria-label={t("cmd.close")}
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-btn text-muted-2 hover:bg-hairline-soft hover:text-text"
            >
              <X size={15} />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-4">
            <p className="text-[11.5px] leading-relaxed text-muted-2">{t("klara.intro")}</p>

            {/* Du bist hier — Erklärung der aktuellen Seite. */}
            {page ? (
              <div>
                <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                  {t("klara.pageLabel")}
                </div>
                <div className="text-[12.5px] font-semibold text-text">{t(page.titleKey)}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{t(page.bodyKey)}</p>
                {speakButton("page", t(page.titleKey), t(page.bodyKey))}
              </div>
            ) : null}

            {/* Aktives Element — data-help-Anker der Seite. */}
            <div>
              <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                {t("klara.fieldLabel")}
              </div>
              {fieldEntry ? (
                <div>
                  <div className="text-[12.5px] font-semibold text-text">
                    {t(fieldEntry.titleKey)}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                    {t(fieldEntry.bodyKey)}
                  </p>
                  {speakButton("field", t(fieldEntry.titleKey), t(fieldEntry.bodyKey))}
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-muted-2">{t("klara.fieldHint")}</p>
              )}
            </div>

            {/* Zeige-Modus-Ergebnis: exakter Anker ODER Treffer zur Element-Beschriftung — ehrlich. */}
            {inspected ? (
              <div>
                <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                  {t("klara.inspectFor", { label: inspected.label || "…" })}
                </div>
                {inspectedEntry ? (
                  <div>
                    <div className="text-[12.5px] font-semibold text-text">
                      {t(inspectedEntry.titleKey)}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                      {t(inspectedEntry.bodyKey)}
                    </p>
                    {speakButton(
                      "inspected",
                      t(inspectedEntry.titleKey),
                      t(inspectedEntry.bodyKey),
                    )}
                  </div>
                ) : inspectedHits.length > 0 ? (
                  <div className="space-y-2">
                    {inspectedHits.slice(0, 3).map((entry) => (
                      <KlaraResult key={entry.id} entry={entry} onNavigate={() => setOpen(false)} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-card border border-dashed border-hairline px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                    {t("klara.noResults")}
                  </p>
                )}
              </div>
            ) : null}

            {/* Element erklären (Zeige-Modus) + Markierung erklären + Suche. */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setInspecting((v) => !v)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-btn border px-2.5 text-[12px] font-semibold ${
                    inspecting
                      ? "border-ai bg-ai-surface-1 text-ai"
                      : "border-hairline bg-surface text-text hover:border-ink/30"
                  }`}
                >
                  {t("klara.inspect")}
                </button>
                <button
                  type="button"
                  onClick={explainSelection}
                  className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30"
                >
                  {t("klara.selectionExplain")}
                </button>
              </div>
              {inspecting ? (
                <p className="rounded-btn bg-ai-surface-2 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ai">
                  {t("klara.inspectHint")}
                </p>
              ) : null}
              {selectionNote ? (
                <p className="text-[11.5px] text-muted-2">{t("klara.selectionEmpty")}</p>
              ) : null}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("klara.searchPlaceholder")}
                className="h-9 w-full rounded-input border border-hairline bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
              />
              {/* Klara Stufe 2: KI-Antwort aus der Hilfe — mit KI-Transparenz ((!)-Info + DSGVO). */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={query.trim().length < 3 || aiAsk.isPending}
                  onClick={askAi}
                  className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-50"
                >
                  {aiAsk.isPending ? t("klara.aiBusy") : t("klara.aiSearch")}
                </button>
                <AiModelInfo task="answer" />
              </div>
              {askedFor && !aiAsk.isPending ? (
                aiNoGrounding ? (
                  <p className="rounded-card border border-dashed border-hairline px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                    {t("klara.noResults")}
                  </p>
                ) : aiAsk.isError ? (
                  <p className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text">
                    {t("state.error")}
                  </p>
                ) : aiAsk.data ? (
                  <div className="rounded-card border border-ai/30 bg-ai-surface-2 px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai">
                        {t("klara.aiAnswerTitle")}
                      </span>
                      {/* Pedi 05.07.: jede KI-Antwort klar gekennzeichnet — generiert, nicht voll geprüft. */}
                      <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text">
                        {t("klara.aiDisclaimer")}
                      </span>
                    </div>
                    {aiAsk.data.answered && aiAsk.data.answer ? (
                      <>
                        <p className="text-[12px] leading-relaxed text-text">{aiAsk.data.answer}</p>
                        {/* Pedi 05.07.: führt die Antwort zu einem Bereich, steht der Link direkt dabei. */}
                        {aiTargetEntry ? (
                          <Link
                            to={aiTargetEntry.route}
                            onClick={() => setOpen(false)}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-btn border border-ai bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1"
                          >
                            {t("klara.aiGoto", {
                              target: (() => {
                                const pageKey = pageTitleKeyForRoute(aiTargetEntry.route);
                                return pageKey ? t(pageKey) : aiTargetEntry.title;
                              })(),
                            })}{" "}
                            <span aria-hidden="true">→</span>
                          </Link>
                        ) : null}
                        {speakButton("ai", t("klara.aiAnswerTitle"), aiAsk.data.answer)}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                            {t("klara.aiSources")}:
                          </span>
                          {aiAsk.data.sources.map((sourceId) => {
                            const src = resolved.find((e) => e.id === sourceId);
                            return src ? (
                              <Link
                                key={sourceId}
                                to={src.route}
                                onClick={() => setOpen(false)}
                                className="rounded-pill border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold text-text hover:border-ink/30"
                              >
                                {src.title}
                              </Link>
                            ) : null;
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-muted">{t("klara.aiEmpty")}</p>
                    )}
                  </div>
                ) : null
              ) : null}
            </div>

            {/* Treffer — ehrlich: leere Suche zeigt nichts, kein Treffer benennt die Lücke. */}
            {query.trim().length > 1 ? (
              results.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                    {t("klara.resultsFor", { q: query.trim() })}
                  </div>
                  {results.slice(0, 6).map((entry) => (
                    <KlaraResult key={entry.id} entry={entry} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ) : (
                <p className="rounded-card border border-dashed border-hairline px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                  {t("klara.noResults")}
                </p>
              )
            ) : null}

            <Link
              to="/hilfe"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
            >
              {t("klara.moreHelp")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
