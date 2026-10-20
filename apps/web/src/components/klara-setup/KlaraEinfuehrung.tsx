import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type KlaraEinfuehrungStand, assistenzProfilApi } from "../../api/assistenzProfil";
import { useSession } from "../../app/AuthContext";
import { GuardedLink } from "../../app/NavGuardContext";
import {
  assistenzStand,
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  useAssistenzAnzeige,
  useAssistenzStand,
} from "../../lib/assistenzProfil";
import { vorgabeZeitzone } from "../../lib/persoenlicheZeitzone";
import { TutorialBereich } from "../../tutorial/TutorialBereich";
import { EINFUEHRUNG_UEBUNG } from "../../tutorial/einfuehrung/lektion";
import { AvatarBild } from "../assistenz/AvatarBild";
import { KlaraGruppe } from "./KlaraSetup";
const KNOPF =
  "rounded-btn border border-hairline px-3 py-1.5 text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40";
const SCHRITTE = ["gestalten", "arbeitsweise", "uebung", "ergebnis"] as const;
const ZONEN = ["Europe/Berlin", "Europe/London", "America/New_York", "Asia/Tokyo", "UTC"];
function Inhalt({ kontoId }: { kontoId: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const stand = useAssistenzStand();
  const anzeige = useAssistenzAnzeige();
  const start: KlaraEinfuehrungStand = stand.antwort?.profil?.einfuehrung ?? {
    schritt: 0,
    begleitung: "kurz",
    zeitzone: vorgabeZeitzone(),
    abgeschlossen: false,
  };
  const [offen, setOffen] = useState(
    new URLSearchParams(window.location.search).get("einfuehrung") === "1",
  );
  const [wert, setWert] = useState<KlaraEinfuehrungStand>(start);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [ueben, setUeben] = useState(true);
  const speichern = async (neu: KlaraEinfuehrungStand, schliessen = false): Promise<void> => {
    setBusy(true);
    setFehler(false);
    setMeldung("");
    try {
      const a = assistenzStand();
      if (a.kontoId !== kontoId || a.status !== "bereit") throw new Error("Konto nicht bereit");
      const r = await assistenzProfilApi.speichern({
        fassung: a.antwort?.profil?.fassung ?? 0,
        einfuehrung: neu,
      });
      bestaetigeAssistenzProfil(kontoId, r);
      setWert(neu);
      setMeldung(t("klaraeinfuehrung.gespeichert"));
      if (schliessen) setOffen(false);
    } catch {
      setFehler(true);
      setMeldung(t("klaraeinfuehrung.fehler"));
    } finally {
      setBusy(false);
    }
  };
  const schritt = SCHRITTE[wert.schritt] ?? "gestalten";
  const datum = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: wert.zeitzone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  return (
    <KlaraGruppe titel={t("klaraeinfuehrung.titel")} testId="klara-setup-einfuehrung">
      <div className="flex items-center gap-3">
        <span className="relative inline-block h-16 w-16 pt-3">
          <AvatarBild motiv={anzeige.motiv} alt="" ersatzBeschriftung="" className="h-12 w-12" />
          <svg
            viewBox="0 0 64 40"
            className="pointer-events-none absolute -top-1 left-0 h-10 w-14"
            role="img"
          >
            <title>{t("klaraeinfuehrung.hut")}</title>
            <path d="M15 29 30 1 45 29Z" fill="#5e3b91" />
            <ellipse cx="30" cy="30" rx="27" ry="6" fill="#432568" />
            <path d="m30 10 2 5 5 0-4 3 1 5-4-3-4 3 1-5-4-3 5 0Z" fill="#ffd36b" />
          </svg>
        </span>
        <p>{t("klaraeinfuehrung.intro")}</p>
      </div>
      <p className="text-[12px] text-muted">{t("klaraeinfuehrung.warnung")}</p>
      {!offen ? (
        <button
          type="button"
          className={KNOPF}
          data-testid="einfuehrung-start"
          onClick={() => {
            setWert(stand.antwort?.profil?.einfuehrung ?? start);
            setOffen(true);
          }}
        >
          {t(start.abgeschlossen ? "klaraeinfuehrung.erneut" : "klaraeinfuehrung.fortsetzen")}
        </button>
      ) : (
        <div className="space-y-3" data-testid="einfuehrung-offen">
          <p data-testid="einfuehrung-schritt">
            {t("klaraeinfuehrung.schritt", {
              nr: wert.schritt + 1,
              titel: t(`klaraeinfuehrung.${schritt}`),
            })}
          </p>
          <p>{t(`klaraeinfuehrung.${schritt}Kurz`)}</p>
          {wert.begleitung === "ausfuehrlich" ? (
            <p>{t(`klaraeinfuehrung.${schritt}Lang`)}</p>
          ) : null}
          {wert.schritt === 0 ? (
            <button
              type="button"
              className={KNOPF}
              onClick={() => {
                const e = document.querySelector<HTMLInputElement>(
                  '[data-testid="klara-setup-erscheinung"] input',
                );
                e?.scrollIntoView({ block: "center" });
                e?.focus();
              }}
            >
              {t("klaraeinfuehrung.formular")}
            </button>
          ) : null}
          {wert.schritt === 1 ? (
            <>
              <label className="block">
                {t("klaraeinfuehrung.begleitung")}
                <select
                  data-testid="einfuehrung-begleitung"
                  className="ml-2 rounded border border-hairline p-2"
                  value={wert.begleitung}
                  onChange={(ev) =>
                    setWert({ ...wert, begleitung: ev.target.value as typeof wert.begleitung })
                  }
                >
                  <option value="kurz">{t("klaraeinfuehrung.kurz")}</option>
                  <option value="ausfuehrlich">{t("klaraeinfuehrung.ausfuehrlich")}</option>
                </select>
              </label>
              <label className="block">
                {t("klaraeinfuehrung.zone")}
                <select
                  data-testid="einfuehrung-zone"
                  className="ml-2 rounded border border-hairline p-2"
                  value={wert.zeitzone}
                  onChange={(ev) => setWert({ ...wert, zeitzone: ev.target.value })}
                >
                  {[
                    ...new Set([
                      wert.zeitzone,
                      ...ZONEN,
                      ...((
                        Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
                      ).supportedValuesOf?.("timeZone") ?? []),
                    ]),
                  ].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
              <p data-testid="einfuehrung-dst">
                {wert.zeitzone}: {datum("2026-10-25T00:30:00Z")} → {datum("2026-10-25T01:30:00Z")}.{" "}
                {t("klaraeinfuehrung.dst")}
              </p>
              <GuardedLink to="/profil?bereich=klara" className="text-brand-text underline">
                {t("klaraeinfuehrung.hinweise")}
              </GuardedLink>
            </>
          ) : null}
          {wert.schritt === 2 && ueben ? (
            <TutorialBereich
              definition={EINFUEHRUNG_UEBUNG}
              id="einfuehrung-tutorial"
              onSchliessen={() => setUeben(false)}
            />
          ) : null}
          {wert.schritt === 2 && !ueben ? (
            <button type="button" className={KNOPF} onClick={() => setUeben(true)}>
              {t("klaraeinfuehrung.uebung")}
            </button>
          ) : null}
          {wert.schritt === 3 ? (
            <>
              <p>
                {wert.zeitzone} · {t(`klaraeinfuehrung.${wert.begleitung}`)}
              </p>
              <p>{t("klaraeinfuehrung.office")}</p>
              <p>{t("klaraeinfuehrung.sprache")}</p>
              <GuardedLink to="/fragen" className="text-brand-text underline">
                {t("klaraeinfuehrung.zurArbeit")}
              </GuardedLink>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {wert.schritt > 0 ? (
              <button
                type="button"
                className={KNOPF}
                disabled={busy}
                onClick={() =>
                  void speichern({ ...wert, schritt: wert.schritt - 1, abgeschlossen: false })
                }
              >
                {t("klaraeinfuehrung.zurueck")}
              </button>
            ) : null}
            <button
              type="button"
              className={KNOPF}
              disabled={busy}
              data-testid="einfuehrung-weiter"
              onClick={() =>
                void speichern(
                  {
                    ...wert,
                    schritt: Math.min(3, wert.schritt + 1),
                    abgeschlossen: wert.schritt === 3,
                  },
                  wert.schritt === 3,
                )
              }
            >
              {t(wert.schritt === 3 ? "klaraeinfuehrung.beenden" : "klaraeinfuehrung.weiter")}
            </button>
            <button
              type="button"
              className={KNOPF}
              disabled={busy}
              data-testid="einfuehrung-pause"
              onClick={() => void speichern(wert, true)}
            >
              {t("klaraeinfuehrung.pause")}
            </button>
          </div>
        </div>
      )}
      <p role={fehler ? "alert" : "status"}>{meldung}</p>
      {fehler ? (
        <button type="button" className={KNOPF} onClick={() => void ladeAssistenzProfil(kontoId)}>
          {t("klaragedaechtnis.laden")}
        </button>
      ) : null}
    </KlaraGruppe>
  );
}
export function KlaraEinfuehrung(): JSX.Element | null {
  const { user } = useSession();
  const stand = useAssistenzStand();
  return user && stand.kontoId === user.id && stand.status === "bereit" ? (
    <Inhalt key={user.id} kontoId={user.id} />
  ) : null;
}
