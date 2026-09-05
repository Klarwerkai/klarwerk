// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „DATEN".
//
// Demodaten (laden/entfernen samt Einmalkennwörtern), Werkseinstellungen, Papierkorb und die
// Audit-Liste. Inhalt und Verhalten wie zuvor in `Admin.tsx`; neu ist nur der Ort: hinter einer
// Zeile mit Wert, erreichbar über das Chevron. Hilfetexte im „?"-Menü der Karte.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Power, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAudit, useUsers } from "../api/hooks";
import type { DemoSeedResult } from "../api/types";
import { useToast } from "../app/ToastContext";
// AUFTRAG-mega64 Block A: der Demodaten-Knopf steht hinter dem Betriebsschalter — dieselbe
// fail-closed Regel wie jede andere geschaltete Fläche (mega46 F2).
import { FeatureGate } from "../components/FeatureGate";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, TextInput } from "../components/ui";
import { isUserAuditAction } from "../lib/adminForms";
import { PILOT_NEXT_STEPS } from "../lib/pilotNextSteps";

/** SCRUM-181 / Pedi 14.07.: Demodaten laden — auch neben vorhandenen Daten, idempotent. */
export function DemodatenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  /**
   * JOB 3065 R4 — die zweite Lücke derselben Klasse wie BENs Befund an `/api/users`.
   *
   * Der Wert der Zeile „Demodaten" kommt aus `/api/admin/demo-seed`. Scheiterte dieser Abruf, stand
   * dort „nicht abrufbar" — und diese Karte, in die das Chevron führt, kannte den Bestand gar nicht:
   * kein Zustand, kein Knopf „Erneut", kein Weg zurück. Auftrag §9 verlangt den Ausweg genau HIER.
   * Die Karte nennt den Bestand jetzt selbst, hinter derselben Hülle wie jede andere Detailkarte.
   */
  const demoStatus = useQuery({
    queryKey: ["admin", "demo-status"],
    queryFn: endpoints.admin.demoStatus,
  });

  const demoSeed = useMutation<DemoSeedResult, unknown, boolean | undefined>({
    // Pedi 05.07./14.07.: force lädt den Demo-Bestand frisch. SCRUM-487: Demo-Sprache = UI-Sprache.
    mutationFn: (force) => endpoints.admin.demoSeed(force ?? false, i18n.language),
    onSuccess: (r) => {
      for (const key of [
        ["users"],
        ["kos"],
        ["gaps"],
        ["conflicts"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
        ["admin", "demo-status"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      if (r.skipped) {
        push("info", t("adm.seedSkipped"));
      } else {
        push("success", t("adm.seedDone", { kos: r.kos, users: r.users }));
      }
    },
    onError: fail,
  });

  // Pedi 02.07.: Demodaten komplett entfernen (Merker überlebt Tester-Bearbeitungen).
  const [confirmPurge, setConfirmPurge] = useState(false);
  const demoPurge = useMutation({
    mutationFn: () => endpoints.admin.demoPurge(),
    onSuccess: (r) => {
      for (const key of [
        ["kos"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
        ["conflicts"],
        // Bug (Pedi 04.07.): auch Wissenslücken/Aufgaben-Sichten auffrischen.
        ["gaps"],
        ["tasks"],
        ["admin", "demo-status"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      setConfirmPurge(false);
      push(
        "success",
        t("adm.purgeDone", {
          kos: r.kos,
          conflicts: r.conflicts,
          duplicates: r.duplicates,
          gaps: r.gaps,
          users: r.users,
        }),
      );
    },
    onError: fail,
  });

  return (
    <Detailkarte
      titel={t("adm.seedTitle")}
      onZurueck={onZurueck}
      testId="detail-demodaten"
      hilfe={[{ titel: t("adm.seedTitle"), text: t("adm.seedHint") }]}
    >
      <Abfragehuelle abfrage={demoStatus} testId="huelle-demostatus">
        {(stand) => (
          <div data-testid="demo-bestand" className="text-[12.5px] text-muted-2">
            {t("einst.daten.demoBestand")}
            {" · "}
            {stand.present
              ? t("einst.daten.demoDa", { count: stand.count })
              : t("einst.wert.keine")}
          </div>
        )}
      </Abfragehuelle>
      <div>
        {/* AUFTRAG-mega64 Block A: Nur das ANLEGEN steht hinter dem Schalter — der Entfernen-Knopf
            ausdrücklich NICHT. Wer die Vorführhilfe abschaltet, muss vorhandene Demodaten weiterhin
            loswerden können. Dieselbe Aufteilung wie serverseitig in admin-routes.ts. */}
        <FeatureGate feature="demodaten">
          <Button
            variant="ghost"
            disabled={demoSeed.isPending}
            onClick={() => demoSeed.mutate(false)}
          >
            <UserPlus size={15} />
            {t("adm.seedButton")}
          </Button>
        </FeatureGate>
        {/* SCRUM-412 (CI): Bestätigung = neutrale Fläche; Rot nur am destruktiven Knopf. */}
        {confirmPurge ? (
          <span className="ml-2 inline-flex items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
            <span className="text-[12px] font-semibold text-text">{t("adm.purgeQ")}</span>
            <button
              type="button"
              className="text-[12px] font-semibold text-muted hover:text-text"
              onClick={() => setConfirmPurge(false)}
            >
              {t("adm.purgeKeep")}
            </button>
            <button
              type="button"
              disabled={demoPurge.isPending}
              className="text-[12px] font-semibold text-trust-crit-text"
              onClick={() => demoPurge.mutate()}
            >
              {t("adm.purgeYes")}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            className="ml-2 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
          >
            <Trash2 size={14} className="mr-1 inline" />
            {t("adm.purgeButton")}
          </button>
        )}
      </div>
      {/* SCRUM-306: nach erfolgreichem Seed sichtbare Next-Steps — keine automatische Weiterleitung. */}
      {demoSeed.isSuccess && demoSeed.data?.skipped ? (
        <div className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
          <p>{t("adm.seedSkippedInline")}</p>
          {/* Pedi 05.07.: Demo-Set trotzdem laden — vorhandenes Demo-Set wird zuerst aufgeräumt. */}
          <button
            type="button"
            disabled={demoSeed.isPending}
            onClick={() => demoSeed.mutate(true)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-btn border border-trust-warn-text/30 px-2.5 py-1 font-semibold text-trust-warn-text hover:bg-trust-warn-text/10 disabled:opacity-50"
          >
            <UserPlus size={13} />
            {t("adm.seedForce")}
          </button>
        </div>
      ) : null}
      {/* ================================================================================
          AUFTRAG-mega64 BLOCK A — DIE EINMALKENNWÖRTER, GENAU EINMAL.
          ================================================================================
          Der Server erzeugt sie bei jeder Neuanlage frisch und nennt sie NUR in der Antwort auf
          diesen einen Aufruf; danach speichert er nur einen Prüfwert. Deshalb stehen sie hier,
          sofort, mit dem Hinweis, dass ein Neuladen sie verliert. Sie werden bewusst NICHT in einen
          Zwischenspeicher, in eine Datei oder in eine Meldung gelegt. */}
      {(demoSeed.data?.einmalkennwoerter ?? []).length > 0 ? (
        <div
          data-testid="demo-einmalkennwoerter"
          className="rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-trust-warn-text"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider">
            {t("adm.seedCredsTitle")}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed">{t("adm.seedCredsHint")}</p>
          <ul className="mt-2 space-y-1">
            {(demoSeed.data?.einmalkennwoerter ?? []).map((zugang) => (
              <li key={zugang.email} className="font-mono text-[12px]">
                {zugang.email} · <span className="font-semibold">{zugang.kennwort}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {demoSeed.isSuccess && !demoSeed.data?.skipped ? (
        <div className="rounded-card border border-hairline bg-page p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("pilot.next.title")}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("pilot.next.hint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PILOT_NEXT_STEPS.map((step) => (
              <Link
                key={step.id}
                to={step.to}
                className="inline-flex items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12px] font-semibold text-text hover:border-ink/30"
              >
                {t(step.labelKey)}
                <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </Detailkarte>
  );
}

/**
 * Pedi 05.07. (Beta): Werksreset — nur im Desktop/Dev-Modus. Löscht ALLE Daten und beendet das
 * Programm. Doppelte Rückfrage plus Re-Authentifizierung (SCRUM-450).
 *
 * JOB 3065: Die Karte gibt es jetzt IMMER (die Zeile davor nennt die Verfügbarkeit als Wert) —
 * ist der Weg in dieser Installation nicht vorhanden, sagt die Karte genau das, statt zu fehlen.
 */
export function WerkseinstellungenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const factoryResetStatus = useQuery({
    queryKey: ["factory-reset-status"],
    queryFn: endpoints.admin.factoryResetStatus,
  });
  // Zwei-Stufen-Bestätigung: "" (aus) → "armed" (Passwort + erste Rückfrage) → "confirm" (Warnung).
  const [factoryStep, setFactoryStep] = useState<"" | "armed" | "confirm">("");
  const [factoryPw, setFactoryPw] = useState("");
  const [factoryDone, setFactoryDone] = useState(false);
  const cancelFactory = (): void => {
    setFactoryStep("");
    setFactoryPw("");
  };
  const factoryReset = useMutation({
    mutationFn: (password: string) => endpoints.admin.factoryReset(password),
    onSuccess: () => {
      // Der Server beendet sich unmittelbar danach — die Oberfläche zeigt einen Neustart-Hinweis.
      setFactoryStep("");
      setFactoryPw("");
      setFactoryDone(true);
      push("success", t("adm.factoryDone"));
    },
    // SCRUM-450: Falsches Passwort → zurück zur Eingabe (Passwort leeren) mit klarer Meldung.
    onError: () => {
      setFactoryStep("armed");
      setFactoryPw("");
      push("error", t("adm.factory.wrongPassword"));
    },
  });

  return (
    <Detailkarte
      titel={t("adm.factory.title")}
      onZurueck={onZurueck}
      testId="detail-werkseinstellungen"
      hilfe={[
        { titel: t("adm.factory.title"), text: t("adm.factory.help") },
        { titel: t("adm.factory.title"), text: t("adm.factory.hint") },
      ]}
    >
      {/* Die Hülle steht davor: „In dieser Installation nicht verfügbar" ist eine TATSACHENAUSSAGE
          und darf nur aus einer erfolgreichen Antwort stammen — nicht aus einem gescheiterten
          Abruf, der nichts über die Installation weiß. */}
      <Abfragehuelle abfrage={factoryResetStatus}>
        {(stand) => (
          <>
            {stand.available !== true ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.factory.unavailable")}</p>
            ) : factoryDone ? (
              <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                {t("adm.factory.restartHint")}
              </p>
            ) : factoryStep === "" ? (
              <button
                type="button"
                onClick={() => setFactoryStep("armed")}
                className="inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
              >
                <RotateCcw size={14} />
                {t("adm.factory.button")}
              </button>
            ) : factoryStep === "armed" ? (
              // SCRUM-450: Stufe 1 — Passwort-Bestätigung (Re-Authentifizierung).
              <div className="space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5">
                <span className="block text-[12.5px] font-semibold text-text">
                  {t("adm.factory.confirm1")}
                </span>
                <Field label={t("adm.factory.passwordLabel")}>
                  <TextInput
                    type="password"
                    value={factoryPw}
                    autoComplete="current-password"
                    onChange={(e) => setFactoryPw(e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={cancelFactory}
                  >
                    {t("adm.factory.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={factoryPw.trim().length === 0}
                    className="text-[12px] font-semibold text-trust-crit-text disabled:opacity-40"
                    onClick={() => setFactoryStep("confirm")}
                  >
                    {t("adm.factory.continue")}
                  </button>
                </div>
              </div>
            ) : (
              // SCRUM-450: Stufe 2 — große, unübersehbare Warnung vor dem unwiderruflichen Schritt.
              <div className="space-y-2.5 rounded-card border border-trust-crit-text/40 bg-trust-crit-bg px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="shrink-0 text-trust-crit-text" />
                  <span className="text-[14px] font-bold text-trust-crit-text">
                    {t("adm.factory.confirm2")}
                  </span>
                </div>
                <p className="text-[12.5px] leading-snug text-trust-crit-text/90">
                  {t("adm.factory.warnBody")}
                </p>
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={cancelFactory}
                  >
                    {t("adm.factory.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={factoryReset.isPending}
                    className="inline-flex items-center gap-1 rounded-btn bg-trust-crit-text px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                    onClick={() => factoryReset.mutate(factoryPw)}
                  >
                    <Power size={13} />
                    {t("adm.factory.execute")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-422: Papierkorb — 28 Tage wiederherstellbar, Endlöschung mit ruhiger Inline-Rückfrage. */
export function PapierkorbDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const users = useUsers();
  const trash = useQuery({ queryKey: ["kos", "trash"], queryFn: endpoints.ko.trash });
  const [confirmTrashPurgeId, setConfirmTrashPurgeId] = useState<string | null>(null);
  const invalidateTrash = (): void => {
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
  };
  const trashRestore = useMutation({
    mutationFn: (id: string) => endpoints.ko.restore(id),
    onSuccess: () => {
      invalidateTrash();
      push("success", t("adm.trash.restored"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const trashPurge = useMutation({
    mutationFn: (id: string) => endpoints.ko.purge(id),
    onSuccess: () => {
      setConfirmTrashPurgeId(null);
      invalidateTrash();
      push("success", t("adm.trash.purged"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const userName = (id: string): string => users.data?.find((u) => u.id === id)?.name ?? id;
  const daysLeft = (expiresAt: string): number =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));

  return (
    <Detailkarte
      titel={t("adm.trash.title")}
      onZurueck={onZurueck}
      testId="detail-papierkorb"
      hilfe={[{ titel: t("adm.trash.title"), text: t("adm.trash.help") }]}
    >
      {/* JOB 3065 R2: `QueryState` zeigt bei einem Fehler zwar einen Satz, aber KEINEN Weg zurück.
          Die Hülle bringt „nicht abrufbar" mit „Erneut versuchen" und hält vorhandene Einträge bei
          gestörter Auffrischung sichtbar. */}
      <Abfragehuelle abfrage={trash}>
        {(eintraege) => (
          <>
            {eintraege.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.trash.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {eintraege.map((entry) => (
                  <li key={entry.id} className="rounded-card border border-hairline p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-text">
                          {entry.title}
                        </div>
                        <div className="text-[11.5px] text-muted-2">
                          {t("adm.trash.deletedMeta", {
                            name: userName(entry.deletedBy),
                            date: new Date(entry.deletedAt).toLocaleDateString(),
                          })}
                          {" · "}
                          {t("adm.trash.expires", { days: daysLeft(entry.expiresAt) })}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={trashRestore.isPending}
                        onClick={() => trashRestore.mutate(entry.id)}
                      >
                        {t("adm.trash.restore")}
                      </Button>
                      {confirmTrashPurgeId === entry.id ? (
                        <span className="flex w-full basis-full flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
                          <span className="text-[12px] font-semibold text-text">
                            {t("adm.trash.purgeQ")}
                          </span>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-muted hover:text-text"
                            onClick={() => setConfirmTrashPurgeId(null)}
                          >
                            {t("adm.trash.keep")}
                          </button>
                          <button
                            type="button"
                            disabled={trashPurge.isPending}
                            className="text-[12px] font-semibold text-trust-crit-text"
                            onClick={() => trashPurge.mutate(entry.id)}
                          >
                            {t("adm.trash.purge")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTrashPurgeId(entry.id)}
                          className="rounded-btn px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                        >
                          <Trash2 size={13} className="mr-1 inline" />
                          {t("adm.trash.purge")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-149: die kleine echte Audit-Sicht für Nutzer-/Auth-Aktionen. */
export function AuditDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const audit = useAudit();
  return (
    <Detailkarte titel={t("adm.auditTitle")} onZurueck={onZurueck} testId="detail-audit">
      <Abfragehuelle abfrage={audit}>
        {(entries) => {
          const userEntries = entries
            .filter((e) => isUserAuditAction(e.action))
            .slice(-15)
            .reverse();
          if (userEntries.length === 0) {
            return <p className="text-[13px] text-muted">{t("adm.auditEmpty")}</p>;
          }
          return (
            <div className="divide-y divide-hairline">
              {userEntries.map((e) => (
                <div key={e.seq} className="flex items-center gap-3 py-2 text-[12.5px]">
                  <span className="font-mono text-[11px] text-muted-2">
                    {new Date(e.at).toLocaleString()}
                  </span>
                  <span className="font-semibold text-text">{e.action}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-muted-2">
                    {e.actor}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      </Abfragehuelle>
    </Detailkarte>
  );
}
