import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../app/AuthContext";
import { Button, Field, TextInput } from "../components/ui";

type Mode = "login" | "register" | "waiting" | "setup" | "forgot" | "forgotSent";

// Auth/Onboarding (BRIEF §6.1 / §7.2). Vollbild, 2-spaltig: dunkles Marken-
// Panel links, Formular rechts. Sub-Zustände inkl. Ersteinrichtung.
export function AuthScreens({ needsSetup }: { needsSetup: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { refresh, oidcEnabled } = useSession();
  const [mode, setMode] = useState<Mode>(needsSetup ? "setup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  // Sicherheit: Passwort-Bestätigung bei Account-Erstellung (register/setup) — ein Vertipper
  // im einzigen Passwortfeld würde sonst still ein falsches Passwort setzen (Aussperrung).
  const [pw2, setPw2] = useState("");
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
    // WP-VIP2-GATE (bens P1): abgeschaltete Selbstregistrierung (Server-Schalter, 403) wird
    // lokalisiert erklärt statt die rohe Server-Meldung zu zeigen.
    onError: (e: unknown) =>
      e instanceof ApiError && e.code === "REGISTRATION_DISABLED"
        ? setErr(t("auth.registrationDisabled"))
        : onError(e),
  });
  const setup = useMutation({
    mutationFn: () => authApi.setup(name, email, pw),
    onSuccess: () => refresh(),
    onError,
  });
  const forgot = useMutation({
    mutationFn: () => authApi.forgot(email),
    onSuccess: () => setMode("forgotSent"),
    onError,
  });

  const busy = login.isPending || register.isPending || setup.isPending || forgot.isPending;
  const go = (m: Mode): void => {
    setErr(null);
    setPw2("");
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

          {mode === "waiting" || mode === "forgotSent" ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-4 text-[13px] text-trust-warn-text">
                {t(mode === "waiting" ? "auth.waitingNote" : "auth.forgotNote")}
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
                // Passwort-Bestätigung erzwingen, bevor ein Konto angelegt wird.
                if ((mode === "register" || mode === "setup") && pw !== pw2) {
                  setErr(t("auth.passwordMismatch"));
                  return;
                }
                if (mode === "login") {
                  login.mutate();
                } else if (mode === "register") {
                  register.mutate();
                } else if (mode === "forgot") {
                  forgot.mutate();
                } else {
                  setup.mutate();
                }
              }}
            >
              {mode === "register" || mode === "setup" ? (
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
              {mode !== "forgot" ? (
                <Field label={t("auth.password")}>
                  <TextInput
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    minLength={mode === "login" ? undefined : 8}
                    required
                  />
                </Field>
              ) : null}
              {mode === "register" || mode === "setup" ? (
                <div className="space-y-1.5">
                  <Field label={t("auth.passwordRepeat")}>
                    <TextInput
                      type="password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      minLength={8}
                      required
                    />
                  </Field>
                  {pw2.length > 0 && pw !== pw2 ? (
                    <p className="text-[12px] text-trust-crit-text">{t("auth.passwordMismatch")}</p>
                  ) : null}
                </div>
              ) : null}

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

          {mode === "login" && !needsSetup ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-2">
                <span className="h-px flex-1 bg-hairline" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-hairline" />
              </div>
              {oidcEnabled ? (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => window.location.assign(authApi.ssoStartUrl)}
                >
                  {t("auth.ssoButton")}
                </Button>
              ) : (
                <p className="text-center text-[12px] text-muted-2">{t("auth.ssoUnavailable")}</p>
              )}
            </div>
          ) : null}

          {!needsSetup && mode === "login" ? (
            <div className="mt-5 space-y-2 text-center text-[13px] text-muted">
              <button
                type="button"
                className="font-semibold text-ink"
                onClick={() => go("register")}
              >
                {t("auth.toRegister")}
              </button>
              <div>
                <button
                  type="button"
                  className="text-muted hover:text-ink"
                  onClick={() => go("forgot")}
                >
                  {t("auth.toForgot")}
                </button>
              </div>
            </div>
          ) : null}
          {!needsSetup && (mode === "register" || mode === "forgot") ? (
            <div className="mt-5 text-center text-[13px] text-muted">
              <button type="button" className="font-semibold text-ink" onClick={() => go("login")}>
                {t("auth.toLogin")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
