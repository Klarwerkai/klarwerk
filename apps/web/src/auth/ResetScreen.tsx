import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { Button, Field, TextInput } from "../components/ui";

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
      <div className="hidden w-1/2 flex-col justify-between bg-ink p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="6.5" fill="none" stroke="#ED7D0E" strokeWidth="3.4" />
              <circle cx="10" cy="10" r="3" fill="#ED7D0E" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-[2px]">KLARWERK</span>
            <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-white/50">
              Reasoning System
            </span>
          </span>
        </div>
        <div className="max-w-sm">
          <p className="text-xl font-semibold leading-snug">{t("auth.tagline")}</p>
          <p className="mt-3 text-sm text-white/60">{t("auth.taglineSub")}</p>
        </div>
        <div className="font-mono text-[11px] text-white/40">klarwerk.ai</div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
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
              <Field label={t("auth.newPassword")}>
                <TextInput
                  type="password"
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
