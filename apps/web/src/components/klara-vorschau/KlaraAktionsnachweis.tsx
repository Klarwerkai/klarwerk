// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — DER NACHWEIS EINES SCHRITTS.
// ================================================================================================
//
// An jedem festgehaltenen Schritt einer Auftragskarte (Klara 05) steht aufklappbar, was geschah:
//   · Aktionskennung (= Vorgangsschlüssel am Schreibweg) und Vorgang (Aktion, Schritt, Auftrag);
//   · Zeitpunkt und ausführende Identität — Klarwerk im Auftrag der Person, mit deren Rechten;
//   · Ergebnis mit vorherigem und neuem Stand, nach einer Rücknahme auch deren Stand;
//   · der Aktionsvertrag: Wirkung, Recht, Rücknahme — Nicht-Rücknehmbares mit dem Arbeitsort;
//   · auf Wunsch die eigenen Einträge der vorhandenen Prüfprotokollkette zu diesem Schritt.
// Alles kommt vom Server (`/api/me/klara/…/auftraege`, `…/protokoll`); nichts wird hier behauptet.
// Und die erklärte Ablehnung einer Rücknahme (`RuecknahmeKonflikt`) mit dem Weg zum Korrigieren.
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type KlaraAuftrag,
  type KlaraAuftragSchritt,
  type KlaraErgebnisstand,
  type KlaraProtokollEintrag,
  klaraAuftragApi,
} from "../../api/klaraAuftrag";
import { HOME_ROUTE } from "../../app/navigation";
import { internerPfad } from "../../lib/internerPfad";
import type { RuecknahmeKonflikt } from "./auftrag";

const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const VERWEIS = "font-semibold text-brand-text hover:underline";
const KNOPF =
  "inline-flex h-7 items-center rounded-btn border border-hairline bg-surface px-2 text-[11px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const ISO = /^\d{4}-\d{2}-\d{2}T/;

function zeitpunkt(iso: string, sprache: string): string {
  return new Date(iso).toLocaleString(sprache, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Ein festgehaltener Stand in Worten — Fassungszeit, Papierkorb oder Art einer Aufgabenwirkung. */
export function standInWorten(
  stand: string | null | undefined,
  t: TFunction,
  sprache: string,
  leer: "neu" | "unbekannt" = "unbekannt",
): string {
  if (!stand) {
    return t(`assistenzverlauf.stand.${leer}`);
  }
  if (stand === "papierkorb") {
    return t("assistenzverlauf.stand.papierkorb");
  }
  if (ISO.test(stand) && Number.isFinite(Date.parse(stand))) {
    return t("assistenzverlauf.stand.fassung", { zeit: zeitpunkt(stand, sprache) });
  }
  return stand
    .split(" ")
    .map((teil) => {
      const trenner = teil.indexOf(":");
      const art = trenner < 0 ? teil : teil.slice(0, trenner);
      const wert = trenner < 0 ? "" : teil.slice(trenner + 1);
      if (art === "prioritaet") {
        return t("assistenzverlauf.stand.prioritaet", {
          wert: t(`klaraauftrag.prioritaet.${wert}`, { defaultValue: wert }),
        });
      }
      if (art === "zugewiesen") {
        return wert
          ? t("assistenzverlauf.stand.zugewiesenAn", { person: wert })
          : t("assistenzverlauf.stand.zugewiesen");
      }
      if (art === "nicht_zugewiesen") {
        return t("assistenzverlauf.stand.nichtZugewiesen");
      }
      if (art === "status") {
        return t("assistenzverlauf.stand.status", { status: wert });
      }
      return art === "eskaliert" ? t("assistenzverlauf.stand.eskaliert") : teil;
    })
    .join(" · ");
}

/** Der Ergebnisstand der Karte: vom Server; `entwurf`, solange der Plan nur hier steht. */
export function KlaraErgebnisstandZeile({
  stand,
}: {
  stand: KlaraErgebnisstand | null;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!stand) {
    return null;
  }
  return (
    <p
      data-testid="klara-ausfuehrung-ergebnisstand"
      data-ergebnisstand={stand}
      title={t("assistenzverlauf.ergebnis.hinweis")}
      className="mt-1 text-[11.5px] text-text"
    >
      <span className={KLEINTITEL}>{t("assistenzverlauf.ergebnis.titel")}</span>{" "}
      <span className="font-semibold">{t(`assistenzverlauf.ergebnis.${stand}`)}</span>
    </p>
  );
}

const WIRKUNGSEREIGNISSE = ["gespeichert", "abgeschlossen", "fehlgeschlagen"] as const;

/** Der Zeitpunkt der Wirkung bzw. Rücknahme dieses Schritts aus dem Verlauf des Auftrags. */
function verlaufszeit(a: KlaraAuftrag, nr: number, ereignisse: readonly string[]): string | null {
  const treffer = a.verlauf.filter((v) => v.nr === nr && ereignisse.includes(v.ereignis));
  return treffer.at(-1)?.am ?? null;
}

/** Ein Protokolleintrag in Worten: der festgehaltene Schrittstand oder die abgelehnte Rücknahme. */
function ereignisInWorten(e: KlaraProtokollEintrag, t: TFunction): string {
  if (e.action.endsWith("ruecknahme-abgelehnt")) {
    return t("assistenzverlauf.protokoll.ereignis.abgelehnt");
  }
  const stand = typeof e.payload.stand === "string" ? e.payload.stand : "";
  return t(`assistenzverlauf.protokoll.ereignis.${stand}`, { defaultValue: stand || e.action });
}

type Felder = { title: string; statement: string } | null | undefined;

/**
 * PV-02-03 (Nacharbeit 3, Ben): der tatsächliche Inhalt eines Entwurfs vor bzw. nach der Wirkung —
 * vom Server gelesen und nur im eigenen Gespräch abgelegt, nie im Prüfprotokoll. Mit `vergleich`
 * ist jedes Feld markiert, das sich gegenüber dem vorherigen Inhalt geändert hat.
 */
function Inhalt({
  testId,
  felder,
  vergleich,
}: {
  testId: string;
  felder: Felder;
  vergleich?: Felder;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!felder) {
    return null;
  }
  const zeilen = [
    { feld: "title", name: t("assistenzverlauf.feld.titel"), wert: felder.title },
    { feld: "statement", name: t("assistenzverlauf.feld.kernaussage"), wert: felder.statement },
  ] as const;
  return (
    <span data-testid={testId} className="mt-0.5 block text-[11px] text-muted">
      {zeilen.map((z) => {
        const geaendert = vergleich ? vergleich[z.feld] !== z.wert : false;
        return (
          <span
            key={z.feld}
            data-feld={z.feld}
            data-geaendert={geaendert ? "ja" : "nein"}
            className={`block whitespace-pre-wrap ${geaendert ? "font-semibold text-text" : ""}`}
          >
            {`${z.name}: ${z.wert || "–"}`}
            {geaendert ? ` (${t("assistenzverlauf.feld.geaendert")})` : ""}
          </span>
        );
      })}
    </span>
  );
}

const KORREKTURPFAD: Readonly<Record<string, string>> = {
  luecke: "/risiko",
  konflikt: "/konflikte",
};

export function KlaraSchrittNachweis({
  auftrag,
  schritt: s,
  gespraechId,
  person,
}: {
  auftrag: KlaraAuftrag;
  schritt: KlaraAuftragSchritt;
  gespraechId: string | null;
  person: string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [protokoll, setProtokoll] = useState<
    | { lage: "zu" }
    | { lage: "laedt" }
    | { lage: "fehler" }
    | { lage: "da"; eintraege: KlaraProtokollEintrag[] }
  >({ lage: "zu" });
  const sprache = i18n.language;
  const vertrag = s.vertrag ?? null;
  const wirkungAm = verlaufszeit(auftrag, s.nr, WIRKUNGSEREIGNISSE);
  const zurueckAm = verlaufszeit(auftrag, s.nr, ["zurueckgenommen"]);
  const angelegt = s.aktion === "entwurf_erstellen";
  const gewirkt = s.stand === "gespeichert" || s.stand === "zurueckgenommen";
  const korrektur =
    vertrag === "aufgabe_prioritaet" || vertrag === "aufgabe_zuweisen"
      ? "luecke"
      : vertrag === "aufgabe_eskalieren"
        ? "konflikt"
        : null;
  const korrekturPfad = korrektur
    ? (s.ergebnis?.pfad ?? s.ziel.pfad ?? KORREKTURPFAD[korrektur] ?? null)
    : null;

  const ladeProtokoll = async (): Promise<void> => {
    if (!gespraechId) {
      return;
    }
    setProtokoll({ lage: "laedt" });
    try {
      const r = await klaraAuftragApi.protokoll(gespraechId, auftrag.id);
      setProtokoll({
        lage: "da",
        eintraege: r.eintraege.filter(
          (e) =>
            e.payload.nr === s.nr ||
            (s.aktionskennung !== undefined && e.payload.aktionskennung === s.aktionskennung),
        ),
      });
    } catch {
      setProtokoll({ lage: "fehler" });
    }
  };

  return (
    <details data-testid="klara-ausfuehrung-nachweis" data-nr={s.nr} className="mt-1">
      <summary className={`${KLEINTITEL} cursor-pointer`}>
        {t("assistenzverlauf.nachweis.titel")}
      </summary>
      <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.aktionskennung")}</dt>
        <dd data-testid="klara-nachweis-aktionskennung" className="break-all font-mono text-text">
          {s.aktionskennung ?? ""}
        </dd>
        <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.vorgang")}</dt>
        <dd data-testid="klara-nachweis-vorgang" className="text-text">
          {t("assistenzverlauf.nachweis.vorgangWert", {
            aktion: t(`klaraauftrag.aktion.${s.aktion}`),
            nr: s.nr,
            auftrag: auftrag.id,
          })}
        </dd>
        <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.zeitpunkt")}</dt>
        <dd data-testid="klara-nachweis-zeitpunkt" data-am={wirkungAm ?? ""} className="text-text">
          {wirkungAm ? zeitpunkt(wirkungAm, sprache) : "–"}
        </dd>
        <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.ausfuehrend")}</dt>
        <dd data-testid="klara-nachweis-ausfuehrend" className="text-text">
          {t("assistenzverlauf.nachweis.ausfuehrendWert", { person })}
        </dd>
        <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.ergebnis")}</dt>
        <dd data-testid="klara-nachweis-ergebnis" data-stand={s.stand} className="text-text">
          {t(`assistenzverlauf.protokoll.ereignis.${s.stand}`)}
          {s.ergebnis ? ` · ${s.ergebnis.titel}` : ""}
        </dd>
        {gewirkt ? (
          <>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.vorher")}</dt>
            <dd
              data-testid="klara-nachweis-vorher"
              data-stand={s.vorherStand ?? ""}
              className="text-text"
            >
              {standInWorten(s.vorherStand, t, sprache, angelegt ? "neu" : "unbekannt")}
              <Inhalt testId="klara-nachweis-vorher-inhalt" felder={s.vorher} />
            </dd>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.neu")}</dt>
            <dd
              data-testid="klara-nachweis-neu"
              data-stand={s.ergebnis?.stand ?? ""}
              className="text-text"
            >
              {standInWorten(s.ergebnis?.stand, t, sprache)}
              <Inhalt testId="klara-nachweis-neu-inhalt" felder={s.nachher} vergleich={s.vorher} />
            </dd>
          </>
        ) : null}
        {s.stand === "zurueckgenommen" ? (
          <>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.nachRuecknahme")}</dt>
            <dd
              data-testid="klara-nachweis-ruecknahme-stand"
              data-stand={s.ruecknahmeStand ?? ""}
              className="text-text"
            >
              {standInWorten(s.ruecknahmeStand, t, sprache)}
              {zurueckAm ? ` · ${zeitpunkt(zurueckAm, sprache)}` : ""}
            </dd>
          </>
        ) : null}
        {vertrag ? (
          <>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.wirkung")}</dt>
            <dd data-testid="klara-nachweis-wirkung" data-vertrag={vertrag} className="text-text">
              {t(`assistenzverlauf.vertrag.${vertrag}.wirkung`)}
            </dd>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.recht")}</dt>
            <dd data-testid="klara-nachweis-recht" className="text-text">
              {t(`assistenzverlauf.vertrag.${vertrag}.recht`)}
            </dd>
            <dt className={KLEINTITEL}>{t("assistenzverlauf.nachweis.ruecknahme")}</dt>
            <dd
              data-testid="klara-nachweis-ruecknahme"
              data-hinderung={s.ruecknahmeHinderung ?? ""}
              className="text-text"
            >
              {s.ruecknahmeHinderung === "fremdstand" ||
              s.ruecknahmeHinderung === "nicht_gespeichert"
                ? t(`assistenzverlauf.hinderung.${s.ruecknahmeHinderung}`)
                : t(`assistenzverlauf.vertrag.${vertrag}.ruecknahme`)}
              {korrektur && korrekturPfad && s.stand === "gespeichert" ? (
                <>
                  {" "}
                  <Link
                    to={internerPfad(korrekturPfad, HOME_ROUTE)}
                    data-testid="klara-nachweis-korrekturweg"
                    className={VERWEIS}
                  >
                    {t(`assistenzverlauf.korrigieren.${korrektur}`)}
                  </Link>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="mt-1">
        <p className={KLEINTITEL}>{t("assistenzverlauf.protokoll.titel")}</p>
        {protokoll.lage === "da" ? (
          protokoll.eintraege.length === 0 ? (
            <p className="text-[11px] text-muted">{t("assistenzverlauf.protokoll.leer")}</p>
          ) : (
            <ol data-testid="klara-nachweis-protokoll" className="text-[11px] text-muted">
              {protokoll.eintraege.map((e) => (
                <li
                  key={e.seq}
                  data-testid="klara-nachweis-protokoll-eintrag"
                  data-action={e.action}
                  data-aktionskennung={String(e.payload.aktionskennung ?? "")}
                  data-stand={String(e.payload.stand ?? "")}
                >
                  {t("assistenzverlauf.protokoll.eintrag", {
                    seq: e.seq,
                    zeit: zeitpunkt(e.at, sprache),
                    ereignis: ereignisInWorten(e, t),
                  })}
                </li>
              ))}
            </ol>
          )
        ) : (
          <button
            type="button"
            data-testid="klara-nachweis-protokoll-laden"
            disabled={protokoll.lage === "laedt" || !gespraechId}
            onClick={() => void ladeProtokoll()}
            className={KNOPF}
          >
            {protokoll.lage === "laedt"
              ? t("assistenzverlauf.protokoll.laedt")
              : t("assistenzverlauf.protokoll.laden")}
          </button>
        )}
        {protokoll.lage === "fehler" ? (
          <p role="alert" className="text-[11px] text-trust-crit-text">
            {t("assistenzverlauf.protokoll.fehler")}
          </p>
        ) : null}
        <p className="text-[10.5px] text-muted-2">{t("assistenzverlauf.protokoll.hinweis")}</p>
      </div>
    </details>
  );
}

/** PV-02-05: die erklärte Ablehnung einer Rücknahme — betroffener Stand und Weg zum Korrigieren. */
export function KlaraRuecknahmeKonflikt({
  konflikt,
}: {
  konflikt: RuecknahmeKonflikt;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const sprache = i18n.language;
  const weg = konflikt.korrekturweg;
  const pfad = konflikt.pfad ?? (weg ? (KORREKTURPFAD[weg] ?? null) : null);
  return (
    <div
      data-testid="klara-ausfuehrung-ruecknahme-konflikt"
      data-grund={konflikt.grund}
      className="mt-0.5 rounded-btn border border-dashed border-hairline px-2 py-1 text-[11px]"
    >
      <p className="font-semibold text-text">{t("assistenzverlauf.konflikt.titel")}</p>
      {konflikt.eigenerStand || konflikt.aktuellerStand ? (
        <p
          data-testid="klara-ruecknahme-konflikt-staende"
          data-eigen={konflikt.eigenerStand ?? ""}
          data-aktuell={konflikt.aktuellerStand ?? ""}
          className="text-text"
        >
          {t("assistenzverlauf.konflikt.staende", {
            eigen: standInWorten(konflikt.eigenerStand, t, sprache),
            aktuell: standInWorten(konflikt.aktuellerStand, t, sprache),
          })}
        </p>
      ) : null}
      {konflikt.fuerAndereSichtbar ? (
        <p className="text-text">{t("assistenzverlauf.konflikt.andere")}</p>
      ) : null}
      {pfad && weg ? (
        <Link
          to={internerPfad(pfad, HOME_ROUTE)}
          data-testid="klara-ruecknahme-konflikt-korrekturweg"
          className={VERWEIS}
        >
          {t(`assistenzverlauf.korrigieren.${weg}`, { defaultValue: "" })}
        </Link>
      ) : null}
    </div>
  );
}
