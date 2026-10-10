// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen) — DIE KARTE EINES AUSFÜHRUNGSAUFTRAGS.
// ================================================================================================
//
// Was die Person sieht, steht am Server (`auftrag.ts` → `/api/me/klara/…/auftraege`):
//   · die GRENZE des Auftrags — Ziel, erlaubte Aktionen, erlaubte Quellen, verantwortliche Person,
//     Ergebnisanforderung, Fassung (mit früheren Fassungen nach einer Korrektur);
//   · der STAND, abgeleitet aus den Schritten: vorgeschlagen, läuft, abgeschlossen, teilweise,
//     fehlgeschlagen, abgebrochen — und je Schritt begonnen, gespeichert, abgeschlossen,
//     fehlgeschlagen, zurückgenommen, mit dem tatsächlichen Grund;
//   · Ziel und Ergebnis als Rückweg in die Anwendung;
//   · ABBRECHEN (keine weiteren Schritte) und RÜCKGÄNGIG (eine gespeicherte Änderung zurück) als zwei
//     getrennte Knöpfe; nicht Rücknehmbares steht als solches da.
// Kein Text dieser Karte wird als Handlung gelesen.
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KlaraAktion, KlaraAuftragSchritt } from "../../api/klaraAuftrag";
import { useSession } from "../../app/AuthContext";
import { HOME_ROUTE } from "../../app/navigation";
import { internerPfad } from "../../lib/internerPfad";
import {
  type AuftragsUmgebung,
  type Ausfuehrung,
  type GeplanterSchritt,
  type LokalerSchritt,
  aufgabenaktionText,
  brecheAuftragAb,
  korrigiereAuftrag,
  nimmZurueck,
  offeneSchritte,
  schliesseAusfuehrung,
  serverSchritt,
  useAusfuehrungen,
  waehleAufgabenaktion,
  waehlePerson,
  waehleZiel,
  wiederhole,
} from "./auftrag";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const VERWEIS = "font-semibold text-brand-text hover:underline";

const UNWIDERRUFLICH: readonly KlaraAktion[] = ["oeffnen", "aufgabe_bearbeiten"];

interface Zeile {
  nr: number;
  aktion: KlaraAktion;
  titel: string;
  zielPfad: string | null;
  server: KlaraAuftragSchritt | undefined;
  lokal: LokalerSchritt | undefined;
}

function zeilenAus(a: Ausfuehrung): Zeile[] {
  if (a.geplant.length > 0) {
    return a.geplant.map((s: GeplanterSchritt) => {
      const server = serverSchritt(a, s.schluessel);
      return {
        nr: s.nr,
        aktion: s.erkannt.aktion,
        titel: server?.ziel.titel ?? s.ziel?.titel ?? s.erkannt.name,
        zielPfad: server?.ziel.pfad ?? s.ziel?.pfad ?? null,
        server,
        lokal: a.lokal[s.nr],
      };
    });
  }
  return (a.auftrag?.schritte ?? []).map((s) => ({
    nr: s.nr,
    aktion: s.aktion,
    titel: s.ziel.titel,
    zielPfad: s.ziel.pfad,
    server: s,
    lokal: undefined,
  }));
}

/** Der sichtbare Stand eines Schritts: unklar vor allem, dann der Server, dann was hier geschah. */
function zeilenStand(z: Zeile): string {
  if (z.lokal?.lage === "unklar") {
    return "unklar";
  }
  // Nacharbeit 4: gespeichert, Nachlesen ausstehend — ungeklärt, auch nach dem Neuladen.
  if (z.server?.stand === "begonnen" && z.server.schreibwirkung && !z.server.geprueft) {
    return "unklar";
  }
  if (z.server) {
    return z.server.stand;
  }
  return z.lokal?.lage ?? "geplant";
}

/** Der nachgelesene Stand einer Aufgabenaktion in Worten („prioritaet:hoch“ → „Priorität hoch“). */
function nachgelesenText(stand: string | null, t: TFunction): string {
  const roh = stand ?? "";
  const trenner = roh.indexOf(":");
  const art = trenner < 0 ? roh : roh.slice(0, trenner);
  const wert = trenner < 0 ? "" : roh.slice(trenner + 1);
  if (art === "prioritaet") {
    return t("klaraauftrag.nachgelesen.prioritaet", { wert: t(`klaraauftrag.prioritaet.${wert}`) });
  }
  if (art === "zugewiesen") {
    return t("klaraauftrag.nachgelesen.zugewiesen", { person: wert });
  }
  return art === "eskaliert" ? t("klaraauftrag.nachgelesen.eskaliert") : (stand ?? "");
}

export function KlaraAusfuehrungen({
  umgebung,
}: {
  umgebung: () => AuftragsUmgebung;
}): JSX.Element | null {
  const liste = useAusfuehrungen();
  if (liste.length === 0) {
    return null;
  }
  return (
    <div data-testid="klara-ausfuehrungen" className="space-y-2">
      {liste.slice(0, 3).map((a) => (
        <AusfuehrungKarte key={a.lokalId} a={a} umgebung={umgebung} />
      ))}
    </div>
  );
}

function AusfuehrungKarte({
  a,
  umgebung,
}: {
  a: Ausfuehrung;
  umgebung: () => AuftragsUmgebung;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const sitzung = useSession();
  const [korrektur, setKorrektur] = useState<number[] | null>(null);
  const auftrag = a.auftrag;
  const stand = auftrag?.stand ?? null;
  const laeuft = a.phase === "laeuft" || a.phase === "pruefen";
  const offen = offeneSchritte(a);
  const zeilen = zeilenAus(a);
  // Begonnen oder gerade am Server in Arbeit — beides kann schon gewirkt haben.
  const geschehen = zeilen.filter(
    (z) => z.server || z.lokal?.lage === "laeuft" || z.lokal?.lage === "unklar",
  ).length;
  const unklar = zeilen.some((z) => zeilenStand(z) === "unklar");
  // Gespeichert, Nachlesen ausstehend: nachlesen bleibt auch nach Abbrechen möglich (kein neuer Schritt).
  const wirkungOffen = zeilen.some(
    (z) => z.server?.stand === "begonnen" && z.server.schreibwirkung && !z.server.geprueft,
  );
  const zeit = (iso: string): string =>
    new Date(iso).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const ich = sitzung.user;
  const verantwortlich =
    auftrag && ich && auftrag.verantwortlich === ich.id
      ? (ich.name ?? ich.email ?? ich.id)
      : (auftrag?.verantwortlich ?? "");
  const fehlerPhase = a.phase === "unbekannt" || a.phase === "fehler";

  return (
    <section
      data-testid="klara-ausfuehrung"
      data-phase={a.phase}
      data-stand={stand ?? ""}
      data-quelle={a.quelle}
      className="rounded-card border border-ai/40 bg-surface px-3 py-2.5"
    >
      <h3 className="text-[12px] font-semibold text-ink">
        {t("klaraauftrag.titel", { quelle: t(`klaraauftrag.quelleArt.${a.quelle}`) })}
      </h3>
      <p data-testid="klara-ausfuehrung-wortlaut" className="mt-0.5 text-[11.5px] text-muted">
        {t("klaraauftrag.wortlaut", { text: a.wortlaut })}
      </p>
      <p data-testid="klara-ausfuehrung-ohne-ki" className="mt-0.5 text-[10.5px] text-muted-2">
        {t("klaraauftrag.ohneKi")}
      </p>

      {auftrag ? (
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.ziel")}</dt>
          <dd data-testid="klara-ausfuehrung-ziel" className="text-text">
            {auftrag.ziel}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.aktionen")}</dt>
          <dd data-testid="klara-ausfuehrung-aktionen" className="text-text">
            {auftrag.erlaubteAktionen.map((x) => t(`klaraauftrag.aktion.${x}`)).join(", ")}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.ziele")}</dt>
          <dd data-testid="klara-ausfuehrung-ziele" className="text-text">
            {auftrag.erlaubteZiele
              .map((z) =>
                t("klaraauftrag.zielEintrag", {
                  titel: z.titel,
                  art: t(`klaraauftrag.zielArt.${z.art}`),
                }),
              )
              .join(" · ")}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.quellen")}</dt>
          <dd data-testid="klara-ausfuehrung-quellen" className="text-text">
            {auftrag.erlaubteQuellen.join(" · ")}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.verantwortlich")}</dt>
          <dd data-testid="klara-ausfuehrung-verantwortlich" className="text-text">
            {verantwortlich}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.ergebnis")}</dt>
          <dd data-testid="klara-ausfuehrung-ergebnisanforderung" className="text-text">
            {auftrag.ergebnis}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.fassung")}</dt>
          <dd
            data-testid="klara-ausfuehrung-fassung"
            data-fassung={auftrag.fassung}
            className="text-text"
          >
            {t("klaraauftrag.fassungWert", { fassung: auftrag.fassung })}
            {auftrag.fassungen.length > 0 ? (
              <ul
                data-testid="klara-ausfuehrung-fassungen"
                className="mt-0.5 text-[11px] text-muted"
              >
                {auftrag.fassungen.map((f, i) => (
                  <li key={f.fassung}>
                    {t("klaraauftrag.fassungAenderung", {
                      von: f.fassung,
                      nach: auftrag.fassungen[i + 1]?.fassung ?? auftrag.fassung,
                      grund: (auftrag.fassungen[i + 1] ?? auftrag).grund ?? "",
                      aktionen: f.erlaubteAktionen
                        .map((x) => t(`klaraauftrag.aktion.${x}`))
                        .join(", "),
                      schritte: f.geplanteSchritte,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </dd>
          <dt className={KLEINTITEL}>{t("klaraauftrag.feld.stand")}</dt>
          <dd
            data-testid="klara-ausfuehrung-stand"
            data-stand={stand ?? ""}
            className="font-semibold text-text"
          >
            {/* Nacharbeit 2: ist eine Antwort verloren, kennt dieser Browser den Stand nicht — dann
                steht genau das da, nicht ein veralteter Stand. */}
            {unklar
              ? t("klaraauftrag.stand.unklar")
              : stand
                ? t(`klaraauftrag.stand.${stand}`)
                : ""}
          </dd>
        </dl>
      ) : null}

      {a.phase === "pruefen" && !auftrag ? (
        <p data-testid="klara-ausfuehrung-pruefen" className="mt-1 text-[11.5px] text-ai">
          {t("klaraauftrag.phase.pruefen")}
        </p>
      ) : null}
      {a.meldung ? (
        <p
          data-testid="klara-ausfuehrung-meldung"
          {...(fehlerPhase ? { role: "alert" } : {})}
          className={`mt-1 text-[11.5px] ${fehlerPhase ? "text-trust-crit-text" : "text-muted"}`}
        >
          {a.meldung}
        </p>
      ) : null}
      {a.phase === "angehalten" && a.geplant.length === 0 ? (
        <p data-testid="klara-ausfuehrung-unterbrochen" className="mt-1 text-[11.5px] text-muted">
          {t("klaraauftrag.unterbrochen")}
        </p>
      ) : null}

      {/* Rückfrage: mehrere Ziele passen — gewählt wird, BEVOR etwas geschieht. */}
      {a.phase === "rueckfrage"
        ? a.geplant
            .filter((s) => s.kandidaten.length > 1)
            .map((s) => (
              <fieldset
                key={s.nr}
                data-testid="klara-ausfuehrung-rueckfrage"
                data-nr={s.nr}
                className="mt-1.5 rounded-btn border border-hairline px-2 py-1.5"
              >
                <legend className="px-1 text-[11.5px] text-text">
                  {t("klaraauftrag.rueckfrageZu", { name: s.erkannt.name })}
                </legend>
                <div className="flex flex-wrap gap-1">
                  {s.kandidaten.map((k, i) => (
                    <button
                      key={`${k.art}-${k.id ?? k.titel}`}
                      type="button"
                      data-testid="klara-ausfuehrung-option"
                      data-id={k.id ?? ""}
                      onClick={() => waehleZiel(a.lokalId, s.nr, i, umgebung())}
                      className={KNOPF}
                    >
                      {t("klaraauftrag.zielEintrag", {
                        titel: k.titel,
                        art: t(`klaraauftrag.zielArt.${k.art}`),
                      })}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))
        : null}
      {/* Nacharbeit 4: Rückfrage zur Aufgabe — welche Aktion bzw. welche Person, BEVOR etwas geschieht. */}
      {a.phase === "rueckfrage"
        ? a.geplant
            .filter((s) => (s.aktionsoptionen?.length ?? 0) > 0 || (s.personen?.length ?? 0) > 1)
            .map((s) => {
              const titel = s.ziel?.titel ?? s.erkannt.name;
              const personen = s.personen ?? [];
              return (
                <fieldset
                  key={`aufgabe-${s.nr}`}
                  data-testid="klara-ausfuehrung-rueckfrage-aufgabe"
                  data-nr={s.nr}
                  className="mt-1.5 rounded-btn border border-hairline px-2 py-1.5"
                >
                  <legend className="px-1 text-[11.5px] text-text">
                    {personen.length > 1
                      ? t("klaraauftrag.rueckfragePerson", { titel })
                      : t("klaraauftrag.rueckfrageAktion", { titel })}
                  </legend>
                  <div className="flex flex-wrap gap-1">
                    {personen.length > 1
                      ? personen.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            data-testid="klara-ausfuehrung-person-option"
                            data-id={p.id}
                            onClick={() => waehlePerson(a.lokalId, s.nr, i, umgebung())}
                            className={KNOPF}
                          >
                            {p.name}
                          </button>
                        ))
                      : (s.aktionsoptionen ?? []).map((o, i) => (
                          <button
                            key={JSON.stringify(o)}
                            type="button"
                            data-testid="klara-ausfuehrung-aktion-option"
                            data-art={o.art}
                            onClick={() => waehleAufgabenaktion(a.lokalId, s.nr, i, umgebung())}
                            className={KNOPF}
                          >
                            {aufgabenaktionText(o, t)}
                          </button>
                        ))}
                  </div>
                </fieldset>
              );
            })
        : null}

      {zeilen.length > 0 && a.phase !== "unbekannt" && a.phase !== "rueckfrage" ? (
        <ol className="mt-1.5 space-y-1">
          {zeilen.map((z) => {
            const sichtbar = zeilenStand(z);
            const s = z.server;
            const ergebnisOffen =
              s?.ergebnis && (s.stand === "gespeichert" || s.stand === "abgeschlossen");
            // Nacharbeit 2: ein am Server gescheiterter Schritt trägt seinen Grundschlüssel — der Satz
            // dazu steht in der Sprache der Fläche, nicht in der des Servers.
            // Nacharbeit 5: gespeichert, aber inzwischen fremd geändert (`fremdstand`) — steht da.
            const meldung =
              s?.stand === "fehlgeschlagen"
                ? s.fehlerCode
                  ? t(`klaraauftrag.fehlerCode.${s.fehlerCode}`, { defaultValue: s.grund ?? "" })
                  : s.grund
                : s?.stand === "gespeichert" && s.fehlerCode
                  ? t(`klaraauftrag.fehlerCode.${s.fehlerCode}`)
                  : z.lokal?.meldung;
            // Öffnen bleibt Öffnen: ein abgeschlossener Öffnen-/Aufgabenschritt heisst „geöffnet“.
            // Nacharbeit 4: eine ausgeführte Aufgabenaktion zeigt, was am Server nachgelesen wurde.
            const aufgabeAusgefuehrt =
              s?.stand === "gespeichert" && s.aktion === "aufgabe_bearbeiten";
            const standText = aufgabeAusgefuehrt
              ? t("klaraauftrag.schrittStand.ausgefuehrt", {
                  stand: nachgelesenText(s.ergebnis?.stand ?? null, t),
                })
              : s?.stand === "abgeschlossen" && UNWIDERRUFLICH.includes(s.aktion)
                ? t(`klaraauftrag.schrittStand.geoeffnet.${s.aktion}`)
                : t(`klaraauftrag.schrittStand.${sichtbar}`);
            // Ungeklärt, aber die Kennung des Gespeicherten ist bekannt: der Weg dorthin bleibt da.
            const bekannteWirkung =
              sichtbar === "unklar" && s?.schreibwirkung && !ergebnisOffen
                ? s.schreibwirkung
                : null;
            return (
              <li
                key={z.nr}
                data-testid="klara-ausfuehrung-schritt"
                data-nr={z.nr}
                data-stand={sichtbar}
                data-aktion={z.aktion}
                className="rounded-btn border border-hairline px-2 py-1 text-[11.5px]"
              >
                <p className="text-text">
                  {t("klaraauftrag.schritt", {
                    nr: z.nr,
                    aktion: t(`klaraauftrag.aktion.${z.aktion}`),
                    titel: z.titel,
                  })}
                  {" · "}
                  <span data-testid="klara-ausfuehrung-schritt-stand" className="font-semibold">
                    {standText}
                  </span>
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-3">
                  {z.zielPfad ? (
                    <Link
                      to={internerPfad(z.zielPfad, HOME_ROUTE)}
                      data-testid="klara-ausfuehrung-schritt-ziel"
                      className={VERWEIS}
                    >
                      {t("klaraauftrag.zumZiel", { titel: z.titel })}
                    </Link>
                  ) : null}
                  {ergebnisOffen && s?.ergebnis ? (
                    <Link
                      to={internerPfad(s.ergebnis.pfad, HOME_ROUTE)}
                      data-testid="klara-ausfuehrung-schritt-ergebnis"
                      data-id={s.ergebnis.id}
                      className={VERWEIS}
                    >
                      {t("klaraauftrag.zumErgebnis", { titel: s.ergebnis.titel })}
                    </Link>
                  ) : null}
                  {bekannteWirkung ? (
                    <Link
                      to={internerPfad(bekannteWirkung.pfad, HOME_ROUTE)}
                      data-testid="klara-ausfuehrung-schritt-wirkung"
                      data-id={bekannteWirkung.id}
                      className={VERWEIS}
                    >
                      {t("klaraauftrag.wirkungBekannt")}
                    </Link>
                  ) : null}
                </div>
                {meldung ? (
                  <p
                    data-testid="klara-ausfuehrung-schritt-meldung"
                    {...(sichtbar === "fehlgeschlagen" || sichtbar === "unklar"
                      ? { role: "alert" }
                      : {})}
                    className="mt-0.5 text-[11px] text-trust-crit-text"
                  >
                    {meldung}
                  </p>
                ) : null}
                {s && s.stand === "abgeschlossen" && UNWIDERRUFLICH.includes(s.aktion) ? (
                  <p
                    data-testid="klara-ausfuehrung-schritt-endgueltig"
                    className="mt-0.5 text-[11px] text-muted-2"
                  >
                    {t("klaraauftrag.endgueltig")}
                  </p>
                ) : null}
                {aufgabeAusgefuehrt ? (
                  <p
                    data-testid="klara-ausfuehrung-schritt-nicht-ruecknehmbar"
                    className="mt-0.5 text-[11px] text-muted-2"
                  >
                    {t("klaraauftrag.nichtRuecknehmbar.aufgabe")}
                  </p>
                ) : null}
                {s?.stand === "zurueckgenommen" ? (
                  <p
                    data-testid="klara-ausfuehrung-schritt-zurueckgenommen"
                    className="mt-0.5 text-[11px] text-muted"
                  >
                    {s.aktion === "entwurf_erstellen"
                      ? t("klaraauftrag.zurueckgenommen.angelegt")
                      : t("klaraauftrag.zurueckgenommen.bearbeitet")}
                  </p>
                ) : null}
                {s?.ruecknehmbar && ergebnisOffen ? (
                  <button
                    type="button"
                    data-testid="klara-ausfuehrung-rueckgaengig"
                    data-nr={z.nr}
                    disabled={z.lokal?.ruecknahme === "laeuft"}
                    onClick={() => void nimmZurueck(a.lokalId, z.nr, umgebung())}
                    className={`${KNOPF} mt-1 h-7 text-[11px]`}
                  >
                    {t("klaraauftrag.knopf.rueckgaengig")}
                  </button>
                ) : null}
                {z.lokal?.ruecknahmeMeldung ? (
                  <p
                    data-testid="klara-ausfuehrung-ruecknahme-meldung"
                    role="alert"
                    className="mt-0.5 text-[11px] text-trust-crit-text"
                  >
                    {z.lokal.ruecknahmeMeldung}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {auftrag && auftrag.verlauf.length > 0 ? (
        <details data-testid="klara-ausfuehrung-verlauf-block" className="mt-1.5">
          <summary className={`${KLEINTITEL} cursor-pointer`}>
            {t("klaraauftrag.verlauf.titel")}
          </summary>
          <ol data-testid="klara-ausfuehrung-verlauf" className="mt-0.5 space-y-0.5 text-[11px]">
            {auftrag.verlauf.map((v) => (
              <li
                key={`${v.am}|${v.ereignis}|${v.nr ?? "-"}|${v.fassung}`}
                data-ereignis={v.ereignis}
                className="text-muted"
              >
                {t("klaraauftrag.verlauf.eintrag", {
                  zeit: zeit(v.am),
                  ereignis: t(`klaraauftrag.ereignis.${v.ereignis}`, { nr: v.nr ?? "" }),
                  fassung: v.fassung,
                })}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {korrektur !== null ? (
        <section
          data-testid="klara-korrektur"
          className="mt-1.5 rounded-btn border border-dashed border-hairline px-2 py-1.5"
        >
          <p className={KLEINTITEL}>{t("klaraauftrag.korrektur.titel")}</p>
          <p className="text-[11px] text-muted">{t("klaraauftrag.korrektur.erklaerung")}</p>
          <p data-testid="klara-korrektur-geschehen" className="mt-0.5 text-[11px] text-text">
            {t("klaraauftrag.korrektur.geschehen", { anzahl: geschehen })}
          </p>
          <div className="mt-1 space-y-0.5">
            {offen.map((s) => (
              <label key={s.nr} className="flex items-center gap-1.5 text-[11.5px] text-text">
                <input
                  type="checkbox"
                  data-testid="klara-korrektur-schritt"
                  data-nr={s.nr}
                  checked={korrektur.includes(s.nr)}
                  onChange={(e) =>
                    setKorrektur((alt) =>
                      alt === null
                        ? alt
                        : e.target.checked
                          ? [...alt, s.nr]
                          : alt.filter((x) => x !== s.nr),
                    )
                  }
                />
                {t("klaraauftrag.schritt", {
                  nr: s.nr,
                  aktion: t(`klaraauftrag.aktion.${s.erkannt.aktion}`),
                  titel: s.ziel?.titel ?? s.erkannt.name,
                })}
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="klara-korrektur-speichern"
              disabled={geschehen + korrektur.length === 0}
              onClick={() => {
                const behalten = korrektur;
                setKorrektur(null);
                void korrigiereAuftrag(a.lokalId, behalten, umgebung());
              }}
              className={KNOPF_KI}
            >
              {t("klaraauftrag.knopf.korrekturSpeichern")}
            </button>
            <button
              type="button"
              data-testid="klara-korrektur-verwerfen"
              onClick={() => setKorrektur(null)}
              className={KNOPF}
            >
              {t("klaraauftrag.knopf.korrekturVerwerfen")}
            </button>
          </div>
        </section>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(laeuft || a.phase === "rueckfrage" || a.phase === "angehalten") && !a.abbruch ? (
          <button
            type="button"
            data-testid="klara-ausfuehrung-abbrechen"
            onClick={() => void brecheAuftragAb(a.lokalId, umgebung())}
            className={KNOPF}
          >
            {t("klaraauftrag.knopf.abbrechen")}
          </button>
        ) : null}
        {a.phase === "angehalten" && unklar && (!a.abbruch || wirkungOffen) ? (
          <button
            type="button"
            data-testid="klara-ausfuehrung-erneut"
            onClick={() => wiederhole(a.lokalId, umgebung())}
            className={KNOPF_KI}
          >
            {t("klaraauftrag.knopf.erneut")}
          </button>
        ) : null}
        {auftrag &&
        (laeuft || a.phase === "angehalten") &&
        !a.abbruch &&
        offen.length > 0 &&
        korrektur === null ? (
          <button
            type="button"
            data-testid="klara-ausfuehrung-korrigieren"
            onClick={() => setKorrektur(offen.map((s) => s.nr))}
            className={KNOPF}
          >
            {t("klaraauftrag.knopf.korrigieren")}
          </button>
        ) : null}
        {a.phase === "fertig" || fehlerPhase ? (
          <button
            type="button"
            data-testid="klara-ausfuehrung-schliessen"
            onClick={() => schliesseAusfuehrung(a.lokalId)}
            className={KNOPF}
          >
            {t("klaraauftrag.knopf.schliessen")}
          </button>
        ) : null}
      </div>
      <p
        data-testid="klara-ausfuehrung-hinweis"
        className="mt-1.5 text-[10.5px] leading-relaxed text-muted-2"
      >
        {t("klaraauftrag.hinweis")}
      </p>
    </section>
  );
}
