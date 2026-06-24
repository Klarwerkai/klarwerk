import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../app/AuthContext";
import { Button, Field, TextInput } from "../components/ui";

type Mode = "login" | "register" | "waiting" | "setup";

// Auth/Onboarding (BRIEF §6.1 / §7.2). Vollbild, 2-spaltig: dunkles Marken-
// Panel links, Formular rechts. Sub-Zustände inkl. Ersteinrichtung.
export function AuthScreens({ needsSetup }: { needsSetup: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const [mode, setMode] = useState<Mode>(needsSetup ? "setup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onError = (e: unknown): void =>
    setErr(e instanceof ApiError ? e.message : t("state.error"));

  const login = useMutation({
    mutationFn: () => authApi.login(email, pw),
    onSuccess: () => refresh(),
    onError,
  });
  const register = useMutation({
    mutationFn: () => authApi.register(name, email, pw),
    onSuccess: () => setMode("waiting"),
    onError,
  });
  const setup = useMutation({
    mutationFn: () => authApi.setup(name, email, pw),
    onSuccess: () => refresh(),
    onError,
  });

  const busy = login.isPending || register.isPending || setup.isPending;
  const go = (m: Mode): void => {
    setErr(null);
    setMode(m);
  };

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
          <h1 className="text-2xl font-semibold text-ink">{t(`auth.title.${mode}`)}</h1>
          <p className="mt-1.5 text-sm text-muted">{t(`auth.sub.${mode}`)}</p>

          {mode === "waiting" ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-4 text-[13px] text-trust-warn-text">
                {t("auth.waitingNote")}
              </div>
              <Button variant="ghost" onClick={() => go("login")}>
                {t("auth.backToLogin")}
              </Button>
            </div>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                if (mode === "login") {
                  login.mutate();
                } else if (mode === "register") {
                  register.mutate();
                } else {
                  setup.mutate();
                }
              }}
            >
              {mode !== "login" ? (
                <Field label={t("auth.name")}>
                  <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
              ) : null}
              <Field label={t("auth.email")}>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label={t("auth.password")}>
                <TextInput
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={mode === "login" ? undefined : 8}
                  required
                />
              </Field>

              {err ? (
                <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                  {err}
                </div>
              ) : null}

              <Button type="submit" variant="primary" disabled={busy} className="w-full">
                {t(`auth.submit.${mode}`)}
              </Button>
            </form>
          )}

          {!needsSetup && mode !== "waiting" ? (
            <div className="mt-5 text-center text-[13px] text-muted">
              {mode === "login" ? (
                <button
                  type="button"
                  className="font-semibold text-ink"
                  onClick={() => go("register")}
                >
                  {t("auth.toRegister")}
                </button>
              ) : (
                <button
                  type="button"
                  className="font-semibold text-ink"
                  onClick={() => go("login")}
                >
                  {t("auth.toLogin")}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
