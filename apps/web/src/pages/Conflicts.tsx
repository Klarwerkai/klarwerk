// ================================================================================================
// JOB 3061 · H2 — REITER „KONFLIKTE": ZWEI KARTEN, DER WIDERSPRUCH FARBIG, VIER KNÖPFE.
// ================================================================================================
//
// Pedi 04.09. 06:50: „Sie vergleichen Duplikat und in Konflikte sind so irreführend und so
// unübersichtlich." Bis hierher stand hier je Konflikt: eine Gruppenüberschrift, eine FindingCard,
// eine Typ-Pille, ein Beschreibungstext, zwei Kollisionskacheln mit einem ↯-Zeichen dazwischen,
// eine Beweislagenzeile, zwei ConflictKoSide-Kacheln, eine Datumszeile, ein Aufklapper mit
// Herkunfts-Badge, zwei KoPanels, zwei Vergleichswegen und einem Eskalationspfad, darunter vier
// Knöpfe, zwei Textfelder — und ein Modal mit denselben zwei Objekten ein drittes Mal.
//
// JETZT (design/klarwerk/Konflikte.dc.html): eine Zeile (worum es geht · k von n · Art), zwei
// Karten nebeneinander mit der widersprechenden Aussage in BEIDEN rot hinterlegt, darunter
// „Links gilt / Rechts gilt / Beide gelten, je nach Kontext / Kein Widerspruch" und rechts der
// Textlink „Zweitmeinung anfragen".
//
// NICHTS GEHT VERLOREN (Auftrag §11): Eskalieren, Eskalationspfad, Vergleichsseite und Details
// liegen im „···" jeder Karte; Herkunft, Sicherheit, Begründung, Zitate, Bedingungen, Maßnahmen,
// Quellen, Status, nächster Schritt, Beweislage und der Wirkungssatz liegen im „Mehr" jeder Karte;
// Leerzustands-Erklärung, Beispielpakete und der KI-Deckel-Vorbehalt liegen im „?"-Menü.
//
// EHRLICHKEIT VOR OPTIK: „Links gilt" LÖSCHT NICHTS. Es schreibt dieselbe dokumentierende
// Auflösung wie bisher (`resolve-conflict`) mit einer vorbelegten, EDITIERBAREN Begründung — der
// Wirkungssatz `con.resolveEffect` steht unverändert daneben. Und markiert wird im Text nur, was
// wörtlich belegt ist (siehe `components/pruefen/markierung.ts`).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos } from "../api/hooks";
import type { Conflict, ConflictStatus, KnowledgeObject } from "../api/types";
import { useRole } from "../app/RoleContext";
import { AiCheckBoardCaveat } from "../components/AiCheckCoverageHint";
import { SourceEvidence } from "../components/ko/SourceEvidence";
import { PruefenKopf } from "../components/pruefen/PruefenKopf";
import { PruefenMehr, PruefenMehrBlock, PruefenMehrZeile } from "../components/pruefen/PruefenMehr";
import {
  PruefenHilfeBlock,
  PruefenMenue,
  PruefenMenueEintrag,
  PruefenMenueLink,
  PruefenMenueTrenner,
} from "../components/pruefen/PruefenMenue";
import {
  MenueSymbol,
  PruefenAktionsband,
  PruefenBandLink,
  PruefenKnopf,
  PruefenPaar,
  PruefenPaarKarte,
  PruefenPaarZeile,
  PruefenPille,
} from "../components/pruefen/PruefenPaar";
import {
  PruefenErstfehler,
  PruefenNichtFrisch,
  PruefenPlatzhalter,
  PruefenSatz,
} from "../components/pruefen/PruefenZustand";
import { markiereTeile } from "../components/pruefen/markierung";
import { abhaengigeQuelle, flaechenZustand } from "../components/pruefen/zaehler";
import { Button, cx } from "../components/ui";
import { CONFLICT_BOARD_TEXT, canDismiss, conflictOriginInfo } from "../lib/conflictBoard";
import {
  CONFLICT_COLLISION_TEXT,
  hasStreitpunkt,
  resolveCollision,
} from "../lib/conflictCollision";
import {
  conflictEvidenceBalance,
  conflictKoPair,
  conflictNextStep,
  resolutionEffect,
} from "../lib/conflictView";
import { conflictFinding, groupFindingsByBeitrag, resolveKo } from "../lib/findingGroups";
import { REVIEW_HELP_TOPICS } from "../lib/reviewHelp";

const PATH: ConflictStatus[] = ["eskaliert", "zweitmeinung", "geloest"];

// JOB 1125: der Redaktionsmarker der Serversicht. Ohne ihn verschwänden zurückgehaltene Belege
// LAUTLOS, und ein Betrachter hielte einen Fund ohne Zitate für einen Fund ohne Belege.
function istRedigiert(eintrag: unknown): boolean {
  return (eintrag as { redacted?: boolean } | null)?.redacted === true;
}

/** Die Meta-Zeile einer Karte: Status · Bereich · Jahr (Konflikte.dc.html:47). */
function metaVon(ko: KnowledgeObject | null, t: (k: string) => string): string {
  if (!ko) {
    return t("board.koRemoved");
  }
  const jahr = new Date(ko.createdAt);
  return [
    t(`status.${ko.status}`),
    ko.category,
    Number.isNaN(jahr.getTime()) ? null : String(jahr.getFullYear()),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Conflicts(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  const query = useConflicts();
  const kos = useKos();
  const qc = useQueryClient();
  const [decision, setDecision] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [opinionId, setOpinionId] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };

  const escalate = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.escalate(id),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const secondOpinion = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.secondOpinion(id, opinion.trim()),
    onSuccess: () => {
      invalidate();
      setOpinionId(null);
      setOpinion("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const resolve = useMutation({
    mutationFn: (c: { id: string; koA: string }) =>
      endpoints.ko.act(c.koA, {
        action: "resolve-conflict",
        conflictId: c.id,
        decision: decision.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setResolvingId(null);
      setDecision("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.dismiss(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-486 (nacht24 Paket 3) hat die Befunde je Beitrag gruppiert und NEUESTE ZUERST gezeigt.
  // Die Gruppen-ÜBERSCHRIFT ist mit dem Kartenpaar entfallen (es steht immer genau ein Konflikt da,
  // mit „k von n"); die REIHENFOLGE bleibt und kommt weiterhin aus derselben Quelle: Befunde
  // desselben Beitrags stehen beieinander, neueste Gruppe zuerst. Kein zweiter Sortierbegriff.
  const items = groupFindingsByBeitrag(query.data ?? []).flatMap((g) => g.items);
  // bens Korrekturpflicht 2 (Runde 4): Ein Konflikt IST das Paar seiner beiden Wissensobjekte —
  // ohne den zweiten Abruf gibt es keine Karte, sondern nur zwei IDs. Solange er läuft, ist die
  // Fläche am Laden; sie sagt nicht „Objekt entfernt" und bietet keine Entscheidung an.
  const lage = flaechenZustand(query, abhaengigeQuelle(kos));
  const aktiv: Conflict | null =
    lage.lage === "bestand"
      ? (items[Math.min(index, Math.max(items.length - 1, 0))] ?? null)
      : null;

  // ---- Das „?"-Menü: alles Erklärende dieser Fläche an EINEM Ort ------------------------------
  const hilfeMenue = (
    <PruefenMenue
      kennung="hilfe"
      beschriftung={t("pruefen.menu.help")}
      symbol={<HelpCircle size={16} aria-hidden="true" />}
      ausrichtung="links"
      breite="w-[22rem]"
    >
      <PruefenHilfeBlock titel={t("con.title")}>
        <p>{t("con.emptyWhat")}</p>
        <p>{t("con.emptyHow")}</p>
        {/* AUFTRAG-mega29 C2: „Keine offenen Konflikte" ist wörtlich richtig — und liest sich ohne
            diesen Satz als „der Bestand ist geprüft und frei". Der Vorbehalt bleibt WAHR. */}
        <AiCheckBoardCaveat className="text-[12px] leading-relaxed text-trust-warn-text" />
        {role === "admin" ? (
          <p>
            {t("con.emptyExamplesHint")}{" "}
            <Link to="/import#beispielpakete" className="font-semibold text-brand-text underline">
              {t("con.emptyExamplesCta")}
            </Link>
          </p>
        ) : null}
      </PruefenHilfeBlock>
      <PruefenMenueTrenner />
      {REVIEW_HELP_TOPICS.filter((topic) =>
        ["conflictEscalate", "conflictSecondOpinion", "conflictResolve"].includes(topic.id),
      ).map((topic) => (
        <PruefenHilfeBlock key={topic.id} titel={t(topic.titleKey)}>
          <p>{t(topic.bodyKey)}</p>
        </PruefenHilfeBlock>
      ))}
    </PruefenMenue>
  );

  return (
    <div className="mx-auto max-w-[1040px]">
      <PruefenKopf aktiv="konflikte" hilfe={hilfeMenue} />
      <div data-testid="pruefen-flaeche" className="space-y-[22px]">
        {lage.auffrischungGescheitert ? <PruefenNichtFrisch /> : null}
        {err ? (
          <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
            {err}
          </div>
        ) : null}
        {lage.lage === "laedt" ? <PruefenPlatzhalter zeilen={2} /> : null}
        {/* „Erneut laden" holt BEIDE Abrufe nach — die Fläche steht auf beiden. */}
        {lage.lage === "erstfehler" ? <PruefenErstfehler onRetry={invalidate} /> : null}
        {lage.lage === "leer" ? <PruefenSatz kennung="leer">{t("con.empty")}</PruefenSatz> : null}
        {aktiv ? konfliktFlaeche(aktiv) : null}
      </div>
    </div>
  );

  // ================================================================================================
  // Zeichenfunktion, keine innere Komponente — Begründung wie in `Validation.tsx`: eine bei jedem
  // Rendern neu erzeugte Komponente ist ein neuer Typ und reisst den Teilbaum samt offenem Menü und
  // Cursor im Textfeld ab.
  // ================================================================================================
  function konfliktFlaeche(c: Conflict): JSX.Element {
    const pair = conflictKoPair(c, kos.data ?? []);
    const origin = conflictOriginInfo(c);
    const collision = resolveCollision(c, kos.data ?? []);
    const evidence = conflictEvidenceBalance(pair);
    const wirkung = resolutionEffect(c);
    const detected = new Date(c.createdAt);
    const detectedText = Number.isNaN(detected.getTime())
      ? null
      : detected.toLocaleDateString(i18n.language);
    const redigiert = istRedigiert(c);
    // Der Streitpunkt ist die Überschrift der Fläche — er sagt, WORUM gestritten wird. Fehlt er,
    // steht der Titel der linken Seite da; nie eine erfundene Zusammenfassung.
    // SCRUM-486: die ehrliche Benennung von WAS und ERKENNUNGSWEG — dieselbe Ableitung, die die
    // Kopfzeile der alten Befundkarte trug. Sie ist nicht entfallen, sie steht jetzt im „Mehr".
    const befund = conflictFinding(c);
    // Die Überschrift der Fläche sagt, WORUM gestritten wird: der Streitpunkt, sonst der geprüfte
    // Beitrag (koA — derselbe, der bis hierher die Gruppenüberschrift trug). Nie eine erfundene
    // Zusammenfassung, nie eine Roh-UUID.
    const titel =
      (collision && hasStreitpunkt(collision) ? collision.streitpunkt.trim() : "") ||
      resolveKo(c.koA, kos.data ?? [])?.title ||
      pair.b?.title ||
      t(`con.type.${c.type}`);
    // SCRUM-492: Steht der Streitwert WÖRTLICH im Beleg, sagt die Markierung das — dieselbe
    // Auskunft wie das frühere Häkchen an der Kollisionskachel, jetzt am markierten Text selbst.
    const belegHinweis = (seite: "a" | "b"): string | undefined =>
      collision?.[seite].streitwertWoertlich ? t(CONFLICT_COLLISION_TEXT.verbatim) : undefined;
    // Markiert wird NUR, was wörtlich im Text steht (Streitwert bzw. Belegzitat dieser Seite).
    const teileA = markiereTeile(pair.a?.statement ?? "", [
      collision?.a.streitwert ?? "",
      origin.quoteA ?? "",
    ]);
    const teileB = markiereTeile(pair.b?.statement ?? "", [
      collision?.b.streitwert ?? "",
      origin.quoteB ?? "",
    ]);
    const offen = c.status !== "geloest";

    const mehr = (seite: "a" | "b"): JSX.Element => {
      const ko = seite === "a" ? pair.a : pair.b;
      const zitat = seite === "a" ? origin.quoteA : origin.quoteB;
      return (
        <PruefenMehr kennung={`konflikt-${seite}`}>
          <PruefenMehrZeile beschriftung={t("lib.originLabel")}>
            {t(befund.kindLabelKey)} · {t(befund.wayLabelKey)} · {t(origin.labelKey)}
            {origin.confidencePercent !== undefined
              ? ` · ${t(CONFLICT_BOARD_TEXT.confidence, { percent: origin.confidencePercent })}`
              : ""}
          </PruefenMehrZeile>
          {origin.confidencePercent !== undefined ? (
            <PruefenMehrBlock beschriftung={t("con.autoConfidenceCaption")}>
              {t(`con.status.${c.status}`)} · {t(`con.type.${c.type}`)}
              {detectedText ? ` · ${t("con.detectedOn", { date: detectedText })}` : ""}
            </PruefenMehrBlock>
          ) : (
            <PruefenMehrZeile beschriftung={t("pruefen.mehr.zustand")}>
              {t(`con.status.${c.status}`)} · {t(`con.type.${c.type}`)}
              {detectedText ? ` · ${t("con.detectedOn", { date: detectedText })}` : ""}
            </PruefenMehrZeile>
          )}
          {origin.rationale ? (
            <PruefenMehrBlock beschriftung={t(CONFLICT_BOARD_TEXT.why)}>
              {origin.rationale}
            </PruefenMehrBlock>
          ) : null}
          {zitat ? (
            <PruefenMehrBlock
              beschriftung={t(
                seite === "a" ? CONFLICT_BOARD_TEXT.quoteA : CONFLICT_BOARD_TEXT.quoteB,
              )}
            >
              <span className="italic">„{zitat}“</span>
            </PruefenMehrBlock>
          ) : null}
          {redigiert ? (
            <PruefenMehrBlock beschriftung={t("con.redacted.title")}>
              {t("con.redacted.body")}
            </PruefenMehrBlock>
          ) : null}
          {ko && ko.conditions.length > 0 ? (
            <PruefenMehrBlock beschriftung={t("ko.conditions")}>
              {ko.conditions.join(" · ")}
            </PruefenMehrBlock>
          ) : null}
          {ko && ko.measures.length > 0 ? (
            <PruefenMehrBlock beschriftung={t("ko.measures")}>
              {ko.measures.join(" · ")}
            </PruefenMehrBlock>
          ) : null}
          {/* SCRUM-486 (WP4): der KERN-BELEG dieser Seite — klickbare Quelle, Quelldatum,
              KO-Konfidenz. Er kam bis hierher aus `ConflictKoSide`; diese Kachel ist mit dem
              Kartenpaar entfallen, der Beleg selbst NICHT: er steht jetzt hier, aus derselben
              geteilten Komponente (`ko/SourceEvidence`) mit denselben Feldern.
              G-2-EHRLICHKEIT (SCRUM-527): Quelldatum nur aus einer ECHTEN Quelle — kein
              `createdAt`-Ersatz; ohne Quelle sagt `SourceEvidence` „kein Quelldatum". */}
          {ko ? (
            <PruefenMehrBlock beschriftung={t("con.evidenceSideLabel")}>
              <SourceEvidence
                sources={ko.sources ?? []}
                confidence={ko.confidence}
                date={ko.sources?.[0]?.at ?? null}
                variant="compact"
              />
            </PruefenMehrBlock>
          ) : null}
          {evidence ? (
            <PruefenMehrBlock beschriftung={t("pruefen.mehr.evidence")}>
              <span data-testid="conflict-evidence-balance">
                {evidence.kind === "neither"
                  ? t("con.evidenceBalance.neither")
                  : t("con.evidenceBalance.oneSided", {
                      title: (evidence.side === "a" ? pair.a?.title : pair.b?.title) ?? "",
                    })}
              </span>
            </PruefenMehrBlock>
          ) : null}
          <PruefenMehrBlock beschriftung={t("con.nextLabel")}>
            {t(`con.next.${conflictNextStep(c)}`)}
          </PruefenMehrBlock>
          <PruefenMehrBlock beschriftung={t("pruefen.mehr.effect")}>
            {t("con.resolveEffect")}
            {wirkung.revalidationRecommended ? ` ${t("con.resolveRevalidate")}` : ""}
          </PruefenMehrBlock>
          {c.secondOpinion ? (
            <PruefenMehrBlock beschriftung={t("con.secondOpinion")}>
              {c.secondOpinion}
            </PruefenMehrBlock>
          ) : null}
          {c.decision ? (
            <PruefenMehrBlock beschriftung={t("con.decision")}>{c.decision}</PruefenMehrBlock>
          ) : null}
        </PruefenMehr>
      );
    };

    const aktionen = (seite: "a" | "b"): JSX.Element => {
      const ko = seite === "a" ? pair.a : pair.b;
      return (
        <PruefenMenue
          kennung={`konflikt-${seite}`}
          beschriftung={t("pruefen.menu.actions")}
          symbol={<MenueSymbol />}
        >
          {c.type === "truth" && c.status === "offen" ? (
            <PruefenMenueEintrag
              disabled={escalate.isPending}
              onClick={() => escalate.mutate(c.id)}
            >
              {t("con.escalate")}
            </PruefenMenueEintrag>
          ) : null}
          <PruefenMenueLink to={`/konflikte/${c.id}/vergleich`}>
            {t("con.readonlyCompare")}
          </PruefenMenueLink>
          {ko ? (
            <PruefenMenueLink to={`/wissen/${ko.id}`}>{t("con.openKo")}</PruefenMenueLink>
          ) : null}
          {/* Der Eskalationspfad ist eine Auskunft, keine Handlung — er steht deshalb hier unten. */}
          {c.type === "truth" ? (
            <>
              <PruefenMenueTrenner />
              <div className="px-2.5 py-2">
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                  {t("con.escPath")}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PATH.map((step, i) => {
                    const reached = PATH.indexOf(c.status) >= i || c.status === "geloest";
                    return (
                      <span
                        key={step}
                        className={cx(
                          "rounded-pill px-2 py-1 font-mono text-[11px]",
                          reached ? "bg-ink text-white" : "border border-hairline text-muted-2",
                        )}
                      >
                        {i + 1} {t(`con.status.${step}`)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </PruefenMenue>
      );
    };

    /** „Links gilt" / „Rechts gilt" / „Beide gelten": derselbe dokumentierende Weg, andere Vorbelegung. */
    const oeffneAufloesung = (vorbelegung: string): void => {
      setErr(null);
      setDecision(vorbelegung);
      setResolvingId(c.id);
    };

    return (
      <>
        <PruefenPaarZeile titel={titel}>
          <PruefenPille kennung="lauf">
            {t("pruefen.kVonN", { k: index + 1, n: items.length })}
          </PruefenPille>
          <PruefenPille ton="crit" kennung="art">
            {t(`con.type.${c.type}`)}
          </PruefenPille>
          {items.length > 1 ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                data-text="knopf"
                data-testid="pruefen-zurueck"
                aria-label={t("pruefen.prev")}
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="rounded-[8px] border border-hairline p-1 text-muted disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                data-text="knopf"
                data-testid="pruefen-vor"
                aria-label={t("pruefen.next")}
                disabled={index >= items.length - 1}
                onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
                className="rounded-[8px] border border-hairline p-1 text-muted disabled:opacity-40"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </PruefenPaarZeile>

        <PruefenPaar>
          <PruefenPaarKarte
            seite="a"
            ton="konflikt"
            titel={pair.a?.title ?? t("board.koRemoved")}
            meta={metaVon(pair.a, t)}
            teile={teileA}
            markeTitel={belegHinweis("a")}
            aktionen={aktionen("a")}
            mehr={mehr("a")}
          />
          <PruefenPaarKarte
            seite="b"
            ton="konflikt"
            titel={pair.b?.title ?? t("board.koRemoved")}
            meta={metaVon(pair.b, t)}
            teile={teileB}
            markeTitel={belegHinweis("b")}
            aktionen={aktionen("b")}
            mehr={mehr("b")}
          />
        </PruefenPaar>

        {offen ? (
          <PruefenAktionsband>
            <PruefenKnopf
              ton="primaer"
              kennung="links-gilt"
              onClick={() =>
                oeffneAufloesung(t("con.prefill.side", { title: pair.a?.title ?? "" }))
              }
            >
              {t("con.side.left")}
            </PruefenKnopf>
            <PruefenKnopf
              ton="primaer"
              kennung="rechts-gilt"
              onClick={() =>
                oeffneAufloesung(t("con.prefill.side", { title: pair.b?.title ?? "" }))
              }
            >
              {t("con.side.right")}
            </PruefenKnopf>
            <PruefenKnopf
              kennung="beide-gelten"
              onClick={() => oeffneAufloesung(t("con.prefill.both"))}
            >
              {t("con.side.both")}
            </PruefenKnopf>
            {canDismiss(c) ? (
              <PruefenKnopf
                kennung="kein-widerspruch"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(c.id)}
              >
                {t("con.side.none")}
              </PruefenKnopf>
            ) : null}
            <PruefenBandLink
              kennung="zweitmeinung"
              onClick={() => {
                setErr(null);
                setOpinion("");
                setOpinionId(opinionId === c.id ? null : c.id);
              }}
            >
              {t("con.secondOpinionAdd")}
            </PruefenBandLink>
          </PruefenAktionsband>
        ) : null}

        {/* Die Begründung ist vorbelegt und EDITIERBAR — die Entscheidung bleibt beim Menschen. */}
        {resolvingId === c.id ? (
          <div data-testid="pruefen-aufloesung" className="space-y-2">
            <div className="rounded-input bg-trust-warn-bg p-2.5 text-[12px] text-trust-warn-text">
              {t("con.resolveEffect")}
              {wirkung.revalidationRecommended ? <span> {t("con.resolveRevalidate")}</span> : null}
            </div>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={2}
              aria-label={t("con.resolve")}
              placeholder={t("con.decisionPlaceholder")}
              className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
            />
            <Button
              variant="primary"
              disabled={resolve.isPending || decision.trim().length === 0}
              onClick={() => resolve.mutate({ id: c.id, koA: c.koA })}
            >
              {t("con.resolveConfirm")}
            </Button>
          </div>
        ) : null}

        {opinionId === c.id ? (
          <div data-testid="pruefen-zweitmeinung" className="space-y-2">
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={2}
              aria-label={t("con.secondOpinionAdd")}
              placeholder={t("con.secondOpinionPlaceholder")}
              className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
            />
            <Button
              variant="primary"
              disabled={secondOpinion.isPending || opinion.trim().length === 0}
              onClick={() => secondOpinion.mutate(c.id)}
            >
              {t("con.secondOpinionConfirm")}
            </Button>
          </div>
        ) : null}
      </>
    );
  }
}
