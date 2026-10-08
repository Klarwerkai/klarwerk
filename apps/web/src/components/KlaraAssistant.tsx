// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — „Klammer 2.0, aber ehrlich". Klara drängt
// sich nie auf (öffnet nur auf Klick), rät nie (Antworten kommen ausschließlich aus der
// Hilfe-Registry) und sagt offen, wenn ihr ein Eintrag fehlt (Hilfe-Lücke). Stufe 1 kann:
// Seiten-Kontext (Du bist hier), aktives Element (data-help-Anker), Markierung erklären,
// Suche über alle Hilfetexte. Stufe 2 (geerdete LLM-Antworten) folgt auf dieser Basis.
import { useMutation } from "@tanstack/react-query";
import { HelpCircle, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useReasonerStatus } from "../api/hooks";
import { aiSperrHinweisKey } from "../lib/aiAvailability";
import { kiBremsSatz } from "../lib/kiBremse";
import {
  type ResolvedKlaraEntry,
  allFaqEntries,
  allKlaraEntries,
  klaraEntryById,
  klaraGrundlage,
  pageEntryFor,
  pageTitleKeyForRoute,
  resolveKlaraEntries,
  searchKlara,
} from "../lib/klaraRegistry";
// JOB 2660 D2: dieselbe Einstufungs-Beschriftung wie in der Wissenssuche (SCRUM-137).
import { knowledgeClassMeta } from "../lib/knowledgeClass";
import { fassungAmOrt, fragenMitBezug, objektbezugAm } from "../lib/objektbezug";
// JOB 3980: EINE Quelle für die Abbildung UI-Sprache → Reasoner-Sprache. Die Zuordnung von Hand,
// die hier bis heute in `askAi()` stand, ist abgelöst (s. dort).
import { type ReasonerLocale, toReasonerLocale } from "../lib/reasonerLocale";
import { type Objektstatus, objektstatusAus } from "../lib/statusFreigabe";
import { useAiAvailable } from "../lib/useAiAvailable";
import { useGelesenerStand } from "../lib/useGelesenerStand";
import { cleanForSpeech, pickVoice } from "../lib/vorlesen";
import { AiModelInfo } from "./AiModelInfo";
import { AiUnavailableHint } from "./AiUnavailableHint";
// WP-UX-WOW-1 U1: Antwort-Markdown sicher rendern (React-Subset, kein HTML-Sink).
import { AnswerMarkdown } from "./AnswerMarkdown";
import { KlaraSpaceKontext } from "./KlaraSpaceKontext";

// Stimmwahl und Textbereinigung fürs Vorlesen stehen seit FE-003 in `lib/vorlesen.ts` — das
// Seitentutorial liest mit denselben Hilfen vor.

// Ein Hilfe-Ergebnis im Panel — Titel, Text, Absprung zur Route des Themas.
// R-0941: auch ein über die Beschriftung gefundenes Element zeigt sein Beispiel, falls es eines hat
// — das Panel reicht es herein, weil die Beispiele nachgeladen werden (siehe `beispiel` unten).
function KlaraResult({
  entry,
  beispiel,
  onNavigate,
}: { entry: ResolvedKlaraEntry; beispiel: string | null; onNavigate: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-hairline bg-page px-3 py-2.5">
      <div className="text-[12.5px] font-semibold text-text">{entry.title}</div>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{entry.body}</p>
      {beispiel ? (
        <p
          data-testid="klara-beispiel-treffer"
          className="mt-1 text-[12px] leading-relaxed text-text"
        >
          <span className="font-semibold">{t("klarabeispiel.titel")}: </span>
          {beispiel}
        </p>
      ) : null}
      <Link
        to={entry.route}
        onClick={onNavigate}
        className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-text hover:underline"
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
  // R-0942: Klara ist eine aufklappende Fläche, kein sperrendes Fenster. Der Auslöser meldet seinen
  // Zustand (`aria-expanded`/`aria-controls`), beim Öffnen springt der Fokus hinein, und beim
  // Schließen kehrt er NUR dann zum Auslöser zurück, wenn er noch im Panel stand — wer inzwischen
  // anderswo auf der Seite arbeitet, wird nicht zurückgerissen.
  const panelId = useId();
  const ausloeserRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const schliessen = (): void => {
    const fokusDrin = panelRef.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (fokusDrin) {
      ausloeserRef.current?.focus();
    }
  };
  const [query, setQuery] = useState("");
  // PAKET 1 (D-AISTATE, Pedi 23.07.): die KI-Antwort (Reasoner-Task „answer") ohne nutzbares Modell
  // HART ausgrauen — Klaras Registry-Suche (ohne KI) bleibt davon unberührt bedienbar.
  const answerAi = useAiAvailable("answer");
  // R-1040: WARUM der Knopf gesperrt ist — „vom Administrator abgeschaltet" ist etwas anderes als
  // „kein Modell aktiv". Die EINE Regel steht in `lib/aiAvailability.ts` (`aiSperrHinweisKey`);
  // gelesen wird derselbe öffentliche Status wie in `useAiAvailable`, mit derselben Unbekannt-Regel
  // (JOB 3220: nur ohne erfolgreiche Daten ist der Status unbekannt).
  const reasonerStatus = useReasonerStatus();
  const answerSperrHinweis = aiSperrHinweisKey(
    reasonerStatus.data,
    "answer",
    reasonerStatus.isError && !reasonerStatus.data,
  );
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [selectionNote, setSelectionNote] = useState(false);
  // Zeige-Modus (Pedi 05.07.): beliebiges Element anklicken → erklären, ohne die Aktion auszulösen.
  const [inspecting, setInspecting] = useState(false);
  const [inspected, setInspected] = useState<{
    label: string;
    entryId: string | null;
    /** STATUS-FREIGABE: der gezeichnete Status des Objekts, auf das gezeigt wurde — sonst `null`. */
    objektstatus: Objektstatus | null;
  } | null>(null);
  // Klara Stufe 2 (Pedi 05.07.): „Mit KI-Unterstützung suchen" — die Frage + die best-passenden
  // Hilfe-Schnipsel gehen an den Reasoner-Task answer; Antwort NUR daraus, sonst ehrliche Lücke.
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const [aiNoGrounding, setAiNoGrounding] = useState(false);
  const aiAsk = useMutation({
    mutationFn: (body: {
      question: string;
      snippets: { id: string; title: string; body: string }[];
      locale?: ReasonerLocale;
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
    // R-0942: beim Öffnen springt der Fokus in die Fläche (die Fläche selbst, nicht das Suchfeld —
    // auf dem Telefon würde ein fokussiertes Feld sofort die Bildschirmtastatur öffnen).
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        // Dieselbe Regel wie `schliessen`, hier über die Refs, damit der Effekt an `open` hängt.
        const fokusDrin = panelRef.current?.contains(document.activeElement) ?? false;
        setOpen(false);
        if (fokusDrin) {
          ausloeserRef.current?.focus();
        }
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
      // STATUS-FREIGABE: liegt das Element in einem Objekt, übernimmt Klara dessen GEZEICHNETEN
      // Status wörtlich (`objektstatusAus`) — keine eigene Statusableitung neben der Fläche.
      setInspected({ label, entryId, objektstatus: objektstatusAus(target) });
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
  // R-0890 / R-0935: die Bibliotheksartikel sind in Klaras SICHTBARER Suche auffindbar (Suchfeld
  // und Zeige-Modus über die Beschriftung) — hinter den Registry- und FAQ-Treffern. R-0943
  // (Nacharbeit 7): in die KI-Grundlage gehen sie als Auszüge je Artikelteil (`klaraGrundlage`).
  // Nachgeladen beim ersten Öffnen (`lib/klaraBibliothek.ts`): statisch eingebunden hoben die
  // Artikel den ersten geladenen Brocken über den Deckel aus R-0801.
  // Nacharbeit 14 (gesamt-hilfen): aus demselben Grund kommen die Elementbeispiele (R-0941,
  // `lib/klaraBeispiele.ts`, 49 Beispiele in drei Sprachen) mit — gemessen stand der Eintritt mit
  // ihnen 3567 B über dem Deckel. Sie werden nur im offenen Panel gezeigt, also erst dort gebraucht.
  const [bibliothek, setBibliothek] = useState<{
    artikel: ResolvedKlaraEntry[];
    auszuege: ResolvedKlaraEntry[];
    beispiel: (entryId: string, lng: string) => string | null;
  }>({ artikel: [], auszuege: [], beispiel: () => null });
  useEffect(() => {
    if (!open) {
      return;
    }
    let aktuell = true;
    const laden = Promise.all([import("../lib/klaraBibliothek"), import("../lib/klaraBeispiele")]);
    void laden.then(([modul, beispiele]) => {
      if (aktuell) {
        const uebersetzen = (key: string): string => t(key);
        setBibliothek({
          artikel: modul.allBibliothekEntries(i18n.language, uebersetzen),
          auszuege: modul.bibliothekAuszuege(i18n.language, uebersetzen),
          beispiel: beispiele.klaraBeispiel,
        });
      }
    });
    return () => {
      aktuell = false;
    };
  }, [open, t, i18n.language]);
  const auffindbar = useMemo(
    () => [...resolved, ...bibliothek.artikel],
    [resolved, bibliothek.artikel],
  );

  const page = pageEntryFor(location.pathname);
  // Arbeitswege am selben Artikel: Seite, Kennung und Fassung aus der Adresse; fehlt dort die
  // Fassung, die der Lesefläche — nur für denselben Artikel (`fassungAmOrt`).
  const objektbezug = objektbezugAm(location.pathname, location.search);
  const gelesen = useGelesenerStand();
  const objektFassung = objektbezug ? fassungAmOrt(objektbezug.bezug, gelesen) : null;
  const fieldEntry = fieldId ? klaraEntryById(fieldId) : null;
  const results = searchKlara(auffindbar, query);
  // „Zum Bereich"-Link unter der KI-Antwort (Pedi 05.07.): beste Quelle → direkter Absprung.
  // Lookup über den AUFGELÖSTEN Bestand, damit auch FAQ-Quellen (faq:*) Titel + Route liefern.
  const aiFirstSourceId = aiAsk.data?.answered ? aiAsk.data.sources[0] : undefined;
  // R-0943: auch ein Bibliotheksauszug als Quelle führt in seinen Bereich.
  const quellen = [...resolved, ...bibliothek.auszuege];
  const aiTargetEntry = aiFirstSourceId
    ? (quellen.find((e) => e.id === aiFirstSourceId) ?? null)
    : null;

  // Zeige-Modus-Auflösung: exakter Anker gewinnt; sonst Beschriftung als tolerante Suche.
  const inspectedEntry = inspected?.entryId ? klaraEntryById(inspected.entryId) : null;
  // R-0941: das konkrete Beispiel zur Elementerklärung (`lib/klaraBeispiele.ts`) — es steht unter
  // dem Text und wird mit vorgelesen. Ohne Beispiel bleibt die Erklärung, wie sie war.
  const klaraBeispiel = bibliothek.beispiel;
  const fieldBeispiel = fieldEntry ? klaraBeispiel(fieldEntry.id, i18n.language) : null;
  const inspectedBeispiel = inspectedEntry ? klaraBeispiel(inspectedEntry.id, i18n.language) : null;
  const mitBeispiel = (body: string, beispiel: string | null): string =>
    beispiel ? `${body} ${t("klarabeispiel.titel")}: ${beispiel}` : body;
  const inspectedHits =
    inspected && !inspectedEntry && inspected.label.length > 1
      ? searchKlara(auffindbar, inspected.label)
      : [];

  // KI-Suche: beste Hilfe-Schnipsel als einzige Antwort-Grundlage mitgeben; ohne Treffer
  // gibt es ehrlich KEINEN Modellaufruf (nichts, worauf die KI sich stützen könnte).
  const askAi = (): void => {
    const question = query.trim();
    if (question.length < 3 || aiAsk.isPending) {
      return;
    }
    // R-0943 (Nacharbeit 7): Registry + FAQ wie bisher, dazu passende Bibliotheksauszüge — ohne
    // eine FAQ-Antwort zu verdrängen (Regel an `klaraGrundlage`).
    const grounding = klaraGrundlage(resolved, bibliothek.auszuege, question, 12);
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
      // JOB 3980: Hier stand eine ZWEITE Zuordnung von Hand — `startsWith("en") ? "en" : "de"`,
      // genau das Muster, das AUFTRAG-mega52 D1 in `reasonerLocale.ts:6-9` als Pedis Befund vom
      // 28.07. beschreibt: alles Nicht-Englische fiel auf Deutsch, Niederländisch erreichte das
      // Modell nie. Sie ist ersatzlos weg; es gilt der eine Helfer.
      locale: toReasonerLocale(i18n.language),
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
        ref={ausloeserRef}
        type="button"
        data-klara="1"
        aria-label={t("klara.open")}
        title={t("klara.open")}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? schliessen() : setOpen(true))}
        className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-ink text-page shadow-popover transition-opacity hover:opacity-85"
      >
        <HelpCircle size={20} />
      </button>
      {open ? (
        <section
          ref={panelRef}
          id={panelId}
          tabIndex={-1}
          data-klara="1"
          aria-label={t("klara.title")}
          className="fixed bottom-20 right-5 z-40 flex max-h-[68vh] w-[min(340px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-popover outline-none"
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
              onClick={schliessen}
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

            {/* ARBEITSWEGE AM SELBEN ARTIKEL — der Beitrag, an dem gerade gearbeitet wird: Kennung
                und Fassung aus DERSELBEN Quelle wie Prüfen, Lesen und Fragen (`lib/objektbezug.ts`),
                also auch nach Zurücknavigation und Neuladen derselbe. Der Weg nach „Fragen" trägt
                genau diesen Bezug weiter. */}
            {objektbezug ? (
              <div
                data-testid="klara-objektbezug"
                data-seite={objektbezug.seite}
                data-ko={objektbezug.bezug.koId}
                data-fassung={objektFassung ?? undefined}
              >
                <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                  {t("arbeitsweg.klara.label")}
                </div>
                <div className="break-all font-mono text-[11.5px] text-text">
                  {objektbezug.bezug.koId}
                </div>
                {objektFassung !== null ? (
                  <div className="text-[12px] text-muted">
                    {t("arbeitsweg.fassung", { fassung: objektFassung })}
                  </div>
                ) : null}
                {objektbezug.seite !== "fragen" ? (
                  <Link
                    data-testid="klara-objektbezug-fragen"
                    to={fragenMitBezug("/fragen", {
                      koId: objektbezug.bezug.koId,
                      fassung: objektFassung,
                    })}
                    onClick={() => setOpen(false)}
                    className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-text hover:underline"
                  >
                    {t("arbeitsweg.klara.chat")} <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            ) : null}

            {/* produkt:20261007:spaces — der tatsächliche Spacekontext dieses Orts (vom Server). */}
            <KlaraSpaceKontext pfad={location.pathname} />

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
                  {fieldBeispiel ? (
                    <p
                      data-testid="klara-beispiel-feld"
                      className="mt-1 rounded-input bg-page px-2 py-1.5 text-[12px] leading-relaxed text-text"
                    >
                      <span className="font-semibold">{t("klarabeispiel.titel")}: </span>
                      {fieldBeispiel}
                    </p>
                  ) : null}
                  {speakButton(
                    "field",
                    t(fieldEntry.titleKey),
                    mitBeispiel(t(fieldEntry.bodyKey), fieldBeispiel),
                  )}
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
                {inspected.objektstatus ? (
                  <div
                    data-testid="klara-objektstatus"
                    data-objekt={inspected.objektstatus.art}
                    className="mb-2 rounded-card border border-hairline bg-page px-3 py-2.5"
                  >
                    <div className="text-[12.5px] font-semibold text-text">
                      {t("statusfreigabe.klara.titel")}
                    </div>
                    <p
                      data-testid="klara-objektstatus-text"
                      className="mt-0.5 text-[12px] leading-relaxed text-text"
                    >
                      {inspected.objektstatus.text}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
                      {t("statusfreigabe.klara.hinweis")}
                    </p>
                    {speakButton(
                      "objektstatus",
                      t("statusfreigabe.klara.titel"),
                      inspected.objektstatus.text,
                    )}
                  </div>
                ) : null}
                {inspectedEntry ? (
                  <div>
                    <div className="text-[12.5px] font-semibold text-text">
                      {t(inspectedEntry.titleKey)}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                      {t(inspectedEntry.bodyKey)}
                    </p>
                    {inspectedBeispiel ? (
                      <p
                        data-testid="klara-beispiel-element"
                        className="mt-1 rounded-input bg-page px-2 py-1.5 text-[12px] leading-relaxed text-text"
                      >
                        <span className="font-semibold">{t("klarabeispiel.titel")}: </span>
                        {inspectedBeispiel}
                      </p>
                    ) : null}
                    {speakButton(
                      "inspected",
                      t(inspectedEntry.titleKey),
                      mitBeispiel(t(inspectedEntry.bodyKey), inspectedBeispiel),
                    )}
                  </div>
                ) : inspectedHits.length > 0 ? (
                  <div className="space-y-2">
                    {inspectedHits.slice(0, 3).map((entry) => (
                      <KlaraResult
                        key={entry.id}
                        entry={entry}
                        beispiel={klaraBeispiel(entry.id, i18n.language)}
                        onNavigate={() => setOpen(false)}
                      />
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
                  // PAKET 1 (D-AISTATE): hart ausgrauen, wenn kein Modell für „answer" nutzbar ist.
                  disabled={query.trim().length < 3 || aiAsk.isPending || !answerAi.available}
                  title={!answerAi.available ? t(answerSperrHinweis) : undefined}
                  onClick={askAi}
                  className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-50"
                >
                  {aiAsk.isPending ? t("klara.aiBusy") : t("klara.aiSearch")}
                </button>
                <AiModelInfo task="answer" />
              </div>
              <AiUnavailableHint show={!answerAi.available} hinweisKey={answerSperrHinweis} />
              {askedFor && !aiAsk.isPending ? (
                aiNoGrounding ? (
                  <p className="rounded-card border border-dashed border-hairline px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                    {t("klara.noResults")}
                  </p>
                ) : aiAsk.isError ? (
                  // R-0842: bei gebremster KI-Anfrage der Satz des Servers mit Wartezeit.
                  <p
                    data-testid="klara-ai-fehler"
                    className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
                  >
                    {kiBremsSatz(aiAsk.error) ?? t("state.error")}
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
                      {/* JOB 2660 D2 — DIE EINSTUFUNG DIESER ANTWORT, SICHTBAR.
                        Pedis Frage lautete: „Sehe ich in der Hilfe, dass mein eigener Text nicht
                        geprüft ist?" Bis hierher war sie mit NEIN zu beantworten. Der Server
                        liefert zu jeder Hilfe-Antwort `knowledgeClass` (abgeleitet aus dem Stand
                        der tragenden Quellen, `answerStanding` in services/reasoner/src/provider.ts)
                        — das Panel zeigte davon nichts. Sichtbar war nur der Satz oben, und der
                        steht IMMER da, gleich worauf die Antwort fußt. Damit war die Güte der
                        Antwort für den Menschen nicht zu erkennen.
                        Das Etikett ist NICHT neu erfunden: Beschriftung und Zuordnung kommen aus
                        demselben Baustein wie in der Wissenssuche (`knowledgeClassMeta`,
                        `ask.knowledgeClass.*`) — Hilfe und Ask sprechen dieselbe Sprache, statt in
                        der Hilfe eine zweite Wahrheit aufzumachen. Es steht bewusst NEBEN dem
                        Hinweis, nicht statt seiner: der eine sagt, WOHER die Antwort kommt, das
                        andere, WORAUF sie steht.
                        Keine Zahl: Der Vertrauenswert ist ein quellenbezogener Wert. Das Panel
                        nennt seine Quellen erst darunter — eine Zahl an dieser Stelle behauptete
                        Genauigkeit vor ihrer Grundlage. Dieselbe Zurückhaltung übt Ask.tsx an
                        seinem Trust-Balken (dort ausführlich begründet, AUFTRAG-mega53 B2). */}
                      <span
                        data-testid="klara-ai-evidence"
                        className="rounded-pill border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted"
                      >
                        {t(knowledgeClassMeta(aiAsk.data.knowledgeClass).labelKey)}
                      </span>
                    </div>
                    {/* JOB 2959 D1 — DIE FRAGE, ZU DER DIESE ANTWORT GEHÖRT.
                      Sie wurde bis hierher gemerkt (`setAskedFor`, oben) und ausschließlich als
                      Schalter benutzt — auf den Bildschirm kam sie nie. Das ist mehr als eine
                      fehlende Beschriftung: Die Antwort bleibt stehen, während der Nutzer im Feld
                      weitertippt. Die Trefferliste darunter zieht mit (`klara.resultsFor` nennt die
                      aktuelle Eingabe), die KI-Antwort daneben tut es nicht — nebeneinander liest
                      sich die alte Antwort dann wie die Antwort auf die neu getippte Frage. Genau
                      das schließt Klaras eigener Grundsatz aus: nichts behaupten, was nicht belegt
                      ist (Dateikopf: „rät nie", „sagt offen, wenn ihr ein Eintrag fehlt").
                      KEIN NEUER TEXTSCHLÜSSEL. Die Zeile trägt die Frage des Nutzers in dessen
                      eigener Sprache; ein Label davor wäre ein neuer i18n-Eintrag, und `i18n.ts`
                      gehört in diesem Durchgang einer anderen Bahn. Das Zitat unter der
                      Überschrift „KI-Antwort aus der Hilfe" ist ohne Label eindeutig. Ob zusätzlich
                      ein Satz nötig ist, wenn die Eingabe inzwischen abweicht („diese Antwort
                      gehört zu deiner vorigen Frage"), ist eine Ownerfrage — sie bräuchte genau
                      diesen neuen Schlüssel. */}
                    <p
                      data-testid="klara-ai-question"
                      className="mb-1.5 text-[11.5px] italic leading-relaxed text-muted-2"
                    >
                      „{askedFor}"
                    </p>
                    {aiAsk.data.answered && aiAsk.data.answer ? (
                      <>
                        {/* WP-UX-WOW-1 U1: Antwort-Markdown sicher rendern (React-Subset). */}
                        <AnswerMarkdown
                          text={aiAsk.data.answer ?? ""}
                          className="text-[12px] leading-relaxed text-text"
                        />
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
                            const src = quellen.find((e) => e.id === sourceId);
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
                    <KlaraResult
                      key={entry.id}
                      entry={entry}
                      beispiel={klaraBeispiel(entry.id, i18n.language)}
                      onNavigate={() => setOpen(false)}
                    />
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
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text hover:underline"
            >
              {t("klara.moreHelp")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
