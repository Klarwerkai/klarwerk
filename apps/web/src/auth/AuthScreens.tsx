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
  const { refresh, oidcEnabled, selfRegistrationEnabled } = useSession();
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
  // ==============================================================================================
  // JOB 4081 — DER MERKER, DER DIE ABSAGE DIESES BESUCHS FESTHÄLT.
  // ==============================================================================================
  //
  // Er behauptet NICHTS über den Serverschalter. Er hält genau eine Tatsache fest: In diesem Besuch
  // hat der Server einen Registrierversuch mit `REGISTRATION_DISABLED` abgewiesen. Ohne ihn stand
  // die Maske nach dem Fehlversuch wieder im Anfangszustand (`go()` löscht `err`) und bot denselben
  // Weg erneut an — die Absage war eine Sackgasse mit Vergessen.
  //
  // BEWUSST NUR IN DER KOMPONENTE, kein Speicher im Browser: Der Merker soll ein Neuladen NICHT
  // überdauern — was der Server heute antwortet, hat er heute zu sagen, und eine Fläche, die aus
  // einem alten Merker heraus behauptet „Zugänge werden vergeben", behauptete mehr, als sie weiß.
  //
  // JOB 4105 — BERICHTIGUNG DER BEGRÜNDUNG, NICHT NUR EINE ERGÄNZUNG. Hier stand bis JOB 4081:
  // „Danach ist unbekannt, was der Server heute antwortet." Das war richtig, solange die Maske den
  // Schalter nur aus einem gescheiterten Versuch erschließen konnte. Seit JOB 4105 ist es das nicht
  // mehr: `selfRegistrationEnabled` kommt aus einer FRISCHEN Statusantwort dieser Sitzung, und die
  // steht nach einem Neuladen sofort wieder zur Verfügung. Der Merker bleibt trotzdem ungespeichert
  // und behauptet weiterhin nichts über den Schalter — er hält die zweite, unabhängige Tatsache
  // fest: In DIESEM Besuch hat der Server einen Versuch abgewiesen. Das deckt den Fall ab, dass der
  // Schalter zwischen Statusabruf und Versuch umgelegt wurde; die Statusantwort ist dann älter als
  // die Absage.
  const [registrierungGeschlossen, setRegistrierungGeschlossen] = useState(false);

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
    //
    // JOB 4081 — ABLÖSUNG, NICHT ERGÄNZUNG. Bis hierher stand die Absage als `setErr(…)` im
    // ALLGEMEINEN Fehlerkasten, derselben Fläche wie ein Vertipper im Passwort. Sie steht jetzt auf
    // einer eigenen Fläche (`auth-registration-closed`) mit dem Ausweg. `setErr` bleibt deshalb
    // ausdrücklich AUS — sonst stünde dieselbe Absage zweimal auf dem Schirm.
    //
    // Kein selbsttätiger Moduswechsel: Wer im Formular steht, bleibt dort stehen, und die
    // eingetippte E-Mail bleibt erhalten. Geleert wird nur das Passwortpaar — es liegt nach einer
    // abgewiesenen Anlage im Klartext im Formular und wird hier nicht mehr gebraucht.
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.code === "REGISTRATION_DISABLED") {
        setRegistrierungGeschlossen(true);
        setPw("");
        setPw2("");
        return;
      }
      onError(e);
    },
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
  // ==============================================================================================
  // JOB 4081 RUNDE 3 — DER KÜRZERE WEG IN DIESELBE ABSAGE (BENs Gegenprobe B1 aus Runde 2).
  // ==============================================================================================
  //
  // Runde 2 schloss den Weg „Anmelden → Registrieren". Offen blieb der kürzere: Lieferung 4 sagt
  // ausdrücklich zu, dass das Formular STEHEN BLEIBT — und dort stand weiter ein Absendeknopf, der
  // `register.mutate()` ein zweites Mal rief. Gemessen: `authApi.register` zweimal statt einmal.
  //
  // Der Merker allein genügt also nicht; er muss auch das Absenden selbst sperren. Beides zusammen
  // gehört hierher, weil beides an derselben Tatsache hängt: Der Server hat diesen Weg in diesem
  // Besuch abgelehnt. `mode === "register"` steht daneben, damit die Sperre NUR den Registrierweg
  // trifft — Anmelden, Passwort vergessen und Ersteinrichtung teilen sich dieses Formular.
  //
  // ==============================================================================================
  // JOB 4105 — DIE ZWEITE, FRÜHERE QUELLE DERSELBEN TATSACHE: DER SERVER SAGT ES VORHER.
  // ==============================================================================================
  //
  // `selfRegistrationEnabled === false` ist die AUSDRÜCKLICHE Auskunft des Servers aus dieser
  // Sitzung (`GET /api/auth/status`). Der Vergleich auf `false` ist kein Stilmittel: Der Wert ist
  // dreiwertig, und `undefined` heißt UNBEKANNT (Antwort steht aus, Backend nicht erreichbar,
  // älterer Server ohne das Feld). Ein `!selfRegistrationEnabled` machte aus jedem Unwissen eine
  // Behauptung — genau das, was diese Maske nicht tun darf.
  //
  // ODER-Verknüpfung, nicht Ersetzung: Die beiden Quellen decken verschiedene Zeitpunkte ab. Der
  // Status ist die frühere (vor jedem Tippen), der Merker die spätere (der Schalter kann zwischen
  // Abruf und Versuch umgelegt worden sein). Es gibt danach nur noch DIESE eine Stelle, an der die
  // Entscheidung fällt — die Fläche im Formular und die Fläche an der Stelle des Verweises hängen
  // beide daran.
  const registrierungZu = registrierungGeschlossen || selfRegistrationEnabled === false;
  const registrierwegZu = mode === "register" && registrierungZu;
  // JOB 4081: `registrierungGeschlossen` wird hier ABSICHTLICH nicht zurückgesetzt. Genau daran
  // hing der Kreis: `err` verschwand bei jedem Moduswechsel, und damit war nach zwei Klicks jede
  // Spur der Absage weg. Eine Tatsache, die der Server berichtet hat, hört durch einen Klick auf
  // „Zurück zur Anmeldung" nicht auf zu gelten.
  const go = (m: Mode): void => {
    setErr(null);
    setPw2("");
    setMode(m);
  };

  // Die Auskunft selbst — an EINER Stelle formuliert und an zwei Stellen gezeigt (im Formular, wo
  // der Versuch gescheitert ist, und an der Stelle des Verweises „Noch kein Konto?").
  // Beide Orte schließen sich über den Modus gegenseitig aus; die Testmarke steht nie doppelt.
  //
  // JOB 4105: ZWEI ANLÄSSE, ZWEI SÄTZE. Der Unterschied ist inhaltlich und nicht kosmetisch.
  // `.fact` (JOB 4081) berichtet über einen soeben abgewiesenen VERSUCH — „Ihre Anlage wurde nicht
  // angenommen". Steht die Auskunft dagegen von vornherein da, hat es keinen Versuch gegeben, über
  // den zu berichten wäre; gesagt wird dann der ZUSTAND der Installation. Ein Satz über einen
  // Versuch, den niemand unternommen hat, wäre eine kleine Unwahrheit an der Stelle, an der diese
  // Maske gerade Vertrauen aufbauen soll.
  const absageFlaeche = (
    <div
      data-testid="auth-registration-closed"
      className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-left text-[12.5px] text-trust-warn-text"
    >
      <p>
        {t(
          registrierungGeschlossen
            ? "auth.registrationClosed.fact"
            : "auth.registrationClosed.upfrontFact",
        )}
      </p>
      <p className="mt-1">
        {t(
          registrierungGeschlossen
            ? "auth.registrationClosed.next"
            : "auth.registrationClosed.upfrontNext",
        )}
      </p>
    </div>
  );

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
                // JOB 4081 RUNDE 3: Hier und nicht nur am Knopf. Die Eingabetaste gibt ein
                // Formular ab, ohne den Absendeknopf zu berühren — ein gesperrter Knopf allein
                // ließe diesen Weg offen. Es wird auch KEIN Fehler gesetzt: die Auskunft steht
                // bereits über dem Formular, ein zweiter Satz daneben sagte dasselbe noch einmal.
                if (registrierwegZu) {
                  return;
                }
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

              {/* JOB 4081: die abgewiesene Registrierung hat ihre eigene Fläche, GENAU HIER — dort,
                  wo der Versuch gerade gescheitert ist, und nicht erst nach einem Moduswechsel. Der
                  allgemeine Kasten darunter bleibt für alles andere zuständig und ist in diesem
                  Fall leer (`register.onError` setzt `err` nicht mehr). */}
              {/* JOB 4105: dieselbe Bedingung, die das Absenden sperrt — die Fläche und die Sperre
                  können nicht mehr auseinanderlaufen. Sie greift jetzt auch ohne Fehlversuch, für
                  den, der bei noch unbeantworteter Statusabfrage ins Formular gegangen ist. */}
              {registrierwegZu ? absageFlaeche : null}

              {err ? (
                <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                  {err}
                </div>
              ) : null}

              {/* JOB 4081 RUNDE 3: gesperrt, sobald der Server diesen Weg abgelehnt hat. Ein Knopf,
                  der nachweislich nichts mehr auslöst, darf nicht bedienbar aussehen — sonst drückt
                  die Person ihn weiter und hält das Ausbleiben jeder Reaktion für einen Fehler der
                  Maske. Die Begründung steht in der Auskunft direkt darüber. */}
              <Button
                type="submit"
                variant="primary"
                disabled={busy || registrierwegZu}
                className="w-full"
              >
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
              {/* JOB 4081: Hat der Server die Selbstregistrierung in diesem Besuch abgelehnt, steht
                  hier die Auskunft statt des Knopfes. Ein Knopf, der nachweislich in dieselbe
                  Absage führt, ist kein Weg. „Passwort vergessen?" darüber bleibt unberührt — das
                  ist der Alltagsfall und hat mit dem Registrierweg nichts zu tun.

                  JOB 4105: Und er führte auch VOR jedem Versuch schon dorthin, sobald der Server
                  die Selbstregistrierung abgeschaltet hat — nur wusste die Maske es nicht. Jetzt
                  fragt sie vorher (`registrierungZu`). Wer kein Konto hat, liest hier von Anfang an
                  den Ausweg, statt ihn sich über vier Felder zu erarbeiten. Bleibt die Antwort aus
                  oder kennt der Server das Feld nicht, steht der Knopf wie bisher: Die Maske
                  behauptet nichts, was sie nicht weiß. */}
              <div>
                {registrierungZu ? (
                  absageFlaeche
                ) : (
                  <button
                    type="button"
                    className="text-muted hover:text-ink"
                    onClick={() => go("register")}
                  >
                    {t("auth.toRegister")}
                  </button>
                )}
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
