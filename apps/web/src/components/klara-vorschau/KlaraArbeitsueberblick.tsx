// produkt:20261008:klara-arbeitsueberblick: reine Sicht auf dieselben berechtigten Originalobjekte.
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { klaraAufgabeApi } from "../../api/klaraAufgabe";
import { klaraErinnerungApi } from "../../api/klaraErinnerung";
import { klaraKalenderApi } from "../../api/klaraKalender";
import { klaraNotizApi } from "../../api/klaraNotiz";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { formatKoTimestamp } from "../../lib/koDates";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";
import { oeffneNotiz } from "./notizen";

const KNOPF =
  "rounded-btn border border-hairline px-2 py-1 text-[12px] text-text hover:border-ink/30";
const LINK = "text-brand underline underline-offset-2";

interface Lesestand<T> {
  isPending: boolean;
  isError: boolean;
  data?: T;
}
function laedt<T>(): Lesestand<T> {
  return { isPending: true, isError: false };
}
function gelesen<T>(r: PromiseSettledResult<T>): Lesestand<T> {
  return r.status === "fulfilled"
    ? { isPending: false, isError: false, data: r.value }
    : { isPending: false, isError: true };
}
async function kalenderEntscheidungen() {
  const { anbindungen } = await klaraKalenderApi.uebersicht();
  const listen = await Promise.all(anbindungen.map((a) => klaraKalenderApi.zuordnungen(a.id)));
  return listen.flatMap((r) => r.zuordnungen).filter((z) => z.entscheidung !== null);
}

export function KlaraArbeitsueberblick({ kontoId }: { kontoId: string }): JSX.Element {
  const epoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  // Derselbe bestehende Rechtewechsel wie bei den Inhaltsabfragen: alte Listen samt verspäteten
  // Antworten vollständig verwerfen. Erneutes Öffnen liest unter dem heutigen Kontext.
  return <ArbeitsueberblickInhalt key={`${kontoId}:${epoche}`} kontoId={kontoId} />;
}

function ArbeitsueberblickInhalt({ kontoId }: { kontoId: string }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const [offen, setOffen] = useState(false);
  const id = useId();
  const [aktualisierung, setAktualisierung] = useState(0);
  const [aufgaben, setAufgaben] =
    useState<Lesestand<Awaited<ReturnType<typeof klaraAufgabeApi.liste>>>>(laedt);
  const [notizen, setNotizen] =
    useState<Lesestand<Awaited<ReturnType<typeof klaraNotizApi.liste>>>>(laedt);
  const [erinnerungen, setErinnerungen] =
    useState<Lesestand<Awaited<ReturnType<typeof klaraErinnerungApi.liste>>>>(laedt);
  const [kalender, setKalender] =
    useState<Lesestand<Awaited<ReturnType<typeof kalenderEntscheidungen>>>>(laedt);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Konto und ausdrückliche Aktualisierung lösen einen neuen berechtigten Abruf aus.
  useEffect(() => {
    if (!offen) return;
    let aktuell = true;
    setAufgaben(laedt());
    setNotizen(laedt());
    setErinnerungen(laedt());
    setKalender(laedt());
    void Promise.allSettled([
      klaraAufgabeApi.liste(),
      klaraNotizApi.liste(""),
      klaraErinnerungApi.liste(),
      kalenderEntscheidungen(),
    ]).then(([a, n, e, k]) => {
      if (!aktuell) return;
      setAufgaben(gelesen(a));
      setNotizen(gelesen(n));
      setErinnerungen(gelesen(e));
      setKalender(gelesen(k));
    });
    // Abmelden/Kontowechsel/Schließen macht verspätete Antworten ungültig.
    return () => {
      aktuell = false;
    };
  }, [offen, kontoId, aktualisierung]);
  const offeneAufgaben = aufgaben.data?.aufgaben.filter((a) => a.status === "offen") ?? [];
  const termine = [
    ...(erinnerungen.data?.erinnerungen ?? []),
    ...(erinnerungen.data?.uebernommen ?? []),
  ].filter(
    (e) =>
      e.status === "pausiert" ||
      (e.status === "aktiv" &&
        [
          "geplant",
          "faellig",
          "laeuft",
          "wartet_auf_klaerung",
          "teilweise_erledigt",
          "fehlgeschlagen",
        ].includes(e.lage)),
  );
  const klaerungen =
    erinnerungen.data?.erinnerungen.filter(
      (e) => e.status === "aktiv" && e.laeufe.some((l) => l.status === "unklar"),
    ) ?? [];
  const zeit = (iso: string | null | undefined) =>
    iso ? (formatKoTimestamp(iso, i18n.language) ?? iso) : t("klaraueberblick.zeitOffen");
  const zustand = (q: { isError: boolean; isPending: boolean }, leer: boolean) =>
    q.isError ? (
      <p role="alert">{t("klaraueberblick.fehler")}</p>
    ) : q.isPending ? (
      <output>{t("klaraueberblick.laden")}</output>
    ) : leer ? (
      <p>{t("klaraueberblick.leer")}</p>
    ) : null;

  return (
    <section
      data-testid="klara-arbeitsueberblick"
      className="border-t border-hairline py-2 text-[12px]"
    >
      <button
        type="button"
        className={KNOPF}
        aria-expanded={offen}
        aria-controls={id}
        onClick={() => setOffen(!offen)}
      >
        {t("klaraueberblick.titel")}
      </button>
      {offen ? (
        <div id={id} className="mt-2 space-y-3">
          <p>{t("klaraueberblick.hilfe")}</p>
          <button
            type="button"
            className={KNOPF}
            data-testid="arbeitsueberblick-aktualisieren"
            disabled={
              aufgaben.isPending ||
              notizen.isPending ||
              erinnerungen.isPending ||
              kalender.isPending
            }
            onClick={() => {
              setAktualisierung((n) => n + 1);
            }}
          >
            {t("klaraueberblick.aktualisieren")}
          </button>
          <section data-testid="arbeitsueberblick-aufgaben">
            <h3 className="font-semibold">{t("klaraueberblick.aufgaben")}</h3>
            {zustand(aufgaben, offeneAufgaben.length === 0)}
            {!aufgaben.isError && !aufgaben.isPending ? (
              <ul>
                {offeneAufgaben.map((a) => (
                  <li key={a.id} data-original-id={a.id}>
                    <Link className={LINK} to={`/aufgaben?persoenlich=${encodeURIComponent(a.id)}`}>
                      {a.titel}
                    </Link>{" "}
                    · {t("klaraueberblick.offen")} · {zeit(a.geaendertAm)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section data-testid="arbeitsueberblick-erinnerungen">
            <h3 className="font-semibold">{t("klaraueberblick.erinnerungen")}</h3>
            {zustand(erinnerungen, termine.length === 0)}
            {!erinnerungen.isError && !erinnerungen.isPending ? (
              <ul>
                {termine.map((e) => (
                  <li key={e.id} data-original-id={e.id}>
                    <Link className={LINK} to={`/aufgaben?erinnerung=${encodeURIComponent(e.id)}`}>
                      {e.titel}
                    </Link>{" "}
                    · {t(`klaraueberblick.${e.status}`)} ·{" "}
                    {e.anzeige.naechste
                      ? `${e.anzeige.naechste.datum} ${e.anzeige.naechste.uhrzeit}`
                      : t("klaraueberblick.zeitOffen")}{" "}
                    ({e.zeitzone})
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section data-testid="arbeitsueberblick-entscheidungen">
            <h3 className="font-semibold">{t("klaraueberblick.entscheidungen")}</h3>
            {erinnerungen.isError || kalender.isError ? (
              <p role="alert">{t("klaraueberblick.entscheidungenFehler")}</p>
            ) : null}
            {erinnerungen.isPending || kalender.isPending ? (
              <output>{t("klaraueberblick.laden")}</output>
            ) : null}
            {!erinnerungen.isError &&
            !kalender.isError &&
            !erinnerungen.isPending &&
            !kalender.isPending &&
            klaerungen.length === 0 &&
            kalender.data?.length === 0 ? (
              <p>{t("klaraueberblick.leer")}</p>
            ) : null}
            <ul>
              {!erinnerungen.isError
                ? klaerungen.map((e) => (
                    <li key={e.id} data-original-id={e.id}>
                      <Link
                        className={LINK}
                        to={`/aufgaben?erinnerung=${encodeURIComponent(e.id)}`}
                      >
                        {e.titel}
                      </Link>{" "}
                      · {t("klaraueberblick.klaerung")} · {zeit(e.geaendertAm)}
                    </li>
                  ))
                : null}
              {!kalender.isError
                ? kalender.data?.map((z) => (
                    <li key={z.schluessel} data-original-id={z.schluessel}>
                      <Link
                        className={LINK}
                        to={`/kalender-anbindung#kalender-zuordnung-${encodeURIComponent(z.schluessel)}`}
                      >
                        {t("klaraueberblick.kalenderEntscheidung")}
                      </Link>{" "}
                      · {zeit(z.geaendertAm)}
                    </li>
                  ))
                : null}
            </ul>
          </section>
          <section data-testid="arbeitsueberblick-notizen">
            <h3 className="font-semibold">{t("klaraueberblick.notizen")}</h3>
            {zustand(notizen, (notizen.data?.notizen.length ?? 0) === 0)}
            {!notizen.isError && !notizen.isPending ? (
              <ul>
                {notizen.data?.notizen.map((n) => (
                  <li key={n.id} data-original-id={n.id}>
                    <button
                      type="button"
                      className={LINK}
                      onClick={() => void oeffneNotiz(n.id, t)}
                    >
                      {n.titel}
                    </button>{" "}
                    · {zeit(n.geaendertAm)} · {t("klaraueberblick.fassung", { fassung: n.fassung })}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
