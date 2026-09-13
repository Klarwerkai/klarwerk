// SCRUM-312/313: wiederverwendbare KI-Nachbearbeitungsbox — geführte Aktionen + freie Anweisung +
// Vorschau mit bewusster Übernahme (Ersetzen/Anhängen/Verwerfen). Schreibt NICHT still in den Text;
// `runAssist` nutzt den vorhandenen reasoner.assist-Endpunkt (optionale instruction). Kein Auto-Submit,
// keine Auto-Validierung. Nutzt die DOM-freien Helfer aus lib/captureAiAssist. Genutzt von Capture
// (Freitext/Reasoner-Draft) UND KO-Detail-Edit (Aussage überarbeiten).
import { Sparkles } from "lucide-react";
import { useId, useState } from "react";
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
      </div>
      <AiUnavailableHint show={!assistAi.available} />
      <AiAssistInstructions disabled={disabled} onRun={(instruction) => void run(instruction)} />
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

// JOB 3428: dieselben Vorlagen und dieselbe freie Eingabe für Arbeitsraum und Standardeditor.
// Der Aufrufer besitzt Anfrage, Vorschau und Übernahme; hier lebt nur die noch ungesendete Anweisung.
export function AiAssistInstructions({
  disabled,
  onRun,
}: {
  disabled: boolean;
  onRun: (instruction: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const presets = useAssistPresets();
  const [free, setFree] = useState("");
  // JOB 3769 R2: welche Vorlage ihre Erklärung gerade aufgeschlagen hat (oder keine). EINE offene
  // Erklärung, nicht drei — aus demselben Grund, aus dem die Werkzeugzeile EINEN offenen Namen hält
  // (`erfassen/Menue.tsx:17-19`): drei aufgeschlagene Sätze wären wieder die 327,9 px, die diesen
  // Auftrag ausgelöst haben. Begründung im Block unten.
  const [offeneErklaerung, setOffeneErklaerung] = useState<string | null>(null);
  const grundId = useId();

  return (
    <div className="mt-2">
      {(presets.data ?? []).map((p) => {
        // ==========================================================================================
        // JOB 3769 — DER SATZ STAND ZWEIMAL DA, UND DAS ZWEITE MAL DRÜCKTE EINGABE UND KNOPF AUS
        // DEM FENSTER. Deshalb entsteht er hier EINMAL und wird einmal weitergegeben.
        // ==========================================================================================
        //
        // DER BEFUND IST GEMESSEN (echtes Chromium, gebaute Anwendung, 390×844,
        // `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts` Fall B6 am Basisstand
        // 456787e): die Palette war 664 px hoch in einem 844 px hohen Fenster (y=130–794), die freie
        // Eingabe lag bei y=848,8–884,8 und der Ausführen-Knopf bei y=849–884,5 — beide UNTER dem
        // Rand. Die drei sichtbaren Absätze mit demselben Satz waren 86,3 + 86,3 + 155,3 = 327,9 px
        // davon, der höchste Textblock der Fläche. Wer die Palette öffnete, sah dreimal denselben
        // Erklärsatz und musste rollen, um überhaupt zu merken, dass es eine freie Anweisung gibt.
        //
        // WAS FÄLLT UND WAS BLEIBT. Gefallen ist der SICHTBARE `<p>` mit
        // `t("capture.ai.customHelp", …)` — derselbe Aufruf stand daneben schon im `HelpTip`, Zeichen
        // für Zeichen. Der Satz selbst ist unverändert (kein Eingriff in `i18n.ts`); er wird nur
        // nicht mehr doppelt GEZEICHNET.
        //
        // ==========================================================================================
        // RUNDE 2 — WARUM DIE VERBLIEBENE DARBIETUNG EIN AUFSCHLAGBARER ABSATZ IST UND KEIN `title`.
        // ==========================================================================================
        //
        // Runde 1 hat den sichtbaren Absatz entfernt und den Satz an den `HelpTip` und an den
        // `title` des Vorlagenknopfes gehängt. Der Prüfer hat beide Wege im echten Chromium
        // NACHGEFAHREN und beide als KEINEN Weg belegt (ben.md der Runde 1, eigene Messung):
        //   · `HelpTip` zeichnet nichts (`components/HelpTip.tsx:11-14`); er meldet Titel und Text
        //     bei der Seitenhilfe an, und das Zahnrad-Menü listet sie. Die Anmeldung gilt aber nur
        //     „für die Dauer der Montage" (`shell/SeitenhilfeContext.tsx:64-72`), und diese Fläche
        //     ist nur montiert, solange die KI-Palette offen ist (`erfassen/Menue.tsx:383` zeichnet
        //     die Kinder nur dann). Der Klick auf das Zahnrad ist ein Klick nach aussen und
        //     SCHLIESST die Palette (`Menue.tsx:309`) — mit ihr verschwindet der Eintrag, bevor das
        //     Zahnrad-Menü ihn zeigen kann. Gemessene Bedienfolge des Prüfers: Zahnrad →
        //     Seitenhilfe → `{"paletteOffen":false,"erklaerungLesbar":false}`.
        //   · Ein `title` braucht ein Überfahren mit dem Zeiger. Am 390-px-Gerät gibt es keines.
        // Zwei Wege, die keiner sind, sind zusammen immer noch keiner: nach Runde 1 war der Satz am
        // Telefon nicht mehr zu lesen. Das ist genau die Halbheit, die §8 Prüfpunkt 4 ausschliesst.
        //
        // ALSO STEHT DER SATZ WIEDER ALS ABSATZ AUF DER FLÄCHE — aber erst, wenn jemand ihn holt.
        // Der „?"-Griff neben dem Vorlagennamen schlägt ihn auf und wieder zu; das ist ein Klick
        // bzw. eine Berührung, und mehr braucht es an keinem Gerät. Damit hat der Auftrag beides,
        // was er verlangt, ohne dass eines das andere frisst:
        //   · ZUGEKLAPPT zeichnet die Erklärung NICHTS (gemessen: 0 px, Palette y=85–511, 426 px —
        //     B6). Die 86,3 + 86,3 + 155,3 px, die freie Eingabe und Ausführen-Knopf unter den
        //     Fensterrand drückten, entstehen beim Öffnen der Palette nicht mehr.
        //   · AUFGEKLAPPT steht der Satz vollständig und lesbar da, am Namen, zu dem er gehört
        //     (gemessen: B7, echte Bedienfolge bei 390×844, danach `scrollHeight <= clientHeight`).
        //
        // ES BLEIBT BEI EINER DARBIETUNG, NICHT DREIEN. Der `HelpTip` an dieser Stelle und der
        // `title` am Vorlagenknopf sind ENTFERNT, nicht danebengelassen (§7 ABLÖSUNG): ein toter
        // Weg neben einem lebenden ist keine Redundanz, sondern eine zweite Wahrheit über dieselbe
        // Sache — und genau die hat diesen Auftrag ausgelöst. `HelpTip` selbst bleibt unangetastet
        // und trägt oben weiter die fünf Werksaktionen (`:117`); nur die Vorlagen melden sich nicht
        // mehr bei einem Sammler an, den sie nachweislich nicht erreichen.
        //
        // KEIN NEUER TEXT (§10): der Satz ist Zeichen für Zeichen `capture.ai.customHelp`, und der
        // Griff trägt als Namen den vorhandenen Schlüssel `help.open` („Hilfe öffnen"). `i18n.ts`
        // ist nicht angefasst.
        const erklaerung = t("capture.ai.customHelp", { instruction: p.instruction });
        const aufgeschlagen = offeneErklaerung === p.id;
        const satzId = `${grundId}-satz-${p.id}`;
        const nameId = `${grundId}-name-${p.id}`;
        return (
          <div key={p.id} className="mb-2">
            {/*
            JOB 3584 — der Breitendeckel und `break-words`: GEMESSEN, nicht vermutet.

            DER BEFUND, im echten Chromium bei 390 px an der gebauten Anwendung
            (`tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`, Fall B1/B2 am Basisstand
            `9b70025`), wörtlich: „die Vorlage „Instandhaltungsuebergabeprotokollzusammenfassung"
            endet rechts ausserhalb (x=398 von 390) — expected 398 to be less than or equal to 390".
            Der Name einer Vorlage kommt vom Admin der Organisation; ein einzelnes langes Wort hat
            hier keinen Umbruchpunkt, und der Knopf wuchs auf 333 px in einer 304 px breiten Fläche.
            Er schob sich damit aus der Palette (rechts 398 gegen Palette 382) und aus dem Fenster;
            was darüber hinausragt, liegt hinter dem Seitwärtsrollen der Menüfläche und ist nicht
            zu lesen. In jsdom ist das unsichtbar: dort ist jedes Rechteck null.

            WARUM BEIDE KLASSEN UND NICHT EINE. `break-words` (`overflow-wrap: break-word`) allein
            genügt NICHT: es geht nicht in die Berechnung der min-content-Breite ein, der Knopf
            bliebe also so breit wie sein längstes Wort — dieselbe Lehre steht im Haus schon
            geschrieben (`apps/web/src/index.css:74-78`). Der Breitendeckel (`max-w-…`) deckelt den
            Knopf auf die Breite seiner Fläche, und erst darin bricht `break-words` das Wort um.
            Beide zusammen sind die kleinste Änderung, die den gemessenen Überlauf behebt; die
            Kalibrierung K1 des Prüfstandes nimmt sie zurück und verlangt, dass die Messung wieder
            rot wird. JOB 3769 R2: aus `max-w-full` wurde `max-w-[calc(100%-1.75rem)]` — derselbe
            Deckel, nur um den Platz des Erklärgriffs verringert (Begründung im Block darunter).
          */}
            {/*
              KEIN `flex-wrap` — GEMESSEN, NICHT GEWÄHLT.
              Mit `flex-wrap` nahm der Knopf mit dem 48-Zeichen-Namen die ganze Zeile (304 px von
              328 px), und der Erklärgriff rutschte auf eine EIGENE Zeile darunter: Palette 454 px
              statt 426 px. Im höchsten Zustand (eigene Vorlagen UND der Satz zum gescheiterten
              Abruf, B5a) kostete das genau die 24 px, die dem freien Eingabefeld dann unten fehlten
              — die Reparatur dieses Auftrags hätte sich selbst aufgefressen. Ohne Umbruch teilen
              sich Name und Griff EINE Zeile; der Name bekommt 276 statt 304 px und bricht darin
              weiterhin in zwei Zeilen (gemessen: 46 px hoch wie vorher), der Griff kostet nichts.

              UND DER DECKEL AM NAMEN BLEIBT DERSELBE MECHANISMUS, er reserviert nur den Platz des
              Griffs: aus `max-w-full` wird `max-w-[calc(100%-1.75rem)]` (24 px Griff + 4 px
              Abstand). KEIN `min-w-0` daneben — ein schrumpfender Flex-Kasten wäre ein ZWEITER
              Setzungsweg für dieselbe Sache und nähme der Kalibrierung K1 ihren Biss: sie nimmt
              `max-w` und `break-words` zurück und verlangt, dass der Name dann wieder aus dem
              Fenster läuft. Mit dem voreingestellten `min-width:auto` tut er das weiterhin.
            */}
            <span className="flex items-center gap-1">
              <button
                id={nameId}
                type="button"
                disabled={disabled}
                onClick={() => onRun(p.instruction)}
                className="max-w-[calc(100%-1.75rem)] break-words rounded-pill border border-dashed border-ai-dashed px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
              >
                {p.name}
              </button>
              {/*
                DER GRIFF IST NICHT MITGESPERRT. `disabled` heisst hier „ohne nutzbares Modell" oder
                „das Blatt ist leer" — dann läuft die Vorlage nicht. WAS sie täte, darf man trotzdem
                nachlesen; ein ausgegrauter Erklärgriff nähme genau dem die Auskunft, der gerade
                wissen will, warum nichts geht.

                `aria-controls` steht nur, solange der Absatz steht: ein Verweis auf einen Knoten,
                den es nicht gibt, ist für ein Hilfsmittel schlechter als keiner (dieselbe Lehre,
                die `erfassen/Menue.tsx:53-55` für `aria-describedby` festhält). `aria-describedby`
                zeigt auf den Vorlagenknopf — sonst hiessen alle drei Griffe gleich „Hilfe öffnen"
                und keiner sagte, zu welcher Vorlage er gehört.
              */}
              <button
                type="button"
                aria-label={t("help.open")}
                aria-describedby={nameId}
                aria-expanded={aufgeschlagen}
                aria-controls={aufgeschlagen ? satzId : undefined}
                data-testid={`ki-vorlage-hilfe-${p.id}`}
                onClick={() => setOffeneErklaerung(aufgeschlagen ? null : p.id)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] font-semibold text-muted-2 hover:border-ink/30 hover:text-text"
              >
                ?
              </button>
            </span>
            {aufgeschlagen ? (
              <p
                id={satzId}
                data-testid={`ki-vorlage-satz-${p.id}`}
                className="mt-1 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-muted"
              >
                {erklaerung}
              </p>
            ) : null}
          </div>
        );
      })}
      {/*
        KEIN Sammelfehler, wenn der Vorlagenabruf scheitert. Die Vorlagen sind eine Nebensache
        dieser Fläche: fehlen sie, fehlen genau sie — die freie Anweisung und die fünf
        Standardaktionen arbeiten weiter. Runde 1 schrieb hier `state.error` („Etwas ist
        schiefgelaufen.") hin; dieser Satz behauptet einen Fehler der GANZEN Seite und machte
        `tests/capture/job2684-d2-studio-mounted.test.tsx` und `…-d4-studio-dokumentweg-mounted…`
        rot, die auf ihrem DRAFT_STALE-Weg genau diesen Satz ausschließen. Ein eigener, knapper Text
        bräuchte einen neuen Schlüssel in `apps/web/src/i18n.ts` — außerhalb der Zielpfade dieses
        Auftrags; der alte Arbeitsraum zeigt hier ebenfalls seit jeher nichts. Festgehalten in
        `tests/ki-freie-anweisung/standardeditor-mounted.test.tsx` (F6).

        JOB 3566 — DIESER SCHLÜSSEL IST JETZT DA, UND ER IST DIE LÖSUNG. `state.error` bleibt aus
        dem oben genannten Grund verboten; an seiner Stelle steht `capture.ai.presetsFailed` — ein
        Satz, der GENAU die eigenen KI-Funktionen benennt und über Seite, KI und Text des Nutzers
        nichts behauptet. Er tritt an die Stelle des Sammelfehlers, nicht daneben (Fall D).

        WARUM `isError` UND NICHT `data.length === 0`: Schweigen bedeutete bis heute zweierlei —
        „diese Organisation hat keine eigenen Funktionen" (wahr) und „sie konnten nicht geladen
        werden" (eine stillschweigende Falschaussage). Nur der Abrufzustand kann die beiden
        trennen; die Trefferzahl kann es nicht. Deshalb schweigt der erfolgreiche LEERE Bestand
        weiter (Fall B), und deshalb schweigt auch der noch LAUFENDE erste Abruf (Fall E) — dort
        ist noch nichts gescheitert.

        UND DESHALB WIRD NICHTS GELEERT: `isError` und `data` schließen einander in React Query
        nicht aus. Scheitert eine AUFFRISCHUNG, bleibt der zuletzt erfolgreich geholte Bestand in
        `data` — die bekannten Funktionen bleiben oben sichtbar UND dieser Satz kommt darunter
        dazu (Fall F in `tests/ki-freie-anweisung/vorlagen-fehler-mounted.test.tsx`).

        DIE OPTIK IST DIE DER HINWEISZEILE (`AiUnavailableHint`), nicht die der roten Fehlerzeile
        der Box (`boxErr`, oben): die gehört der Assist-Anfrage. Zwei Fehlerkanäle, zwei Stellen,
        zwei verschiedene Aussagen.

        RUNDE 2 — WARUM `isError` ALLEIN NICHT REICHT (BEN, Korrekturpflicht 1). Ist das Gerät schon
        offline, BEVOR diese Fläche aufgeht, wird der Abruf gar nicht erst gestellt: react-query
        pausiert ihn (`fetchStatus: "paused"`, Netzmodus „online"), der Endpunkt wird nie gerufen,
        und weil nichts gerufen wurde, ist auch nichts gescheitert — `isError` bleibt falsch und die
        Fläche schwieg wieder. Gemessen: Fall G rief den Vorlagen-Endpunkt 0-mal. Deshalb steht der
        Satz auch bei `paused`; §9 des Auftrags verlangt für offline ausdrücklich dieselbe Aussage
        wie für den Fehler.

        WARUM `fetchStatus === "paused"` UND NICHT DER ONLINEZUSTAND SELBST (`lib/netzzustand.ts`).
        `paused` entsteht NUR an einem Abruf, den es geben soll (dort im Kopfkommentar :5-11
        festgehalten) — genau die Aussage, die hier gebraucht wird. Ein eigener Online-Blick wäre
        eine zweite Wahrheit über dieselbe Sache und würde zu viel sagen: offline mit frischem, weil
        eben geholtem Bestand fragt niemand nach, es ist nichts unterwegs und nichts fehlt — dann
        wäre „konnten nicht geladen werden" falsch. Beides misst Fall G: offline steht der Satz,
        und sobald das Netz zurück ist, holt der Abruf nach und der Satz geht wieder.
      */}
      {presets.isError || presets.fetchStatus === "paused" ? (
        <p data-testid="ki-vorlagen-fehler" className="mt-1.5 text-[12px] text-muted-2">
          {t("capture.ai.presetsFailed")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder={t("capture.ai.freePlaceholder")}
          aria-label={t("capture.ai.freeLabel")}
          className="h-9 min-w-0 flex-1 rounded-input border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-ink/30"
        />
        <Button
          variant="ghost"
          disabled={disabled || free.trim().length === 0}
          onClick={() => onRun(free.trim())}
        >
          <Sparkles size={14} />
          {t("capture.ai.run")}
        </Button>
      </div>
    </div>
  );
}
