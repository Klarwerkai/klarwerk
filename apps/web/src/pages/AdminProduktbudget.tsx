// ==================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE DETAILKARTE „PRODUKTBUDGETS" UNTER „KI".
// ==================================================================================================
//
// Je Budgetbereich (Perplexity-PoC, Claude und ChatGPT zu Nr. 32) steht hier, was PBE-02 verlangt:
// Betrag, Währung, Geltungsbereich, Anbieter, Zeitraum, verbraucht, reserviert, verbleibend, Stand
// — und darunter die Änderung. Alles kommt vom Server (`GET /api/admin/produktbudget`); die Karte
// rechnet keinen Rest selbst aus.
//
// DIE EINGABE GEHT NICHT VERLOREN (PBE-08). Der Entwurf eines Bereichs bleibt stehen, bis der
// Server die Änderung bestätigt. Er trägt eine eigene Änderungskennung, die bei jedem erneuten
// Speichern DIESELBE bleibt: kam die erste Antwort nie an, erkennt der Server die Wiederholung und
// legt keinen zweiten Eintrag an. Bei einem Konflikt zeigt die Karte den neuen Stand NEBEN der
// Eingabe; gespeichert wird erst, wenn die Person es erneut auslöst.
//
// DER FESTE SATZ unten steht sichtbar und nicht im „?"-Menü: eine Budgetänderung ist keine
// Aufladung, keine Kontoumstellung und keine Tokenfreigabe — das muss man VOR dem Speichern lesen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  BUDGET_WAEHRUNGEN,
  BUDGET_ZEITRAEUME,
  type BudgetBereich,
  type BudgetWaehrung,
  type BudgetWerte,
  type BudgetZeitraum,
  PRODUKTBUDGET_KEY,
  type Produktbudgetstand,
  centAlsBetrag,
  produktbudgetApi,
} from "../api/produktbudget";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, TextInput } from "../components/ui";

interface Entwurf {
  betrag: string;
  waehrung: BudgetWaehrung;
  zeitraum: BudgetZeitraum;
  grund: string;
  /** Die Fassung, auf der dieser Entwurf beruht — der Server prüft sie. */
  fassung: number;
  aenderungId: string;
}

type Meldung = { art: "ok" | "fehler" | "konflikt"; text: string };

/**
 * Die Kennung eines Änderungsvorgangs — über `crypto.getRandomValues`, das es anders als
 * `crypto.randomUUID` auch ausserhalb eines sicheren Kontexts gibt (Insel unter `http://<LAN>`,
 * dieselbe Lehre wie `lib/createOperation.ts`).
 */
function neueKennung(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `pb-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const SELECT_KLASSE =
  "h-10 max-w-full rounded-input border border-hairline bg-surface px-2 text-sm text-text";

function Wertzeile({
  label,
  wert,
  testId,
}: {
  label: string;
  wert: string;
  testId: string;
}): JSX.Element {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 border-b border-hairline py-1.5 last:border-b-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd data-testid={testId} className="text-[13px] text-text">
        {wert}
      </dd>
    </div>
  );
}

function BereichKarte({ b, dezimal }: { b: BudgetBereich; dezimal: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);

  const betrag = (cent: number, waehrung: BudgetWaehrung): string =>
    `${centAlsBetrag(cent, dezimal)} ${waehrung}`;
  const werte = (w: BudgetWerte): string =>
    `${betrag(w.betragCent, w.waehrung)} · ${t(`produktbudget.zeitraum.${w.zeitraum}`)}`;
  const datum = (iso: string): string =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  const aktuell: Entwurf = entwurf ?? {
    betrag: centAlsBetrag(b.betragCent, dezimal),
    waehrung: b.waehrung,
    zeitraum: b.zeitraum,
    grund: "",
    fassung: b.fassung,
    aenderungId: "",
  };
  const aendern = (teil: Partial<Entwurf>): void => {
    setMeldung(null);
    setEntwurf({
      ...aktuell,
      ...teil,
      aenderungId: aktuell.aenderungId === "" ? neueKennung() : aktuell.aenderungId,
    });
  };

  const speichern = useMutation({
    mutationFn: (e: Entwurf) =>
      produktbudgetApi.aendere(b.bereich, {
        betrag: e.betrag,
        waehrung: e.waehrung,
        zeitraum: e.zeitraum,
        fassung: e.fassung,
        aenderungId: e.aenderungId,
        ...(e.grund.trim() === "" ? {} : { grund: e.grund }),
      }),
    onSuccess: (antwort) => {
      const { wiederholt, geaendert, ...stand } = antwort;
      qc.setQueryData<Produktbudgetstand>(PRODUKTBUDGET_KEY, stand);
      setEntwurf(null);
      const gespeichert = geaendert || wiederholt;
      setMeldung({
        art: "ok",
        text: t(gespeichert ? "produktbudget.gespeichert" : "produktbudget.unveraendert"),
      });
    },
    onError: (fehler) => {
      if (fehler instanceof ApiError) {
        const grund = typeof fehler.details.grund === "string" ? fehler.details.grund : null;
        const neu = fehler.details.stand as Produktbudgetstand | undefined;
        if (neu && Array.isArray(neu.bereiche)) {
          // Der neue Stand steht daneben; die Eingabe bleibt, die Fassung wird NICHT still
          // übernommen — erst ein ausdrücklicher Schritt bezieht die Eingabe auf ihn.
          qc.setQueryData<Produktbudgetstand>(PRODUKTBUDGET_KEY, neu);
        }
        setMeldung({
          art: fehler.status === 409 ? "konflikt" : "fehler",
          text: grund
            ? t(`produktbudget.fehler.${grund}`, { defaultValue: fehler.message })
            : fehler.message,
        });
        return;
      }
      // Kein Serverbefund (Netz, Zeitlimit): ob gespeichert wurde, ist unklar. Die Eingabe und ihre
      // Änderungskennung bleiben — ein erneutes Speichern wirkt höchstens einmal.
      setMeldung({ art: "fehler", text: t("produktbudget.fehler.unklar") });
    },
  });

  // Nach einem Konflikt: die Eingabe auf den neuen Stand beziehen — ausdrücklich, per Knopf.
  const konfliktUebernehmen = (): void => {
    if (entwurf) {
      setEntwurf({ ...entwurf, fassung: b.fassung, aenderungId: neueKennung() });
      setMeldung(null);
    }
  };

  const id = b.bereich;
  const name = t(`produktbudget.bereich.${id}`);
  return (
    <section
      data-testid={`produktbudget-bereich-${id}`}
      className="space-y-3 rounded-card border border-hairline p-3"
    >
      <h3 className="text-[14px] font-semibold text-text">{name}</h3>
      <dl>
        <Wertzeile
          label={t("produktbudget.feld.anbieter")}
          wert={t(`produktbudget.anbieter.${b.anbieter}`)}
          testId={`pb-anbieter-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.geltung")}
          wert={t(`produktbudget.geltung.${id}`)}
          testId={`pb-geltung-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.betrag")}
          wert={betrag(b.betragCent, b.waehrung)}
          testId={`pb-betrag-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.zeitraum")}
          wert={t(`produktbudget.zeitraum.${b.zeitraum}`)}
          testId={`pb-zeitraum-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.verbraucht")}
          wert={betrag(b.verbrauchtCent, b.waehrung)}
          testId={`pb-verbraucht-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.reserviert")}
          wert={betrag(b.reserviertCent, b.waehrung)}
          testId={`pb-reserviert-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.verbleibend")}
          wert={betrag(b.verbleibendCent, b.waehrung)}
          testId={`pb-verbleibend-${id}`}
        />
        {b.ueberschrittenCent > 0 ? (
          <Wertzeile
            label={t("produktbudget.feld.ueberschritten")}
            wert={betrag(b.ueberschrittenCent, b.waehrung)}
            testId={`pb-ueberschritten-${id}`}
          />
        ) : null}
        <Wertzeile
          label={t("produktbudget.feld.kostenweg")}
          wert={
            b.sperre === null
              ? t("produktbudget.kostenweg.offen")
              : t(`produktbudget.sperre.${b.sperre}`)
          }
          testId={`pb-kostenweg-${id}`}
        />
        <Wertzeile
          label={t("produktbudget.feld.stand")}
          wert={
            b.fassung === 0 || b.geaendertAm === null
              ? t("produktbudget.stand.vorgabe")
              : t("produktbudget.stand.geaendert", {
                  fassung: b.fassung,
                  datum: datum(b.geaendertAm),
                  von: b.geaendertVon ?? "–",
                })
          }
          testId={`pb-stand-${id}`}
        />
      </dl>
      {b.abgeloest ? (
        <p data-testid={`pb-abgeloest-${id}`} className="text-[12px] text-muted-2">
          {t("produktbudget.abgeloest", {
            betrag: betrag(b.abgeloest.betragCent, b.abgeloest.waehrung),
          })}
        </p>
      ) : null}
      {b.zeitraum === "offen" ? (
        <p data-testid={`pb-frage-${id}`} className="text-[12px] text-trust-warn-text">
          {t("produktbudget.frageOffen")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
        <Field label={t("produktbudget.feld.betrag")}>
          <TextInput
            inputMode="decimal"
            className="w-28"
            value={aktuell.betrag}
            onChange={(e) => aendern({ betrag: e.target.value })}
            aria-label={`${t("produktbudget.feld.betrag")} · ${name}`}
            data-testid={`pb-eingabe-betrag-${id}`}
          />
        </Field>
        <Field label={t("produktbudget.feld.waehrung")}>
          <select
            className={SELECT_KLASSE}
            value={aktuell.waehrung}
            onChange={(e) => aendern({ waehrung: e.target.value as BudgetWaehrung })}
            data-testid={`pb-eingabe-waehrung-${id}`}
          >
            {BUDGET_WAEHRUNGEN.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("produktbudget.feld.zeitraum")}>
          <select
            className={SELECT_KLASSE}
            value={aktuell.zeitraum}
            onChange={(e) => aendern({ zeitraum: e.target.value as BudgetZeitraum })}
            data-testid={`pb-eingabe-zeitraum-${id}`}
          >
            {BUDGET_ZEITRAEUME.map((z) => (
              <option key={z} value={z}>
                {t(`produktbudget.zeitraum.${z}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("produktbudget.feld.grund")}>
          <TextInput
            className="w-56"
            maxLength={200}
            value={aktuell.grund}
            onChange={(e) => aendern({ grund: e.target.value })}
            data-testid={`pb-eingabe-grund-${id}`}
          />
        </Field>
        <Button
          variant="primary"
          disabled={entwurf === null || speichern.isPending}
          onClick={() => {
            if (entwurf) {
              speichern.mutate(entwurf);
            }
          }}
          data-testid={`pb-speichern-${id}`}
        >
          {t("produktbudget.speichern")}
        </Button>
      </div>
      <output
        aria-live="polite"
        data-testid={`pb-meldung-${id}`}
        className={`block text-[12px] ${
          meldung?.art === "ok" ? "text-trust-ok-text" : "text-trust-crit-text"
        }`}
      >
        {meldung?.text ?? ""}
      </output>
      {meldung?.art === "konflikt" && entwurf ? (
        <Button onClick={konfliktUebernehmen} data-testid={`pb-konflikt-uebernehmen-${id}`}>
          {t("produktbudget.konfliktUebernehmen")}
        </Button>
      ) : null}

      {b.letzteAenderungen.length > 0 ? (
        <ul data-testid={`pb-verlauf-${id}`} className="space-y-1 text-[11.5px] text-muted-2">
          {b.letzteAenderungen.map((a) => (
            <li key={a.aenderungId}>
              {t("produktbudget.verlaufZeile", {
                datum: datum(a.am),
                von: a.von,
                vorher: werte(a.vorher),
                nachher: werte(a.nachher),
              })}
              {a.grund ? ` · ${a.grund}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ProduktbudgetDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const stand = useQuery({ queryKey: PRODUKTBUDGET_KEY, queryFn: produktbudgetApi.lies });
  const dezimal = i18n.language.startsWith("en") ? "." : ",";
  return (
    <Detailkarte
      titel={t("produktbudget.titel")}
      onZurueck={onZurueck}
      testId="detail-produktbudget"
      hilfe={[{ titel: t("produktbudget.titel"), text: t("produktbudget.hilfe") }]}
    >
      <Abfragehuelle abfrage={stand} testId="huelle-produktbudget">
        {(daten) => (
          <div className="space-y-3">
            {daten.bereiche.map((b) => (
              <BereichKarte key={b.bereich} b={b} dezimal={dezimal} />
            ))}
          </div>
        )}
      </Abfragehuelle>
      <p
        data-testid="produktbudget-ehrlichkeit"
        className="rounded-card border border-hairline bg-page px-3 py-2 text-[11px] leading-relaxed text-muted-2"
      >
        {t("produktbudget.ehrlichkeit")}
      </p>
    </Detailkarte>
  );
}
