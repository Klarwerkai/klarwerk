// ================================================================================================
// JOB 3061 · H2 — REITER „DUPLIKATE": ZWEI KARTEN, DAS ABWEICHENDE GELB, VIER KNÖPFE.
// ================================================================================================
//
// Dieselbe Fläche wie „Konflikte" mit zwei Unterschieden (design/klarwerk/Duplikate.dc.html):
// die Markierung ist #FDF1D7 statt #FBE6E6, und die vier Knöpfe heissen „Links behalten /
// Rechts behalten / Beide behalten, verknüpfen / Kein Duplikat".
//
// EHRLICHKEIT VOR OPTIK, hier besonders (Auftrag §8.5):
//   · Die Prozentzahl bleibt SICHTBAR — als EINE Pille „NN % gleich" in der Kopfzeile. Sie führt
//     mit der KI-Wahrscheinlichkeit, wenn es einen echten Modellfund gibt, sonst mit der
//     Textdeckung (`overlapDetectorInfo.isModelFinding`); die Einordnung „Wahrscheinlichkeit, kein
//     Beweis" steht wörtlich im „Mehr".
//   · KEIN Zusammenführen, KEIN Löschen. „Links behalten" ist der vorhandene, dokumentierende Weg
//     `keepSeparate` mit einem Vermerk, welche Seite als maßgeblich gilt — beide Objekte bleiben.
//   · Markiert wird nur, was wörtlich belegt ist. Findet sich weder ein Eigenanteil noch ein
//     gemeinsames Zitat im Text, bleibt der Text unmarkiert statt bunt geraten.
//
// NICHTS GEHT VERLOREN (Auftrag §11): Vergleichsseite und Objektdetails im „···"; Erkennungsweg,
// Textdeckung, Sicherheit, Caption, gemeinsame Aussagen mit Zitaten, Eigenanteile, Empfehlung,
// Status, Abschlussgrund und der Redaktionshinweis im „Mehr"; die Erkennungs-Hilfe und der
// KI-Deckel-Vorbehalt im „?"-Menü.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDuplicates, useKos } from "../api/hooks";
import type { KnowledgeObject, OverlapEntry } from "../api/types";
import { AiCheckBoardCaveat } from "../components/AiCheckCoverageHint";
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
import {
  type TextStueck,
  hatMarkierung,
  markiereRest,
  markiereTeile,
} from "../components/pruefen/markierung";
import { abhaengigeQuelle, flaechenZustand } from "../components/pruefen/zaehler";
import { conflictKoPair } from "../lib/conflictView";
import {
  DUPLICATE_BOARD_TEXT,
  canClose,
  overlapDetectorInfo,
  recommendationLabelKey,
  relationLabelKey,
} from "../lib/duplicateBoard";
import { groupFindingsByBeitrag, overlapFinding, resolveKo } from "../lib/findingGroups";

/**
 * JOB 3061 · H2: die drei Abschlussgründe, die ein MENSCH wählen darf — dieselbe Teilmenge, die der
 * Server in `HUMAN_OVERLAP_CLOSE_REASONS` führt. `merged`, `participant_deleted` und `superseded`
 * gehören dem Assistenten bzw. den Integritäts-Routinen und stehen darum NICHT zur Wahl: die Fläche
 * darf keinen Vorgang ins Protokoll schreiben, den es nicht gab.
 */
const ABSCHLUSSGRUENDE = ["kept_separate", "linked_related", "dismissed"] as const;
type AbschlussGrund = (typeof ABSCHLUSSGRUENDE)[number];

/** Was der Statusweg an den Server schickt — dieselbe Form wie `endpoints.duplicates.setStatus`. */
type StatusEingabe =
  | { status: "in_bearbeitung"; note?: string }
  | { status: "geschlossen"; reason: AbschlussGrund; note?: string };

function istRedigiert(eintrag: unknown): boolean {
  return (eintrag as { redacted?: boolean } | null)?.redacted === true;
}

function metaVon(ko: KnowledgeObject | null, t: (k: string) => string): string {
  if (!ko) {
    return t("board.koRemoved");
  }
  const datum = new Date(ko.createdAt);
  return [
    t(`status.${ko.status}`),
    ko.category,
    Number.isNaN(datum.getTime()) ? null : String(datum.getFullYear()),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Was auf dieser Seite markiert wird: bevorzugt der EIGENANTEIL (das, was nur hier steht), weil er
 * genau die Frage beantwortet, die ein Redakteur hat. Steht er nicht wörtlich im Text, wird der
 * Rest um die gemeinsamen Zitate herum markiert. Gibt es auch die nicht, bleibt der Text ruhig.
 */
function teileFuer(text: string, eigenanteil: string, gemeinsam: readonly string[]): TextStueck[] {
  const direkt = markiereTeile(text, [eigenanteil]);
  if (hatMarkierung(direkt)) {
    return direkt;
  }
  return markiereRest(text, gemeinsam);
}

export function Duplicates(): JSX.Element {
  const { t } = useTranslation();
  const query = useDuplicates();
  const kos = useKos();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["duplicates"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };
  const onError = (e: unknown): void =>
    setErr(e instanceof ApiError ? e.message : t("state.error"));

  const dismiss = useMutation({
    mutationFn: (id: string) => endpoints.duplicates.dismiss(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  // Auftrag §5.5: „Links behalten"/„Rechts behalten" → getrennt lassen MIT Vermerk der maßgeblichen
  // Seite. Der Vermerk reist auf dem vorhandenen `note`-Feld des Endpunkts mit; es wird nichts
  // zusammengeführt und nichts gelöscht.
  const keepSeparate = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      endpoints.duplicates.keepSeparate(id, note),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  const linkRelated = useMutation({
    mutationFn: (id: string) => endpoints.duplicates.linkRelated(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  // ==============================================================================================
  // JOB 3061 · H2 (bens Korrekturpflicht 1, Runde 5) — „STATUS SETZEN" ALS EIGENER MENÜWEG.
  // ==============================================================================================
  //
  // Auftrag §5: das „···"-Menü der Duplikatkarte kann „Status setzen (In Bearbeitung/Geschlossen
  // mit Abschlussgrund)". In Runde 5 stand davon nur die ANZEIGE im „Mehr" — der Weg fehlte, und
  // ein Abschluss über „Links behalten" im Fussband ist nicht derselbe Vorgang: dort wählt der
  // KNOPF den Grund, hier wählt ihn der MENSCH.
  //
  // Der Endpunkt dahinter ist neu (`POST /api/duplicates/:id/status`) und liegt ausserhalb der
  // Zielpfade; die RUECKGABE nennt ihn unter ABWEICHUNGEN. Ohne ihn wäre „In Bearbeitung" eine
  // Scheinfunktion gewesen — der Wert stand im Typ, aber nichts konnte ihn je schreiben.
  const setStatus = useMutation({
    mutationFn: (eingabe: { id: string } & StatusEingabe) =>
      endpoints.duplicates.setStatus(eingabe.id, eingabe),
    onSuccess: () => {
      invalidate();
      setErr(null);
      // Das Formular hat seinen Zweck erfüllt; beim nächsten Öffnen fängt es leer an.
      setStatusform(null);
    },
    onError,
  });
  // Welches Kartenmenü hat das Abschlussformular offen, mit welchem Grund und welchem Vermerk?
  // Bewusst EIN Zustand für die ganze Fläche und nicht einer je Karte: es gibt genau einen
  // Vorgang, und zwei gleichzeitig offene Abschlussformulare zu demselben Eintrag wären eine
  // Einladung, ihn zweimal zu schliessen.
  const [statusform, setStatusform] = useState<{
    seite: "a" | "b";
    grund: AbschlussGrund | "";
    vermerk: string;
  } | null>(null);
  const busy =
    dismiss.isPending || keepSeparate.isPending || linkRelated.isPending || setStatus.isPending;

  // SCRUM-486 (nacht24 Paket 3): dieselbe Reihenfolge wie bisher — Befunde desselben Beitrags
  // beieinander, neueste Gruppe zuerst. Nur die Gruppen-Überschrift ist mit dem Kartenpaar
  // entfallen; die Ordnung kommt weiterhin aus derselben Quelle.
  const items = groupFindingsByBeitrag(query.data ?? []).flatMap((g) => g.items);
  // bens Korrekturpflicht 2 (Runde 4): dieselbe Kopplung wie bei den Konflikten — eine
  // Überschneidung ist das Paar ihrer beiden Wissensobjekte. Solange der Objektabruf keine Antwort
  // hat, lädt die Fläche; sie behauptet nicht „Objekt entfernt" und lässt nichts entscheiden.
  const lage = flaechenZustand(query, abhaengigeQuelle(kos));
  const aktiv: OverlapEntry | null =
    lage.lage === "bestand"
      ? (items[Math.min(index, Math.max(items.length - 1, 0))] ?? null)
      : null;

  const hilfeMenue = (
    <PruefenMenue
      kennung="hilfe"
      beschriftung={t("pruefen.menu.help")}
      symbol={<HelpCircle size={16} aria-hidden="true" />}
      ausrichtung="links"
      breite="w-[22rem]"
    >
      <PruefenHilfeBlock titel={t("dup.help.detection.title")}>
        <p>{t("dup.help.detection.body")}</p>
      </PruefenHilfeBlock>
      <PruefenHilfeBlock titel={t("dup.title")}>
        <p>{t("dup.intro")}</p>
        {/* AUFTRAG-mega29 C2: ein leeres Ergebnis nach einem gedeckelten Lauf heißt nicht
            „frei von Überschneidungen". Der Vorbehalt bleibt WAHR. */}
        <AiCheckBoardCaveat className="text-[12px] leading-relaxed text-trust-warn-text" />
      </PruefenHilfeBlock>
    </PruefenMenue>
  );

  return (
    <div className="mx-auto max-w-[1040px]">
      <PruefenKopf aktiv="duplikate" hilfe={hilfeMenue} />
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
        {lage.lage === "leer" ? <PruefenSatz kennung="leer">{t("dup.empty")}</PruefenSatz> : null}
        {aktiv ? duplikatFlaeche(aktiv) : null}
      </div>
    </div>
  );

  // Zeichenfunktion, keine innere Komponente (Begründung: `Validation.tsx`).
  function duplikatFlaeche(e: OverlapEntry): JSX.Element {
    const pair = conflictKoPair(e, kos.data ?? []);
    const info = overlapDetectorInfo(e);
    // Die EINE führende Zahl der Pille — dieselbe Wahl wie bisher (Duplicates.tsx:203):
    // KI-Wahrscheinlichkeit bei echtem Modellfund, sonst die deterministische Textdeckung.
    const fuehrend = info
      ? info.isModelFinding
        ? info.confidencePercent
        : info.overlapPercent
      : undefined;
    // SCRUM-486: WAS (Duplikat vs. Überschneidung) und ERKENNUNGSWEG, ehrlich benannt — dieselbe
    // Ableitung wie in der alten Befundkarte; sie steht jetzt im „Mehr".
    const befund = overlapFinding(e);
    // Die Überschrift nennt den GEPRÜFTEN Beitrag (koA), der bis hierher die Gruppenüberschrift war.
    const titel =
      resolveKo(e.koA, kos.data ?? [])?.title ?? pair.b?.title ?? t(relationLabelKey(e.relation));
    const teileA = teileFuer(
      pair.a?.statement ?? "",
      e.eigenanteilA,
      e.aspects.map((a) => a.zitatA),
    );
    const teileB = teileFuer(
      pair.b?.statement ?? "",
      e.eigenanteilB,
      e.aspects.map((a) => a.zitatB),
    );
    const redigiert = istRedigiert(e);

    const mehr = (seite: "a" | "b"): JSX.Element => {
      const eigen = seite === "a" ? e.eigenanteilA : e.eigenanteilB;
      return (
        <PruefenMehr kennung={`duplikat-${seite}`}>
          <PruefenMehrZeile beschriftung={t("lib.originLabel")}>
            {t(befund.kindLabelKey)} · {t(befund.wayLabelKey)}
          </PruefenMehrZeile>
          {info ? (
            <PruefenMehrZeile beschriftung={t(info.methodLabelKey)}>
              {t(DUPLICATE_BOARD_TEXT.overlap, { percent: info.overlapPercent })}
              {info.confidencePercent !== undefined
                ? ` · ${t(DUPLICATE_BOARD_TEXT.confidence, { percent: info.confidencePercent })}`
                : ""}
            </PruefenMehrZeile>
          ) : null}
          {/* SCRUM-486 B: die führende Zahl ist Ähnlichkeit/Wahrscheinlichkeit, kein Beweis. */}
          <PruefenMehrBlock beschriftung={t("pruefen.mehr.effect")}>
            {t(info?.isModelFinding ? "dup.leadCaptionModel" : "dup.leadCaptionText")}
          </PruefenMehrBlock>
          {info?.rationale ? (
            <PruefenMehrBlock beschriftung={t(DUPLICATE_BOARD_TEXT.why)}>
              {info.rationale}
            </PruefenMehrBlock>
          ) : null}
          {redigiert ? (
            <PruefenMehrBlock beschriftung={t("dup.redacted.title")}>
              {t("dup.redacted.body")}
            </PruefenMehrBlock>
          ) : null}
          {e.aspects.length > 0 ? (
            <PruefenMehrBlock beschriftung={t("dup.shared")}>
              <ul className="space-y-1.5">
                {e.aspects.map((a, i) => (
                  <li key={`${e.id}-aspect-${seite}-${a.zitatA}-${i}`}>
                    {a.beschreibung ? (
                      <span className="block font-medium">{a.beschreibung}</span>
                    ) : null}
                    <span className="block italic">„{seite === "a" ? a.zitatA : a.zitatB}“</span>
                  </li>
                ))}
              </ul>
            </PruefenMehrBlock>
          ) : null}
          {eigen ? (
            <PruefenMehrBlock beschriftung={t(seite === "a" ? "dup.onlyA" : "dup.onlyB")}>
              {eigen}
            </PruefenMehrBlock>
          ) : null}
          <PruefenMehrZeile beschriftung={t("pruefen.mehr.recommendation")}>
            {t(recommendationLabelKey(e.recommendation))}
          </PruefenMehrZeile>
          <PruefenMehrZeile beschriftung={t("pruefen.mehr.zustand")}>
            {t(`dup.status.${e.status}`)}
            {e.resolution ? ` · ${t(`dup.reason.${e.resolution.reason}`)}` : ""}
          </PruefenMehrZeile>
        </PruefenMehr>
      );
    };

    const aktionen = (seite: "a" | "b"): JSX.Element => {
      const ko = seite === "a" ? pair.a : pair.b;
      return (
        <PruefenMenue
          kennung={`duplikat-${seite}`}
          beschriftung={t("pruefen.menu.actions")}
          symbol={<MenueSymbol />}
        >
          {/* JOB 2241, der dort benannte enge Rest — der Text des Vergleichslinks wohnt jetzt in
              `i18n.ts` statt in einem lokalen Dreisprachen-Register in dieser Datei. Der deutsche
              Wortlaut bleibt bytegleich. */}
          <PruefenMenueLink to={`/duplikate/${e.id}/vergleich`}>
            {t("dup.compareReadonly")}
          </PruefenMenueLink>
          {ko ? (
            <PruefenMenueLink to={`/wissen/${ko.id}`}>{t("dup.openKo")}</PruefenMenueLink>
          ) : null}
          {/* Auftrag §5: „Status setzen" — der eigene Weg neben den Entscheidungsknöpfen. Er steht
              nur, solange es etwas zu setzen gibt; ein geschlossener Vorgang zeigt hier nichts,
              statt einen Knopf anzubieten, der mit 400 zurückkäme. */}
          {canClose(e) ? (
            <>
              <PruefenMenueTrenner />
              {/* Bewusst OHNE `uppercase`: `innerText` gibt die Schrift so zurück, wie sie
                  gerendert wird — eine CSS-Grossschreibung machte aus „Status setzen" ein
                  „STATUS SETZEN", das keiner Messung und keiner Suche mehr entspricht, die vom
                  i18n-Schlüssel ausgeht (der Inventar-Test tut genau das). Was dasteht, ist der
                  Text, der im Register steht. */}
              <div className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold text-muted-2">
                {t("dup.setStatus")}
              </div>
              {/* „In Bearbeitung" nur aus „offen" heraus: der Vorgang IST schon in Bearbeitung,
                  und ein Knopf, der nichts ändert, wäre eine Behauptung ohne Wirkung. */}
              {e.status === "offen" ? (
                <PruefenMenueEintrag
                  disabled={busy}
                  onClick={() => setStatus.mutate({ id: e.id, status: "in_bearbeitung" })}
                >
                  {t("dup.status.in_bearbeitung")}
                </PruefenMenueEintrag>
              ) : null}
              <PruefenMenueEintrag
                disabled={busy}
                onClick={() =>
                  setStatusform((v) =>
                    v?.seite === seite ? null : { seite, grund: "", vermerk: "" },
                  )
                }
              >
                {t("dup.status.geschlossen")}
              </PruefenMenueEintrag>
              {statusform?.seite === seite ? abschlussformular(e, statusform) : null}
            </>
          ) : null}
        </PruefenMenue>
      );
    };

    /**
     * Das Abschlussformular IM Menü: der Abschlussgrund ist PFLICHT (der Senden-Knopf bleibt
     * gesperrt, solange keiner gewählt ist), der Vermerk ist freiwillig. Radios und kein
     * Auswahlfeld, weil alle drei Möglichkeiten samt ihrer Wirkung gleichzeitig lesbar sein
     * sollen — es ist eine Entscheidung, keine Einstellung.
     */
    function abschlussformular(
      eintrag: OverlapEntry,
      form: { seite: "a" | "b"; grund: AbschlussGrund | ""; vermerk: string },
    ): JSX.Element {
      const gruppe = `dup-abschluss-${form.seite}`;
      return (
        <div
          data-testid={`pruefen-abschluss-${form.seite}`}
          className="mt-1 rounded-[8px] bg-hairline-soft px-2.5 py-2"
        >
          <div className="text-[11.5px] font-semibold text-ink">{t("dup.closeReasonLabel")}</div>
          <div className="mt-1.5 space-y-1">
            {ABSCHLUSSGRUENDE.map((grund) => (
              <label
                key={grund}
                className="flex cursor-pointer items-start gap-2 text-[12.5px] text-text"
              >
                <input
                  type="radio"
                  name={gruppe}
                  value={grund}
                  checked={form.grund === grund}
                  onChange={() => setStatusform({ ...form, grund })}
                  className="mt-0.5"
                />
                <span>{t(`dup.reason.${grund}`)}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            value={form.vermerk}
            aria-label={t("dup.closeNoteLabel")}
            placeholder={t("dup.closeNoteLabel")}
            onChange={(ev) => setStatusform({ ...form, vermerk: ev.target.value })}
            className="mt-2 w-full rounded-[6px] border border-hairline bg-surface px-2 py-1 text-[12.5px] text-text"
          />
          <button
            type="button"
            data-testid="pruefen-abschluss-senden"
            disabled={busy || form.grund === ""}
            onClick={() => {
              if (form.grund === "") {
                return;
              }
              setStatus.mutate({
                id: eintrag.id,
                status: "geschlossen",
                reason: form.grund,
                ...(form.vermerk.trim() ? { note: form.vermerk.trim() } : {}),
              });
            }}
            className="mt-2 w-full rounded-[8px] bg-ink px-2 py-1.5 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("dup.closeSubmit")}
          </button>
        </div>
      );
    }

    return (
      <>
        <PruefenPaarZeile titel={titel}>
          <PruefenPille kennung="lauf">
            {t("pruefen.kVonN", { k: index + 1, n: items.length })}
          </PruefenPille>
          {fuehrend !== undefined ? (
            <PruefenPille ton="warn" kennung="gleich">
              {t("dup.samePercent", { percent: fuehrend })}
            </PruefenPille>
          ) : null}
          <PruefenPille kennung="beziehung">{t(relationLabelKey(e.relation))}</PruefenPille>
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
            ton="duplikat"
            titel={pair.a?.title ?? t("board.koRemoved")}
            meta={metaVon(pair.a, t)}
            teile={teileA}
            aktionen={aktionen("a")}
            mehr={mehr("a")}
          />
          <PruefenPaarKarte
            seite="b"
            ton="duplikat"
            titel={pair.b?.title ?? t("board.koRemoved")}
            meta={metaVon(pair.b, t)}
            teile={teileB}
            aktionen={aktionen("b")}
            mehr={mehr("b")}
          />
        </PruefenPaar>

        {canClose(e) ? (
          <PruefenAktionsband>
            <PruefenKnopf
              ton="primaer"
              kennung="links-behalten"
              disabled={busy}
              onClick={() =>
                keepSeparate.mutate({
                  id: e.id,
                  note: t("dup.keepNote", { title: pair.a?.title ?? "" }),
                })
              }
            >
              {t("dup.side.left")}
            </PruefenKnopf>
            <PruefenKnopf
              ton="primaer"
              kennung="rechts-behalten"
              disabled={busy}
              onClick={() =>
                keepSeparate.mutate({
                  id: e.id,
                  note: t("dup.keepNote", { title: pair.b?.title ?? "" }),
                })
              }
            >
              {t("dup.side.right")}
            </PruefenKnopf>
            <PruefenKnopf
              kennung="beide-verknuepfen"
              disabled={busy}
              onClick={() => linkRelated.mutate(e.id)}
            >
              {t("dup.side.both")}
            </PruefenKnopf>
            <PruefenKnopf
              kennung="kein-duplikat"
              disabled={busy}
              onClick={() => dismiss.mutate(e.id)}
            >
              {t("dup.side.none")}
            </PruefenKnopf>
          </PruefenAktionsband>
        ) : e.resolution ? (
          <PruefenSatz kennung="geschlossen">
            {`${t("dup.closed")}: ${t(`dup.reason.${e.resolution.reason}`)}`}
          </PruefenSatz>
        ) : null}
      </>
    );
  }
}
