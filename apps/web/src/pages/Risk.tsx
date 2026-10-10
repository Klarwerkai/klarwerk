import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import {
  useBusFactor,
  useConflicts,
  useDirectory,
  useExpertise,
  useGaps,
  useKos,
  useLifecyclePending,
} from "../api/hooks";
import type { Gap, GapPriority } from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { AiCheckBoardCaveat } from "../components/AiCheckCoverageHint";
import { BereichsprofilPflege } from "../components/BereichsprofilPflege";
import { EigeneNulltreffer } from "../components/EigeneNulltreffer";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { HelpTip } from "../components/HelpTip";
import { LueckenAnsprechpartner } from "../components/LueckenAnsprechpartner";
import { LueckenVorgang } from "../components/LueckenVorgang";
import { RisikoHorizont } from "../components/RisikoHorizont";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { nurOffeneLuecken, offeneLuecken } from "../lib/adminUebersicht";
import { captureGapHref, gapPrivacyNoticeKey } from "../lib/captureFromGap";
import { canSeeExpertise, contributorNamesFor, expertiseVisible } from "../lib/expertiseView";
import { leseFall } from "../lib/fallAbsprung";
import { gapBelegbedarfSchluessel } from "../lib/gapBelegbedarf";
import { gapTitelEtikett } from "../lib/gapLocaleTag";
import {
  GAP_PRIORITIES,
  type PriorityTone,
  gapNextStep,
  gapPhase,
  priorityTone,
  sortGapsByPriority,
} from "../lib/gapPriority";
import { type RiskLevel, domainRisk, plantValidatedRatio } from "../lib/knowledgeHealth";
import { buildRiskCockpit } from "../lib/riskCockpit";
import { phaseLabelKey } from "../lib/taskAction";
import { useAuthorName } from "../lib/useAuthorName";

const RISK_TONE: Record<RiskLevel, string> = {
  kritisch: "bg-trust-crit-bg text-trust-crit-text",
  mittel: "bg-trust-warn-bg text-trust-warn-text",
  gut: "bg-trust-pos-bg text-trust-pos-text",
};

const PRIORITY_TONE: Record<PriorityTone, string> = {
  crit: "bg-trust-crit-bg text-trust-crit-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Risk(): JSX.Element {
  const { t, i18n } = useTranslation();
  const bus = useBusFactor();
  const gaps = useGaps();
  const conflicts = useConflicts();
  const kos = useKos();
  // R-1639 (Nacharbeit 1): die „Stimmt das noch?"-Merker — gesetzt allein durch gemeldete
  // Anlagenänderungen. Ohne Antwort bleibt die Zahl je Kategorie unbekannt (null), nicht 0.
  const pending = useLifecyclePending();
  const users = useDirectory();
  // Consultant-System (Experten-Matching): nur berechtigte Rollen fragen die Sicht überhaupt an; ist
  // das Flag serverseitig AUS, kommt 404 → keine Daten → nichts gerendert (exakt heutiges Verhalten).
  const { role } = useRole();
  // AUFNAHME 20260922 · GESAMT-NAVIGATION · R-1023 (b): gemessen war „Risiken und Lücken" nach der
  // korrigierten Zählregel die zweitschwerste Fläche (Lauf nacharbeit-7: 135 gleichzeitig sichtbare
  // Bedienelemente und Zustandsangaben). Rund 85 davon trug die Pflege der Eingänge — je Bereich
  // Verantwortung, vier Stufen und Speichern, dazu die Ruhestandshorizonte. Sie ist eine
  // Verwaltungsarbeit, keine Auskunft; sie steht jetzt hinter dem Schalter `risiko-pflege-schalter`
  // und ist aufgeklappt unverändert dieselbe Fläche (nichts gelöscht, keine Rechte geändert).
  // Eingeklappt bleibt sie MONTIERT und ist nur verborgen — ungespeicherte Eingaben überleben das
  // Ein- und Ausklappen (s. unten am Schalter).
  const [pflegeOffen, setPflegeOffen] = useState(false);
  const expertise = useExpertise(canSeeExpertise(role));
  // R-1663 / R-2178: die Ansprechpartner je Lücke hängen am selben Schalter wie die Expertise-Route,
  // und die Oberfläche erfährt ihn auf demselben Weg — an der Abwesenheit der Route (`null` bei 404,
  // JOB 577; `expertMatching` steht nach R-1975 bewusst NICHT in `FeatureName`, Leserregister
  // tests/funktionsschalter/schalter-leser.test.ts). Geprüft wird „Antwort ist eine Liste", nicht
  // „Liste ist nicht leer": ein leerer Themenüberblick heisst nicht, dass zu einer Frage keine Spur
  // existiert.
  const ansprechpartnerSichtbar = canSeeExpertise(role) && Array.isArray(expertise.data);
  const qc = useQueryClient();
  const { push } = useToast();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["gaps"] });
  // R-0953 (Bestandsabgleich, Nacharbeit 4): Zuweisen, Priorisieren und Löschen einer Lücke
  // scheiterten bis hierher STILL — die Auswahl sprang zurück, und niemand erfuhr, warum. Alle vier
  // Lückenaktionen melden Erfolg und Fehler jetzt über den Benachrichtigungs-Bus.
  const gemeldet = (erfolgKey: string) => () => {
    push("success", t(erfolgKey));
    invalidate();
  };
  const fehlgeschlagen = (fehlerKey: string) => () => push("error", t(fehlerKey));
  // R-0846 / L6: eine Lücke schliesst nur mit dem Wissensobjekt, das sie beantwortet. Der Server
  // prüft den Bezug; scheitert er, bleibt die Lücke offen und die Zeile sagt es.
  const close = useMutation({
    mutationFn: ({ id, koId }: { id: string; koId: string }) => endpoints.gaps.close(id, koId),
    onSuccess: gemeldet("risk.gapToast.closed"),
    onError: fehlgeschlagen("risk.closeFailed"),
  });
  const assign = useMutation({
    mutationFn: ({ id, expertId }: { id: string; expertId: string }) =>
      endpoints.gaps.assign(id, expertId),
    onSuccess: gemeldet("risk.gapToast.assigned"),
    onError: fehlgeschlagen("risk.gapToast.assignFailed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.gaps.remove(id),
    onSuccess: gemeldet("risk.gapToast.removed"),
    onError: fehlgeschlagen("risk.gapToast.removeFailed"),
  });
  const setPriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: GapPriority }) =>
      endpoints.gaps.setPriority(id, priority),
    onSuccess: gemeldet("risk.gapToast.prioritySaved"),
    onError: fehlgeschlagen("risk.gapToast.priorityFailed"),
  });
  // R-0956 (Ben, Nacharbeit 7): die WAHL je Lücke bleibt stehen, bis der Server sie übernommen hat.
  // Bis hierher hing die Priorität am alten Serverwert und Person/Objekt an einem festen `""` —
  // ein Speicherfehler kostete die Auswahl. Ein Eintrag weicht erst, wenn ein neuer Serverstand sie
  // bestätigt (Priorität gleich, Person zugewiesen, Lücke geschlossen) oder die Lücke fehlt; nach
  // einem Fehler steht er weiter da und lässt sich mit „Erneut versuchen“ unverändert senden.
  const [prioWahl, setPrioWahl] = useState<Record<string, GapPriority>>({});
  const [personWahl, setPersonWahl] = useState<Record<string, string>>({});
  const [objektWahl, setObjektWahl] = useState<Record<string, string>>({});
  useEffect(() => {
    const liste = gaps.data;
    if (!liste) {
      return;
    }
    const lueckeVon = new Map(liste.map((g) => [g.id, g]));
    const offenBis = <W,>(
      alt: Record<string, W>,
      bestaetigt: (g: Gap, wert: W) => boolean,
    ): Record<string, W> => {
      const neu = Object.fromEntries(
        Object.entries(alt).filter(([id, wert]) => {
          const g = lueckeVon.get(id);
          return g !== undefined && !bestaetigt(g, wert);
        }),
      );
      return Object.keys(neu).length === Object.keys(alt).length ? alt : neu;
    };
    setPrioWahl((alt) => offenBis(alt, (g, wert) => g.priority === wert));
    setPersonWahl((alt) => offenBis(alt, (g, wert) => g.assignee === wert));
    setObjektWahl((alt) => offenBis(alt, (g) => g.status !== "offen"));
  }, [gaps.data]);

  const maxKo = Math.max(1, ...(bus.data ?? []).map((b) => b.koCount));
  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts). Die
  // abgeschriebene Zeile hier sagte „Unbekannte Person", sobald das Verzeichnis nur NICHT DA war —
  // eine Aussage über die Person, wo gar keine feststand.
  const nameOf = useAuthorName();
  // R-0961: `?fall=<id>` aus der Aufgabenliste markiert genau diese Lücke und holt sie EINMAL in
  // Sicht, sobald die Liste sie trägt. Ohne Treffer bleibt die Seite, wie sie war.
  const [params] = useSearchParams();
  const zielLuecke = leseFall(params);
  const nurOffene = nurOffeneLuecken(params);
  const zielZeile = useRef<HTMLDivElement | null>(null);
  const zielGezeigt = useRef(false);
  const lueckenGeladen = gaps.data !== undefined;
  useEffect(() => {
    if (lueckenGeladen && !zielGezeigt.current && zielZeile.current) {
      zielGezeigt.current = true;
      zielZeile.current.scrollIntoView({ block: "center" });
    }
  }, [lueckenGeladen]);

  // SCRUM-230: kompakter Cockpit-Einstieg aus echten Gap-/Conflict-Daten (kein Score, keine Engine).
  const cockpit = buildRiskCockpit(gaps.data ?? [], conflicts.data ?? []);
  const cockpitTiles: { key: string; label: string; value: number; crit?: boolean }[] = [
    { key: "openGaps", label: t("risk.kpiOpenGaps"), value: cockpit.openGaps },
    {
      key: "high",
      label: t("risk.kpiHigh"),
      value: cockpit.highPriority,
      crit: cockpit.highPriority > 0,
    },
    { key: "unassigned", label: t("risk.kpiUnassigned"), value: cockpit.unassigned },
    { key: "assigned", label: t("risk.kpiAssigned"), value: cockpit.assigned },
    {
      key: "conflicts",
      label: t("risk.kpiOpenConflicts"),
      value: cockpit.openConflicts,
      crit: cockpit.openConflicts > 0,
    },
    { key: "closed", label: t("risk.kpiClosedGaps"), value: cockpit.closedGaps },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader kicker={t("risk.kicker")} title={t("nav.risk")} pageKey="risiko" />

      {/* SCRUM-230: kompakter Cockpit-Einstieg — aggregierte Kennzahlen aus vorhandenen Daten. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.summary")}</SectionLabel>
          <HelpTip title={t("risk.summary")} body={t("risk.help.summary")} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {cockpitTiles.map((tile) => (
            <Card key={tile.key} className="p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {tile.label}
              </div>
              <div
                className={`mt-1 text-2xl font-semibold ${
                  tile.crit ? "text-trust-crit-text" : "text-ink"
                }`}
              >
                {tile.value}
              </div>
            </Card>
          ))}
        </div>
        {/*
          AUFTRAG-mega31 BLOCK C1 (bens GELB-2, achte Fläche): Die Kachel „offene Konflikte" zeigt
          auch eine echte Null — ohne jede Einschränkung. Das ist dieselbe falsche Entwarnung wie auf
          den leeren Boards, nur an einer Stelle, an die niemand gedacht hat: die wörtliche Zahl ist
          korrekt, die Management-Inferenz „kein Risiko" ist es nicht.

          BEWUSST OHNE Bedingung auf den Wert: der Vorbehalt gilt der HERKUNFT der Zahl, nicht ihrer
          Höhe. Auch „5 offene Konflikte" ist ein Mindestwert aus gedeckelten und teils gescheiterten
          Läufen, kein Gesamtstand. Die Komponente schweigt von selbst, sobald der Bestand belegt
          vollständig geprüft ist — der Hinweis wird also nie zu Dauerrauschen.
        */}
        <AiCheckBoardCaveat className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-trust-warn-text" />
      </div>

      {/* SCRUM-133: Risiko-Cockpit nach Domäne/Kategorie */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.cockpit")}</SectionLabel>
          <HelpTip title={t("risk.cockpit")} body={t("risk.help.cockpit")} />
        </div>
        {/* R-0956 (Bestandsabgleich, Nacharbeit 4): auch das leere Cockpit ordnet ein — derselbe
            Grund und derselbe nächste Schritt wie die leere Bus-Faktor-Liste darunter. */}
        <QueryState
          query={kos}
          emptyText={t("risk.cockpitEmpty")}
          emptyExtra={<EmptyStateCtas context="risk" />}
        >
          {(items) => {
            const rows = domainRisk(items, bus.data ?? [], pending.data ?? null);
            const werk = plantValidatedRatio(items);
            if (rows.length === 0) {
              return (
                <Card className="border-dashed text-center text-sm text-muted">
                  {t("risk.cockpitEmpty")}
                  <EmptyStateCtas context="risk" />
                </Card>
              );
            }
            return (
              <div className="grid gap-2 sm:grid-cols-2">
                {rows.map((r) => {
                  // Pedi 05.07.: „wer trägt das Wissen" sichtbar machen — die Personen hinter dieser
                  // Domäne (aus den echten KO-Autoren abgeleitet), damit ein Einzelquellen-Risiko konkret wird.
                  // Nacharbeit 1 (ben F1): Träger ist die URHEBERSCHAFT `originalAuthor` — dieselbe
                  // Regel, nach der der Bus-Faktor zählt (library-analytics `busFactor`). `author` ist
                  // der Erfasser; nach einer Übernahme fremden Wissens nannte der Hinweis sonst den
                  // Erfasser, oder bei zwei Erfassern zwei Träger trotz Einzelquelle.
                  const bearers = Array.from(
                    new Set(
                      items.filter((k) => k.category === r.category).map((k) => k.originalAuthor),
                    ),
                  ).map(nameOf);
                  return (
                    <Card key={r.category} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13.5px] font-medium text-text">
                          {r.category}
                        </span>
                        <span
                          className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${RISK_TONE[r.level]}`}
                        >
                          {t(`risk.level.${r.level}`)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
                        <span>
                          {t("risk.koCount")}: <span className="text-text">{r.koCount}</span>
                        </span>
                        <span>
                          {t("risk.validated")}:{" "}
                          <span className="text-text">{r.validatedRatio}%</span>
                        </span>
                        <span>
                          {t("risk.openKo")}: <span className="text-text">{r.openCount}</span>
                        </span>
                        <span>
                          {t("risk.experts")}: <span className="text-text">{r.authorCount}</span>
                        </span>
                      </div>
                      {/* R-1639 (Nacharbeit 1): „Wie ist meine Wissens-Abdeckung im Vergleich zum
                          Werks-Durchschnitt?" — Prüfanteil dieser Kategorie gegen den ganzen
                          sichtbaren Bestand. */}
                      {werk === null ? null : (
                        <p data-testid="risk-vs-plant" className="text-[11.5px] text-muted">
                          {t(
                            r.validatedRatio > werk
                              ? "risk.vsPlant.above"
                              : r.validatedRatio < werk
                                ? "risk.vsPlant.below"
                                : "risk.vsPlant.equal",
                            { avg: werk },
                          )}
                        </p>
                      )}
                      {/* R-1639 (Nacharbeit 1): „Welche Objekte sind durch Anlagenänderungen
                          veraltet?" — nur wenn die Merkerlage geladen ist UND etwas ansteht; der
                          Weg führt zur bestehenden Prüfliste. */}
                      {r.staleByAssetChange !== null && r.staleByAssetChange > 0 ? (
                        <Link
                          data-testid="risk-stale-asset"
                          to="/lebenszyklus"
                          className="block text-[11.5px] font-semibold text-trust-warn-text hover:underline"
                        >
                          {t("risk.staleByAssetChange", { count: r.staleByAssetChange })}
                        </Link>
                      ) : null}
                      {/* Pedi 05.07.: Einzelquellen-Risiko ausführlich erklären + WER es trägt. */}
                      {r.singleSource ? (
                        <div className="rounded-btn bg-trust-crit-bg px-2.5 py-2 text-[11.5px] text-trust-crit-text">
                          <div className="font-semibold">{t("risk.singleSource")}</div>
                          <p className="mt-0.5 leading-relaxed">{t("risk.singleSourceExplain")}</p>
                          {bearers.length > 0 ? (
                            <p className="mt-1 font-semibold">
                              {t("risk.bearer", { names: bearers.join(", ") })}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Verweis auf die konkreten Objekte dieser Domäne (das „was"). */}
                      <Link
                        to={`/bibliothek?category=${encodeURIComponent(r.category)}`}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text hover:underline"
                      >
                        {t("risk.viewObjects")} <span aria-hidden="true">→</span>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            );
          }}
        </QueryState>
      </div>

      {/* R-1639 / R-2183 (Nacharbeit 3): „mein Bereich" — Bus-Faktor 1, Ruhestand in 24/36 Monaten
          und der Arbeitsvorrat bis zur Frist (components/RisikoHorizont). */}
      <RisikoHorizont />

      {/* Die Pflege der Eingänge dazu (Bereichsverantwortung, vier eingeschätzte Prioritätsfaktoren,
          Ruhestandshorizonte) — nur die Admin-Rolle; der Server verlangt `users.manage`. */}
      {role === "admin" ? (
        <div>
          <button
            type="button"
            data-testid="risiko-pflege-schalter"
            data-entlastung-schalter=""
            aria-expanded={pflegeOffen}
            aria-controls="risiko-pflege"
            onClick={() => setPflegeOffen((offen) => !offen)}
            className="mb-2 inline-flex items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t(pflegeOffen ? "navigation.pflegeAusblenden" : "navigation.pflegeZeigen")}
          </button>
          {/* VERBORGEN, NICHT AUSGEBAUT (Ben, Nacharbeit 8): die Zeilen halten ihren ungespeicherten
              Entwurf als lokalen Zustand (`BereichsprofilPflege.tsx`, `ProfilZeile`). Ein
              bedingtes Rendern hätte ihn beim Einklappen verworfen — Ändern, Einklappen, Aufklappen
              stand wieder beim gespeicherten Wert. `hidden` nimmt die Fläche aus Sicht und
              Tabreihenfolge und lässt den Entwurf stehen; gemessen in
              `tests/gesamt-navigation/risiko-pflege-einklappen-mounted.test.tsx`. */}
          <div id="risiko-pflege" data-testid="risiko-pflege" hidden={!pflegeOffen}>
            <BereichsprofilPflege />
          </div>
        </div>
      ) : null}

      {/* Consultant-System (Experten-Matching): Thema → Personen, die schon dazu beigetragen haben —
          als Hilfe „wen könnte man kurz um eine Einordnung bitten". Kein Ranking, keine Zahlen; die
          Reihenfolge bleibt alphabetisch (Backend). Sichtbar nur mit ko.assign UND aktivem Flag. */}
      {/* JOB 577: `expertise.data` kann seit der 404-Normalisierung auch `null` sein — der
          ausdrückliche Datenzustand „keine Fläche". Er fällt hier auf die BEREITS GEPRÜFTE Lage
          `undefined` zurück, für die `expertiseVisible(rolle, undefined) === false` in
          `lib/expertiseView.test.ts` festgeschrieben ist. Bewusst die kleinste korrekte Anpassung:
          Der Vertrag der beiden Hilfsfunktionen bleibt unangetastet, und die Fläche erscheint bei
          Abwesenheit nicht. Dass genau das passiert, ist gemessen — nicht angenommen
          (tests/app/577-abwesenheit-verbraucher-mounted.test.tsx, Fall V1). */}
      {expertiseVisible(role, expertise.data ?? undefined) ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <SectionLabel>{t("expertise.title")}</SectionLabel>
            <HelpTip title={t("expertise.title")} body={t("expertise.help")} />
          </div>
          <p className="mb-2 text-[12px] text-muted-2">{t("expertise.intro")}</p>
          <Card className="space-y-3">
            {(expertise.data ?? []).map((entry) => {
              const names = contributorNamesFor(
                expertise.data ?? undefined,
                entry.category,
                nameOf,
              );
              if (names.length === 0) {
                return null;
              }
              return (
                <div key={entry.category} className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13.5px] font-medium text-text">{entry.category}</span>
                    <span className="text-[13px] text-muted">{names.join(", ")}</span>
                  </div>
                  <p className="text-[11.5px] italic text-muted-2">
                    {t("expertise.invite", { topic: entry.category })}
                  </p>
                </div>
              );
            })}
            <p className="border-t border-hairline pt-2 text-[11.5px] text-muted-2">
              {t("expertise.thanks")}
            </p>
          </Card>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.busfactor")}</SectionLabel>
          <HelpTip title={t("risk.busfactor")} body={t("risk.help.busfactor")} />
        </div>
        {/* R-0956: die leere Liste ordnet in den Wissenskreis ein und nennt den nächsten Schritt. */}
        <QueryState
          query={bus}
          emptyText={t("risk.busEmpty")}
          emptyExtra={<EmptyStateCtas context="risk" />}
        >
          {(items) => (
            <Card className="space-y-2.5">
              {/* Pedi 05.07.: Legende, damit die Balkenfarbe verständlich ist. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full" style={{ background: "#c0473f" }} />
                  {t("risk.busLegendSingle")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full" style={{ background: "#3aa06a" }} />
                  {t("risk.busLegendOk")}
                </span>
              </div>
              {items.map((b) => (
                <div key={b.category} className="flex items-center gap-3">
                  <span className="w-32 truncate text-[13px] text-text">{b.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.koCount / maxKo) * 100}%`,
                        background: b.singleSource ? "#c0473f" : "#3aa06a",
                      }}
                    />
                  </div>
                  {/* AUFTRAG-mega51 BLOCK F1: hier stand `{b.authorCount} {t("risk.experts")}` —
                      zusammengesetzt, und damit „1 Experten". Pluralisierung läuft jetzt über
                      `count`, wie es mega34 für `lib.facet.showResults` schon richtig macht. Die
                      Beschriftungsform „Experten: 3" weiter oben (:189) bleibt unberührt — sie ist
                      ein Etikett, keine Aufzählung, und hat das Problem nie gehabt. */}
                  <span className="font-mono text-[11px] text-muted-2">
                    {t("risk.expertsCount", { count: b.authorCount })}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </QueryState>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <SectionLabel>{t("risk.gaps")}</SectionLabel>
          <HelpTip title={t("risk.gaps")} body={t("risk.help.gaps")} />
        </div>
        {/* SCRUM-283: ehrlich + datensparsam — gespeicherte Fragen sind offene Lücken (keine Antwort/
            kein validiertes Wissen); beim Erfassen keine sensiblen Details, geprüfte Erfahrung ergänzen. */}
        <p className="mb-2 text-[12px] text-muted-2">{t(gapPrivacyNoticeKey())}</p>
        {/* ADMIN-01: Ziel des Zählers „Offene Wissenslücken" der Verwaltung. Der Filter steht in der
            Adresse (`?luecken=offen`) und wählt mit DERSELBEN Regel wie der Zähler
            (`offeneLuecken`) aus DERSELBEN Abfrage (`["gaps"]`). */}
        {nurOffene ? (
          <div
            data-testid="filter-luecken"
            className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted"
          >
            <span>{t("verwaltung.filter.offeneLuecken")}</span>
            <Link to="/risiko" className="text-text underline underline-offset-2">
              {t("verwaltung.filter.aufheben")}
            </Link>
          </div>
        ) : null}
        <QueryState
          query={gaps}
          emptyText={t("risk.gapsEmpty")}
          emptyExtra={<EmptyStateCtas context="gaps" />}
        >
          {(items) => (
            <Card className="p-0">
              <div className="divide-y divide-hairline">
                {nurOffene && offeneLuecken(items).length === 0 ? (
                  <div className="px-4 py-2.5 text-[13px] text-muted">
                    {t("verwaltung.filter.keineOffenen")}
                  </div>
                ) : null}
                {sortGapsByPriority(nurOffene ? offeneLuecken(items) : items).map((g) => (
                  <div
                    key={g.id}
                    data-testid="luecke-zeile"
                    ref={g.id === zielLuecke ? zielZeile : undefined}
                    aria-current={g.id === zielLuecke ? "true" : undefined}
                    // Die Markierung hängt am `aria-current` selbst: EIN Merkmal trägt Bedeutung
                    // und Darstellung, und die Klassenkette bleibt statisch lesbar.
                    className="flex items-center gap-3 px-4 py-2.5 aria-[current=true]:ring-2 aria-[current=true]:ring-inset aria-[current=true]:ring-brand"
                  >
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${PRIORITY_TONE[priorityTone(g.priority)]}`}
                    >
                      {t(`risk.priority.${g.priority}`)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* FUNKE-FIX2 P0 (bens Erforderlich 4): Fragetext nur an Berechtigte — der
                          Server redigiert für Unberechtigte (g.redacted), dann Neutralbezeichnung. */}
                      {/* GAP-SPRACHHERKUNFT: dieselbe Lueckenliste wie in "Meine Aufgaben" —
                          ohne diese Stelle saehe jeder den alten Zustand, der ueber
                          "Risiko & Luecken" geht statt ueber die Aufgabenliste (Auflage 1 des
                          Design-Leads). Titel und Etikett sind GESCHWISTER: der Titel kuerzt
                          (`truncate`), das Etikett bleibt (`shrink-0`). */}
                      <div className="flex items-baseline gap-1.5">
                        <div className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                          {g.redacted ? t("risk.gapRedacted") : g.question}
                        </div>
                        {/* R-0307 / R-1061: ohne Sprachangabe das neutrale Etikett „Originalfrage". */}
                        {(() => {
                          const sprache = gapTitelEtikett(g, i18n.language, t);
                          return sprache ? (
                            <span
                              data-testid="luecke-etikett"
                              className="shrink-0 rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2"
                            >
                              {sprache}
                            </span>
                          ) : null;
                        })()}
                        {/* R-0333 / R-0753: die Häufigkeit auch auf dem Lücken-Board — dieselbe
                            Regel wie in „Meine Aufgaben": erst ab zwei, Altbestand ohne Zähler
                            bleibt still. Eine Zahl ist kein Fragetext, also auch bei redigierten. */}
                        {typeof g.askCount === "number" && g.askCount > 1 ? (
                          <span
                            data-testid="luecke-haeufigkeit"
                            className="shrink-0 font-mono text-[10.5px] text-muted-2"
                          >
                            {t("gap.askCount", { count: g.askCount })}
                          </span>
                        ) : null}
                      </div>
                      {/* R-0291: welcher Beleg für eine tragfähige Antwort fehlen würde — nur in der
                          berechtigten Sicht (bei redigierten Lücken hält der Server ihn zurück). */}
                      {(() => {
                        const bedarf = g.status === "offen" ? gapBelegbedarfSchluessel(g) : null;
                        return bedarf ? (
                          <div
                            data-testid="luecke-belegbedarf"
                            className="mt-0.5 text-[11px] text-muted"
                          >
                            <span className="font-mono uppercase tracking-wider text-muted-2">
                              {t("gap.belegbedarf.label")}:
                            </span>{" "}
                            {bedarf.map((k) => t(k)).join(" · ")}
                          </div>
                        ) : null;
                      })()}
                      {/* SCRUM-253: ehrliche nächste Handlung je offener Lücke (priorisieren/zuweisen/erfassen). */}
                      {g.status === "offen" ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          {/* SCRUM-298: Knowledge-OS-Phase — offene Lücke ist „Erfassen"-Arbeit (gleiche Kreis-Sprache wie Start/MyTasks). */}
                          <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-2">
                            {t("task.phaseLabel")} {t(phaseLabelKey(gapPhase(g)))}
                          </span>
                          <span>
                            <span className="font-mono uppercase tracking-wider text-muted-2">
                              {t("risk.gapNextLabel")}:
                            </span>{" "}
                            {t(`risk.gapNext.${gapNextStep(g)}`)}
                          </span>
                        </div>
                      ) : null}
                      {/* R-1663 / R-2178: begründete Ansprechpartner nach Wissensspuren — nur mit
                          ko.assign UND eingeschaltetem Schalter (dieselben Tore wie die Route). */}
                      {g.status === "offen" && ansprechpartnerSichtbar ? (
                        <LueckenAnsprechpartner
                          gapId={g.id}
                          assignPending={assign.isPending}
                          onAssign={(expertId) => assign.mutate({ id: g.id, expertId })}
                        />
                      ) : null}
                      {/* produkt:20261010:wissenskreislauf-schliessen: der gemeinsame Vorgang —
                          Zuständigkeit, Rückfrage, Entwurf, Fachprüfung, Abschluss. Über `?fall=`
                          (Aufgabenliste) gleich aufgeklappt. Wer nicht beteiligt ist, erfährt nur
                          das (der Server antwortet 404). */}
                      <LueckenVorgang gapId={g.id} anfangsOffen={g.id === zielLuecke} />
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] uppercase text-muted-2">
                      {g.assignee ? `→ ${nameOf(g.assignee)}` : t(`risk.gapStatus.${g.status}`)}
                    </span>
                    {/* Wie geschlossen wurde — eine Rücknahme sieht nie wie eine Lösung aus. */}
                    {g.abschlussArt ? (
                      <span
                        data-testid="luecke-abschlussart"
                        data-art={g.abschlussArt}
                        className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] uppercase ${
                          g.abschlussArt === "fachlich"
                            ? "bg-trust-pos-bg text-trust-pos-text"
                            : "bg-trust-warn-bg text-trust-warn-text"
                        }`}
                      >
                        {t(
                          g.abschlussArt === "fachlich"
                            ? "lueckenvorgang.liste.geloest"
                            : "lueckenvorgang.liste.zurueckgenommen",
                        )}
                      </span>
                    ) : null}
                    {g.rueckfrageOffen ? (
                      <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-ai">
                        {t("lueckenvorgang.liste.rueckfrageOffen")}
                      </span>
                    ) : null}
                    {g.status === "offen" ? (
                      <>
                        {/* SCRUM-263 / FUNKE-FIX2 P0 (bens Erforderlich 4): offene Lücke als
                            Erfassungskontext starten — der Einstieg trägt die GAP-ID (kein Fragetext
                            in der URL). Capture lädt den Text erst nach serverseitiger Berechtigung. */}
                        <Link
                          to={captureGapHref(g.id)}
                          className="inline-flex shrink-0 items-center rounded-btn bg-ink px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
                        >
                          {t("risk.gapCapture")}
                        </Link>
                        <select
                          value={prioWahl[g.id] ?? g.priority}
                          disabled={setPriority.isPending}
                          onChange={(e) => {
                            const priority = e.target.value as GapPriority;
                            setPrioWahl((alt) => ({ ...alt, [g.id]: priority }));
                            setPriority.mutate({ id: g.id, priority });
                          }}
                          title={t("risk.priorityLabel")}
                          className="h-8 w-28 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                        >
                          {GAP_PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {t(`risk.priority.${p}`)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={personWahl[g.id] ?? ""}
                          disabled={assign.isPending}
                          onChange={(e) => {
                            const expertId = e.target.value;
                            if (expertId) {
                              setPersonWahl((alt) => ({ ...alt, [g.id]: expertId }));
                              assign.mutate({ id: g.id, expertId });
                            }
                          }}
                          className="h-8 w-36 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                        >
                          <option value="">{t("risk.assign")}</option>
                          {(users.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.id}
                            </option>
                          ))}
                        </select>
                        <select
                          value={objektWahl[g.id] ?? ""}
                          data-testid="luecke-schliessen"
                          disabled={close.isPending || (kos.data ?? []).length === 0}
                          onChange={(e) => {
                            const koId = e.target.value;
                            if (koId) {
                              setObjektWahl((alt) => ({ ...alt, [g.id]: koId }));
                              close.mutate({ id: g.id, koId });
                            }
                          }}
                          title={t("risk.closeWithTitle")}
                          aria-label={t("risk.closeWithTitle")}
                          className="h-8 w-40 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                        >
                          <option value="">{t("risk.close")}</option>
                          {(kos.data ?? []).map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.title}
                            </option>
                          ))}
                        </select>
                        {close.isError && close.variables?.id === g.id ? (
                          <span role="alert" className="text-[11px] text-trust-crit-text">
                            {t("risk.closeFailed")}
                          </span>
                        ) : null}
                        {/* R-0956 (Ben, Nacharbeit 7): nach einem Speicherfehler steht die Wahl
                            weiter im Feld, und derselbe Wert lässt sich erneut senden. */}
                        {setPriority.isError && setPriority.variables?.id === g.id ? (
                          <button
                            type="button"
                            data-testid="luecke-erneut-prioritaet"
                            onClick={() => {
                              if (setPriority.variables) {
                                setPriority.mutate(setPriority.variables);
                              }
                            }}
                            className="text-[11px] font-semibold text-trust-crit-text underline"
                          >
                            {t("loadstate.error.retry")}
                          </button>
                        ) : null}
                        {assign.isError && assign.variables?.id === g.id ? (
                          <button
                            type="button"
                            data-testid="luecke-erneut-person"
                            onClick={() => {
                              if (assign.variables) {
                                assign.mutate(assign.variables);
                              }
                            }}
                            className="text-[11px] font-semibold text-trust-crit-text underline"
                          >
                            {t("loadstate.error.retry")}
                          </button>
                        ) : null}
                        {close.isError && close.variables?.id === g.id ? (
                          <button
                            type="button"
                            data-testid="luecke-erneut-schliessen"
                            onClick={() => {
                              if (close.variables) {
                                close.mutate(close.variables);
                              }
                            }}
                            className="text-[11px] font-semibold text-trust-crit-text underline"
                          >
                            {t("loadstate.error.retry")}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    <button
                      type="button"
                      title={t("risk.delete")}
                      onClick={() => remove.mutate(g.id)}
                      className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </QueryState>
      </div>

      {/* R-0773: getrennt von den unbeantworteten Fragen darüber — die eigenen SUCHEN, die nichts
          Sichtbares fanden (components/EigeneNulltreffer.tsx). */}
      <EigeneNulltreffer />
    </div>
  );
}
