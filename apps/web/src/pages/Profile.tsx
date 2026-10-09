// JOB 3065 H6 — DAS PROFIL IN DERSELBEN ZEILENKARTE WIE DIE EINSTELLUNGEN.
//
// Kein Kicker, keine Einleitung: Name (Wert = Rolle), E-Mail, Sprache, Passwort ändern, die eigene
// Wirkung und das Abmelden — jede Zeile mit ihrem Wert, die Karten dahinter unverändert.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useMyImpact } from "../api/hooks";
import { useSession } from "../app/AuthContext";
// FUNKE F1 (nacht24 Paket 6): „Meine Wirkung" — Zahlen nur über eigene Beiträge.
import { MyImpactNumbers } from "../components/FunkeCards";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { EinstellungenSeite } from "../components/einstellungen/Seite";
import { Zeile, Zeilenkarte } from "../components/einstellungen/Zeilenkarte";
import { Avatar, Button, Field, TextInput } from "../components/ui";
import { OBERFLAECHEN_SPRACHEN as SPRACHEN } from "../lib/sprachregister";
import { useSeitenhilfeAnmeldung } from "../shell/SeitenhilfeContext";

function WirkungDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const impact = useMyImpact();
  return (
    <Detailkarte titel={t("funke.impact.title")} onZurueck={onZurueck} testId="detail-wirkung">
      {/* JOB 3065 R3 (BENs Korrekturpflicht 1): Hier stand `QueryState`. Der zeigt bei einem Fehler
          die technische Meldung der Schnittstelle („Service Unavailable") und bietet KEINEN Ausweg.
          Dieselbe Hülle wie in allen anderen Detailkarten sagt „nicht abrufbar" und hat den Knopf,
          der die Zahlen wirklich neu holt. */}
      <Abfragehuelle abfrage={impact}>
        {(daten) => <MyImpactNumbers impact={daten} />}
      </Abfragehuelle>
    </Detailkarte>
  );
}

// ================================================================================================
// JOB 3065 · H6 R10 — DIE SPRACHWAHL STEHT IN DER ZEILE, NICHT HINTER EINEM CHEVRON.
// ================================================================================================
//
// Bis Runde 9 lag sie in einer Detailkarte. Das hat eine Zusage von JOB 3060 gebrochen: dessen
// Funktionsinventar hält fest, dass die Sprachpille aus der alten Topbar nach `/profil` in die
// Zeile „Sprache" gewandert ist, und misst sie an der gebauten Seite OHNE weiteren Klick
// (`tests/design/h1-funktionsinventar.test.ts`, Fall `P-sprache`: drei Knöpfe de/en/nl in `main`).
// Hinter dem Chevron fand der Test nichts — eine verlorene Funktion im Sinne des Inventars.
//
// Drei Knöpfe brauchen keine eigene Karte: sie passen als Bedienelement RECHTS in die Zeile, genau
// wie das Häkchen „Erweiterte Module" in den Einstellungen. Der aktive Knopf IST der Wert, deshalb
// trägt die Zeile keinen zusätzlichen Werttext — er stünde sonst zweimal da.
const SPRACH_KNOEPFE = "sprach-knoepfe";

function SprachWahl(): JSX.Element {
  const { i18n } = useTranslation();
  return (
    /* E2E-020: Profil-Sprachwahl auf DE/EN/NL wie im Header — NL war hier zuvor nicht wählbar. */
    <span data-testid={SPRACH_KNOEPFE} className="flex gap-1.5">
      {SPRACHEN.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={i18n.language.startsWith(l)}
          onClick={() => void i18n.changeLanguage(l)}
          className={`rounded-btn px-2.5 py-1 text-[13px] font-semibold uppercase ${
            i18n.language.startsWith(l) ? "bg-ink text-white" : "border border-hairline text-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </span>
  );
}

function PasswortDetail({
  onZurueck,
  onChanged,
}: {
  onZurueck: () => void;
  onChanged: () => void;
}): JSX.Element {
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

  return (
    <Detailkarte titel={t("prof.passwordTitle")} onZurueck={onZurueck} testId="detail-passwort">
      {done ? (
        // Backend verwirft beim Passwortwechsel alle Sitzungen — daher neu anmelden.
        <>
          <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-4 text-[13px] text-trust-pos-text">
            {t("prof.passwordChanged")}
          </div>
          <Button variant="primary" onClick={onChanged}>
            {t("auth.toSignIn")}
          </Button>
        </>
      ) : (
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
      )}
    </Detailkarte>
  );
}

// ================================================================================================
// R-0562 — DIE EIGENE ZWEI-FAKTOR-ANMELDUNG: einrichten (Passwort → Schlüssel → ersten Code
// bestätigen) und ausschalten (Passwort + aktueller Code). Ohne Firmen-Anmeldedienst.
// ================================================================================================
type Einrichtung = { secret: string; otpauthUri: string };

function knopfSchluessel(aktiv: boolean, eingerichtet: boolean): string {
  if (aktiv) {
    return "zweifaktor.profil.ausschalten";
  }
  return eingerichtet ? "zweifaktor.profil.bestaetigen" : "zweifaktor.profil.starten";
}

function ZweiFaktorDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ZWEI_FAKTOR_KEY, queryFn: authApi.secondFactorStatus });
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [einrichtung, setEinrichtung] = useState<Einrichtung | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onError = (e: unknown): void =>
    setErr(e instanceof ApiError ? e.message : t("state.error"));
  const fertig = (text: string): void => {
    setPw("");
    setCode("");
    setEinrichtung(null);
    setMeldung(text);
    void queryClient.invalidateQueries({ queryKey: ZWEI_FAKTOR_KEY });
  };

  const starten = useMutation({
    mutationFn: () => authApi.secondFactorSetup(pw),
    onSuccess: (daten) => {
      setPw("");
      setEinrichtung(daten);
    },
    onError,
  });
  const bestaetigen = useMutation({
    mutationFn: () => authApi.secondFactorConfirm(code),
    onSuccess: () => fertig(t("zweifaktor.profil.eingeschaltet")),
    onError,
  });
  const ausschalten = useMutation({
    mutationFn: () => authApi.secondFactorDisable(pw, code),
    onSuccess: () => fertig(t("zweifaktor.profil.ausgeschaltet")),
    onError,
  });
  const aktiv = status.data?.active === true;

  const passwortFeld = (
    <Field label={t("prof.oldPassword")}>
      <TextInput
        type="password"
        autoComplete="current-password"
        data-testid="zweifaktor-passwort"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        required
      />
    </Field>
  );
  const codeFeld = (
    <Field label={t("zweifaktor.code")}>
      <TextInput
        autoComplete="one-time-code"
        inputMode="numeric"
        data-testid="zweifaktor-code"
        maxLength={7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
    </Field>
  );

  return (
    <Detailkarte
      titel={t("zweifaktor.profil.titel")}
      onZurueck={onZurueck}
      testId="detail-zweifaktor"
    >
      <p className="text-[13px] text-muted">{t("zweifaktor.profil.einleitung")}</p>
      {meldung ? (
        <div
          data-testid="zweifaktor-meldung"
          className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-4 text-[13px] text-trust-pos-text"
        >
          {meldung}
        </div>
      ) : null}
      <Abfragehuelle abfrage={status}>
        {() => (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              setMeldung(null);
              if (aktiv) {
                ausschalten.mutate();
              } else if (einrichtung) {
                bestaetigen.mutate();
              } else {
                starten.mutate();
              }
            }}
          >
            {/* Eingeschaltet: Passwort + Code. Aus: erst Passwort, dann Schlüssel + Code. */}
            {aktiv || einrichtung === null ? passwortFeld : null}
            {!aktiv && einrichtung !== null ? (
              <div className="space-y-2">
                <p className="text-[13px] text-ink">{t("zweifaktor.profil.schluessel")}</p>
                {/* Vierergruppen zum Abtippen; Leerzeichen ignoriert jede Authenticator-App. */}
                <code
                  data-testid="zweifaktor-schluessel"
                  className="block break-all rounded-btn bg-surface-2 px-3 py-2 font-mono text-[14px] tracking-wider text-ink"
                >
                  {einrichtung.secret.replace(/(.{4})/g, "$1 ").trim()}
                </code>
                <a
                  href={einrichtung.otpauthUri}
                  className="text-[13px] font-semibold text-ink underline"
                >
                  {t("zweifaktor.profil.link")}
                </a>
              </div>
            ) : null}
            {aktiv || einrichtung !== null ? codeFeld : null}
            {err ? (
              <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                {err}
              </div>
            ) : null}
            <Button
              type="submit"
              variant={aktiv ? "danger" : "primary"}
              data-testid="zweifaktor-absenden"
              disabled={starten.isPending || bestaetigen.isPending || ausschalten.isPending}
            >
              {t(knopfSchluessel(aktiv, einrichtung !== null))}
            </Button>
          </form>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

const ZWEI_FAKTOR_KEY = ["auth", "second-factor"] as const;

export function Profile(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<null | "passwort" | "wirkung" | "zweifaktor">(null);
  const zweiFaktor = useQuery({ queryKey: ZWEI_FAKTOR_KEY, queryFn: authApi.secondFactorStatus });
  const zurueck = (): void => setDetail(null);
  // JOB 3742 · DIE SEITENHILFE DIESER FLÄCHE — und warum hier der HAKEN steht und nicht der
  // Baustein, den die anderen fünf Seiten dieses Auftrags nehmen.
  //
  // `tests/design/zielbild-h6-kein-erklaertext.test.ts` (Fall Q) zählt im Quelltext der
  // Einstellungs- und Profilseiten die Vorkommen jenes Bausteins und verlangt NULL: JOB 3065 hat
  // die zwölf Sprechblasen dieser Flächen in die „?"-Menüs der Detailkarten verlegt, und diese
  // Zusage gilt weiter. Der Baustein ist ohnehin nur eine Hülle um genau diesen Haken
  // (`components/`, seit JOB 3060 · H1) — der Weg ist derselbe, kein zweiter. Die Anmeldung steht
  // VOR der Fallunterscheidung „Detailkarte oder Zeilenliste": sie beschreibt die Seite und bleibt
  // deshalb auch stehen, während eine Detailkarte offen ist.
  useSeitenhilfeAnmeldung(t("seitenhilfe.profil.titel"), t("seitenhilfe.profil.text"));

  return (
    <EinstellungenSeite titel={t("nav.profile")} seitenSchluessel="profil">
      {detail === "passwort" ? (
        <PasswortDetail onZurueck={zurueck} onChanged={() => void signOut()} />
      ) : null}
      {detail === "wirkung" ? <WirkungDetail onZurueck={zurueck} /> : null}
      {detail === "zweifaktor" ? <ZweiFaktorDetail onZurueck={zurueck} /> : null}
      {detail === null ? (
        <Zeilenkarte>
          <Zeile
            label={user?.name ?? "—"}
            // Das Kürzelzeichen des eigenen Kontos — dieselbe Darstellung wie bisher im Profilkopf.
            vorn={<Avatar initials={(user?.name ?? "??").slice(0, 2).toUpperCase()} />}
            wert={t(`role.name.${user?.role ?? "viewer"}`)}
            testId="zeile-name"
          />
          <Zeile label={t("adm.email")} wert={user?.email ?? "—"} testId="zeile-email" />
          <Zeile label={t("prof.language")} steuerung={<SprachWahl />} testId="zeile-sprache" />
          <Zeile
            label={t("prof.passwordTitle")}
            onOeffnen={() => setDetail("passwort")}
            testId="zeile-passwort"
          />
          <Zeile
            label={t("zweifaktor.profil.titel")}
            // Unbekannt (Abfrage läuft oder scheitert) ist weder „Ein" noch „Aus".
            wert={
              zweiFaktor.data === undefined
                ? "—"
                : t(zweiFaktor.data.active ? "zweifaktor.profil.ein" : "zweifaktor.profil.aus")
            }
            onOeffnen={() => setDetail("zweifaktor")}
            testId="zeile-zweifaktor"
          />
          <Zeile
            label={t("funke.impact.title")}
            onOeffnen={() => setDetail("wirkung")}
            testId="zeile-wirkung"
          />
          <Zeile
            label={t("prof.kicker")}
            wert={t("action.logout")}
            ton="kritisch"
            ohneSymbol
            testId="zeile-abmelden"
            onOeffnen={() => {
              if (busy) {
                return;
              }
              setBusy(true);
              void signOut();
            }}
          />
        </Zeilenkarte>
      ) : null}
    </EinstellungenSeite>
  );
}
