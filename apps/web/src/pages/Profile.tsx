// JOB 3065 H6 — DAS PROFIL IN DERSELBEN ZEILENKARTE WIE DIE EINSTELLUNGEN.
//
// Kein Kicker, keine Einleitung: Name (Wert = Rolle), E-Mail, Sprache, Passwort ändern, die eigene
// Wirkung und das Abmelden — jede Zeile mit ihrem Wert, die Karten dahinter unverändert.
import { useMutation } from "@tanstack/react-query";
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

const SPRACHEN = ["de", "en", "nl"] as const;

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

export function Profile(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<null | "passwort" | "wirkung">(null);
  const zurueck = (): void => setDetail(null);

  return (
    <EinstellungenSeite titel={t("nav.profile")} seitenSchluessel="profil">
      {detail === "passwort" ? (
        <PasswortDetail onZurueck={zurueck} onChanged={() => void signOut()} />
      ) : null}
      {detail === "wirkung" ? <WirkungDetail onZurueck={zurueck} /> : null}
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
