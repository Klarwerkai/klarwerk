import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { Button } from "../components/ui";
import { parseOidcCallback } from "../lib/oidcCallback";

// FR-AUTH-07: SSO-Callback. Liegt VOR dem Auth-Gate (ohne Anmeldung erreichbar).
// Verarbeitet ?code=&state= → tauscht serverseitig (PKCE) gegen die Sitzung,
// zeigt Fehler ehrlich und leitet nach Erfolg auf die App weiter.
export function SsoCallback(): JSX.Element {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const cb = parseOidcCallback(window.location.search);
    if (cb.error) {
      setError(cb.error);
      return;
    }
    if (!cb.code || !cb.state) {
      setError(t("auth.ssoIncomplete"));
      return;
    }
    authApi
      .oidc(cb.code, cb.state)
      .then(() => window.location.assign("/"))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : t("state.error")));
  }, [t]);

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
          <h1 className="text-2xl font-semibold text-ink">{t("auth.ssoTitle")}</h1>
          {error ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg p-4 text-[13px] text-trust-crit-text">
                {error}
              </div>
              <Button variant="ghost" onClick={toSignIn}>
                {t("auth.toSignIn")}
              </Button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted">{t("auth.ssoBusy")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
