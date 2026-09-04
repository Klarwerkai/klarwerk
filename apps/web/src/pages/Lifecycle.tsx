// ================================================================================================
// JOB 3061 · H2 — REITER „ERNEUT": DIESELBE FLÄCHE WIE „OFFEN", NUR MIT ANDERER FRAGE.
// ================================================================================================
//
// Links die Liste der fälligen Objekte, rechts die Karte des gewählten — „Noch gültig" (grün) und
// „Erneut prüfen". Der Banner „Stimmt das noch?", der Lernpfad und die Erklärtexte liegen im
// „?"-Menü dieses Reiters; „Objekt ansehen", „Wissen nutzen" und „Zur Validierung" im „···".
// Unter der Liste klappt EINE Zeile die Anlagenänderung auf.
//
// EHRLICHKEIT — die eine Stelle, an der dieser Reiter vom Auftragstext abweicht und warum:
// Der Auftrag nennt zwei Knöpfe, „Noch gültig (→ neue Version)" und „Erneut prüfen (→ revalidate)".
// Es gibt serverseitig genau EINEN Weg: `endpoints.ko.act(id, { action: "revalidate" })` — er
// bestätigt die Gültigkeit und setzt die Frist neu. Einen Endpunkt „neue Version anlegen" gibt es
// nicht. Deshalb trägt „Noch gültig" unverändert diesen einen Weg (das tat der bisherige Knopf
// desselben Namens auch), und „Erneut prüfen" führt auf den bereits vorhandenen Weg in den
// Prüffluss (`revalidationCta`). Zwei Knöpfe mit demselben Serveraufruf wären eine Scheinfunktion.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useKos, useLearningPath, useLearningProgress, useLifecyclePending } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { PruefenKopf } from "../components/pruefen/PruefenKopf";
import { PruefenMehr, PruefenMehrBlock, PruefenMehrZeile } from "../components/pruefen/PruefenMehr";
import {
  PruefenHilfeBlock,
  PruefenMenue,
  PruefenMenueLink,
  PruefenMenueTrenner,
} from "../components/pruefen/PruefenMenue";
import { MenueSymbol, PruefenKnopf, PruefenPille } from "../components/pruefen/PruefenPaar";
import {
  PruefenErstfehler,
  PruefenNichtFrisch,
  PruefenPlatzhalter,
  PruefenSatz,
} from "../components/pruefen/PruefenZustand";
import { abhaengigeQuelle, flaechenZustand } from "../components/pruefen/zaehler";
import { Button, cx } from "../components/ui";
import { completedCount, isStepDone, progressPercent } from "../lib/learningPath";
import {
  revalidationCta,
  revalidationNextSteps,
  revalidationPhase,
  revalidationView,
} from "../lib/revalidation";
import { phaseLabelKey } from "../lib/taskAction";

const QUITTUNG_MS = 3000;

export function Lifecycle(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const role = user?.role ?? "viewer";

  const query = useLifecyclePending();
  const kos = useKos();
  const path = useLearningPath(role);
  const pathId = path.data?.id;
  const progress = useLearningProgress(pathId);
  const done = progress.data ?? [];

  const [aktivId, setAktivId] = useState<string | null>(null);
  const [lastRevalidated, setLastRevalidated] = useState<{
    id: string;
    title: string;
    found: boolean;
  } | null>(null);
  const confirm = useMutation({
    mutationFn: ({ id }: { id: string; title: string; found: boolean }) =>
      endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      setLastRevalidated({ id: vars.id, title: vars.title, found: vars.found });
    },
  });

  // SCRUM-146: Asset-Change-Auslöser → markiert gekoppelte KOs „prüfen".
  const [assetRef, setAssetRef] = useState("");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (note === null) {
      return;
    }
    const timer = window.setTimeout(() => setNote(null), QUITTUNG_MS);
    return () => window.clearTimeout(timer);
  }, [note]);
  const assetChanged = useMutation({
    mutationFn: (ref: string) => endpoints.lifecycle.assetChanged(ref),
    onSuccess: (ids) => {
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      setNote(t("lcy.assetMarked", { n: ids.length, asset: assetRef.trim() }));
      setAssetRef("");
    },
    onError: () => setNote(t("state.error")),
  });

  // SCRUM-145: Lernpfad-Schritt abhaken (Fortschritt serverseitig).
  const complete = useMutation({
    mutationFn: (stepId: string) => endpoints.learningPaths.complete(pathId ?? "", stepId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learning-progress", pathId] }),
  });

  const ids = query.data ?? [];
  // bens Korrekturpflicht 2 (Runde 4): Die Fälligkeitsliste liefert nur IDs — Titel, Anlage und
  // Status stehen im Objektabruf (`revalidationView`). Ohne dessen Antwort stand hier die rohe UUID
  // mit dem Vermerk „Objekt nicht auffindbar", obwohl das Objekt nur noch nicht geladen war.
  const lage = flaechenZustand(query, abhaengigeQuelle(kos));
  const bestand = lage.lage === "bestand";
  const aktivIdEffektiv = bestand ? (ids.find((id) => id === aktivId) ?? ids[0] ?? null) : null;

  const hilfeMenue = (
    <PruefenMenue
      kennung="hilfe"
      beschriftung={t("pruefen.menu.help")}
      symbol={<HelpCircle size={16} aria-hidden="true" />}
      ausrichtung="links"
      breite="w-[22rem]"
    >
      <PruefenHilfeBlock titel={t("lcy.pendingTitle")}>
        <p>{t("lcy.banner")}</p>
      </PruefenHilfeBlock>
      <PruefenMenueTrenner />
      <PruefenHilfeBlock titel={t("lcy.pathTitle", { role: t(`role.name.${role}`) })}>
        {path.isLoading ? (
          <p>{t("state.loading")}</p>
        ) : path.data ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progressPercent(path.data, done)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-muted-2">
                {completedCount(path.data, done)}/{path.data.steps.length}
              </span>
            </div>
            <ol className="mt-1 space-y-1.5">
              {path.data.steps.map((step, i) => {
                const stepDone = isStepDone(done, step.id);
                return (
                  <li key={step.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={stepDone || complete.isPending}
                      onClick={() => complete.mutate(step.id)}
                      title={stepDone ? t("lcy.stepDone") : t("lcy.stepComplete")}
                      className={cx(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-btn border",
                        stepDone
                          ? "border-trust-pos-fill bg-trust-pos-bg text-trust-pos-text"
                          : "border-hairline text-muted hover:bg-hairline-soft",
                      )}
                    >
                      {stepDone ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <span className="text-[10px]">{i + 1}</span>
                      )}
                    </button>
                    <span className={stepDone ? "text-muted line-through" : "text-text"}>
                      {step.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p>{t("lcy.pathEmpty")}</p>
        )}
      </PruefenHilfeBlock>
      <PruefenMenueTrenner />
      <PruefenHilfeBlock titel={t("lcy.assetTitle")}>
        <p>{t("lcy.assetHint")}</p>
      </PruefenHilfeBlock>
    </PruefenMenue>
  );

  return (
    <div className="mx-auto max-w-[1040px]">
      <PruefenKopf aktiv="erneut" hilfe={hilfeMenue} />
      <div data-testid="pruefen-flaeche" className="flex flex-col items-start gap-6 lg:flex-row">
        {/* ---- Die Liste, gleiche Bauform wie die Warteschlange in „Offen" ------------------- */}
        <div className="w-full shrink-0 lg:w-[260px]">
          {lage.auffrischungGescheitert ? <PruefenNichtFrisch /> : null}
          {lage.lage === "laedt" ? <PruefenPlatzhalter /> : null}
          {/* „Erneut laden" holt BEIDE Abrufe nach — die Liste steht auf beiden. */}
          {lage.lage === "erstfehler" ? (
            <PruefenErstfehler
              onRetry={() => {
                void qc.invalidateQueries({ queryKey: ["lifecycle", "pending"] });
                void qc.invalidateQueries({ queryKey: ["kos"] });
              }}
            />
          ) : null}
          {lage.lage === "leer" ? <PruefenSatz kennung="leer">{t("lcy.empty")}</PruefenSatz> : null}
          {bestand && ids.length > 0 ? (
            <ul data-testid="pruefen-warteschlange" className="flex flex-col gap-1">
              {ids.map((id) => {
                const view = revalidationView(id, kos.data ?? []);
                const ist = aktivIdEffektiv === id;
                return (
                  <li key={id} data-testid="lifecycle-row">
                    <button
                      type="button"
                      data-testid="pruefen-warteschlange-eintrag"
                      aria-current={ist ? "true" : undefined}
                      onClick={() => setAktivId(id)}
                      className={cx(
                        "block w-full rounded-[9px] border px-[12px] py-[10px] text-left text-[13.5px] leading-[1.35]",
                        ist
                          ? "border-hairline bg-surface font-semibold text-text"
                          : "border-transparent text-muted hover:bg-hairline-soft",
                      )}
                    >
                      <span data-text="titel">{view.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {/* Auftrag §5b: EINE Zeile unter der Liste, die Feld + Auslöser aufklappt. */}
          <details data-testid="pruefen-anlage" className="mt-3">
            <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-muted hover:text-text">
              {t("lcy.assetToggle")}
            </summary>
            <div className="mt-2 space-y-2">
              <input
                value={assetRef}
                onChange={(e) => setAssetRef(e.target.value)}
                placeholder={t("lcy.assetPlaceholder")}
                aria-label={t("lcy.assetPlaceholder")}
                className="h-9 w-full rounded-input border border-hairline bg-surface px-3 text-[12.5px] outline-none focus:border-ink/30"
              />
              <Button
                variant="primary"
                disabled={assetChanged.isPending || assetRef.trim().length === 0}
                onClick={() => assetChanged.mutate(assetRef.trim())}
              >
                {t("lcy.assetTrigger")}
              </Button>
              {/* Die Quittung steht 3 s und verschwindet dann — sie ist kein Dauertext. */}
              {note ? (
                <p data-testid="pruefen-quittung" className="text-[12.5px] text-trust-warn-text">
                  {note}
                </p>
              ) : null}
            </div>
          </details>
        </div>

        {/* ---- Die Karte des gewählten Objekts ----------------------------------------------- */}
        <div className="min-w-0 flex-1">{aktivIdEffektiv ? karte(aktivIdEffektiv) : null}</div>
      </div>
    </div>
  );

  // Zeichenfunktion, keine innere Komponente (Begründung: `Validation.tsx`).
  function karte(id: string): JSX.Element {
    const view = revalidationView(id, kos.data ?? []);
    const cta = revalidationCta(view);
    return (
      <div
        data-testid="pruefen-karte"
        className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile"
      >
        <div className="flex flex-col gap-[12px] px-[28px] pb-[20px] pt-[24px]">
          <div className="flex items-center gap-2">
            <PruefenPille ton="warn" kennung="art">
              <span className="uppercase">{t("status.revalidierung")}</span>
            </PruefenPille>
            <span data-text="meta" className="text-[12.5px] text-muted">
              {[t(phaseLabelKey(revalidationPhase(view))), view.asset].filter(Boolean).join(" · ")}
            </span>
            <span className="ml-auto">
              <PruefenMenue
                kennung="karte"
                beschriftung={t("pruefen.menu.actions")}
                symbol={<MenueSymbol />}
              >
                {/* „Objekt ansehen" und „Wissen nutzen" kommen aus dem VORHANDENEN Weg
                    `revalidationNextSteps` — kein zweiter Weg zu denselben zwei Zielen. */}
                {revalidationNextSteps({ id, title: view.title, found: view.found }).map((s) => (
                  <PruefenMenueLink key={s.to} to={s.to}>
                    {t(s.labelKey)}
                  </PruefenMenueLink>
                ))}
                {cta ? <PruefenMenueLink to={cta.href}>{t(cta.labelKey)}</PruefenMenueLink> : null}
              </PruefenMenue>
            </span>
          </div>
          <Link
            to={`/wissen/${id}`}
            data-text="titel"
            className="text-[20px] font-[650] leading-snug tracking-[-0.2px] text-text underline-offset-4 hover:underline"
          >
            {view.title}
          </Link>
          <PruefenMehr kennung="erneut">
            <PruefenMehrZeile beschriftung={t("lcy.revalNextLabel")}>
              {t(`lcy.revalNext.${view.nextStep}`)}
            </PruefenMehrZeile>
            {view.asset ? (
              <PruefenMehrZeile beschriftung={t("lcy.revalAsset")}>{view.asset}</PruefenMehrZeile>
            ) : null}
            {!view.found ? (
              <PruefenMehrBlock beschriftung={t("pruefen.mehr.zustand")}>
                {t("lcy.revalMissing")}
              </PruefenMehrBlock>
            ) : null}
            {lastRevalidated ? (
              <PruefenMehrBlock beschriftung={t("pruefen.lastDecision")}>
                <span data-testid="pruefen-zuletzt">
                  {t("lcy.revalSaved")} — {lastRevalidated.title}
                </span>
              </PruefenMehrBlock>
            ) : null}
          </PruefenMehr>
        </div>
        <div
          data-testid="pruefen-fussband"
          className="flex flex-wrap items-center gap-[10px] border-t border-hairline bg-page px-[28px] py-[16px]"
        >
          <PruefenKnopf
            ton="gut"
            kennung="noch-gueltig"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ id, title: view.title, found: view.found })}
          >
            <Check size={14} aria-hidden="true" />
            {t("lcy.stillValid")}
          </PruefenKnopf>
          {cta ? (
            <PruefenKnopf kennung="erneut-pruefen" onClick={() => navigate(cta.href)}>
              {t(cta.labelKey)}
            </PruefenKnopf>
          ) : null}
        </div>
      </div>
    );
  }
}
