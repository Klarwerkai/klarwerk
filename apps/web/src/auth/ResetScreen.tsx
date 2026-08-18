import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { Button, Field, TextInput } from "../components/ui";
// JOB 1097 / D-028 + D-027: dieselbe Markenfläche und dieselbe Sprachwahl wie die Anmeldemaske —
// aus EINER Quelle. Der Markenblock stand hier vorher zeichengleich ein zweites Mal.
import { BrandCompact, BrandPanel, PublicLangSwitch } from "./BrandPanel";

// Passwort-Reset einlösen (FR-AUTH-08). Aufruf über den E-Mail-Link
// https://klarwerk.ai/reset?token=… — ohne Anmeldung erreichbar.
export function ResetScreen(): JSX.Element {
  const { t } = useTranslation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: () => authApi.reset(token, pw),
    onSuccess: () => setDone(true),
    onError: (e: unknown) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const toSignIn = (): void => window.location.assign("/");

  return (
    <div className="flex h-full">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <BrandCompact />
          <div className="mb-4 flex justify-end">
            <PublicLangSwitch />
          </div>
          <h1 className="text-2xl font-semibold text-ink">{t("auth.title.reset")}</h1>
          <p className="mt-1.5 text-sm text-muted">{t("auth.sub.reset")}</p>

          {done ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-4 text-[13px] text-trust-pos-text">
                {t("auth.resetDone")}
              </div>
              <Button variant="primary" className="w-full" onClick={toSignIn}>
                {t("auth.toSignIn")}
              </Button>
            </div>
          ) : !token ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg p-4 text-[13px] text-trust-crit-text">
                {t("auth.resetInvalid")}
              </div>
              <Button variant="ghost" onClick={toSignIn}>
                {t("auth.toSignIn")}
              </Button>
            </div>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                reset.mutate();
              }}
            >
              {/* JOB 1097 / D-023 + D-026: benanntes Feld für den Passwortmanager, Autofokus auf
                  dem einzigen Eingabefeld dieser Maske, und die Längenregel steht VOR der Eingabe
                  statt erst im Fehlschlag. */}
              <Field label={`${t("auth.newPassword")} (${t("auth.passwordRule")})`}>
                <TextInput
                  id="reset-new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              {err ? (
                <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                  {err}
                </div>
              ) : null}

              <Button type="submit" variant="primary" disabled={reset.isPending} className="w-full">
                {t("auth.submit.reset")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
