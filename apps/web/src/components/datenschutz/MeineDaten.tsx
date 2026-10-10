// ================================================================================================
// BETROFFENENRECHTE IM PROFIL — „MEINE DATEN" (R-0663) UND „KONTO LÖSCHEN LASSEN" (R-0661).
// ================================================================================================
//
// Zwei Detailkarten hinter zwei Zeilen von `/profil`. Beide zeigen ihren Zustand über dieselbe
// `Abfragehuelle` wie jede andere Detailkarte (lädt · nicht abrufbar + Erneut versuchen · Stand).
//
// „Meine Daten" zählt je Bereich, was die Auskunft enthält, nennt den Übergabe-Stand und — ebenso
// sichtbar — was NICHT in der Datei steht und warum. Der Knopf lädt GENAU die Antwort herunter, die
// gezählt wurde; es gibt keinen zweiten Abruf, der etwas anderes liefern könnte.
//
// „Konto löschen lassen" stellt einen Antrag. Er löscht nichts; er wird zur Aufgabe der Verwaltung
// mit Frist. Der Text darüber sagt, was das Erledigen bewirkt und was stehen bleibt.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  type Loeschantrag,
  alsDateiSpeichern,
  dateistempel,
  datenschutzApi,
} from "../../api/datenschutz";
import { Abfragehuelle } from "../einstellungen/Abfragehuelle";
import { Detailkarte } from "../einstellungen/Detailkarte";
import { Kicker } from "../einstellungen/Zeilenkarte";
import { Button, Field } from "../ui";

/** Die Bereiche der Auskunft in der Reihenfolge des Auftrags: Konto, Objekte, Kommentare, … */
const BEREICHE = [
  "eigeneObjekte",
  "bearbeitungen",
  "kommentare",
  "entwuerfe",
  "fragen",
  "antworten",
  "bewertungen",
  "zuweisungen",
  "kenntnisnahmen",
  "anhaenge",
  "lernpfade",
  "loeschantraege",
  "nachfolge",
  "kiLaeufe",
  "klaraSitzungen",
  "klaraZustimmungen",
  "protokoll",
] as const;

const BEKANNTE_FEHLER = [
  "BEREITS_OFFEN",
  "NICHT_OFFEN",
  "ZU_LANG",
  "GRUND_FEHLT",
  "NICHT_HALTBAR",
  "LETZTER_ADMIN",
] as const;

/** Die Fehlermeldung eines Antragsvorgangs in der Sprache der Oberfläche. */
export function useAntragsfehler(): (e: unknown) => string {
  const { t } = useTranslation();
  return (e) => {
    if (e instanceof ApiError && (BEKANNTE_FEHLER as readonly string[]).includes(e.code)) {
      return t(`datenschutz.fehler.${e.code}`);
    }
    return t("datenschutz.fehler.allgemein");
  };
}

const LISTE = "divide-y divide-hairline overflow-hidden rounded-card border border-hairline";
const LISTENZEILE = "flex items-center justify-between gap-3 px-3 py-2 text-[13px]";

export const MEINE_DATEN_KEY = ["datenschutz", "meineDaten"] as const;
export const MEINE_ANTRAEGE_KEY = ["datenschutz", "meineAntraege"] as const;

export function MeineDatenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  // Jeder Abruf ist eine erteilte Auskunft und steht im Prüfprotokoll — deshalb kein stilles
  // Nachladen beim Fensterwechsel. „Erneut versuchen" und ein neues Öffnen holen frisch.
  const daten = useQuery({
    queryKey: MEINE_DATEN_KEY,
    queryFn: datenschutzApi.meineDaten,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  return (
    <Detailkarte
      titel={t("datenschutz.meineDaten.titel")}
      onZurueck={onZurueck}
      testId="detail-meine-daten"
    >
      <Abfragehuelle abfrage={daten}>
        {(a) => (
          <>
            <dl className={LISTE} data-testid="meine-daten-bereiche">
              {BEREICHE.map((b) => {
                const zahl = a.zaehlung[b];
                return (
                  <div key={b} className={LISTENZEILE}>
                    <dt className="text-text">{t(`datenschutz.meineDaten.bereich.${b}`)}</dt>
                    <dd className="text-muted-2" data-bereich={b}>
                      {typeof zahl === "number" && zahl >= 0
                        ? String(zahl)
                        : t("datenschutz.meineDaten.nichtAbrufbar")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <Kicker>{t("datenschutz.meineDaten.uebergabe")}</Kicker>
            <dl className={LISTE} data-testid="meine-daten-uebergabe">
              {(
                [
                  ["verantwortlich", a.uebergabe.verantwortlichFuer],
                  ["autor", a.uebergabe.autorVon],
                  ["pruefung", a.uebergabe.offenePruefzuweisungen],
                  ["fragen", a.uebergabe.zugewieseneOffeneFragen],
                ] as const
              ).map(([schluessel, zahl]) => (
                <div key={schluessel} className={LISTENZEILE}>
                  <dt className="text-text">
                    {t(`datenschutz.meineDaten.uebergabe.${schluessel}`)}
                  </dt>
                  <dd className="text-muted-2">{String(zahl)}</dd>
                </div>
              ))}
              <div className={LISTENZEILE}>
                <dt className="text-text">{t("datenschutz.meineDaten.uebergabe.nachfolge")}</dt>
                <dd className="text-muted-2" data-testid="meine-daten-nachfolge">
                  {a.uebergabe.nachfolgeBeiBefristung ?? "—"}
                </dd>
              </div>
            </dl>
            <Kicker>{t("datenschutz.meineDaten.nichtEnthalten")}</Kicker>
            <ul className="space-y-1.5 text-[12.5px]" data-testid="meine-daten-nicht-enthalten">
              {a.nichtEnthalten.map((n) => (
                <li key={n.datenart}>
                  <span className="font-semibold text-text">{n.name}</span>
                  <span className="text-muted"> — {n.grund}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-muted-2">
              {t("datenschutz.meineDaten.stand", {
                zeit: new Date(a.erzeugtAm).toLocaleString(),
              })}
            </p>
            <Button
              variant="primary"
              data-testid="meine-daten-herunterladen"
              onClick={() =>
                alsDateiSpeichern(
                  JSON.stringify(a, null, 2),
                  `klarwerk-meine-daten-${dateistempel(a.erzeugtAm)}.json`,
                  "application/json;charset=utf-8",
                )
              }
            >
              <Download size={14} /> {t("datenschutz.meineDaten.herunterladen")}
            </Button>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

function datum(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function FruehereAntraege({ antraege }: { antraege: readonly Loeschantrag[] }): JSX.Element | null {
  const { t } = useTranslation();
  if (antraege.length === 0) {
    return null;
  }
  return (
    <>
      <Kicker>{t("datenschutz.antrag.verlauf")}</Kicker>
      <ul className={LISTE} data-testid="loeschantrag-verlauf">
        {antraege.map((a) => (
          <li key={a.id} className="space-y-0.5 px-3 py-2 text-[12.5px]">
            <div className="text-text">
              {t("datenschutz.verwaltung.entscheidung", {
                status: t(`datenschutz.status.${a.status}`),
                datum: datum(a.entschiedenAm),
              })}
            </div>
            {a.entscheidungsgrund ? (
              <div className="text-muted">
                {t("datenschutz.verwaltung.begruendung", { text: a.entscheidungsgrund })}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function LoeschantragDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fehlertext = useAntragsfehler();
  const [begruendung, setBegruendung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const antraege = useQuery({
    queryKey: MEINE_ANTRAEGE_KEY,
    queryFn: datenschutzApi.meineAntraege,
    retry: false,
  });
  const neuLaden = (): void => {
    void queryClient.invalidateQueries({ queryKey: MEINE_ANTRAEGE_KEY });
  };
  const stellen = useMutation({
    mutationFn: () => datenschutzApi.antragStellen(begruendung.trim() || null),
    onSuccess: () => {
      setBegruendung("");
      setFehler(null);
      neuLaden();
    },
    onError: (e) => setFehler(fehlertext(e)),
  });
  const zurueckziehen = useMutation({
    mutationFn: (id: string) => datenschutzApi.antragZurueckziehen(id),
    onSuccess: () => {
      setFehler(null);
      neuLaden();
    },
    onError: (e) => setFehler(fehlertext(e)),
  });

  return (
    <Detailkarte
      titel={t("datenschutz.antrag.titel")}
      onZurueck={onZurueck}
      testId="detail-loeschantrag"
    >
      <p className="text-[12.5px] leading-relaxed text-muted" data-testid="loeschantrag-wirkung">
        {t("datenschutz.antrag.wirkung")}
      </p>
      <Abfragehuelle abfrage={antraege}>
        {({ antraege: liste }) => {
          // `in_bearbeitung`: die Verwaltung löscht gerade — der Antrag ist noch aktiv, aber nicht
          // mehr zurückziehbar.
          const aktiv = (a: Loeschantrag): boolean =>
            a.status === "offen" || a.status === "in_bearbeitung";
          const offen = liste.find(aktiv);
          const frueher = liste.filter((a) => !aktiv(a));
          return (
            <>
              {offen ? (
                <div
                  className="space-y-2 rounded-card border border-hairline bg-page p-3 text-[13px]"
                  data-testid="loeschantrag-offen"
                >
                  <p className="text-text">
                    {t("datenschutz.antrag.offen", {
                      gestellt: datum(offen.gestelltAm),
                      frist: datum(offen.fristBis),
                    })}
                  </p>
                  {offen.ueberfaellig ? (
                    <p className="font-semibold text-trust-crit-text">
                      {t("datenschutz.antrag.ueberfaellig")}
                    </p>
                  ) : null}
                  {offen.status === "offen" ? (
                    <Button
                      disabled={zurueckziehen.isPending}
                      onClick={() => zurueckziehen.mutate(offen.id)}
                      data-testid="loeschantrag-zurueckziehen"
                    >
                      {t("datenschutz.antrag.zurueckziehen")}
                    </Button>
                  ) : (
                    <p className="text-muted">{t("datenschutz.status.in_bearbeitung")}</p>
                  )}
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFehler(null);
                    stellen.mutate();
                  }}
                >
                  <Field label={t("datenschutz.antrag.begruendung")}>
                    <textarea
                      value={begruendung}
                      onChange={(e) => setBegruendung(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      data-testid="loeschantrag-begruendung"
                      className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30"
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={stellen.isPending}
                    data-testid="loeschantrag-stellen"
                  >
                    {stellen.isPending
                      ? t("datenschutz.antrag.laeuft")
                      : t("datenschutz.antrag.stellen")}
                  </Button>
                </form>
              )}
              {fehler ? (
                <div
                  role="alert"
                  className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
                >
                  {fehler}
                </div>
              ) : null}
              <FruehereAntraege antraege={frueher} />
            </>
          );
        }}
      </Abfragehuelle>
    </Detailkarte>
  );
}
