import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useConflicts,
  useEigeneBefunde,
  useGapsSummary,
  useKos,
  useLiveWall,
} from "../../api/hooks";
import { useRole } from "../../app/RoleContext";
import { DEMO_PILOT_PATH, captureDemoHref } from "../../lib/demoPilotPath";
import { eigeneKollisionStart } from "../../lib/eigeneKollision";
import { knowledgeCapital } from "../../lib/funke";
import { KNOWLEDGE_CYCLE } from "../../lib/knowledgeCycle";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../../lib/knowledgeGuidance";
import { useNetzOnline } from "../../lib/netzzustand";
import { PROOF_CHAIN } from "../../lib/proofChain";
import { START_HELP_TOPICS } from "../../lib/startHelp";
import { START_ORIENTATION_TEXT } from "../../lib/startOrientation";
import { stufe2FeatureLabelKeys } from "../../lib/stufe2Hint";
import { AdminFirstRunCard } from "../AdminFirstRunCard";
import { KnowledgeCapitalNumbers, OpenGapsSummary } from "../FunkeCards";
import { KlaraPathTeaser } from "../KlaraPathTeaser";
import { RoleLink } from "../RoleLink";
import { StatusPill } from "../trust";
import type { StartPanelId } from "./startPunkte";

// ================================================================================================
// JOB 3064 H5 — DIE UMGEZOGENEN BLÖCKE DER STARTSEITE. KEINER IST GESTRICHEN.
// ================================================================================================
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren … arbeite mit
// Untermenüs." Bis JOB 3045 trug `/start` zehn Blöcke gleichzeitig; das Zielbild
// (`design/klarwerk/Main.dc.html`) lässt Frage, Feld und zwei Karten übrig. Alles Übrige steht ab
// hier hinter dem „…"-Menü — je Block ein benannter Punkt, je Punkt ein Blatt.
//
// DIE INHALTE SIND WÖRTLICH DIESELBEN. Was hier steht, stand vorher auf der Fläche: Zwecksatz,
// Leitsatz, Klara-Teaser, Wissenskreis, Orientierung, Demo-/Pilotpfad, Erststart-Karte, Live-Wall,
// Wissenskapital, offene Lücken, Stufe-2-Hinweis und die drei ?-Hilfen. Kein Text wurde gekürzt;
// nur sein ORT hat sich geändert. `tests/design/h5-funktionsinventar.test.ts` öffnet jeden Punkt
// einzeln und verlangt seinen Inhalt.
//
// ZWEI PUNKTE, DIE DER AUFTRAG NICHT AUFZÄHLTE (§5a: „Jede weitere Funktion … wird als Zeile
// ergänzt — nie gestrichen"): die Wissenskapital-Kachel (F5) und die Zusammenfassung der offenen
// Wissenslücken (F3) standen ebenfalls auf der Startseite (Start.tsx:633–646 am Basisstand). Sie
// bekommen den gemeinsamen Punkt „Wissenskapital".
//
// UND EIN DRITTER PUNKT, den der Auftrag nur halb aufzählt: die Kollisionsauskunft (A27, JOB 3025).
// §5a schickt den FALL als Zeile in „FÜR DICH" — und dort steht er auch. Was dort NICHT hinpasst,
// ist die andere Hälfte dieser Karte: die fünf Datenlagen, in denen die Auskunft NICHT belastbar
// ist (lädt, Erstfehler, laufende Auffrischung, gescheiterte Auffrischung, offline mit und ohne
// Stand) und die Verneinung „keine Kollision", die ausdrücklich nur nach einem frischen Abruf
// stehen darf. Fünf Codex-Runden (JOB 3002 R1–R5, JOB 3025 R1–R3) haben genau daran gearbeitet;
// eine Zeile, die nur im Erfolgsfall erscheint, würde die vier Störungslagen ersatzlos
// verschweigen — eine Störung sähe wieder aus wie Leere. Sie bekommen deshalb den Punkt „Eigene
// Objekte", und die Zeile in „FÜR DICH" bleibt der kurze Weg in den einen Fall, der handeln lässt.
//
// DIE TABELLE DER PUNKTE steht bewusst NEBENAN in `startPunkte.ts` (dort begründet): sie ist die
// Erwartung des Funktionsinventars, und dessen Test läuft im Wurzel-Typprüfer ohne `jsx`.

const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function StartPanelInhalt({ id }: { id: StartPanelId }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  const guide = knowledgeGuidance("start");
  const kos = useKos();
  const gapsSummary = useGapsSummary();
  const liveWall = useLiveWall();
  // A27 · JOB 3025: DIESELBE Funktion, die auch die Zeile in „FÜR DICH" speist. Die Abfragen
  // dahinter sind dieselben Cache-Einträge (react-query), also entsteht hier kein zweiter Abruf
  // und keine zweite Wahrheit — nur eine zweite Anzeige derselben Auskunft.
  //
  // JOB 3084 · Q6: der Onlinezustand wird GEREICHT, nicht gedeutet — aus derselben einen Quelle wie
  // an der Lesefläche (`lib/netzzustand.ts`). Hier entsteht keine neue Bedingung; ohne diese Zeile
  // stünde nach einer Netztrennung mit ruhendem, formal frischem Zwischenspeicher weiterhin „keine
  // offene Kollision" da (Befund R-1585). Beide Flächen bekommen ihn, damit er nicht an einer davon
  // vergessen wird — das ist die Drift, an der JOB 3002 Runde 4 fiel.
  const kollision = eigeneKollisionStart(
    {
      befunde: useEigeneBefunde(),
      konflikte: useConflicts(),
      kos,
    },
    useNetzOnline(),
  );
  const kollisionsWeg = kollision.weg;
  const stufe2Features = stufe2FeatureLabelKeys()
    .map((k) => t(k))
    .join(", ");

  if (id === "ueber") {
    // AUFTRAG-mega38 BLOCK G1: der eine bejahende Satz ohne Fachwort — plus der Leitsatz, der bis
    // JOB 3015 D5 die letzte Zeile der Startseite war.
    return (
      <div className="space-y-4">
        <p className="kw-start-purpose text-[13.5px] leading-relaxed text-text">
          {t("start.purpose")}
        </p>
        <p className="text-[12px] leading-relaxed text-muted-2">{t("start.konsole.leitsatz")}</p>
      </div>
    );
  }
  if (id === "klara") {
    return <KlaraPathTeaser surface="start" />;
  }
  if (id === "kreis") {
    // SCRUM-261: der Knowledge-OS-Kreis behält ALLE vier Schritte — auch den, den diese Rolle
    // nicht selbst ausführt. Wegzulassen wäre nicht ehrlicher, sondern unvollständig.
    return (
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{t("cycle.title")}</h3>
        <p className="mb-3 mt-0.5 text-[12.5px] text-muted">{t("cycle.subtitle")}</p>
        <div className="grid gap-3">
          {KNOWLEDGE_CYCLE.map((step, i) => (
            <RoleLink
              key={step.id}
              to={step.to}
              className="group rounded-card border border-hairline bg-surface p-3 transition"
              hoverClassName="hover:border-ink/30"
            >
              {(erreichbar) => (
                <>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] font-semibold text-ink">{t(step.labelKey)}</span>
                    {erreichbar && i < KNOWLEDGE_CYCLE.length - 1 ? (
                      <ArrowRight size={15} className="ml-auto text-muted-2" />
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    {t(step.descKey)}
                  </p>
                </>
              )}
            </RoleLink>
          ))}
        </div>
      </div>
    );
  }
  if (id === "demo") {
    // Aufräum-Pass 02.07.: „So liest du Klarwerk" (SCRUM-289) + Demo-/Pilotpfad (SCRUM-290/301).
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{t(START_ORIENTATION_TEXT.title)}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {t(START_ORIENTATION_TEXT.hint)}
          </p>
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
          <div className="mt-2 grid gap-2">
            {guide.items.map((item) => (
              <RoleLink
                key={item.id}
                to={item.to}
                className="rounded-card border border-hairline bg-surface p-3 transition"
                hoverClassName="hover:border-ink/30"
              >
                {() => (
                  <>
                    <span
                      className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                    >
                      {t(item.labelKey)}
                    </span>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                      {t(item.bodyKey)}
                    </p>
                  </>
                )}
              </RoleLink>
            ))}
          </div>
        </div>
        <div className="border-t border-hairline pt-4">
          <h3 className="text-[14px] font-semibold text-ink">{t("demo.title")}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("demo.subtitle")}</p>
          {/* SCRUM-301: sichtbare Pilot-Beweiskette. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
              {t("demo.proof.label")}
            </span>
            {PROOF_CHAIN.map((beat) => (
              <span key={beat.id} className="flex items-center gap-1.5">
                {beat.n > 1 ? <span className="text-muted-2">→</span> : null}
                <span className="rounded-pill bg-page px-2 py-0.5 text-[11px] font-medium text-text">
                  {t(beat.labelKey)}
                </span>
              </span>
            ))}
          </div>
          <ol className="mt-3 grid gap-2">
            {DEMO_PILOT_PATH.map((step) => (
              <li key={step.id}>
                <RoleLink
                  to={step.to}
                  className="block h-full rounded-card border border-hairline bg-surface p-3 transition"
                  hoverClassName="hover:border-ink/30"
                >
                  {() => (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
                          {step.n}
                        </span>
                        <span className="text-[13.5px] font-semibold text-ink">
                          {t(step.labelKey)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                        {t(step.descKey)}
                      </p>
                    </>
                  )}
                </RoleLink>
              </li>
            ))}
          </ol>
          {/* SCRUM-296: aktiver Erfassungsfluss als Einstieg — Capture → Validation → Use. */}
          <RoleLink
            to={captureDemoHref()}
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-text"
            hoverClassName="hover:underline"
          >
            {(erreichbar) => (
              <>
                {t("demo.captureEntry")} {erreichbar ? <ArrowRight size={13} /> : null}
              </>
            )}
          </RoleLink>
        </div>
      </div>
    );
  }
  if (id === "erst") {
    // SCRUM-429: ruhige Erststart-Führung für den neuen Admin.
    return <AdminFirstRunCard />;
  }
  if (id === "gerade") {
    // Audit-P4 (SCRUM-398): Live-Wall — „frisch gesichert" und „hat geholfen" aus echten
    // Ereignissen. Ohne geladene Daten steht hier NICHTS statt einer erfundenen Leermeldung.
    const daten = liveWall.data;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{t("start.livewall.title")}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {t("start.livewall.subtitle")}
          </p>
        </div>
        {daten ? (
          <>
            {daten.helpedToday > 0 ? (
              <span className="inline-flex rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold text-trust-pos-text">
                {t("start.livewall.helpedToday", { n: daten.helpedToday })}
              </span>
            ) : null}
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {t("start.livewall.saved")}
              </div>
              {daten.saved.length === 0 ? (
                <p className="text-[12.5px] text-muted">{t("start.livewall.savedEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {daten.saved.map((s) => (
                    <li key={s.koId} className="flex items-baseline gap-2">
                      <RoleLink
                        to={`/wissen/${s.koId}`}
                        className="min-w-0 flex-1 truncate text-[13px] font-medium text-text"
                        hoverClassName="hover:text-ink"
                      >
                        {() => s.title}
                      </RoleLink>
                      {/* AUFTRAG-mega34 F: die übersetzte Status-Plakette statt des rohen DB-Werts. */}
                      <span className="shrink-0">
                        <StatusPill status={s.status} />
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-2">
                        {new Date(s.at).toLocaleString(
                          i18n.language.startsWith("en") ? "en-GB" : "de-DE",
                          { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {t("start.livewall.helped")}
              </div>
              {daten.helped.length === 0 ? (
                <p className="text-[12.5px] text-muted">{t("start.livewall.helpedEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {daten.helped.map((h) => (
                    <li key={`${h.koId}-${h.at}`} className="flex items-baseline gap-2">
                      <RoleLink
                        to={`/wissen/${h.koId}`}
                        className="min-w-0 flex-1 truncate text-[13px] font-medium text-text"
                        hoverClassName="hover:text-ink"
                      >
                        {() => h.title}
                      </RoleLink>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-2">
                        {new Date(h.at).toLocaleString(
                          i18n.language.startsWith("en") ? "en-GB" : "de-DE",
                          { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }
  if (id === "kapital") {
    // FUNKE F5/F3 (nacht24 Paket 6): Bestandssummen und die anonyme Zahl offener Lücken. Die
    // Lückenzahl kommt weiter aus dem Summary-Endpunkt — kein Volltext-Fetch (FUNKE-FIX2 P0).
    //
    // OHNE BEIDE QUELLEN STEHT HIER NICHTS: `knowledgeCapital([], [])` lieferte lauter Nullen, und
    // eine 0 aus fehlenden Daten ist genau die Behauptung, die `lib/loadingState.ts` verbietet.
    const bestand = kos.data;
    const luecken = gapsSummary.data;
    if (!bestand || !luecken) {
      return <div data-testid="h5-kapital-ohne-daten" />;
    }
    return (
      <div className="space-y-4">
        <KnowledgeCapitalNumbers
          capital={{ ...knowledgeCapital(bestand, []), openGaps: luecken.open }}
        />
        <OpenGapsSummary total={luecken.open} />
      </div>
    );
  }
  if (id === "kollision") {
    // ==========================================================================================
    // A27 (OFFEN.md:81) · JOB 3025 — WAS AN DEN EIGENEN OBJEKTEN KOLLIDIERT.
    // ==========================================================================================
    // WÖRTLICH die Karte, die bis JOB 3064 auf der Startseite stand — derselbe Testanker, dieselbe
    // Ableitung (`eigeneKollisionStart`, dieselbe Funktion wie auf der Detailseite; ein zweiter
    // Ableitungsweg wäre die Drift, an der JOB 3002 R4 fiel), dieselben sechs Datenlagen.
    //
    // Kein Inhalt der Gegenseite (A28) und keine Zahl ohne Grundlage: steht `datenlageKey`, ist die
    // Lage nicht `frisch`, und dann steht hier ein Satz über die Datenlage statt über den Bestand.
    return (
      <div data-testid="job3025-kollision-start">
        <h3 className="mb-1 text-[14px] font-semibold text-ink">{t("kollision.start.title")}</h3>
        <p className="text-[12.5px] leading-relaxed text-text">
          {t(kollision.satzKey, { n: kollision.anzahl })}
        </p>
        {kollision.art !== "keine" && kollision.datenlageKey ? (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
            {t(kollision.datenlageKey)}
          </p>
        ) : null}
        {kollisionsWeg ? (
          <RoleLink
            to={kollisionsWeg.to}
            className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text"
          >
            {(erreichbar) => (
              <>
                {t(kollisionsWeg.textKey)}
                {erreichbar ? <ArrowRight size={14} className="shrink-0" /> : null}
              </>
            )}
          </RoleLink>
        ) : null}
        {kollision.wiederholenMoeglich ? (
          <button
            type="button"
            onClick={kollision.erneutPruefen}
            className="ml-3 mt-1 inline-flex items-center text-[12px] font-semibold text-brand-text underline"
          >
            {t("kollision.wiederholen")}
          </button>
        ) : null}
      </div>
    );
  }
  if (id === "stufe2") {
    // SCRUM-235: ehrlicher Stufe-2-Auffindbarkeits-Hinweis — nur für Admins mit ausgeschaltetem Schalter.
    return (
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{t("start.stufe2.title")}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          {t("start.stufe2.body", { features: stufe2Features, toggle: t("role.stage2") })}
        </p>
      </div>
    );
  }
  // „hilfe" — SCRUM-488: die drei ?-Hilfen des Start-Screens, jetzt als Liste statt als drei
  // verstreute Fragezeichen. Rolle bleibt unbenutzt in diesem Zweig; sie steuert nur die Sichtbarkeit
  // der Punkte oben (startPanelSichtbar).
  void role;
  return (
    <ul className="space-y-4">
      {START_HELP_TOPICS.map((topic) => (
        <li key={topic.id}>
          <h3 className="text-[13px] font-semibold text-ink">{t(topic.titleKey)}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t(topic.bodyKey)}</p>
        </li>
      ))}
    </ul>
  );
}
