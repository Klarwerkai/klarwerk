// JOB 3065 H6 — DAS PROFIL IN DERSELBEN ZEILENKARTE WIE DIE EINSTELLUNGEN.
//
// Kein Kicker, keine Einleitung: Name (Wert = Rolle), E-Mail, Kontodaten berichtigen, Sprache,
// Passwort ändern, die eigene Wirkung und das Abmelden — jede Zeile mit ihrem Wert.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useMyImpact } from "../api/hooks";
import { useSession } from "../app/AuthContext";
// FUNKE F1 (nacht24 Paket 6): „Meine Wirkung" — Zahlen nur über eigene Beiträge.
import { MyImpactNumbers } from "../components/FunkeCards";
// Betroffenenrechte (R-0663, R-0661): „Meine Daten" und der eigene Löschantrag.
import { LoeschantragDetail, MeineDatenDetail } from "../components/datenschutz/MeineDaten";
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

// R-0582 (DS13): DIE EIGENEN KONTODATEN BERICHTIGEN — ohne Antrag, ohne Admin.
//
// Vorbelegt mit dem Stand der Sitzung. Gesendet werden nur geänderte Felder; der neue Stand kommt
// aus der ANTWORT und ersetzt den Sitzungsnutzer sofort (Name in Profil und Kopfzeile). Das
// Passwortfeld erscheint erst, wenn die E-Mail wirklich anders lautet — der Server verlangt es nur
// dann. Die Meldung eines Fehlers ist der Satz des Servers (Adresse vergeben, Passwort falsch).
//
// REINE SSO-KONTEN haben kein Passwort. Für sie (und für jedes verknüpfte Konto) steht daneben
// „Mit SSO bestätigen": der Entwurf wird im Tab (`sessionStorage`) gemerkt, die erneute Anmeldung
// beim eigenen Anbieter läuft über `ziel=profil`, und der Rückruf führt nach
// `/profil?kontodaten=sso` zurück — die Karte öffnet sich mit dem Entwurf, der Server nimmt die
// neue Adresse dann ohne Passwort an (einmal, kurz, nur für diese Sitzung).
//
// BEN, NACHARBEIT 4 — ZWEI REGELN DES RÜCKWEGS:
//   · DER ENTWURF GEHÖRT DEM KONTO, DAS IHN BEGONNEN HAT (`kontoId`). Meldet der Anbieter beim
//     Rückruf ein ANDERES Konto an, wird er verworfen, die Karte zeigt die Daten des jetzt
//     angemeldeten Kontos und sagt, warum. Der Server bestätigt in diesem Fall ohnehin nichts.
//   · EINE ABGELEHNTE BESTÄTIGUNG (abgelaufen, verbraucht, fehlt — Antwort 401/403) setzt den
//     Bestätigungszustand zurück: Passwortfeld und „Mit SSO bestätigen" sind sofort wieder da, die
//     Eingaben bleiben stehen.
export const KONTODATEN_ENTWURF = "kw_kontodaten_entwurf";

interface Entwurf {
  kontoId: string;
  name: string;
  email: string;
}

function entwurfLesen(): Entwurf | null {
  try {
    const roh = window.sessionStorage.getItem(KONTODATEN_ENTWURF);
    const wert = roh
      ? (JSON.parse(roh) as { kontoId?: unknown; name?: unknown; email?: unknown })
      : null;
    return wert &&
      typeof wert.kontoId === "string" &&
      typeof wert.name === "string" &&
      typeof wert.email === "string"
      ? { kontoId: wert.kontoId, name: wert.name, email: wert.email }
      : null;
  } catch {
    return null;
  }
}

function KontodatenDetail({
  onZurueck,
  ausSso,
}: {
  onZurueck: () => void;
  ausSso: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user, oidcEnabled, samlEnabled } = useSession();
  const [entwurf] = useState(() => (ausSso ? entwurfLesen() : null));
  // Der Entwurf ist gelesen — er verlässt den Tab-Speicher erst NACH dem Aufbau (StrictMode ruft
  // den Initialisierer doppelt; dort entfernt, fände der zweite Aufruf nichts mehr).
  useEffect(() => {
    if (ausSso) {
      try {
        window.sessionStorage.removeItem(KONTODATEN_ENTWURF);
      } catch {
        // Ohne Tab-Speicher gibt es nichts zu entfernen.
      }
    }
  }, [ausSso]);
  const [name, setName] = useState(entwurf ? "" : (user?.name ?? ""));
  const [email, setEmail] = useState(entwurf ? "" : (user?.email ?? ""));
  const [passwort, setPasswort] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Die Bestätigung gilt für genau EINE gelungene Adressänderung (Server verbraucht sie).
  const [ssoBestaetigt, setSsoBestaetigt] = useState(false);
  // Erst wenn das angemeldete Konto bekannt ist, wird entschieden, wem die Felder gehören.
  const [vorbelegt, setVorbelegt] = useState(false);
  useEffect(() => {
    if (vorbelegt || !user) {
      return;
    }
    setVorbelegt(true);
    if (entwurf && entwurf.kontoId === user.id) {
      setName(entwurf.name);
      setEmail(entwurf.email);
      setSsoBestaetigt(true);
      setHinweis(t("prof.correctSsoConfirmed"));
      return;
    }
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    if (entwurf) {
      setErr(t("prof.correctSsoKontoGewechselt"));
    }
  }, [vorbelegt, user, entwurf, t]);
  const neueEmail = email.trim() !== (user?.email ?? "");
  // Verknüpfte Firmen-Identität (OIDC oder SAML — beide legen sie über `loginWithOidc` an) und je
  // eingerichtetem Firmen-Login ein Bestätigungsweg. Welcher Anbieter das Konto kennt, entscheidet
  // der Server beim Rücksprung: bestätigt wird nur, wenn er DASSELBE Konto wieder anmeldet.
  const verknuepft = Boolean(user?.oidcSubject);
  const oidcBestaetigung = oidcEnabled && verknuepft;
  const samlBestaetigung = samlEnabled && verknuepft;

  const speichern = useMutation({
    mutationFn: () =>
      authApi.correctAccount({
        ...(name.trim() !== (user?.name ?? "") ? { name: name.trim() } : {}),
        ...(neueEmail
          ? { email: email.trim(), ...(ssoBestaetigt ? {} : { currentPassword: passwort }) }
          : {}),
      }),
    onSuccess: (stand) => {
      qc.setQueryData(["auth", "me"], stand);
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setPasswort("");
      if (neueEmail) {
        setSsoBestaetigt(false);
      }
      setHinweis(t("prof.correctSaved"));
    },
    onError: (e: unknown) => {
      // Abgelehnte Bestätigung: zurück auf „unbestätigt", damit der Weg erneut bedienbar ist.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setSsoBestaetigt(false);
      }
      setErr(e instanceof ApiError ? e.message : t("state.error"));
    },
  });

  const mitSsoBestaetigen = (startUrl: string): void => {
    if (!user) {
      return;
    }
    try {
      const neu: Entwurf = { kontoId: user.id, name: name.trim(), email: email.trim() };
      window.sessionStorage.setItem(KONTODATEN_ENTWURF, JSON.stringify(neu));
    } catch {
      // Ohne Tab-Speicher geht der Entwurf verloren; die Bestätigung selbst gilt trotzdem.
    }
    window.location.assign(startUrl);
  };

  return (
    <Detailkarte titel={t("prof.correctTitle")} onZurueck={onZurueck} testId="detail-kontodaten">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          setHinweis(null);
          if (name.trim() === (user?.name ?? "") && !neueEmail) {
            setHinweis(t("prof.correctUnchanged"));
            return;
          }
          speichern.mutate();
        }}
      >
        <Field label={t("adm.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("adm.email")}>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        {neueEmail && !ssoBestaetigt ? (
          <Field label={t("prof.correctPassword")}>
            <TextInput
              type="password"
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
            />
          </Field>
        ) : null}
        {neueEmail && !ssoBestaetigt && (oidcBestaetigung || samlBestaetigung) ? (
          <div className="flex flex-wrap gap-2">
            {oidcBestaetigung ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => mitSsoBestaetigen(authApi.ssoProfilBestaetigungUrl)}
              >
                {t("prof.correctSso")}
              </Button>
            ) : null}
            {samlBestaetigung ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => mitSsoBestaetigen(authApi.samlProfilBestaetigungUrl)}
              >
                {t("prof.correctSaml")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {err ? (
          <div
            role="alert"
            className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
          >
            {err}
          </div>
        ) : null}
        {hinweis ? (
          <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-3 text-[13px] text-trust-pos-text">
            {hinweis}
          </div>
        ) : null}
        <Button type="submit" variant="primary" disabled={speichern.isPending}>
          {t("prof.correctSubmit")}
        </Button>
      </form>
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
  // R-0582: Rücksprung aus der SSO-Bestätigung (`/profil?kontodaten=sso`) öffnet die Karte wieder.
  const ausSso = new URLSearchParams(useLocation().search).get("kontodaten") === "sso";
  const [detail, setDetail] = useState<
    null | "passwort" | "wirkung" | "kontodaten" | "zweifaktor" | "meineDaten" | "loeschantrag"
  >(ausSso ? "kontodaten" : null);
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
      {detail === "kontodaten" ? <KontodatenDetail onZurueck={zurueck} ausSso={ausSso} /> : null}
      {detail === "zweifaktor" ? <ZweiFaktorDetail onZurueck={zurueck} /> : null}
      {detail === "meineDaten" ? <MeineDatenDetail onZurueck={zurueck} /> : null}
      {detail === "loeschantrag" ? <LoeschantragDetail onZurueck={zurueck} /> : null}
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
          <Zeile
            label={t("prof.correctTitle")}
            onOeffnen={() => setDetail("kontodaten")}
            testId="zeile-kontodaten"
          />
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
            label={t("datenschutz.meineDaten.titel")}
            wert={t("datenschutz.meineDaten.wert")}
            onOeffnen={() => setDetail("meineDaten")}
            testId="zeile-meine-daten"
          />
          <Zeile
            label={t("datenschutz.antrag.titel")}
            onOeffnen={() => setDetail("loeschantrag")}
            testId="zeile-loeschantrag"
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
