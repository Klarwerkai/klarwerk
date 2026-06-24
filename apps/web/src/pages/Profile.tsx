import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../app/AuthContext";
import { Avatar, Button, Card, Field, PageHeader, TextInput } from "../components/ui";

function PasswordChangeCard({ onChanged }: { onChanged: () => void }): JSX.Element {
  const { t } = useTranslation();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: () => authApi.changePassword(oldPw, newPw),
    onSuccess: () => setDone(true),
    onError: (e: unknown) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  if (done) {
    // Backend verwirft beim Passwortwechsel alle Sitzungen — daher neu anmelden.
    return (
      <Card className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">{t("prof.passwordTitle")}</h2>
        <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-4 text-[13px] text-trust-pos-text">
          {t("prof.passwordChanged")}
        </div>
        <Button variant="primary" onClick={onChanged}>
          {t("auth.toSignIn")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-[15px] font-semibold text-ink">{t("prof.passwordTitle")}</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          change.mutate();
        }}
      >
        <Field label={t("prof.oldPassword")}>
          <TextInput
            type="password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
          />
        </Field>
        <Field label={t("prof.newPassword")}>
          <TextInput
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        {err ? (
          <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
            {err}
          </div>
        ) : null}
        <Button type="submit" variant="primary" disabled={change.isPending}>
          {t("prof.passwordSubmit")}
        </Button>
      </form>
    </Card>
  );
}

export function Profile(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const initials = (user?.name ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader kicker={t("prof.kicker")} title={t("nav.profile")} />
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} />
          <div>
            <div className="text-[15px] font-semibold text-text">{user?.name ?? "—"}</div>
            <div className="font-mono text-[12px] text-muted-2">{user?.email ?? ""}</div>
          </div>
          <span className="ml-auto rounded-pill bg-page px-2.5 py-1 text-[12px] font-semibold text-muted">
            {t(`role.name.${user?.role ?? "viewer"}`)}
          </span>
        </div>

        <Field label={t("prof.language")}>
          <div className="flex gap-1.5">
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => void i18n.changeLanguage(l)}
                className={`rounded-btn px-3 py-1.5 text-[13px] font-semibold uppercase ${
                  i18n.language.startsWith(l)
                    ? "bg-ink text-white"
                    : "border border-hairline text-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>

        <div className="border-t border-hairline pt-4">
          <Button
            onClick={() => {
              setBusy(true);
              void signOut();
            }}
            disabled={busy}
          >
            {t("action.logout")}
          </Button>
        </div>
      </Card>

      <PasswordChangeCard onChanged={() => void signOut()} />
    </div>
  );
}
