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
// R-0252: VOR den Karten steht ein Satz, welche Art von Arbeit vorliegt (Regel, Sache, Version), und
// das Band richtet sich danach (`lib/conflictView.ts`, `conflictWorkActions`): der Sachkonflikt
// behält genau die Knöpfe oben; der Regelkonflikt bietet keine Zweitmeinung an; der
// Versionskonflikt fragt „Linker/Rechter Stand gilt", ohne „Beide gelten" und ohne Zweitmeinung.
// Ohne Einordnung (Nacharbeit 5): drei Knöpfe „Als Regel-/Sach-/Versionskonflikt einordnen" stehen
// vorn; die typabhängigen Aktionen sind bis dahin sichtbar gesperrt, ein Satz nennt den Grund. Die
// Einordnung wird gespeichert (`POST /api/conflicts/:id/arbeitsart`), danach gilt das passende Band.
//
// R-0215 / R-1714: ein OFFENER Wahrheitskonflikt ist noch nicht eskaliert. Dann steht „Eskalieren"
// vorn im Band, Entscheidungen und Zweitmeinung sind sichtbar gesperrt (der Dienst lehnt sie mit
// 409 ab), und ein Satz darunter sagt warum. „Kein Widerspruch" bleibt offen — er entscheidet
// keine Wahrheit, er verneint den Befund.
//
// R-0263: nach „Links/Rechts gilt" wählt der Mensch, ob die Seite überstimmt oder nur präzisiert
// (dann mit Geltungsbereich). Der Vorrang gilt nur zwischen diesen zwei Punkten.
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
import { ChevronLeft, ChevronRight, HelpCircle, ListOrdered } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos } from "../api/hooks";
import type {
  Conflict,
  ConflictStatus,
  ConflictWorkKind,
  KnowledgeObject,
  VorrangArt,
} from "../api/types";
import { useRole } from "../app/RoleContext";
import { AiCheckBoardCaveat } from "../components/AiCheckCoverageHint";
import { leerzustandsZeile } from "../components/EmptyStateCtas";
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
import { adminHref } from "../lib/adminSections";
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
  conflictWorkActions,
  conflictWorkKind,
  einordnungAusstehend,
  eskalationAusstehend,
  klaraVorschlag,
  naechsterSchrittSchluessel,
  resolutionEffect,
} from "../lib/conflictView";
import { fallHref, leseFall } from "../lib/fallAbsprung";
import { conflictFinding, groupFindingsByBeitrag, resolveKo } from "../lib/findingGroups";
import { clusterReihenfolge, konfliktCluster } from "../lib/konfliktCluster";
import { REVIEW_HELP_TOPICS } from "../lib/reviewHelp";

const PATH: ConflictStatus[] = ["eskaliert", "zweitmeinung", "geloest"];

/** R-0252: die drei Arbeitsarten des Einordnungswegs, in der Reihenfolge der Auftragsquelle. */
const EINORDNUNG: readonly ConflictWorkKind[] = ["regel", "sache", "version"];

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
  // R-0263: welche Seite gilt (null = „Beide gelten", kein Vorrang), ob sie überstimmt oder nur
  // präzisiert, und — beim Präzisieren — der Geltungsbereich.
  const [gewaehlteSeite, setGewaehlteSeite] = useState<"a" | "b" | null>(null);
  const [vorrangArt, setVorrangArt] = useState<VorrangArt>("ueberstimmt");
  const [geltungsbereich, setGeltungsbereich] = useState("");
  const [opinionId, setOpinionId] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");
  // R-1105: „Kein Widerspruch" schließt erst mit der Begründung des Menschen.
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState(0);
  // R-0961: `?fall=<id>` aus der Aufgabenliste wählt genau diesen Konflikt vor. Die Vorwahl gilt,
  // bis der Prüfer selbst blättert; ein unbekannter Fall fällt auf die gewohnte erste Stelle zurück.
  const [params] = useSearchParams();
  const [zielFall, setZielFall] = useState<string | null>(() => leseFall(params));
  // Aufnahme gesamt-konfliktboard (FR-CON-04): die Fallliste unten verlinkt auf DIESELBE Fläche
  // (`/konflikte?fall=<id>`). Ohne Neumontage liefe die Vorwahl oben nur beim ersten Anstrich —
  // jeder neue Adressstand wählt deshalb seinen Fall erneut vor, auch derselbe Link ein zweites Mal.
  // Abgeglichen im Rendern, kein Effekt und kein Zuhörer.
  const ort = useLocation();
  const [gelesenerOrt, setGelesenerOrt] = useState(ort.key);
  if (ort.key !== gelesenerOrt) {
    setGelesenerOrt(ort.key);
    setZielFall(leseFall(params));
  }

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };

  const escalate = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.escalate(id),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // R-0252 (Nacharbeit 5): der Einordnungsweg — die befugte Person legt die Arbeitsart fest.
  const einordnen = useMutation({
    mutationFn: (v: { id: string; arbeitsart: ConflictWorkKind }) =>
      endpoints.conflicts.einordnen(v.id, v.arbeitsart),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
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
    mutationFn: (c: { id: string; koA: string; koB: string }) =>
      endpoints.ko.act(c.koA, {
        action: "resolve-conflict",
        conflictId: c.id,
        decision: decision.trim(),
        // R-0263: der Vorrang wirkt nur zwischen GENAU diesen zwei Punkten. „Beide gelten" legt
        // keinen fest und schickt deshalb nichts.
        ...(gewaehlteSeite
          ? {
              vorrang: {
                art: vorrangArt,
                gilt: gewaehlteSeite === "a" ? c.koA : c.koB,
                ...(vorrangArt === "schraenkt_ein"
                  ? { geltungsbereich: geltungsbereich.trim() }
                  : {}),
              },
            }
          : {}),
      }),
    onSuccess: () => {
      invalidate();
      setResolvingId(null);
      setDecision("");
      setGewaehlteSeite(null);
      setVorrangArt("ueberstimmt");
      setGeltungsbereich("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.dismiss(id, dismissNote.trim()),
    onSuccess: () => {
      invalidate();
      setDismissingId(null);
      setDismissNote("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-486 (nacht24 Paket 3) hat die Befunde je Beitrag gruppiert und NEUESTE ZUERST gezeigt.
  // Die Gruppen-ÜBERSCHRIFT ist mit dem Kartenpaar entfallen (es steht immer genau ein Konflikt da,
  // mit „k von n"); die REIHENFOLGE bleibt und kommt weiterhin aus derselben Quelle: Befunde
  // desselben Beitrags stehen beieinander, neueste Gruppe zuerst. Kein zweiter Sortierbegriff.
  // R-1637: Widersprüche, die über gemeinsame Beiträge zusammenhängen, stehen beim Blättern
  // nebeneinander und tragen die Cluster-Auskunft. Ohne Cluster bleibt die Reihenfolge die alte.
  const items = clusterReihenfolge(
    groupFindingsByBeitrag(query.data ?? []).flatMap((g) => g.items),
  );
  const cluster = konfliktCluster(items);
  // bens Korrekturpflicht 2 (Runde 4): Ein Konflikt IST das Paar seiner beiden Wissensobjekte —
  // ohne den zweiten Abruf gibt es keine Karte, sondern nur zwei IDs. Solange er läuft, ist die
  // Fläche am Laden; sie sagt nicht „Objekt entfernt" und bietet keine Entscheidung an.
  const lage = flaechenZustand(query, abhaengigeQuelle(kos));
  const zielIndex = zielFall === null ? -1 : items.findIndex((c) => c.id === zielFall);
  const index = zielIndex >= 0 ? zielIndex : gewaehlt;
  const blaettern = (ziel: number): void => {
    setZielFall(null);
    setGewaehlt(Math.min(Math.max(0, ziel), Math.max(items.length - 1, 0)));
  };
  const aktiv: Conflict | null =
    lage.lage === "bestand"
      ? (items[Math.min(index, Math.max(items.length - 1, 0))] ?? null)
      : null;

  // Die Überschrift eines Konflikts sagt, WORUM gestritten wird: der Streitpunkt, sonst der geprüfte
  // Beitrag (koA), sonst die andere Seite. Nie eine erfundene Zusammenfassung, nie eine Roh-UUID.
  // EINE Ableitung für die Paarzeile UND die Fallliste — dieselbe Zeile heißt an beiden Orten gleich.
  const titelVon = (c: Conflict): string => {
    const kollision = resolveCollision(c, kos.data ?? []);
    return (
      (kollision && hasStreitpunkt(kollision) ? kollision.streitpunkt.trim() : "") ||
      resolveKo(c.koA, kos.data ?? [])?.title ||
      conflictKoPair(c, kos.data ?? []).b?.title ||
      t(`con.type.${c.type}`)
    );
  };

  // ---- Die Fallliste: ALLE ungelösten Konflikte, je einer mit Link zur Klärung ----------------
  // Aufnahme gesamt-konfliktboard (R-0950, R-1711, FR-CON-04): die Fläche zeigt bewusst EIN Paar mit
  // „k von n" (Pedi 04.09., JOB 3061) — die Liste aller offenen Fälle steht deshalb im Menü neben
  // dem Segment, geschlossen nur ein Symbol (Textmesser bleibt unberührt). Sie liest dieselben
  // `items` wie Paarzeile und „k von n": jeder Status außer „gelöst", wie der Server ihn liefert
  // (`services/conflicts/src/service.ts`, `unresolved()`), ohne Filter nach dem Objektstatus. Jede
  // Zeile ist ein echter Link (`/konflikte?fall=<id>`); `key` am Menü schließt es nach dem Sprung.
  const faelleMenue =
    lage.lage === "bestand" && items.length > 0 ? (
      <PruefenMenue
        key={ort.key}
        kennung="faelle"
        beschriftung={t("con.caseList", { count: items.length })}
        symbol={<ListOrdered size={16} aria-hidden="true" />}
        breite="w-[22rem]"
      >
        {items.map((c) => (
          <PruefenMenueLink key={c.id} to={fallHref("/konflikte", c.id)}>
            <span
              className={cx(
                "min-w-0 flex-1 truncate",
                c.id === aktiv?.id ? "font-semibold" : undefined,
              )}
            >
              {titelVon(c)}
            </span>
            <span className="shrink-0 text-[11.5px] text-muted">{t(`con.status.${c.status}`)}</span>
          </PruefenMenueLink>
        ))}
      </PruefenMenue>
    ) : null;

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
            {/* ADMIN-16: die Beispielpakete wohnen nicht mehr auf der Importseite, sondern in der
                Verwaltung unter Vorführdaten — der Hinweis nennt deshalb den neuen Ort. */}
            {t("betriebdemo.konfliktHinweis")}{" "}
            <Link
              to={adminHref("vorfuehrdaten", "pakete")}
              className="font-semibold text-brand-text underline"
            >
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
      <PruefenKopf aktiv="konflikte" filter={faelleMenue} hilfe={hilfeMenue} />
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
      {/* R-0956 (Nacharbeit 7): unter der Brettfläche die Einordnung in den Wissenskreis — die
          Fläche selbst trägt im Leerfall weiter genau ihren Satz (con.empty). */}
      {lage.lage === "leer" ? leerzustandsZeile(t, "conflicts") : null}
    </div>
  );

  // ================================================================================================
  // R-1637 · Die Cluster-Auskunft über dem Kartenpaar. Sie erscheint NUR, wenn der angezeigte
  // Konflikt zu einem Cluster gehört — ein einzelner Konflikt sieht aus wie bisher. Die Mitglieder
  // sind Sprungmarken auf dieselbe Fläche; entschieden wird weiter je Widerspruch.
  // ================================================================================================
  function clusterHinweis(c: Conflict): JSX.Element | null {
    const gruppe = cluster.get(c.id);
    if (!gruppe) {
      return null;
    }
    const titelVon = (ko: string): string =>
      resolveKo(ko, kos.data ?? [])?.title ?? t("board.koRemoved");
    const ueberschrift = t("konfliktcluster.titel", {
      n: gruppe.konflikte.length,
      m: gruppe.beitraege.length,
    });
    return (
      <div
        data-testid="konflikt-cluster"
        className="space-y-2 rounded-input bg-trust-warn-bg p-3 text-[12.5px] text-trust-warn-text"
      >
        <div className="font-semibold">{ueberschrift}</div>
        <p>{t("konfliktcluster.erklaerung")}</p>
        <div>
          <span className="font-semibold">{t("konfliktcluster.beitraege")}: </span>
          <span data-testid="konflikt-cluster-beitraege">
            {gruppe.beitraege.map(titelVon).join(" · ")}
          </span>
        </div>
        <div>
          <div className="mb-1 font-semibold">{t("konfliktcluster.widersprueche")}</div>
          <div className="flex flex-wrap gap-1.5">
            {gruppe.konflikte.map((id) => {
              const mitglied = items.find((k) => k.id === id);
              if (!mitglied) {
                return null;
              }
              const angezeigt = id === c.id;
              return (
                <button
                  key={id}
                  type="button"
                  data-text="knopf"
                  data-testid="konflikt-cluster-mitglied"
                  aria-current={angezeigt ? "true" : undefined}
                  disabled={angezeigt}
                  onClick={() => blaettern(items.indexOf(mitglied))}
                  className={cx(
                    "rounded-pill px-2 py-1 text-[11.5px]",
                    angezeigt ? "bg-ink text-white" : "border border-hairline bg-surface text-text",
                  )}
                >
                  {t("konfliktcluster.paar", {
                    a: titelVon(mitglied.koA),
                    b: titelVon(mitglied.koB),
                  })}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

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
    // Die Überschrift der Fläche: dieselbe Ableitung wie in der Fallliste (`titelVon`, oben).
    const titel = titelVon(c);
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
    // ------------------------------------------------------------------------------------------
    // JOB 3406 · KONFLIKTBESCHREIBUNG-SICHTBAR — der von Hand erfasste Satz, genau einmal.
    // ------------------------------------------------------------------------------------------
    // WAS FEHLTE: `description` ist ein PFLICHTfeld am Konflikt (services/conflicts/src/types.ts:57)
    // und trägt beim MANUELL angelegten Konflikt das Einzige, was erklärt, WARUM ein Mensch die zwei
    // Aussagen für widersprüchlich hielt. Der Altstand `c4a166ba` zeigte ihn (dort :371-372); seit
    // dem Umbau auf das Kartenpaar las ihn niemand mehr. Was seither an seiner Stelle stand, ist
    // NICHT dieselbe Auskunft: `origin.rationale` entsteht ausschliesslich im Zweig
    // `origin === "auto" && detector` (lib/conflictBoard.ts:28-38) — der manuelle Zweig gibt dort
    // systematisch nichts zurück.
    //
    // WARUM AUSSERHALB BEIDER KARTEN: der Satz beschreibt den WIDERSPRUCH, nicht eine der beiden
    // Seiten (anders als Zitat, Quellen, Bedingungen, die je Karte stehen). Im `mehr()` einer Karte
    // stünde er zwangsläufig zweimal und behauptete ausserdem, jemand habe SEITE A beschrieben.
    // Deshalb flach unter der Kopfzeile: eine Stelle, ohne Aufklappen lesbar (Vorführung).
    //
    // WARUM DER AUTOMATISCHE FALL IHN NICHT ZEIGT — gemessen, nicht vorsichtshalber: bei der
    // Erkennung schreibt `service.ts:404` `autoDescription(verdict)`, und `detect.ts:216-227` bildet
    // daraus wörtlich „Automatisch erkannt: " + `verdict.begruendung`. Genau diese `begruendung`
    // steht als `detector.rationale` (`service.ts:391`) bereits im „Mehr". Der automatische Zweig
    // hätte hier also denselben Satz ein zweites Mal — mit fest deutschem Vorspann, eingefroren in
    // der Sprache des Erkennungslaufs. Das wäre keine zusätzliche Auskunft, sondern eine verdoppelte;
    // die Fläche des automatischen Falls bleibt deshalb Zeichen für Zeichen die alte — festgehalten
    // vom Umriss-Pin in `tests/conflict-description/beschreibung-sichtbar.test.tsx` (F3).
    //
    // WARUM DER RIEGEL HIER UND NICHT NUR AM SERVER: `sichtbarkeit.ts:486` leert `description` bei
    // Redaktion bereits am Draht. Die Anzeige verlässt sich NICHT darauf — ein Riegel, der nur bei
    // artigem Server hält, ist keiner (JOB 1125).
    //
    // Leer oder nur Zwischenraum heisst: gar nichts. Kein Rahmen, keine Beschriftung und ausdrücklich
    // KEIN Satz über die Abwesenheit — Nichtwissen wird nicht zu einer Auskunft.
    const beschreibung = redigiert || origin.isAuto ? "" : (c.description ?? "").trim();

    // R-0252: die Art der Arbeit steht VOR den Karten — EIN Satz, flach, ohne Aufklappen. Er sagt
    // dazu, ob die Einordnung bei der Anlage gewählt oder von der Prüfung erkannt wurde. Das Band
    // darunter richtet sich nach ihr (`conflictWorkActions`). Die Arbeitsart ist eine Einordnung,
    // kein Inhalt: sie bleibt auch bei Redaktion stehen (Redaktion leert Text und Zitate).
    const arbeit = conflictWorkKind(c);
    const band = conflictWorkActions(arbeit.kind);
    // Nacharbeit 2: ohne Einordnung sagt der Satz „nicht bestimmt" — er rät keine Art aus `type`.
    const arbeitSatz =
      arbeit.kind === null
        ? t("konfliktarbeit.satz.offen")
        : `${t(`konfliktarbeit.satz.${arbeit.kind}`)} ${t(
            arbeit.herkunft === "erkannt" ? "konfliktarbeit.erkannt" : "konfliktarbeit.gewaehlt",
          )}`;
    // R-0215 / R-1714: solange der Wahrheitskonflikt nicht eskaliert ist, sind Entscheidung und
    // Zweitmeinung gesperrt — sichtbar, mit Grund, und „Eskalieren" steht vorn im Band.
    const gesperrt = eskalationAusstehend(c);
    // R-0252 (Nacharbeit 5): ohne Arbeitsart wird ZUERST eingeordnet — die typabhängigen Aktionen
    // stehen sichtbar, aber gesperrt da, bis die befugte Person Regel, Sache oder Version gewählt hat.
    const einordnungOffen = einordnungAusstehend(c);
    const entscheidungGesperrt = gesperrt || einordnungOffen;
    // R-0263 (Nacharbeit 5): Klaras Vorschlag Widerspruch/Präzisierung — er steht im
    // Entscheidungsweg, entscheiden muss die Person (`klaraVorschlag`, lib/conflictView.ts).
    const vorschlag = klaraVorschlag(c);
    const vorschlagSatz = vorschlag
      ? t(vorschlag.schluessel, {
          title: (vorschlag.seite === "a" ? pair.a?.title : pair.b?.title) ?? "",
          bereich: vorschlag.geltungsbereich || t("konfliktarbeit.amPunkt.bereichZurueck"),
        })
      : null;

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
            {t(naechsterSchrittSchluessel(conflictNextStep(c)))}
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

    /** „Links gilt" / „Rechts gilt" / „Beide gelten": derselbe dokumentierende Weg, andere Vorbelegung.
     *  R-0263: `gilt` merkt sich die gewählte Seite — „Beide gelten" (null) legt keinen Vorrang fest. */
    const oeffneAufloesung = (vorbelegung: string, gilt: "a" | "b" | null): void => {
      setErr(null);
      setDecision(vorbelegung);
      setGewaehlteSeite(gilt);
      setVorrangArt("ueberstimmt");
      setGeltungsbereich("");
      setResolvingId(c.id);
    };
    const praezisiert = gewaehlteSeite !== null && vorrangArt === "schraenkt_ein";

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
                onClick={() => blaettern(index - 1)}
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
                onClick={() => blaettern(index + 1)}
                className="rounded-[8px] border border-hairline p-1 text-muted disabled:opacity-40"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </PruefenPaarZeile>

        <p data-testid="konflikt-arbeitsart" className="text-[13px] leading-relaxed text-muted">
          {arbeitSatz}
        </p>

        {clusterHinweis(c)}

        {/* Ohne Beschriftung — und das ist eine Entscheidung, keine Lücke: es gibt keinen
            bestehenden Schlüssel, der „der bei der Anlage erfasste Satz" sachlich richtig benennt
            (`con.autoWhy` = „Begründung" gehört dem automatischen Befund und würde die zwei
            Auskünfte gerade vermischen), und `i18n.ts` ist Zielpfad zweier laufender Aufträge.
            Eine Beschriftung, deren Wortlaut nicht passt, ist schlechter als keine — der Altstand
            `c4a166ba` zeigte den Absatz ebenfalls unbeschriftet. `whitespace-pre-line` hält
            mehrzeilig Erfasstes lesbar; der Text bleibt Text (React entschärft Markup selbst). */}
        {beschreibung ? (
          <p
            data-testid="konflikt-beschreibung"
            className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted"
          >
            {beschreibung}
          </p>
        ) : null}

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
            {gesperrt ? (
              <PruefenKnopf
                ton="primaer"
                kennung="eskalieren"
                disabled={escalate.isPending}
                onClick={() => escalate.mutate(c.id)}
              >
                {t("con.escalate")}
              </PruefenKnopf>
            ) : null}
            {einordnungOffen
              ? EINORDNUNG.map((art) => (
                  <PruefenKnopf
                    key={art}
                    kennung={`einordnen-${art}`}
                    disabled={einordnen.isPending}
                    onClick={() => einordnen.mutate({ id: c.id, arbeitsart: art })}
                  >
                    {t(`konfliktarbeit.einordnen.${art}`)}
                  </PruefenKnopf>
                ))
              : null}
            <PruefenKnopf
              ton="primaer"
              kennung="links-gilt"
              disabled={entscheidungGesperrt}
              onClick={() =>
                oeffneAufloesung(t("con.prefill.side", { title: pair.a?.title ?? "" }), "a")
              }
            >
              {t(band.linksKey)}
            </PruefenKnopf>
            <PruefenKnopf
              ton="primaer"
              kennung="rechts-gilt"
              disabled={entscheidungGesperrt}
              onClick={() =>
                oeffneAufloesung(t("con.prefill.side", { title: pair.b?.title ?? "" }), "b")
              }
            >
              {t(band.rechtsKey)}
            </PruefenKnopf>
            {band.beideGelten ? (
              <PruefenKnopf
                kennung="beide-gelten"
                disabled={entscheidungGesperrt}
                onClick={() => oeffneAufloesung(t("con.prefill.both"), null)}
              >
                {t("con.side.both")}
              </PruefenKnopf>
            ) : null}
            {canDismiss(c) ? (
              <PruefenKnopf
                kennung="kein-widerspruch"
                disabled={dismiss.isPending}
                onClick={() => {
                  setErr(null);
                  setDismissNote("");
                  setDismissingId(dismissingId === c.id ? null : c.id);
                }}
              >
                {t("con.side.none")}
              </PruefenKnopf>
            ) : null}
            {band.zweitmeinung ? (
              <PruefenBandLink
                kennung="zweitmeinung"
                disabled={entscheidungGesperrt}
                onClick={() => {
                  setErr(null);
                  setOpinion("");
                  setOpinionId(opinionId === c.id ? null : c.id);
                }}
              >
                {t("con.secondOpinionAdd")}
              </PruefenBandLink>
            ) : null}
          </PruefenAktionsband>
        ) : null}
        {offen && gesperrt ? (
          <p data-testid="konflikt-eskalation-zuerst" className="text-[12.5px] text-muted">
            {t("konfliktarbeit.eskalation.zuerst")}
          </p>
        ) : null}
        {offen && einordnungOffen ? (
          <p data-testid="konflikt-einordnung-zuerst" className="text-[12.5px] text-muted">
            {t("konfliktarbeit.einordnung.zuerst")}
          </p>
        ) : null}

        {/* Die Begründung ist vorbelegt und EDITIERBAR — die Entscheidung bleibt beim Menschen. */}
        {resolvingId === c.id ? (
          <div data-testid="pruefen-aufloesung" className="space-y-2">
            <div className="rounded-input bg-trust-warn-bg p-2.5 text-[12px] text-trust-warn-text">
              {t("con.resolveEffect")}
              {wirkung.revalidationRecommended ? <span> {t("con.resolveRevalidate")}</span> : null}
            </div>
            {/* R-0263 (Nacharbeit 5): Klaras Vorschlag steht im Entscheidungsweg — als Vorschlag,
                nicht als Vorbelegung. Wählen und den Geltungsbereich festlegen tut die Person. */}
            {vorschlagSatz && band.praezisierung ? (
              <p data-testid="konflikt-vorschlag" className="text-[12.5px] text-muted">
                {vorschlagSatz}
              </p>
            ) : null}
            {/* R-0263: gilt die gewählte Seite überall, oder präzisiert sie die andere nur in einem
                Geltungsbereich? Beim Versionskonflikt gibt es nur das Überstimmen. */}
            {gewaehlteSeite !== null && band.praezisierung ? (
              <fieldset data-testid="konflikt-vorrang" className="space-y-1 text-[13px]">
                <legend className="font-medium text-muted">
                  {t("konfliktarbeit.vorrang.frage")}
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`vorrang-${c.id}`}
                    checked={vorrangArt === "ueberstimmt"}
                    onChange={() => setVorrangArt("ueberstimmt")}
                  />
                  {t("konfliktarbeit.vorrang.ueberstimmt")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`vorrang-${c.id}`}
                    data-testid="konflikt-vorrang-praezisiert"
                    checked={vorrangArt === "schraenkt_ein"}
                    onChange={() => setVorrangArt("schraenkt_ein")}
                  />
                  {t("konfliktarbeit.vorrang.schraenktEin")}
                </label>
                {praezisiert ? (
                  <input
                    type="text"
                    data-testid="konflikt-geltungsbereich"
                    value={geltungsbereich}
                    onChange={(e) => setGeltungsbereich(e.target.value)}
                    aria-label={t("konfliktarbeit.vorrang.geltungsbereich")}
                    placeholder={t("konfliktarbeit.vorrang.geltungsbereichHinweis")}
                    className="h-10 w-full rounded-input border border-hairline bg-surface px-2.5 text-sm"
                  />
                ) : null}
                <p className="text-[12px] text-muted">{t("konfliktarbeit.vorrang.wirkung")}</p>
              </fieldset>
            ) : null}
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
              disabled={
                resolve.isPending ||
                decision.trim().length === 0 ||
                (praezisiert && geltungsbereich.trim().length === 0)
              }
              onClick={() => resolve.mutate({ id: c.id, koA: c.koA, koB: c.koB })}
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

        {dismissingId === c.id ? (
          <div data-testid="pruefen-fehlalarm" className="space-y-2">
            <div className="rounded-input bg-trust-warn-bg p-2.5 text-[12px] text-trust-warn-text">
              {t("fehlalarm.wirkung")}
            </div>
            <textarea
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              rows={2}
              aria-label={t("con.dismiss")}
              placeholder={t("fehlalarm.platzhalter")}
              className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
            />
            <Button
              variant="primary"
              disabled={dismiss.isPending || dismissNote.trim().length === 0}
              onClick={() => dismiss.mutate(c.id)}
            >
              {t("con.dismiss")}
            </Button>
          </div>
        ) : null}
      </>
    );
  }
}
