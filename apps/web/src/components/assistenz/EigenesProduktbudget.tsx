// ==================================================================================================
// produkt:20261013:produktbudget-anwender-admin (PBE-12) — DAS EIGENE BUDGET FÜR KOSTENPFLICHTIGE
// AUFRUFE, IM PROFIL UNTER „FÄHIGKEITEN" DER ASSISTENZ.
// ==================================================================================================
//
// Je Bereich: Gesamtbudget und Zeitraum, die erlaubte Zuweisung (von der Verwaltung, sonst der
// Gesamtbetrag), die eigene Belegung, der eigene Rest — und das EIGENE Unterlimit. Mehr kann ein
// Anwender hier nicht ändern: Gesamtbudget und Zuweisungen ändert nur die Verwaltung, und der
// Server hält das Unterlimit innerhalb der Zuweisung. Alles kommt vom Server
// (`GET /api/me/produktbudget`); die Fläche rechnet keinen Rest selbst aus.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  EIGENES_PRODUKTBUDGET_KEY,
  type EigeneBudgets,
  type EigenesBudget,
  centAlsBetrag,
  produktbudgetApi,
} from "../../api/produktbudget";
import { Abfragehuelle } from "../einstellungen/Abfragehuelle";
import { Button, Field, TextInput } from "../ui";

function EigenerBereich({ e, dezimal }: { e: EigenesBudget; dezimal: string }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [eingabe, setEingabeZustand] = useState<string | null>(null);
  // Spiegel der Eingabe für die Antwortbehandlung — entschieden wird gegen die Eingabe von JETZT.
  const eingabeJetzt = useRef<string | null>(null);
  const setEingabe = (neu: string | null): void => {
    eingabeJetzt.current = neu;
    setEingabeZustand(neu);
  };
  const [meldung, setMeldung] = useState<string | null>(null);
  const geld = (cent: number): string => `${centAlsBetrag(cent, dezimal)} ${e.waehrung}`;
  const id = e.bereich;

  // PBE-08 (Ben, nacharbeit-6): der GESENDETE Vorgang — Wert und Grundfassung — steht fest. Während
  // er läuft, ist das Feld gesperrt; die Antwort löscht nur genau diesen Wert, nie eine andere
  // Eingabe.
  const speichern = useMutation({
    mutationFn: (g: { unterlimit: string | null; fassung: number }) =>
      produktbudgetApi.setzeUnterlimit(id, g),
    onSuccess: (stand, g) => {
      qc.setQueryData<EigeneBudgets>(EIGENES_PRODUKTBUDGET_KEY, stand);
      const jetzt = eingabeJetzt.current;
      const weiter = jetzt !== null && jetzt !== g.unterlimit;
      if (!weiter) {
        setEingabe(null);
      }
      setMeldung(t(weiter ? "produktbudget.gespeichertWeitere" : "produktbudget.gespeichert"));
    },
    onError: (fehler) => {
      // Die Eingabe bleibt stehen; die Meldung nennt den Grund des Servers.
      const grund =
        fehler instanceof ApiError && typeof fehler.details.grund === "string"
          ? fehler.details.grund
          : null;
      setMeldung(
        grund
          ? t(`produktbudget.fehler.${grund}`, { defaultValue: fehler.message })
          : t("produktbudget.fehler.unklar"),
      );
    },
  });

  const wert =
    eingabe ?? (e.unterlimitCent === null ? "" : centAlsBetrag(e.unterlimitCent, dezimal));
  return (
    <section
      data-testid={`eigenes-budget-${id}`}
      className="space-y-2 rounded-card border border-hairline p-3"
    >
      <h4 className="text-[13px] font-semibold text-text">
        {t("produktbudget.eigen.kopf", {
          bereich: t(`produktbudget.bereich.${id}`),
          betrag: geld(e.betragCent),
          zeitraum: t(`produktbudget.zeitraum.${e.zeitraum}`),
        })}
      </h4>
      <dl className="space-y-1 text-[12.5px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("produktbudget.eigen.zuweisung")}</dt>
          <dd data-testid={`eigenes-budget-zuweisung-${id}`}>{geld(e.zuweisungCent)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("produktbudget.eigen.belegt")}</dt>
          <dd data-testid={`eigenes-budget-belegt-${id}`}>{geld(e.belegtCent)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("produktbudget.eigen.verbleibend")}</dt>
          <dd data-testid={`eigenes-budget-verbleibend-${id}`}>{geld(e.eigenVerbleibendCent)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("produktbudget.eigen.unterlimit")}>
          <TextInput
            inputMode="decimal"
            className="w-28"
            value={wert}
            disabled={speichern.isPending}
            onChange={(ev) => {
              if (speichern.isPending) {
                return;
              }
              setMeldung(null);
              setEingabe(ev.target.value);
            }}
            data-testid={`eigenes-budget-unterlimit-${id}`}
          />
        </Field>
        <Button
          variant="primary"
          disabled={eingabe === null || eingabe.trim() === "" || speichern.isPending}
          onClick={() => speichern.mutate({ unterlimit: eingabe, fassung: e.fassung })}
          data-testid={`eigenes-budget-speichern-${id}`}
        >
          {t("produktbudget.eigen.speichern")}
        </Button>
        <Button
          disabled={e.unterlimitCent === null || speichern.isPending}
          onClick={() => speichern.mutate({ unterlimit: null, fassung: e.fassung })}
          data-testid={`eigenes-budget-aufheben-${id}`}
        >
          {t("produktbudget.eigen.aufheben")}
        </Button>
      </div>
      <output
        aria-live="polite"
        data-testid={`eigenes-budget-meldung-${id}`}
        className="block text-[12px] text-muted-2"
      >
        {meldung ?? ""}
      </output>
    </section>
  );
}

export function EigenesProduktbudget(): JSX.Element {
  const { t, i18n } = useTranslation();
  const stand = useQuery({ queryKey: EIGENES_PRODUKTBUDGET_KEY, queryFn: produktbudgetApi.eigene });
  const dezimal = i18n.language.startsWith("en") ? "." : ",";
  return (
    <div data-testid="eigenes-produktbudget" className="space-y-2">
      <h3 className="text-[13.5px] font-semibold text-text">{t("produktbudget.eigen.titel")}</h3>
      <p className="text-[12px] text-muted-2">{t("produktbudget.eigen.hinweis")}</p>
      <Abfragehuelle abfrage={stand} testId="huelle-eigenes-produktbudget">
        {(daten) => (
          <div className="space-y-2">
            {daten.bereiche.map((e) => (
              <EigenerBereich key={e.bereich} e={e} dezimal={dezimal} />
            ))}
          </div>
        )}
      </Abfragehuelle>
    </div>
  );
}
