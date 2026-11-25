import { useState } from "react";
import { ApiError } from "../../api/client";
import { type NotizModell, type NotizQuellenpruefung, klaraWissenApi } from "../../api/klaraWissen";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { Referenzpruefung, auszuegeAus } from "../fragen/Referenzpruefung";

function stufe(rolle: NotizQuellenpruefung["ergebnis"]["rollen"]["pruefer"]) {
  return typeof rolle === "object" ? (rolle?.stufe ?? null) : rolle;
}

export function KlaraNotizPruefung({ id, fassung }: { id: string; fassung: number }) {
  const { t } = useAssistenzT();
  const [pruefung, setPruefung] = useState<NotizQuellenpruefung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const pruefen = async () => {
    setPruefung(null);
    setFehler("");
    setLaeuft(true);
    try {
      const antwort = await klaraWissenApi.pruefen(id);
      if (antwort.fassung === fassung) setPruefung(antwort);
      else setFehler("neueFassung");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setFehler("fassungGeaendert");
      else
        setFehler(
          e instanceof ApiError && [403, 404].includes(e.status) ? "unverfuegbar" : "fehler",
        );
    } finally {
      setLaeuft(false);
    }
  };
  const beschriftung = (rolle: NotizModell | NonNullable<ReturnType<typeof stufe>>) =>
    typeof rolle === "object" && rolle.modell
      ? rolle.modell
      : t(`referenzpruefung.stufe.${stufe(rolle)}`);
  const ergebnis = pruefung?.ergebnis;
  const passagen = auszuegeAus(pruefung?.beleg);
  return (
    <div className="my-2 space-y-2" aria-busy={laeuft}>
      <button
        type="button"
        className="rounded-btn border border-hairline px-3 py-1 text-sm disabled:opacity-50"
        data-testid="wissen-pruefen"
        disabled={laeuft}
        onClick={() => void pruefen()}
      >
        {t(laeuft ? "klarawissen.modellpruefung.laeuft" : "klarawissen.pruefen")}
      </button>
      {fehler && <p role="alert">{t(`klarawissen.modellpruefung.${fehler}`)}</p>}
      {pruefung && ergebnis && (
        <>
          {pruefung.modellherkunft && (
            <dl className="space-y-1 text-xs" data-testid="notiz-modellherkunft">
              <div>
                <dt className="font-semibold">{t("klarawissen.modellpruefung.ursprung")}</dt>
                <dd>{beschriftung(pruefung.modellherkunft)}</dd>
              </div>
              {ergebnis.status === "geprueft" && ergebnis.rollen.pruefer && (
                <div>
                  <dt className="font-semibold">{t("klarawissen.modellpruefung.pruefer")}</dt>
                  <dd>{beschriftung(ergebnis.rollen.pruefer)}</dd>
                </div>
              )}
            </dl>
          )}
          <Referenzpruefung
            ergebnis={{
              ...ergebnis,
              rollen: {
                antwort: stufe(ergebnis.rollen.antwort),
                pruefer: stufe(ergebnis.rollen.pruefer),
              },
            }}
            aussageTexte={new Map(pruefung.beleg.aussagen.map((a) => [a.aussageId, a.text]))}
            antwortFingerabdruck={pruefung.beleg.antwortFingerabdruck}
            titelVon={(koId) => pruefung.quelltitel?.[koId]}
            wissenHref={gespeicherteFassungHref}
            auszugVon={(fid) => passagen.get(fid)}
            testId="notiz-quellenpruefung"
          />
        </>
      )}
    </div>
  );
}
