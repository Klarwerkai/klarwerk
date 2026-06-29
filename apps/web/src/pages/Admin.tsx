import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAudit, useUsers } from "../api/hooks";
import { useToast } from "../app/ToastContext";
import { ROLES, type Role } from "../app/navigation";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  SectionLabel,
  TextInput,
} from "../components/ui";
import { isNewUserValid, isPasswordResetValid, isUserAuditAction } from "../lib/adminForms";
import { PILOT_NEXT_STEPS } from "../lib/pilotNextSteps";

const EMPTY_NEW_USER = { name: "", email: "", password: "", role: "experte" as Role };

export function Admin(): JSX.Element {
  const { t } = useTranslation();
  const query = useUsers();
  const audit = useAudit();
  const qc = useQueryClient();
  const { push } = useToast();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["users"] });
  const fail = (e: unknown) => push("error", e instanceof ApiError ? e.message : t("state.error"));

  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  const create = useMutation({
    mutationFn: () =>
      endpoints.users.create(
        newUser.name.trim(),
        newUser.email.trim(),
        newUser.password,
        newUser.role,
      ),
    onSuccess: () => {
      invalidate();
      setNewUser({ ...EMPTY_NEW_USER });
      push("success", t("adm.created"));
    },
    onError: fail,
  });

  const approve = useMutation({
    mutationFn: (id: string) => endpoints.users.approve(id),
    onSuccess: invalidate,
    onError: fail,
  });
  const setRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => endpoints.users.setRole(v.id, v.role),
    onSuccess: invalidate,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.users.remove(id),
    onSuccess: invalidate,
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      endpoints.users.resetPassword(v.id, v.password),
    onSuccess: () => {
      setResetId(null);
      setResetPw("");
      push("success", t("adm.resetDone"));
    },
    onError: fail,
  });

  // SCRUM-181: Demodaten in eine LEERE Instanz laden (admin-only). Ehrliche skipped/seeded-Meldung.
  const demoSeed = useMutation({
    mutationFn: () => endpoints.admin.demoSeed(),
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader kicker={t("adm.kicker")} title={t("nav.admin")} />

      {/* SCRUM-181: Demodaten laden (nur leere Instanz; idempotent, ehrliche Rückmeldung). */}
      <Card className="space-y-2">
        <SectionLabel>{t("adm.seedTitle")}</SectionLabel>
        <p className="text-[12.5px] text-muted">{t("adm.seedHint")}</p>
        <div>
          <Button variant="ghost" disabled={demoSeed.isPending} onClick={() => demoSeed.mutate()}>
            <UserPlus size={15} />
            {t("adm.seedButton")}
          </Button>
        </div>
        {/* SCRUM-306: nach erfolgreichem Seed (nicht übersprungen) sichtbare Next-Steps in den Stage-1-
            Lauf — keine automatische Weiterleitung, nur vorhandene Routen. Ohne Seed unverändert. */}
        {demoSeed.isSuccess && !demoSeed.data?.skipped ? (
          <div className="mt-1 rounded-card border border-hairline bg-page p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              {t("pilot.next.title")}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              {t("pilot.next.hint")}
            </p>
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
      </Card>

      {/* SCRUM-147: Nutzer anlegen */}
      <Card className="space-y-3">
        <SectionLabel>{t("adm.createTitle")}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("adm.name")}>
            <TextInput
              value={newUser.name}
              onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
            />
          </Field>
          <Field label={t("adm.email")}>
            <TextInput
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            />
          </Field>
          <Field label={t("adm.password")}>
            <TextInput
              type="password"
              minLength={8}
              value={newUser.password}
              onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
            />
          </Field>
          <Field label={t("adm.role")}>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as Role }))}
              className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.name.${r}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button
          variant="primary"
          disabled={create.isPending || !isNewUserValid(newUser)}
          onClick={() => create.mutate()}
        >
          <UserPlus size={15} />
          {t("adm.create")}
        </Button>
      </Card>

      {/* Nutzerliste + Freigabe/Rolle/Reset/Löschen */}
      <QueryState query={query} emptyText={t("adm.empty")}>
        {(users) => (
          <Card className="p-0">
            <div className="divide-y divide-hairline">
              {users.map((u) => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-text">{u.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-2">{u.email}</div>
                    </div>
                    {u.approved ? (
                      <select
                        value={u.role}
                        onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as Role })}
                        className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(`role.name.${r}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => approve.mutate(u.id)}
                        className="rounded-btn bg-trust-pos-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-pos-text hover:opacity-80"
                      >
                        {t("adm.approve")}
                      </button>
                    )}
                    <button
                      type="button"
                      title={t("adm.reset")}
                      onClick={() => {
                        setResetId((id) => (id === u.id ? null : u.id));
                        setResetPw("");
                      }}
                      className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      type="button"
                      title={t("adm.remove")}
                      onClick={() => remove.mutate(u.id)}
                      className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {resetId === u.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-input bg-page p-2">
                      <TextInput
                        type="password"
                        minLength={8}
                        placeholder={t("adm.newPassword")}
                        value={resetPw}
                        onChange={(e) => setResetPw(e.target.value)}
                        className="h-9 flex-1"
                      />
                      <Button
                        variant="primary"
                        disabled={reset.isPending || !isPasswordResetValid(resetPw)}
                        onClick={() => reset.mutate({ id: u.id, password: resetPw })}
                      >
                        {t("adm.resetConfirm")}
                      </Button>
                      <Button variant="ghost" onClick={() => setResetId(null)}>
                        {t("adm.resetCancel")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}
      </QueryState>

      {/* SCRUM-149: kleine echte Audit-Sicht für Nutzer-/Auth-Aktionen */}
      <Card className="p-0">
        <div className="px-4 pt-4">
          <SectionLabel>{t("adm.auditTitle")}</SectionLabel>
        </div>
        <QueryState query={audit} emptyText={t("adm.auditEmpty")}>
          {(entries) => {
            const userEntries = entries
              .filter((e) => isUserAuditAction(e.action))
              .slice(-15)
              .reverse();
            if (userEntries.length === 0) {
              return <p className="px-4 py-3 text-[13px] text-muted">{t("adm.auditEmpty")}</p>;
            }
            return (
              <div className="divide-y divide-hairline">
                {userEntries.map((e) => (
                  <div key={e.seq} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
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
        </QueryState>
      </Card>
    </div>
  );
}
