// produkt:20261011:assistenz-programmadapter (BPA-04) — WAS DIE ASSISTENZ IN WELCHEM PROGRAMM KANN.
//
// Steht in „Meine Assistenz" (Einstellungen → Persönliche Einstellungen), also im bestehenden
// Assistenzfenster — kein eigenes Fenster je Programm. Gelesen wird `GET /api/klara/programme`:
// je Programm Stand (real geprüft / gebaut ohne realen Lauf / nicht geliefert), die macOS-Fassung,
// Lesen, Auswahl, Schreiben, Ergebnisprüfung, Rücknahme und die Grenzsätze des Servers. Nicht
// gelieferte Programme stehen ausdrücklich als „Nicht geliefert" da; ein Word-Erfolg färbt nie ab.
//
// Der Code für den Mac-Begleiter kommt aus dem BESTEHENDEN Übergabeweg der Anmeldung
// (`POST /api/auth/office-handover`, 120 s, einmalig) — keine zweite Anmeldung.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type BegleiterCode,
  type Faehigkeit,
  type FaehigkeitsStand,
  type ProgrammSicht,
  programmeApi,
} from "../../api/programme";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { Button } from "../ui";

const PROGRAMME_KEY = ["klara", "programme"] as const;

const FAEHIGKEITEN: ReadonlyArray<{ f: Faehigkeit; schluessel: string }> = [
  { f: "lesen", schluessel: "programme.faehigkeit.lesen" },
  { f: "auswahl", schluessel: "programme.faehigkeit.auswahl" },
  { f: "schreiben", schluessel: "programme.faehigkeit.schreiben" },
  { f: "ergebnispruefung", schluessel: "programme.faehigkeit.ergebnispruefung" },
  { f: "ruecknahme", schluessel: "programme.faehigkeit.ruecknahme" },
];

const STAND: Record<FaehigkeitsStand, string> = {
  "real-belegt": "programme.stand.real-belegt",
  "gebaut-ohne-hostbeleg": "programme.stand.gebaut-ohne-hostbeleg",
  "nicht-geliefert": "programme.stand.nicht-geliefert",
  ausgeschlossen: "programme.stand.ausgeschlossen",
};

function statusSchluessel(p: ProgrammSicht): string {
  if (p.geliefert) {
    return "programme.status.geliefert";
  }
  return p.weg === "keiner" ? "programme.status.nichtGeliefert" : "programme.status.gebaut";
}

export function ProgrammeUebersicht(): JSX.Element {
  const { t } = useAssistenzT();
  const abfrage = useQuery({ queryKey: PROGRAMME_KEY, queryFn: programmeApi.lesen });
  const [code, setCode] = useState<BegleiterCode | null>(null);
  const [codeFehler, setCodeFehler] = useState(false);

  const codeErzeugen = (): void => {
    setCodeFehler(false);
    programmeApi.begleiterCode().then(
      (neu) => setCode(neu),
      () => {
        setCode(null);
        setCodeFehler(true);
      },
    );
  };

  return (
    <section data-testid="programme-uebersicht" className="space-y-3 pt-4">
      <h3 className="text-[14px] font-semibold">{t("programme.titel")}</h3>
      <p className="text-[13px] text-muted">{t("programme.intro")}</p>
      {abfrage.isPending ? <p className="text-[12.5px]">{t("programme.laden")}</p> : null}
      {abfrage.isError ? (
        <div role="alert" className="space-y-2 text-[12.5px] text-trust-crit-text">
          <p>{t("programme.fehler")}</p>
          <Button variant="outline" onClick={() => void abfrage.refetch()}>
            {t("programme.wiederholen")}
          </Button>
        </div>
      ) : null}
      {abfrage.data ? (
        <ul className="space-y-3">
          {abfrage.data.programme.map((p) => (
            <li
              key={p.programm}
              data-testid={`programm-${p.programm}`}
              data-geliefert={p.geliefert ? "ja" : "nein"}
              className="rounded-btn border border-hairline px-3 py-2 text-[12.5px]"
            >
              <p className="font-semibold">
                {p.anzeigename} ·{" "}
                <span data-testid="programm-status">{t(statusSchluessel(p))}</span>
              </p>
              {p.os.unterstuetzt ? (
                <p data-testid="programm-os">
                  {t("programme.os", {
                    fassung: p.os.unterstuetzt,
                    geprueft: p.os.realGeprueft ?? t("programme.os.offen"),
                  })}
                </p>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3">
                {FAEHIGKEITEN.map(({ f, schluessel }) => (
                  <div key={f} className="contents">
                    <dt>{t(schluessel)}</dt>
                    <dd data-testid={`faehigkeit-${f}`} title={p.faehigkeiten[f].grenze}>
                      {t(STAND[p.faehigkeiten[f].stand])}
                    </dd>
                  </div>
                ))}
              </dl>
              {p.bedienungshilfeLesen ? (
                <p>{t("programme.bedienungshilfe", { stand: t(STAND[p.bedienungshilfeLesen]) })}</p>
              ) : null}
              <ul className="list-disc pl-5 text-muted">
                {p.grenzen.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-2 rounded-btn border border-hairline px-3 py-2 text-[12.5px]">
        <h4 className="font-semibold">{t("programme.begleiter.titel")}</h4>
        <p>{t("programme.begleiter.text")}</p>
        <Button variant="outline" data-testid="begleiter-code" onClick={codeErzeugen}>
          {t("programme.begleiter.knopf")}
        </Button>
        {code ? (
          <output data-testid="begleiter-code-wert" className="block font-mono">
            {t("programme.begleiter.code", { code: code.code })}
          </output>
        ) : null}
        {codeFehler ? <p role="alert">{t("programme.begleiter.fehler")}</p> : null}
      </div>
    </section>
  );
}
