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
//
// produkt:20261010:aenderungsfolgen-sichtbar — DIESELBE FLÄCHE, JETZT MIT DEM WARUM.
// Je offenem Fall liefert `GET /api/lifecycle/folgepruefung` Anlass, Stand und Zuständigkeit. Die
// Liste nennt darunter Grund, zuständige Person, Prüfstatus und Termin; die Karte nennt je Anlass,
// WARUM der Eintrag betroffen ist (Kopplung, auslösender Eintrag, Änderungsbeleg, Fassung). „Noch
// gültig" schickt den angezeigten Stand mit — ist inzwischen eine weitere Änderung eingegangen,
// lehnt der Server ab (409) und der Fall bleibt offen. Ohne diese Auskunft (Ladefehler) bleibt der
// bisherige Weg, und die Karte sagt das.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import {
  useFolgepruefung,
  useKos,
  useLearningPath,
  useLearningProgress,
  useLifecyclePending,
} from "../api/hooks";
import type { FolgepruefungsAnlass, FolgepruefungsFall } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { EmptyStateCtas, leerzustandsZeile } from "../components/EmptyStateCtas";
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
import { leseFall } from "../lib/fallAbsprung";
import { aeltesteVorlage, faelligeKennungen } from "../lib/frische";
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
  const { push } = useToast();
  const navigate = useNavigate();
  const { user } = useSession();
  const role = user?.role ?? "viewer";

  const query = useLifecyclePending();
  const kos = useKos();
  const folge = useFolgepruefung();
  const faelle = new Map<string, FolgepruefungsFall>(
    (folge.data ?? []).map((fall) => [fall.koId, fall]),
  );
  const path = useLearningPath(role);
  const pathId = path.data?.id;
  const progress = useLearningProgress(pathId);
  const done = progress.data ?? [];

  // R-0961: `?fall=<id>` aus der Aufgabenliste wählt genau dieses Objekt vor. Steht es nicht (mehr)
  // in der Fälligkeitsliste, führt wie bisher der erste Eintrag (`aktivIdEffektiv` unten).
  const [params] = useSearchParams();
  const [aktivId, setAktivId] = useState<string | null>(() => leseFall(params));
  const [lastRevalidated, setLastRevalidated] = useState<{
    id: string;
    title: string;
    found: boolean;
    stand?: number;
  } | null>(null);
  const confirm = useMutation({
    // produkt:20261010:aenderungsfolgen-sichtbar: mit Stand, sobald er bekannt ist.
    // Nacharbeit 6 (Ben, K5): mit dem Stand reist die angezeigte Inhaltsfassung.
    mutationFn: ({
      id,
      stand,
      fassung,
    }: {
      id: string;
      title: string;
      found: boolean;
      stand?: number;
      fassung?: number;
    }) =>
      endpoints.ko.act(
        id,
        stand === undefined || fassung === undefined
          ? { action: "revalidate" }
          : { action: "revalidate", stand, fassung },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      setLastRevalidated({
        id: vars.id,
        title: vars.title,
        found: vars.found,
        ...(vars.stand !== undefined ? { stand: vars.stand } : {}),
      });
    },
    // R-0953 (Bestandsabgleich, Nacharbeit 4): der Erfolg hat seine Quittung oben; der Fehler
    // blieb bis hierher still.
    // produkt:20261010:aenderungsfolgen-sichtbar: ein veralteter Stand ist kein Störfall — die
    // Meldung sagt, was geschah, und die Liste lädt den neuen Stand.
    onError: (error) => {
      // Nacharbeit 6: auch eine inzwischen überarbeitete Inhaltsfassung (`KO_STALE`) ist ein
      // veralteter Stand — dieselbe Meldung, dasselbe Neuladen.
      if (
        error instanceof ApiError &&
        (error.code === "STAND_VERALTET" || error.code === "KO_STALE")
      ) {
        void qc.invalidateQueries({ queryKey: ["lifecycle"] });
        push("error", t("folgepruefung.standVeraltet"));
        return;
      }
      push("error", t("lcy.toast.revalidateFailed"));
    },
  });

  // SCRUM-146: Asset-Change-Auslöser → markiert gekoppelte KOs „prüfen".
  const [assetRef, setAssetRef] = useState("");
  const [aenderung, setAenderung] = useState("");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (note === null) {
      return;
    }
    const timer = window.setTimeout(() => setNote(null), QUITTUNG_MS);
    return () => window.clearTimeout(timer);
  }, [note]);
  const assetChanged = useMutation({
    // produkt:20261010:aenderungsfolgen-sichtbar: der optionale Änderungsbeleg unterscheidet eine
    // weitere Änderung von der wiederholten Meldung derselben.
    mutationFn: (ref: string) =>
      aenderung.trim().length > 0
        ? endpoints.lifecycle.assetChanged(ref, aenderung.trim())
        : endpoints.lifecycle.assetChanged(ref),
    onSuccess: (ids) => {
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      setNote(
        ids.length === 0
          ? t("folgepruefung.keineKopplung", { asset: assetRef.trim() })
          : t("lcy.assetMarked", { n: ids.length, asset: assetRef.trim() }),
      );
      setAssetRef("");
      setAenderung("");
    },
    onError: () => setNote(t("state.error")),
  });

  // SCRUM-145: Lernpfad-Schritt abhaken (Fortschritt serverseitig).
  const complete = useMutation({
    mutationFn: (stepId: string) => endpoints.learningPaths.complete(pathId ?? "", stepId),
    onSuccess: () => {
      push("success", t("lcy.toast.stepDone"));
      void qc.invalidateQueries({ queryKey: ["learning-progress", pathId] });
    },
    onError: () => push("error", t("lcy.toast.stepFailed")),
  });

  // aufnahme:20260922:gesamt-wissen-frische (R-0206): neben den Merkern steht hier auch geprüftes
  // Wissen, das nach der serverseitigen Frische fällig oder veraltet ist (`lib/frische.ts`).
  const faellig =
    query.data === undefined ? undefined : faelligeKennungen(query.data, kos.data ?? []);
  const ids = faellig ?? [];
  // R-0266: die ältesten geprüften Beiträge in der Verantwortung der angemeldeten Person. Dieselbe
  // Auswahlregel stellt der Server jede Woche als persönliche Vorlage in die Glocke
  // (`aeltesteVorlageFuer`, services/app/src/frische-meldungen.ts) — hier steht sie zum Abarbeiten.
  const vorlage = user ? aeltesteVorlage(kos.data ?? [], user.id) : [];
  // bens Korrekturpflicht 2 (Runde 4): Die Fälligkeitsliste liefert nur IDs — Titel, Anlage und
  // Status stehen im Objektabruf (`revalidationView`). Ohne dessen Antwort stand hier die rohe UUID
  // mit dem Vermerk „Objekt nicht auffindbar", obwohl das Objekt nur noch nicht geladen war.
  const lage = flaechenZustand(
    { data: faellig, isLoading: query.isLoading, isError: query.isError },
    abhaengigeQuelle(kos),
  );
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
      {/* R-0888 (gesamt-hilfen, Nacharbeit 13): die vorhandene Erklärung des grünen Knopfs „Noch
          gültig" unten im Fussband (`lib/reviewHelp.ts`, `vhelp.stillValid`) — bis hierher nur über
          Klaras Suche erreichbar, jetzt im „?"-Menü des Reiters, in dem der Knopf steht. */}
      <PruefenHilfeBlock titel={t("vhelp.stillValid.title")}>
        <p>{t("vhelp.stillValid.body")}</p>
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
          <>
            <p>{t("lcy.pathEmpty")}</p>
            {leerzustandsZeile(t, "lernpfad")}
          </>
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
          {/* R-0956 (Bestandsabgleich, Nacharbeit 4): der Leersatz bleibt wörtlich; darunter die
              Einordnung in den Wissenskreis und der nächste Schritt. */}
          {lage.lage === "leer" ? <EmptyStateCtas context="lifecycle" /> : null}
          {bestand && ids.length > 0 ? (
            <ul data-testid="pruefen-warteschlange" className="flex flex-col gap-1">
              {ids.map((id) => {
                const view = revalidationView(id, kos.data ?? []);
                const ist = aktivIdEffektiv === id;
                const fall = faelle.get(id);
                const termin = kos.data?.find((k) => k.id === id)?.frische?.haltbarBis ?? null;
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
                      {/* produkt:20261010:aenderungsfolgen-sichtbar: Grund, zuständige Person,
                          Prüfstatus und Termin — nur, wo ein Änderungsfall vorliegt. */}
                      {fall ? (
                        <span
                          data-text="meta"
                          data-testid="folgepruefung-zeile"
                          className="mt-0.5 block text-[11.5px] font-normal text-muted-2"
                        >
                          {[
                            grundKurz(fall),
                            zustaendigText(fall),
                            t("folgepruefung.statusOffen", { stand: fall.stand }),
                            termin ? new Date(termin).toLocaleDateString() : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
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
              <input
                value={aenderung}
                onChange={(e) => setAenderung(e.target.value)}
                maxLength={200}
                placeholder={t("folgepruefung.aenderungPlaceholder")}
                aria-label={t("folgepruefung.aenderungPlaceholder")}
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
          {/* R-0266: die ältesten geprüften Beiträge der angemeldeten Person zur Bestätigung. */}
          <details data-testid="pruefen-vorlage" className="mt-3">
            <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-muted hover:text-text">
              {t("frische.vorlageTitel")} ({vorlage.length})
            </summary>
            <div className="mt-2 space-y-1.5 text-[12.5px]">
              {vorlage.length === 0 ? (
                <p className="text-muted-2">{t("frische.vorlageLeer")}</p>
              ) : (
                <>
                  <p className="text-muted">{t("frische.vorlageHinweis")}</p>
                  <ul className="flex flex-col gap-1">
                    {vorlage.map((eintrag) => (
                      <li key={eintrag.id} data-testid="pruefen-vorlage-eintrag">
                        <Link
                          to={`/wissen/${eintrag.id}`}
                          className="text-text underline-offset-4 hover:underline"
                        >
                          {eintrag.title}
                        </Link>
                        {eintrag.frische ? (
                          <span className="ml-1.5 text-muted-2">
                            · {t(`frische.stufe.${eintrag.frische.stufe}`)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </details>
        </div>

        {/* ---- Die Karte des gewählten Objekts ----------------------------------------------- */}
        <div className="min-w-0 flex-1">{aktivIdEffektiv ? karte(aktivIdEffektiv) : null}</div>
      </div>
    </div>
  );

  // produkt:20261010:aenderungsfolgen-sichtbar: der Grund in einem Wort — für die Listenzeile.
  function grundKurz(fall: FolgepruefungsFall): string {
    if (fall.anlaesse.length === 0) {
      return t("folgepruefung.grundKurz.unbekannt");
    }
    if (fall.anlaesse.length > 1) {
      return t("folgepruefung.grundKurz.mehrere", { anzahl: fall.anlaesse.length });
    }
    return t(`folgepruefung.grundKurz.${fall.anlaesse[0]?.grund ?? "unbekannt"}`);
  }

  function zustaendigText(fall: FolgepruefungsFall): string {
    if (!fall.zustaendig.vorhanden || fall.zustaendig.name === null) {
      return t("folgepruefung.zustaendigFehlt", { id: fall.zustaendig.id });
    }
    return fall.zustaendig.art === "author-fallback"
      ? `${fall.zustaendig.name} ${t("folgepruefung.zustaendigErsatz")}`
      : fall.zustaendig.name;
  }

  // Ein Anlass als Satz: Grund, Änderungsbeleg, Zeitpunkt, Fassungen, fehlende Kopplung.
  function anlassZeile(fall: FolgepruefungsFall, anlass: FolgepruefungsAnlass): JSX.Element {
    const satz =
      anlass.grund === "bibliothek"
        ? t("folgepruefung.grund.bibliothek")
        : anlass.grund === "nachbar" && anlass.ausloeser
          ? anlass.assetRef
            ? t("folgepruefung.grund.nachbar", {
                titel: anlass.ausloeser.title,
                asset: anlass.assetRef,
              })
            : t("folgepruefung.grund.nachbarOhneAnlage", { titel: anlass.ausloeser.title })
          : anlass.assetRef
            ? t("folgepruefung.grund.anlage", { asset: anlass.assetRef })
            : t("folgepruefung.grund.anlageOhne");
    const zusatz = [
      anlass.aenderung ? t("folgepruefung.aenderung", { aenderung: anlass.aenderung }) : null,
      t("folgepruefung.am", { datum: new Date(anlass.am).toLocaleString() }),
      anlass.ausloeser && anlass.ausloeser.version !== null && anlass.ausloeser.koId !== fall.koId
        ? t("folgepruefung.ausloeserFassung", { version: anlass.ausloeser.version })
        : null,
      anlass.koVersion !== null
        ? t("folgepruefung.fassungBeiMeldung", { version: anlass.koVersion })
        : null,
    ].filter(Boolean);
    return (
      <li
        key={`${anlass.am}-${anlass.grund}-${anlass.aenderung ?? ""}`}
        data-testid="folgepruefung-anlass"
      >
        <span className="text-text">{satz}</span>
        <span className="text-muted"> · {zusatz.join(" · ")}</span>
        {anlass.kopplungBesteht === false && anlass.assetRef ? (
          <span className="block text-trust-warn-text">
            {t("folgepruefung.kopplungFehlt", { asset: anlass.assetRef })}
          </span>
        ) : null}
      </li>
    );
  }

  // Der Warum-Block der Karte. Ganz als `data-text` ausgezeichnet: er ist Inhalt des Falls, kein
  // Erklärtext der Fläche (Textmesser, JOB 3061 §5.6).
  function warumBlock(
    fall: FolgepruefungsFall | undefined,
    termin: string | null,
    ohneStand: boolean,
  ): JSX.Element | null {
    if (!fall) {
      return ohneStand ? (
        <div
          data-text="meta"
          data-testid="folgepruefung-ladefehler"
          className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted"
        >
          <span>{t("folgepruefung.ladefehler")}</span>
          <button
            type="button"
            data-testid="folgepruefung-neu-laden"
            onClick={() => void qc.invalidateQueries({ queryKey: ["lifecycle"] })}
            className="font-semibold text-text underline-offset-4 hover:underline"
          >
            {t("folgepruefung.neuLaden")}
          </button>
        </div>
      ) : null;
    }
    const fassungen = fall.anlaesse.map((a) => a.koVersion).filter((v): v is number => v !== null);
    const juengsteFassung = fassungen.length > 0 ? Math.max(...fassungen) : null;
    return (
      <div data-text="text" data-testid="folgepruefung-warum" className="space-y-1.5 text-[12.5px]">
        <div className="font-semibold text-text">{t("folgepruefung.warumTitel")}</div>
        {fall.anlaesse.length === 0 ? (
          <p className="text-trust-warn-text">{t("folgepruefung.anlassFehlt")}</p>
        ) : (
          <ul className="flex flex-col gap-1">{fall.anlaesse.map((a) => anlassZeile(fall, a))}</ul>
        )}
        {juengsteFassung !== null && fall.version > juengsteFassung ? (
          <p className="text-trust-warn-text">
            {t("folgepruefung.seitMeldungUeberarbeitet", {
              alt: juengsteFassung,
              neu: fall.version,
            })}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted">{t("folgepruefung.zustaendigLabel")}</dt>
          <dd
            data-testid="folgepruefung-zustaendig"
            className={fall.zustaendig.vorhanden ? "text-text" : "text-trust-warn-text"}
          >
            {zustaendigText(fall)}
          </dd>
          <dt className="text-muted">{t("folgepruefung.statusLabel")}</dt>
          <dd data-testid="folgepruefung-status" className="text-text">
            {[
              t(`status.${fall.status}`, { defaultValue: fall.status }),
              t("folgepruefung.statusOffen", { stand: fall.stand }),
            ].join(" · ")}
          </dd>
          {termin ? (
            <>
              <dt className="text-muted">{t("folgepruefung.terminLabel")}</dt>
              <dd data-testid="folgepruefung-termin" className="text-text">
                {new Date(termin).toLocaleDateString()}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="text-muted-2">{t("folgepruefung.abdeckung")}</p>
        <p className="text-muted-2">{t("folgepruefung.bestaetigtHinweis")}</p>
      </div>
    );
  }

  // Zeichenfunktion, keine innere Komponente (Begründung: `Validation.tsx`).
  function karte(id: string): JSX.Element {
    const view = revalidationView(id, kos.data ?? []);
    const cta = revalidationCta(view);
    const frische = kos.data?.find((k) => k.id === id)?.frische;
    const fall = faelle.get(id);
    // Nacharbeit 4 (Ben, K5): steht für den Eintrag ein Merker, ist der Abschluss NUR mit dem
    // angezeigten Stand möglich. Fehlt die Folgeprüfungsauskunft (lädt, gescheitert), bleibt
    // „Noch gültig" gesperrt, und die Karte bietet das Neuladen an. Rein fristfällige Einträge
    // ohne Merker bestätigen wie bisher (dort gibt es keinen Stand).
    const ohneStand = (query.data ?? []).includes(id) && !fall;
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
          {warumBlock(fall, frische?.haltbarBis ?? null, ohneStand)}
          <PruefenMehr kennung="erneut">
            <PruefenMehrZeile beschriftung={t("lcy.revalNextLabel")}>
              {t(`lcy.revalNext.${view.nextStep}`)}
            </PruefenMehrZeile>
            {view.asset ? (
              <PruefenMehrZeile beschriftung={t("lcy.revalAsset")}>{view.asset}</PruefenMehrZeile>
            ) : null}
            {/* aufnahme:20260922:gesamt-wissen-frische: wie frisch und bis wann gesichert. Wer
                verantwortlich ist, steht am Objekt (Bibliothek „Mehr" → Belege). */}
            {frische ? (
              <>
                <PruefenMehrZeile beschriftung={t("frische.stufeLabel")}>
                  {t(`frische.stufe.${frische.stufe}`)}
                </PruefenMehrZeile>
                <PruefenMehrZeile beschriftung={t("frische.haltbarBis")}>
                  {frische.haltbarBis
                    ? new Date(frische.haltbarBis).toLocaleDateString()
                    : t("frische.haltbarUnbekannt")}
                </PruefenMehrZeile>
              </>
            ) : null}
            {!view.found ? (
              <PruefenMehrBlock beschriftung={t("pruefen.mehr.zustand")}>
                {t("lcy.revalMissing")}
              </PruefenMehrBlock>
            ) : null}
            {lastRevalidated ? (
              <PruefenMehrBlock beschriftung={t("pruefen.lastDecision")}>
                <span data-testid="pruefen-zuletzt">
                  {lastRevalidated.stand !== undefined
                    ? t("folgepruefung.abgeschlossen", {
                        stand: lastRevalidated.stand,
                        titel: lastRevalidated.title,
                      })
                    : [t("lcy.revalSaved"), lastRevalidated.title].join(" — ")}
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
            disabled={confirm.isPending || ohneStand}
            onClick={() =>
              confirm.mutate({
                id,
                title: view.title,
                found: view.found,
                ...(fall ? { stand: fall.stand, fassung: fall.version } : {}),
              })
            }
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
