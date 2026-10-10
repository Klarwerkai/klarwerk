// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DIE EINE DARSTELLUNG DES PROTOKOLLS.
// ================================================================================================
//
// Zwei Karten lesen dieselbe Kette: das Prüfprotokoll (alle Vorgänge, mit Kettenprüfung und Export)
// und die knappe Auth-Ansicht (nur Konto- und Anmeldeereignisse). Bis hierher zeigte die zweite den
// ROHEN Aktionscode und die Kennung des Handelnden — eine eigene, schlechtere Fassung desselben
// Protokolls. Ab hier teilen sich beide diese Datei:
//
//   · `AuditTabelle`      Zeitpunkt mit Zeitzone, verständliches Ereignis, Personen mit Namen (und
//                         woher der Name stammt), das betroffene Objekt beim Titel mit Rücklink —
//                         nur wenn der Server es für diesen Betrachter freigegeben hat — und je
//                         Eintrag die technischen Angaben: Nummer, Zeitpunkt in UTC, Rohaktion,
//                         Kennungen, Prüfwert.
//   · `AuditFilterLeiste` Person, Vorgang, Betroffen und Zeitraum, beliebig kombinierbar.
//   · `useAuditAdressfilter` Die Filter und die Seite stehen in der ADRESSE. Wer aus dem Protokoll
//                         in einen Beitrag springt und zurückkehrt, findet dieselben Filter und
//                         dieselbe Seite wieder.
//   · `AuditSeitenleiste` Ältere Einträge seitenweise, nie die unbeschränkte Gesamtliste.
//
// Die Abfragen selbst (`useAuditSeite`, `useDirectory`) stehen in den Seiten
// (`pages/AdminSicherheitDetails.tsx`, `pages/AdminDatenDetails.tsx`) — dort, wo die Matrix der
// Zustandswege sie zählt (`tests/design/h6-detail-zustandsweg.test.ts`).
import { type FormEvent, Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import type { AuditEntry, AuditSeite } from "../../api/types";
import { auditActionLabel } from "../../lib/auditAction";
import {
  type DetailZeile,
  type VerzeichnisLage,
  auditEventDetail,
  kontoBelege,
  mehrdeutigeNamen,
  protokollNamen,
  verzeichnisNamen,
} from "../../lib/auditEventDetail";
import {
  type AuditFilterWerte,
  LEERE_AUDIT_FILTER,
  zeitpunktMitZone,
  zeitraumVerkehrt,
} from "../../lib/auditFilter";
import { Button } from "../ui";
import { abfragelage, useIstOnline, wertBefund } from "./zeilenWert";

// ------------------------------------------------------------------------------------------------
// Die Filter in der Adresse
// ------------------------------------------------------------------------------------------------

/** Die Adressparameter — mit eigenem Präfix, damit sie nie mit `bereich`/`detail` kollidieren. */
export const AUDIT_ADRESSE = {
  person: "a_person",
  aktion: "a_aktion",
  ziel: "a_ziel",
  von: "a_von",
  bis: "a_bis",
  vor: "a_vor",
} as const;

export interface AuditAdressfilter {
  werte: AuditFilterWerte;
  /** Der Zeiger der aktuellen Seite — `undefined` heißt „die neuesten Einträge". */
  vor: number | undefined;
  gefiltert: boolean;
  anwenden: (werte: AuditFilterWerte) => void;
  zuruecksetzen: () => void;
  aelter: (vor: number) => void;
  neueste: () => void;
}

/**
 * Filter und Seite aus der Adresse — und Änderungen als neue Adresse (Verlaufseintrag). So bringt
 * „Zurück" im Browser den vorigen Filter oder die vorige Seite zurück, und ein Rücksprung aus einem
 * Beitrag landet wieder in genau dieser Ansicht.
 */
export function useAuditAdressfilter(): AuditAdressfilter {
  const [params, setParams] = useSearchParams();
  const werte: AuditFilterWerte = {
    person: params.get(AUDIT_ADRESSE.person) ?? "",
    aktion: params.get(AUDIT_ADRESSE.aktion) ?? "",
    ziel: params.get(AUDIT_ADRESSE.ziel) ?? "",
    von: params.get(AUDIT_ADRESSE.von) ?? "",
    bis: params.get(AUDIT_ADRESSE.bis) ?? "",
  };
  const vorRoh = params.get(AUDIT_ADRESSE.vor) ?? "";
  const vor = /^\d{1,9}$/.test(vorRoh) && Number(vorRoh) > 0 ? Number(vorRoh) : undefined;

  const setze = (neu: Partial<AuditFilterWerte>, neuerZeiger: number | undefined): void => {
    setParams((alt) => {
      const naechste = new URLSearchParams(alt);
      for (const feld of Object.keys(LEERE_AUDIT_FILTER) as (keyof AuditFilterWerte)[]) {
        const wert = (neu[feld] ?? werte[feld]).trim();
        if (wert === "") {
          naechste.delete(AUDIT_ADRESSE[feld]);
        } else {
          naechste.set(AUDIT_ADRESSE[feld], wert);
        }
      }
      if (neuerZeiger === undefined) {
        naechste.delete(AUDIT_ADRESSE.vor);
      } else {
        naechste.set(AUDIT_ADRESSE.vor, String(neuerZeiger));
      }
      return naechste;
    });
  };

  return {
    werte,
    vor,
    gefiltert: Object.values(werte).some((w) => w !== ""),
    // Ein neuer Filter beginnt immer bei den neuesten Einträgen.
    anwenden: (neu) => setze(neu, undefined),
    zuruecksetzen: () => setze(LEERE_AUDIT_FILTER, undefined),
    aelter: (naechsterZeiger) => setze({}, naechsterZeiger),
    neueste: () => setze({}, undefined),
  };
}

// ------------------------------------------------------------------------------------------------
// Das Verzeichnis als Lage (unverändert aus der Verwalteransicht übernommen)
// ------------------------------------------------------------------------------------------------

interface VerzeichnisAbfrage {
  data: readonly { id: string; name: string }[] | undefined;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: string;
  dataUpdatedAt: number;
}

/**
 * JOB 3140: das Verzeichnis ist eine NACHRANGIGE Quelle. Sein Zustand wird über dasselbe Modell
 * gelesen wie jede Einstellungszeile (`zeilenWert.ts`) — damit die Tatsachenaussage „Konto nicht mehr
 * vorhanden" nur aus einer erfolgreichen, frischen Antwort entstehen kann (drei Lagen, R2).
 */
export function useVerzeichnislage(abfrage: VerzeichnisAbfrage): VerzeichnisLage {
  const online = useIstOnline();
  const lage = abfragelage(abfrage, online);
  const befund = wertBefund(lage, null);
  const daten = abfrage.data;
  const laeuft = lage.laeuft;
  const veraltet = befund.nichtAktualisiert;
  return useMemo((): VerzeichnisLage => {
    if (befund.art === "laedt") {
      return { art: "laedt" };
    }
    if (befund.art === "fehler" || befund.art === "offline") {
      return { art: "nichtAbrufbar" };
    }
    return {
      art: "geladen",
      namen: verzeichnisNamen(daten),
      stand: veraltet ? "veraltet" : laeuft ? "laeuftNach" : "frisch",
    };
  }, [befund.art, veraltet, laeuft, daten]);
}

/** Die Verzeichnisnamen für die Personenauswahl — leer, solange nichts geladen ist. */
function verzeichnisListe(lage: VerzeichnisLage): [string, string][] {
  if (lage.art !== "geladen") {
    return [];
  }
  return [...lage.namen].sort((a, b) => a[1].localeCompare(b[1]));
}

// ------------------------------------------------------------------------------------------------
// Die Tabelle
// ------------------------------------------------------------------------------------------------

/** Verwalteransicht (N-0027): die Spaltenköpfe des Prüfprotokolls in ihrer Reihenfolge. */
export const AUDIT_SPALTEN = [
  "auditprotokoll.spalte.zeit",
  "audit.detail.event",
  "audit.detail.actor",
  "audit.detail.target",
  "audit.detail.roleBefore",
  "audit.detail.roleAfter",
  "auditprotokoll.spalte.technik",
] as const;

// Welche Detailzeile (`lib/auditEventDetail.ts`) in welche Spalte fällt. Die Spalte „Betroffen"
// nimmt ein Konto ebenso wie ein Objekt auf; die Zeile behält ihre eigene Beschriftung als Merkmal.
const ZEILEN_SPALTEN: readonly (readonly string[])[] = [
  ["audit.detail.actor"],
  ["audit.detail.target", "audit.detail.targetObject"],
  ["audit.detail.roleBefore"],
  ["audit.detail.roleAfter"],
];

/**
 * JOB 3140 (UX-11): der Wert einer Detailzeile — reiner Text. Welche Aussage gilt, entscheidet
 * `lib/auditEventDetail.ts`; hier wird nur gerendert.
 *
 * produkt:20261009:admin-audit-verstaendlich: dazu (K3) die Herkunft eines Namens, wenn er NICHT im
 * Eintrag selbst gespeichert ist, und (K1) eine Kurzkennung, wenn derselbe Name zu mehreren
 * Kennungen gehört.
 */
function DetailWert({
  zeile,
  mehrdeutig,
}: {
  zeile: DetailZeile;
  mehrdeutig: ReadonlySet<string>;
}): JSX.Element {
  const { t } = useTranslation();
  if (zeile.kind === "missing") {
    return <span className="italic text-muted-2">{t("audit.detail.notStored")}</span>;
  }
  const kennungInSpalte = zeile.kind === "id" && zeile.hinweisKey === undefined;
  const mehrdeutigerName =
    zeile.kind === "text" &&
    zeile.value !== undefined &&
    zeile.id !== undefined &&
    mehrdeutig.has(zeile.value.trim());
  // Ein Dienstzugang trägt einen Namen aus dem Wörterbuch UND seine Kennung — die Kennung ist hier
  // das, was ihn von einem anderen Dienstzugang unterscheidet.
  const kennungZumWort = zeile.kind === "text" && zeile.valueKey !== undefined && zeile.id;
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      {zeile.kind === "text" ? (
        <span className="text-text">{zeile.valueKey ? t(zeile.valueKey) : zeile.value}</span>
      ) : null}
      {mehrdeutigerName && zeile.id !== undefined ? (
        <span
          data-audit-kurzkennung=""
          title={zeile.id}
          className="font-mono text-[10.5px] text-muted-2"
        >
          {t("auditprotokoll.kurzkennung", { kurz: zeile.id.slice(0, 8) })}
        </span>
      ) : null}
      {kennungZumWort ? (
        <span className="truncate font-mono text-[10.5px] text-muted-2">{zeile.id}</span>
      ) : null}
      {zeile.herkunft === "verzeichnis" ? (
        <span data-audit-herkunft="verzeichnis" className="italic text-muted-2">
          {t("auditprotokoll.name.heute")}
        </span>
      ) : null}
      {zeile.herkunft === "protokoll" ? (
        <span data-audit-herkunft="protokoll" className="italic text-muted-2">
          {t("auditprotokoll.name.ausProtokoll")}
        </span>
      ) : null}
      {/* JOB 3140 R2: der Hinweis steht NUR da, wenn es einen gibt. */}
      {zeile.hinweisKey === undefined ? null : (
        <span className="italic text-muted-2">{t(zeile.hinweisKey)}</span>
      )}
      {kennungInSpalte && zeile.id !== undefined ? (
        <span className="truncate font-mono text-[10.5px] text-muted-2">{zeile.id}</span>
      ) : null}
    </span>
  );
}

/**
 * Das betroffene Objekt — beim Titel und mit Rücklink, wenn der Server es für diesen Betrachter
 * freigegeben hat (`objekte`, nur Objekte, die er JETZT öffnen darf). Sonst die Kennung wie bisher:
 * kein Titel, kein Link, keine Vermutung.
 */
function ObjektWert({
  zeile,
  objekt,
}: {
  zeile: DetailZeile;
  objekt: { titel: string } | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  if (objekt === undefined || zeile.id === undefined) {
    return <DetailWert zeile={zeile} mehrdeutig={new Set()} />;
  }
  const titel = objekt.titel.trim() === "" ? t("auditprotokoll.objekt.ohneTitel") : objekt.titel;
  return (
    <Link
      to={`/wissen/${encodeURIComponent(zeile.id)}`}
      data-audit-objektlink={zeile.id}
      className="font-semibold text-ai underline-offset-2 hover:underline focus-visible:underline"
    >
      {titel}
    </Link>
  );
}

/**
 * Verwalteransicht (N-0027): die technischen Angaben eines Eintrags — ergänzend, eingeklappt.
 *
 * produkt:20261009:admin-audit-verstaendlich (K2): neben Nummer, Kennungen und Prüfwert stehen hier
 * jetzt auch der ROHE Aktionscode und der gespeicherte Zeitpunkt in UTC — genau das, was braucht, wer
 * einen Eintrag mit der exportierten Kette oder einer Rückfrage abgleicht. Schwärzt der Server
 * Inhaltsfelder (K5), sagt die Detailansicht, welche.
 */
function TechnikAngaben({
  eintrag,
  zielLabelKey,
}: {
  eintrag: AuditEntry;
  zielLabelKey: string;
}): JSX.Element {
  const { t } = useTranslation();
  const zeilen: { key: string; labelKey: string; wert: string }[] = [
    { key: "seq", labelKey: "auditprotokoll.technik.nr", wert: String(eintrag.seq) },
    { key: "at", labelKey: "auditprotokoll.technik.zeitpunkt", wert: eintrag.at },
    { key: "action", labelKey: "auditprotokoll.technik.aktion", wert: eintrag.action },
    { key: "audit.detail.actor", labelKey: "auditprotokoll.technik.akteur", wert: eintrag.actor },
    {
      key: zielLabelKey,
      labelKey:
        zielLabelKey === "audit.detail.targetObject"
          ? "auditprotokoll.technik.objekt"
          : "auditprotokoll.technik.konto",
      wert: eintrag.target,
    },
    { key: "hash", labelKey: "auditprotokoll.technik.hash", wert: eintrag.hash },
  ];
  if (eintrag.geschwaerzt !== undefined && eintrag.geschwaerzt.length > 0) {
    zeilen.push({
      key: "geschwaerzt",
      labelKey: "auditprotokoll.technik.geschwaerzt",
      wert: eintrag.geschwaerzt.join(", "),
    });
  }
  return (
    <details data-audit-technik={eintrag.seq} className="text-[11px]">
      <summary className="cursor-pointer text-muted-2 hover:text-text">
        {t("auditprotokoll.technik.anzeigen")}
      </summary>
      <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        {zeilen.map((z) => (
          <Fragment key={z.key}>
            <dt className="text-muted-2">{t(z.labelKey)}</dt>
            <dd data-audit-kennung={z.key} className="min-w-0 break-all font-mono text-muted">
              {z.wert === "" ? t("audit.detail.notStored") : z.wert}
            </dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

/**
 * Eine Seite des Protokolls als Tabelle. Spalten wie in der Verwalteransicht (N-0027); die Zellen
 * sind Text. Einziges Bedienelement einer Zeile ist die eingeklappte Detailansicht — und, wenn der
 * Betrachter das betroffene Objekt öffnen darf, der Rücklink dorthin.
 */
export function AuditTabelle({
  seite,
  verzeichnis,
}: {
  seite: AuditSeite;
  verzeichnis: VerzeichnisLage;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  // N-0027: Namen, die die Kette selbst gespeichert hat — aus den Einträgen dieser Seite und aus
  // den Namensbelegen, die der Server zu ihren Kennungen mitliefert. Benennt auch gelöschte Konten.
  const protokoll = useMemo(
    () => protokollNamen([...seite.namensbelege, ...seite.entries]),
    [seite.namensbelege, seite.entries],
  );
  // K1 (Bens Befund Nacharbeit 3): welche Kennungen nachweislich Konten waren — nur sie können
  // „nicht mehr vorhanden" sein; jede andere fehlende Kennung heißt „unbekannte Kennung".
  const belege = useMemo(
    () => kontoBelege([...seite.namensbelege, ...seite.entries]),
    [seite.namensbelege, seite.entries],
  );
  const mehrdeutig = useMemo(
    () =>
      mehrdeutigeNamen(verzeichnis.art === "geladen" ? verzeichnis.namen : new Map(), protokoll),
    [verzeichnis, protokoll],
  );
  return (
    <div className="overflow-x-auto">
      <table data-audit-tabelle="" className="w-full text-left text-[12.5px]">
        <caption className="pb-1 text-left text-[11.5px] text-muted-2">
          {t("auditprotokoll.tabelle.seite", { shown: seite.entries.length })}
        </caption>
        <thead>
          <tr className="border-b border-hairline text-[11px] text-muted-2">
            {AUDIT_SPALTEN.map((key) => (
              <th
                key={key}
                scope="col"
                data-audit-spalte={key}
                className="px-2 py-1.5 align-bottom font-semibold"
              >
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {seite.entries.map((e) => {
            const zeilen = auditEventDetail(e, verzeichnis, protokoll, belege);
            const zielZeile = zeilen[1];
            return (
              <tr key={e.seq} data-audit-eintrag={e.seq} className="align-top">
                <td className="whitespace-nowrap px-2 py-2 text-[11px] text-muted-2">
                  <time dateTime={e.at}>{zeitpunktMitZone(e.at, i18n.language)}</time>
                </td>
                <td
                  data-audit-zeile="audit.detail.event"
                  className="px-2 py-2 font-semibold text-text"
                >
                  {auditActionLabel(e.action, t)}
                </td>
                {ZEILEN_SPALTEN.map((spalte) => {
                  const zeile = zeilen.find((z) => spalte.includes(z.labelKey));
                  if (zeile === undefined) {
                    return <td key={spalte[0]} className="px-2 py-2" />;
                  }
                  return (
                    <td
                      key={spalte[0]}
                      data-audit-zeile={zeile.labelKey}
                      className="min-w-0 px-2 py-2 text-muted"
                    >
                      {zeile.labelKey === "audit.detail.targetObject" ? (
                        <ObjektWert zeile={zeile} objekt={seite.objekte[e.target]} />
                      ) : (
                        <DetailWert zeile={zeile} mehrdeutig={mehrdeutig} />
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2">
                  <TechnikAngaben
                    eintrag={e}
                    zielLabelKey={zielZeile?.labelKey ?? "audit.detail.target"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Leerzustand und Seitenleiste
// ------------------------------------------------------------------------------------------------

/** Ein lesbarer Leerzustand — mit Ausweg, wenn die Filter die Leere verursachen. */
export function AuditLeer({
  filter,
  leerKey,
}: {
  filter: AuditAdressfilter;
  leerKey: string;
}): JSX.Element {
  const { t } = useTranslation();
  if (!filter.gefiltert && filter.vor === undefined) {
    return <p className="text-[13px] text-muted">{t(leerKey)}</p>;
  }
  return (
    <div data-audit-leer="gefiltert" className="flex flex-wrap items-center gap-2">
      <p className="text-[13px] text-muted">
        {t(
          filter.vor === undefined ? "auditprotokoll.leer.gefiltert" : "auditprotokoll.seite.ende",
        )}
      </p>
      {filter.gefiltert ? (
        <Button variant="outline" className="print-hide" onClick={filter.zuruecksetzen}>
          {t("auditprotokoll.filter.zuruecksetzen")}
        </Button>
      ) : null}
      {filter.vor !== undefined ? (
        <Button variant="outline" className="print-hide" onClick={filter.neueste}>
          {t("auditprotokoll.seite.neueste")}
        </Button>
      ) : null}
    </div>
  );
}

/** Blättern: ältere Seite über den Zeiger des Servers, zurück zu den neuesten Einträgen. */
export function AuditSeitenleiste({
  seite,
  filter,
}: {
  seite: AuditSeite;
  filter: AuditAdressfilter;
}): JSX.Element | null {
  const { t } = useTranslation();
  const naechster = seite.nextBefore;
  if (naechster === null && filter.vor === undefined) {
    return null;
  }
  return (
    <nav
      aria-label={t("auditprotokoll.seite.navigation")}
      data-audit-seitenleiste=""
      className="print-hide flex flex-wrap items-center gap-2"
    >
      {filter.vor !== undefined ? (
        <Button variant="outline" onClick={filter.neueste}>
          {t("auditprotokoll.seite.neueste")}
        </Button>
      ) : null}
      {naechster !== null ? (
        <Button variant="outline" onClick={() => filter.aelter(naechster)}>
          {t("auditprotokoll.seite.aelter")}
        </Button>
      ) : (
        <span className="text-[12px] text-muted-2">{t("auditprotokoll.seite.ende")}</span>
      )}
    </nav>
  );
}

// ------------------------------------------------------------------------------------------------
// Die Filterleiste
// ------------------------------------------------------------------------------------------------

const FELD =
  "w-full min-w-0 rounded-btn border border-hairline bg-surface px-2 py-1.5 text-[13px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-ai";

/**
 * Person, Vorgang, Betroffen und Zeitraum — kombinierbar. Die Vorschläge zeigen nur, was ohnehin
 * jedem Angemeldeten offensteht: Personen aus dem Verzeichnis und die Namen der Vorgänge. Objekte
 * werden NICHT vorgeschlagen; ihr Titel erscheint nur dort, wo der Server ihn freigibt (K5).
 */
export function AuditFilterLeiste({
  filter,
  verzeichnis,
  aktionen,
  idPraefix,
}: {
  filter: AuditAdressfilter;
  verzeichnis: VerzeichnisLage;
  /** Die Vorgänge, die zur Auswahl stehen (Rohcodes). */
  aktionen: readonly string[];
  /** Eindeutiger Präfix für die Feldkennungen dieser Karte. */
  idPraefix: string;
}): JSX.Element {
  const { t } = useTranslation();
  const [entwurf, setEntwurf] = useState<AuditFilterWerte>(filter.werte);
  const [fehler, setFehler] = useState(false);
  // Ändert sich die Adresse von außen (Zurück im Browser, Zurücksetzen), folgt das Formular.
  const adressStand = JSON.stringify(filter.werte);
  const [gemerkterStand, setGemerkterStand] = useState(adressStand);
  if (gemerkterStand !== adressStand) {
    setGemerkterStand(adressStand);
    setEntwurf(filter.werte);
    setFehler(false);
  }
  const personen = verzeichnisListe(verzeichnis);
  // Der Name zur eingegebenen Kennung, wenn das Verzeichnis sie kennt — sonst der Bedienhinweis.
  const personName =
    entwurf.person === "system"
      ? t("audit.detail.systemActor")
      : personen.find(([id]) => id === entwurf.person.trim())?.[1];
  const aktionBekannt = entwurf.aktion === "" || aktionen.includes(entwurf.aktion);
  const mehrdeutig = mehrdeutigeNamen(
    verzeichnis.art === "geladen" ? verzeichnis.namen : new Map(),
  );

  const absenden = (ereignis: FormEvent<HTMLFormElement>): void => {
    ereignis.preventDefault();
    if (zeitraumVerkehrt(entwurf)) {
      setFehler(true);
      return;
    }
    setFehler(false);
    filter.anwenden(entwurf);
  };
  const feld = (name: keyof AuditFilterWerte) => ({
    id: `${idPraefix}-${name}`,
    value: entwurf[name],
    onChange: (e: { target: { value: string } }) =>
      setEntwurf((alt) => ({ ...alt, [name]: e.target.value })),
  });

  return (
    <form
      onSubmit={absenden}
      data-audit-filter=""
      aria-label={t("auditprotokoll.filter.titel")}
      className="print-hide grid grid-cols-1 gap-2 rounded-card border border-hairline bg-page p-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      {/* Bens Befund Nacharbeit 3: eine geschlossene Auswahl ließ nur heutige Konten zu. Das Feld
          nimmt jetzt jede Kennung an (entfernte, unbekannte, Dienstzugänge — die Kennung steht
          unter „Kennungen anzeigen“) und schlägt Namen aus dem Verzeichnis vor. Gefiltert wird
          weiter über die Kennung. */}
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-semibold text-muted-2">
        {t("auditprotokoll.filter.person")}
        <input
          {...feld("person")}
          type="text"
          list={`${idPraefix}-personen`}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("auditprotokoll.filter.personAlle")}
          aria-describedby={`${idPraefix}-person-hinweis`}
          className={`${FELD} font-mono`}
        />
        <span id={`${idPraefix}-person-hinweis`} className="font-normal text-muted-2">
          {personName ?? t("auditprotokoll.filter.personHinweis")}
        </span>
        <datalist id={`${idPraefix}-personen`}>
          <option value="system" label={t("audit.detail.systemActor")} />
          {personen.map(([id, name]) => (
            <option
              key={id}
              value={id}
              label={
                mehrdeutig.has(name.trim())
                  ? `${name} (${t("auditprotokoll.kurzkennung", { kurz: id.slice(0, 8) })})`
                  : name
              }
            />
          ))}
        </datalist>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-semibold text-muted-2">
        {t("auditprotokoll.filter.aktion")}
        <select {...feld("aktion")} className={FELD}>
          <option value="">{t("auditprotokoll.filter.aktionAlle")}</option>
          {aktionen.map((a) => (
            <option key={a} value={a}>
              {auditActionLabel(a, t)}
            </option>
          ))}
          {aktionBekannt ? null : (
            <option value={entwurf.aktion}>{auditActionLabel(entwurf.aktion, t)}</option>
          )}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-semibold text-muted-2">
        {t("auditprotokoll.filter.ziel")}
        <input
          {...feld("ziel")}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("auditprotokoll.filter.zielPlatzhalter")}
          className={`${FELD} font-mono`}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-semibold text-muted-2">
        {t("auditprotokoll.filter.von")}
        <input {...feld("von")} type="date" className={FELD} />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-semibold text-muted-2">
        {t("auditprotokoll.filter.bis")}
        <input
          {...feld("bis")}
          type="date"
          aria-invalid={fehler || undefined}
          aria-describedby={fehler ? `${idPraefix}-zeitraumfehler` : undefined}
          className={FELD}
        />
      </label>
      {fehler ? (
        <p
          id={`${idPraefix}-zeitraumfehler`}
          role="alert"
          className="text-[12px] font-semibold text-trust-crit-text sm:col-span-2 lg:col-span-5"
        >
          {t("auditprotokoll.filter.zeitraumFalsch")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="submit" variant="outline">
          {t("auditprotokoll.filter.anwenden")}
        </Button>
        {filter.gefiltert ? (
          <Button variant="outline" onClick={filter.zuruecksetzen}>
            {t("auditprotokoll.filter.zuruecksetzen")}
          </Button>
        ) : null}
        <span className="text-[11.5px] text-muted-2">
          {t("auditprotokoll.zeitzone", {
            zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        </span>
      </div>
    </form>
  );
}
