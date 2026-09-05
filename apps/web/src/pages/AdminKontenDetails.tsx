// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „KONTEN".
//
// Ein Nutzer (Freigeben · Rolle · Passwort zurücksetzen · Löschen), das Anlegen, die Rollen-Vorschau
// („Ansicht als Rolle", vorher in der Seitenleiste) und je Rolle die Karte ihrer Freiheiten.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useUsers } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { NAV_GROUPS, ROLES, type Role, roleAllows } from "../app/navigation";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { freiheitenSchluessel, kiWahlFrei } from "../components/einstellungen/rollenFreiheiten";
import { Button, Field, TextInput } from "../components/ui";
import { isPasswordResetValid, newUserIssues, passwordRepeatMismatch } from "../lib/adminForms";

const EMPTY_NEW_USER = { name: "", email: "", password: "", role: "experte" as Role };

/** Ein Konto: alles, was der Admin an diesem Nutzer tun darf. */
export function NutzerDetail({
  nutzerId,
  onZurueck,
}: {
  nutzerId: string;
  onZurueck: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const users = useUsers();
  const nutzer = users.data?.find((u) => u.id === nutzerId);
  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["users"] });
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

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
    onSuccess: () => {
      invalidate();
      onZurueck();
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      endpoints.users.resetPassword(v.id, v.password),
    onSuccess: () => {
      setResetOffen(false);
      setResetPw("");
      setResetPw2("");
      push("success", t("adm.resetDone"));
    },
    onError: fail,
  });

  const [resetOffen, setResetOffen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  // SCRUM-455: Wiederholung des neuen Passworts (Vertipper-Schutz).
  const [resetPw2, setResetPw2] = useState("");
  // JOB 3065: Löschen bekommt die Rückfrage, die es auf der alten Kartenwand nie hatte (mega45:
  // genau EIN Knopf trägt die Warnfarbe, keiner die neutrale Vorgabe).
  const [confirmRemove, setConfirmRemove] = useState(false);

  // JOB 3065 R2: „Dieses Konto gibt es nicht mehr" ist eine Tatsachenaussage. Sie darf NUR aus
  // einer erfolgreichen Antwort entstehen, in der das Konto fehlt — nicht daraus, dass die Liste
  // gerade lädt oder ihr Abruf gescheitert ist (dieselbe Klasse wie LEHREN 3002/3027).
  if (!nutzer) {
    return (
      <Detailkarte titel={t("adm.sec.konten")} onZurueck={onZurueck} testId="detail-nutzer">
        <Abfragehuelle abfrage={users}>
          {() => <p className="text-[12.5px] text-muted-2">{t("einst.konten.nutzerWeg")}</p>}
        </Abfragehuelle>
      </Detailkarte>
    );
  }

  return (
    <Detailkarte titel={nutzer.name} onZurueck={onZurueck} testId="detail-nutzer">
      <div className="font-mono text-[12px] text-muted-2">{nutzer.email}</div>

      {nutzer.approved ? (
        <Field label={t("adm.role")}>
          <select
            value={nutzer.role}
            onChange={(e) => setRole.mutate({ id: nutzer.id, role: e.target.value as Role })}
            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.name.${r}`)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => approve.mutate(nutzer.id)}
          className="rounded-btn bg-trust-pos-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-pos-text hover:opacity-80"
        >
          {t("adm.approve")}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Button
          variant="ghost"
          onClick={() => {
            setResetOffen((v) => !v);
            setResetPw("");
            setResetPw2("");
          }}
        >
          <KeyRound size={15} />
          {t("adm.reset")}
        </Button>
        {confirmRemove ? (
          <span className="inline-flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
            <span className="text-[12px] font-semibold text-text">{t("adm.removeQ")}</span>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              {t("adm.removeKeep")}
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(nutzer.id)}
            >
              {t("adm.removeYes")}
            </Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
          >
            {t("adm.remove")}
          </button>
        )}
      </div>

      {resetOffen ? (
        <div className="rounded-input bg-page p-2">
          {/* SCRUM-455: Passwort + Wiederholung — ein Vertipper würde den Nutzer aussperren. */}
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              type="password"
              minLength={8}
              placeholder={t("adm.newPassword")}
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className="h-9 flex-1"
            />
            <TextInput
              type="password"
              minLength={8}
              placeholder={t("adm.newPasswordRepeat")}
              value={resetPw2}
              onChange={(e) => setResetPw2(e.target.value)}
              className="h-9 flex-1"
            />
            <Button
              variant="primary"
              disabled={reset.isPending || !isPasswordResetValid(resetPw, resetPw2)}
              onClick={() => reset.mutate({ id: nutzer.id, password: resetPw })}
            >
              {t("adm.resetConfirm")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setResetOffen(false);
                setResetPw("");
                setResetPw2("");
              }}
            >
              {t("adm.resetCancel")}
            </Button>
          </div>
          {/* Ehrlicher Grund erst, wenn im Wiederholfeld etwas steht (kein Fehler beim Tippen). */}
          {passwordRepeatMismatch(resetPw, resetPw2) ? (
            <p className="mt-1.5 text-[12px] text-trust-crit-text">{t("adm.passwordMismatch")}</p>
          ) : null}
        </div>
      ) : null}
    </Detailkarte>
  );
}

/** SCRUM-147: Nutzer anlegen. */
export function NutzerAnlegenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  // Sicherheit: Passwort-Bestätigung bei der Nutzeranlage (Vertipper-Schutz, analog Reset).
  const [newUserPw2, setNewUserPw2] = useState("");
  const create = useMutation({
    mutationFn: () =>
      endpoints.users.create(
        newUser.name.trim(),
        newUser.email.trim(),
        newUser.password,
        newUser.role,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ ...EMPTY_NEW_USER });
      setNewUserPw2("");
      push("success", t("adm.created"));
      onZurueck();
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.createTitle")}
      onZurueck={onZurueck}
      testId="detail-nutzer-neu"
      hilfe={[{ titel: t("adm.createTitle"), text: t("adm.createHint") }]}
    >
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
        {/* Ein Vertipper würde den neuen Nutzer sonst aussperren. */}
        <Field label={t("adm.newPasswordRepeat")}>
          <TextInput
            type="password"
            minLength={8}
            value={newUserPw2}
            onChange={(e) => setNewUserPw2(e.target.value)}
          />
          {passwordRepeatMismatch(newUser.password, newUserPw2) ? (
            <p className="mt-1.5 text-[12px] text-trust-crit-text">{t("adm.passwordMismatch")}</p>
          ) : null}
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
      {/* SCRUM-463: Knopf nicht stumm deaktivieren. Fehlt etwas, sagt ein Klick ehrlich, was —
          sonst „passiert nichts" ohne jede Rückmeldung. Die Auskunft kommt als Meldung mit den
          FEHLENDEN Feldern beim Namen (`adm.createInvalid` + `adm.field.*`), nicht als stehender
          Absatz: JOB 3065 R2 (BENs Korrekturpflicht 1) — `adm.createHint` ist ein verlegter
          Hilfetext und lebt im „?"-Menü dieser Karte, nicht im Sichtfeld. */}
      <div>
        <Button
          variant="primary"
          disabled={create.isPending}
          onClick={() => {
            const issues = newUserIssues(newUser);
            if (issues.length > 0) {
              push(
                "error",
                `${t("adm.createInvalid")} ${issues.map((i) => t(`adm.field.${i}`)).join(", ")}`,
              );
              return;
            }
            if (newUser.password !== newUserPw2) {
              push("error", t("adm.passwordMismatch"));
              return;
            }
            create.mutate();
          }}
        >
          <UserPlus size={15} />
          {t("adm.create")}
        </Button>
      </div>
    </Detailkarte>
  );
}

/**
 * Die Rollen-Vorschau. Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als jede Rolle prüfen; die
 * echte Session (Backend-RBAC) bleibt Admin. Bis JOB 3060 stand dieser Schalter in der
 * Seitenleiste — hier ist sein neuer Ort.
 */
export function AnsichtAlsRolleDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { role, setRole } = useRole();
  return (
    <Detailkarte titel={t("role.viewAs")} onZurueck={onZurueck} testId="detail-ansicht-rolle">
      <div className="grid grid-cols-4 gap-1.5">
        {ROLES.map((r: Role) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className={`rounded-pill px-1 py-1.5 text-[12px] font-semibold transition-colors ${
              role === r ? "bg-brand text-white" : "bg-hairline-soft text-muted hover:text-text"
            }`}
          >
            {t(`role.short.${r}`)}
          </button>
        ))}
      </div>
      {/* ============================================================================================
          JOB 3065 H6 R10: HIER STAND EIN RÜCKWEG, DER NIE ERREICHBAR WAR.
          ============================================================================================
          Der Hinweis „Vorschau als … — du bleibst Admin" samt Knopf „Zur Admin-Ansicht" hing an
          `previewActive`, also an „eine Fremdrolle ist aktiv". Genau dann aber nimmt der Rollen-Guard
          dem Admin diese Seite weg (`routes.tsx` → `RoleNotice` statt `/admin`), und diese Karte
          wird gar nicht gerendert. Der Knopf war damit sichtbar, solange man ihn nicht braucht, und
          weg, sobald man ihn braucht — eine Scheinfunktion.
          Der echte Rückweg hängt in der Hülle, wo er die Sperre überlebt:
          `apps/web/src/shell/RollenVorschau.tsx` (Zahnrad-Menü, „Zur Admin-Ansicht"). Gemessen im
          Rundweg B1 von `tests/design/h6-funktionsinventar.test.ts`. */}
    </Detailkarte>
  );
}

/**
 * Was eine Rolle darf — die Bereiche, die ihr `minRole` freigibt. Die Liste stammt aus
 * `app/navigation.ts`; die Karte behauptet nichts eigenes.
 */
export function RolleDetail({
  rolle,
  onZurueck,
}: {
  rolle: Role;
  onZurueck: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const worte = freiheitenSchluessel(rolle).map((k) => t(k));
  return (
    <Detailkarte titel={t(`role.name.${rolle}`)} onZurueck={onZurueck} testId="detail-rolle">
      <div className="text-[13px] text-muted">
        {worte.length > 0 ? worte.join(", ") : t("einst.wert.keine")}
        {kiWahlFrei(rolle) ? ` · ${t("einst.rollen.kiWahl")}` : ""}
      </div>
      <ul className="space-y-3">
        {NAV_GROUPS.map((gruppe) => {
          const eintraege = gruppe.items.filter((i) => roleAllows(i, rolle));
          if (eintraege.length === 0) {
            return null;
          }
          return (
            <li key={gruppe.id}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {t(gruppe.titleKey)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {eintraege.map((i) => (
                  <span
                    key={i.id}
                    className="rounded-pill border border-hairline px-2 py-0.5 text-[12px] text-text"
                  >
                    {t(i.labelKey)}
                    {i.stufe2 ? <span className="ml-1 text-brand-text">·2</span> : null}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Detailkarte>
  );
}
