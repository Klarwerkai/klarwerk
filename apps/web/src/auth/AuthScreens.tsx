import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../app/AuthContext";
import { Button, Field, TextInput } from "../components/ui";
// AUFTRAG-mega61 Block A/B/D: Fußbereich, Hinweistext und der Satz nach einer Ablehnung. Der
// ABLAUF dieser Maske — die sechs Zustände, ihre Übergänge, die Mutationen — bleibt unangetastet;
// hinzu kommen ausschließlich Anzeigeflächen unterhalb des Formulars.
import { LegalFooter } from "../legal/LegalPages";
import { NoticeText, takeDeclineMarker } from "../legal/NoticeBanner";
// JOB 1097 / D-028 + D-027: Markenfläche und Sprachwahl liegen als EINE Quelle daneben. Der
// Markenblock stand vorher zeichengleich auch in `ResetScreen.tsx` — jede Änderung hätte an beide
// Stellen gemusst, sonst wären sie auseinandergelaufen.
import { BrandCompact, BrandPanel, PublicLangSwitch } from "./BrandPanel";

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
  // AUFTRAG-mega61 Block D: Wer den Hinweis abgelehnt hat, landet nach dem Abmelden hier. Ohne
  // diesen Satz stünde er vor einer Anmeldemaske ohne Erklärung — eine Sackgasse mit Gedächtnis.
  // Einmalig beim ersten Rendern gelesen UND gelöscht (`useState`-Initialisierer), damit der Satz
  // nicht bei jedem späteren Zustandswechsel wieder auftaucht.
  const [declined] = useState(takeDeclineMarker);

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

  // JOB 1097 / D-026: die Längenregel gilt überall dort, wo ein NEUES Passwort gesetzt wird — bei
  // der Anmeldung gilt sie nicht, und dort steht sie deshalb auch nicht.
  const neuesPasswort = mode === "register" || mode === "setup";
  const passwortLabel = neuesPasswort
    ? `${t("auth.password")} (${t("auth.passwordRule")})`
    : t("auth.password");

  return (
    <div className="flex h-full">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <BrandCompact />
          {/* D-027: die Sprachwahl steht VOR dem Formular — wer die Maske nicht liest, soll sie
              nicht erst suchen müssen. */}
          <div className="mb-4 flex justify-end">
            <PublicLangSwitch />
          </div>
          <h1 className="text-2xl font-semibold text-ink">{t(`auth.title.${mode}`)}</h1>
          <p className="mt-1.5 text-sm text-muted">{t(`auth.sub.${mode}`)}</p>

          {declined ? (
            <div
              data-testid="auth-declined-hint"
              className="mt-4 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-[12.5px] text-trust-warn-text"
            >
              {t("notice.decline.loginHint")}
            </div>
          ) : null}

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
              {/* JOB 1097 / D-023: `id`, `name` und `autoComplete` an JEDEM Feld. Ohne sie hat ein
                  Passwortmanager keinen einzigen Anhaltspunkt — repo-weit gab es genau EIN
                  `autoComplete`, auf der Adminseite. `TextInput` reicht alle Input-Attribute per
                  `...props` durch; es braucht keinen Umbau, nur Attribute an der Aufrufstelle.

                  Der Autofokus steht auf dem ERSTEN Feld des jeweiligen Modus: bei Registrieren
                  und Ersteinrichtung ist das der Name, sonst die E-Mail. */}
              {neuesPasswort ? (
                <Field label={t("auth.name")}>
                  <TextInput
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
              ) : null}
              <Field label={t("auth.email")}>
                <TextInput
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus={!neuesPasswort}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              {mode !== "forgot" ? (
                <Field label={passwortLabel}>
                  <TextInput
                    id="auth-password"
                    name="password"
                    type="password"
                    // Der Unterschied ist kein Detail: `current-password` lässt den Manager das
                    // gespeicherte Passwort anbieten, `new-password` schlägt ein neues vor.
                    autoComplete={neuesPasswort ? "new-password" : "current-password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    minLength={mode === "login" ? undefined : 8}
                    required
                  />
                </Field>
              ) : null}
              {neuesPasswort ? (
                <div className="space-y-1.5">
                  <Field label={t("auth.passwordRepeat")}>
                    <TextInput
                      id="auth-password-repeat"
                      name="password-repeat"
                      type="password"
                      autoComplete="new-password"
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

          {/* JOB 1097 / D-025 (a): Trenner UND SSO-Satz erscheinen nur, wenn SSO überhaupt
              vorgesehen ist. Vorher rendered die Maske im `else`-Zweig zwei Zeilen für eine
              Nicht-Funktion — und `oidcEnabled` hat den Vorgabewert `false`, das stand auf einer
              Instanz ohne OIDC also DAUERHAFT da. Ein „oder"-Trenner, auf den nichts folgt, ist
              zudem ein Trenner ohne zweite Seite. */}
          {mode === "login" && !needsSetup && oidcEnabled ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-2">
                <span className="h-px flex-1 bg-hairline" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => window.location.assign(authApi.ssoStartUrl)}
              >
                {t("auth.ssoButton")}
              </Button>
            </div>
          ) : null}

          {/* D-025 (b): Reihenfolge und Gewicht getauscht. „Passwort vergessen?" ist der
              Alltagsfall und stand vorher unten und leise; „Registrieren" trifft die meisten
              Besucher genau einmal und stand oben und halbfett. */}
          {!needsSetup && mode === "login" ? (
            <div className="mt-5 space-y-2 text-center text-[13px] text-muted">
              <button type="button" className="font-semibold text-ink" onClick={() => go("forgot")}>
                {t("auth.toForgot")}
              </button>
              <div>
                <button
                  type="button"
                  className="text-muted hover:text-ink"
                  onClick={() => go("register")}
                >
                  {t("auth.toRegister")}
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

          {/* AUFTRAG-mega61 Block B: derselbe Hinweis wie in der Anwendung, aber als schlichter
              Textabsatz OHNE Knöpfe. Hier beginnt die Datenerhebung, also gehört die Information
              hierher — es gibt aber noch kein Konto, an dem sich eine Kenntnisnahme vermerken
              ließe, und ein Knopf, der nichts vermerken kann, wäre eine Geste ohne Wirkung. */}
          <div className="mt-8 border-t border-hairline pt-4">
            <NoticeText />
            {/* AUFTRAG-mega61 Block A: der Fußbereich MUSS hier stehen — § 5 DDG verlangt das
                Impressum von jeder Seite, und die Datenschutzerklärung muss vor der ersten
                Datenerhebung verfügbar sein. Diese Maske IST die erste Datenerhebung. */}
            <LegalFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
