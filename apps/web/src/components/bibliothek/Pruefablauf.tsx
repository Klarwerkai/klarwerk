// ================================================================================================
// AUFNAHME gesamt-peer-validierung · package:pruefablauf — DIE BAUSTEINE DES VORSCHLAGSWEGS.
// ================================================================================================
//
// Drei Lücken, die Ben am Vorschlagsweg belegt hat (Nacharbeit 3), je ein Baustein:
//   · `PrueferWahl` — die Änderung einer BENANNTEN Person zur Prüfung geben. Zur Wahl steht das
//     Verzeichnis ohne die eigene Person (dasselbe Muster wie der Prüfer-Vorschlag beim Erfassen);
//     ob die gewählte Person freigeben darf, entscheidet der Server und sagt es sonst (400).
//   · `VorschlagRueckfragen` — die Rückfragen am Vorschlag, mit wem, wann und welchem Inhalt.
//   · `EigeneVorschlaege` — der Status des EIGENEN Vorschlags für den Einreicher, auch nach der
//     Entscheidung: übernommen (welche Fassung), abgelehnt (mit Begründung) oder offen (mit
//     Rückfrage). Bis hierher sah ihn nur, wer freigeben darf, und nur solange er offen war.
//
// Alles hier ZEIGT nur, was am Vorschlag gespeichert ist. Kein Baustein rechnet einen Status aus
// etwas anderem als `status`, `rueckfragen`, `decidedBy`/`decidedAt`, `resultVersion` und `note`.
//
// Antworten 18/19 (Nutzerentscheid 11.10.2026): `Weisung` — die eigene Weisung unmittelbar gültig
// einstellen, wenn das KONTO eine Weisungsbefugnis für den Bereich trägt (nicht die Rolle), und
// die nachfolgende Sichtung: wer, bis wann, überfällig?, und für die benannte Person Bestätigen
// oder Widerrufen. Ob es erlaubt ist, entscheidet der Server; hier steht der Weg nur da, wo er
// nicht sicher scheitert.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { useDirectory } from "../../api/hooks";
import type { KnowledgeObject, KoProposal } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button } from "../ui";

type NameOf = (id: string) => string;

export function PrueferWahl({
  wert,
  onChange,
  eigeneId,
}: {
  wert: string;
  onChange: (id: string) => void;
  eigeneId: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const directory = useDirectory();
  const personen = (Array.isArray(directory.data) ? directory.data : []).filter(
    (p) => p.id !== eigeneId,
  );
  return (
    <label className="flex flex-col gap-1 text-[11.5px] text-muted">
      {t("pruefablauf.pruefer.label")}
      <select
        data-testid="bib-pruefer-wahl"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-card border border-hairline bg-surface px-2 py-1 text-[12.5px] text-text"
      >
        <option value="">{t("pruefablauf.pruefer.keine")}</option>
        {personen.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VorschlagRueckfragen({
  vorschlag,
  nameOf,
}: {
  vorschlag: KoProposal;
  nameOf: NameOf;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const rueckfragen = vorschlag.rueckfragen ?? [];
  if (rueckfragen.length === 0) {
    return null;
  }
  return (
    <ul data-testid="bib-vorschlag-rueckfragen" className="mt-1.5 space-y-1">
      {rueckfragen.map((r) => (
        <li
          key={`${r.von}-${r.at}`}
          data-testid="bib-vorschlag-rueckfrage-eintrag"
          className="rounded-card border border-hairline bg-surface p-2 text-[12px]"
        >
          <p className="text-[11px] text-muted">
            {t("pruefablauf.rueckfrage.von", {
              name: nameOf(r.von),
              zeit: formatKoTimestamp(r.at, i18n.language) ?? r.at,
            })}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-text">{r.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** AW06-K02: der Textschlüssel der Kontoregel, wie sie im Beleg steht. */
export function kontoregelSchluessel(
  kontoregel: string | null,
  benoetigt: number | undefined,
): { schluessel: string; n?: string } {
  switch (kontoregel) {
    case "peer-pruefung":
      return benoetigt === undefined
        ? { schluessel: "pruefablauf.annahme.regel.peerPruefungOhneZahl" }
        : { schluessel: "pruefablauf.annahme.regel.peerPruefung", n: String(benoetigt) };
    case "direktannahme":
      return { schluessel: "pruefablauf.annahme.regel.direktannahme" };
    case "pflichtpruefung":
      return { schluessel: "pruefablauf.annahme.regel.pflichtpruefung" };
    case "freiwillige-zweitpruefung":
      return { schluessel: "pruefablauf.annahme.regel.freiwilligeZweitpruefung" };
    case "eigentuemerfreigabe":
      return { schluessel: "pruefablauf.annahme.regel.eigentuemerfreigabe" };
    case "weisung":
      return { schluessel: "pruefablauf.annahme.regel.weisung" };
    default:
      return { schluessel: "pruefablauf.annahme.regel.unbekannt" };
  }
}

/**
 * AW06-K02 — DIE ANNAHME DIESER FASSUNG: Fassung, Person, Zeitpunkt und Kontoregel. Alles kommt
 * vom Server aus dem referenzierten Beleg (`KnowledgeObject.annahme`); hier wird nur gezeichnet.
 * Ohne belegte Annahme steht nichts — auch kein „nicht angenommen".
 */
export function AnnahmeZeile({
  annahme,
  nameOf,
}: {
  annahme: NonNullable<KnowledgeObject["annahme"]> | undefined;
  nameOf: NameOf;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (!annahme) {
    return null;
  }
  const regel = kontoregelSchluessel(annahme.kontoregel, annahme.benoetigt);
  return (
    <div data-testid="bib-annahme" className="text-[11.5px] leading-relaxed text-muted">
      <p data-testid="bib-annahme-zeile">
        {t("pruefablauf.annahme.zeile", {
          fassung: String(annahme.fassung),
          person: nameOf(annahme.person),
          zeit: formatKoTimestamp(annahme.zeitpunkt, i18n.language) ?? annahme.zeitpunkt,
        })}
      </p>
      <p data-testid="bib-annahme-regel" data-kontoregel={annahme.kontoregel ?? "unbekannt"}>
        {t(regel.schluessel, regel.n === undefined ? {} : { n: regel.n })}
      </p>
    </div>
  );
}

/** Der Status eines Vorschlags in Worten — nur aus den gespeicherten Feldern. */
export function vorschlagStatusSchluessel(v: KoProposal): { schluessel: string; n?: string } {
  if (v.status === "uebernommen") {
    return typeof v.resultVersion === "number"
      ? { schluessel: "pruefablauf.status.uebernommen", n: String(v.resultVersion) }
      : { schluessel: "pruefablauf.status.uebernommenOhneFassung" };
  }
  if (v.status === "abgelehnt") {
    return { schluessel: "pruefablauf.status.abgelehnt" };
  }
  return (v.rueckfragen ?? []).length > 0
    ? { schluessel: "pruefablauf.status.offenRueckfrage" }
    : { schluessel: "pruefablauf.status.offen" };
}

export function EigeneVorschlaege({
  vorschlaege,
  nameOf,
}: {
  vorschlaege: readonly KoProposal[];
  nameOf: NameOf;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (vorschlaege.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="bib-eigene-vorschlaege"
      className="rounded-card border border-hairline bg-hairline-soft/40 p-3"
    >
      <h3 className="text-[12.5px] font-semibold text-text">{t("pruefablauf.eigene.titel")}</h3>
      <ul className="mt-2 space-y-2.5">
        {vorschlaege.map((v) => {
          const status = vorschlagStatusSchluessel(v);
          return (
            <li
              key={v.id}
              data-testid="bib-eigener-vorschlag"
              data-vorschlag-id={v.id}
              data-status={v.status}
              className="border-hairline border-t pt-2.5 first:border-t-0 first:pt-0"
            >
              <p
                data-testid="bib-eigener-vorschlag-status"
                className="text-[12px] font-medium text-text"
              >
                {t(status.schluessel, status.n === undefined ? {} : { n: status.n })}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {formatKoTimestamp(v.at, i18n.language) ?? v.at} ·{" "}
                {t("ko.propose.fromVersion", { n: String(v.baseVersion) })}
                {v.pruefer
                  ? ` · ${t("pruefablauf.pruefer.zugeordnet", { name: nameOf(v.pruefer) })}`
                  : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
                {v.statement}
              </p>
              {v.decidedBy && v.decidedAt ? (
                <p
                  data-testid="bib-eigener-vorschlag-entscheidung"
                  className="mt-1 text-[11.5px] text-muted"
                >
                  {t("pruefablauf.entschieden", {
                    name: nameOf(v.decidedBy),
                    zeit: formatKoTimestamp(v.decidedAt, i18n.language) ?? v.decidedAt,
                  })}
                </p>
              ) : null}
              {v.note ? (
                <p
                  data-testid="bib-eigener-vorschlag-begruendung"
                  className="mt-0.5 whitespace-pre-wrap text-[12px] text-text"
                >
                  {t("pruefablauf.begruendung", { text: v.note })}
                </p>
              ) : null}
              <VorschlagRueckfragen vorschlag={v} nameOf={nameOf} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Antwort 18: deckt die Befugnis des Kontos den Bereich? `*` = ganzes Unternehmen. */
export function weisungsbefugnisDeckt(
  befugnis: { bereiche: readonly string[] } | undefined,
  bereich: string | undefined,
): boolean {
  if (!befugnis) {
    return false;
  }
  if (befugnis.bereiche.includes("*")) {
    return true;
  }
  const ziel = (bereich ?? "").trim().toLowerCase();
  return ziel.length > 0 && befugnis.bereiche.some((b) => b.trim().toLowerCase() === ziel);
}

/** Ein Kalendertag JJJJ-MM-TT in der Sprache der Oberfläche (ohne Uhrzeit). */
function kalendertag(tag: string, sprache: string): string {
  const d = new Date(`${tag}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? tag
    : d.toLocaleDateString(sprache, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
}

type WeisungsObjekt = Pick<
  KnowledgeObject,
  "id" | "author" | "category" | "status" | "version" | "weisungsSichtung"
>;

/**
 * Antworten 18/19 — DIE UNMITTELBAR GÜLTIGE WEISUNG UND IHRE SICHTUNG.
 *
 * Einstellen: nur am EIGENEN, noch nicht fachlich bestätigten Objekt und nur, wenn die
 * Weisungsbefugnis am Konto (`befugnis`) den Bereich deckt — die Rolle allein zeigt den Weg nicht.
 * Sichtung: steht da, sobald die gültige Fassung eine trägt; die benannte Person bestätigt oder
 * widerruft. „Überfällig" ist eine Ableitung aus Frist und heutigem Tag, nichts Gespeichertes.
 */
export function Weisung({
  ko,
  angemeldet,
  befugnis,
  nameOf,
  heute = new Date().toISOString().slice(0, 10),
}: {
  ko: WeisungsObjekt;
  angemeldet: string | undefined;
  befugnis: { bereiche: readonly string[] } | undefined;
  nameOf: NameOf;
  /** Der heutige Kalendertag (JJJJ-MM-TT) — für Prüfungen einstellbar. */
  heute?: string;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const sichten = useMutation({
    mutationFn: (ergebnis: "bestaetigt" | "widerrufen") =>
      endpoints.ko.act(ko.id, { action: "weisung-sichten", sichtung: { ergebnis } }),
    onSuccess: () => {
      auffrischeWeisung(qc, ko.id);
      push("success", t("pruefablauf.sichtung.gespeichert"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const s = ko.weisungsSichtung?.koVersion === ko.version ? ko.weisungsSichtung : undefined;
  const ueberfaellig = s !== undefined && !s.ergebnis && s.frist < heute;
  const fristSchluessel = ueberfaellig
    ? "pruefablauf.sichtung.ueberfaellig"
    : "pruefablauf.sichtung.offen";
  const ergebnisSchluessel =
    s?.ergebnis?.art === "bestaetigt"
      ? "pruefablauf.sichtung.bestaetigt"
      : "pruefablauf.sichtung.zurueckgenommen";
  const darfEinstellen =
    angemeldet !== undefined &&
    ko.author === angemeldet &&
    ko.status !== "validiert" &&
    weisungsbefugnisDeckt(befugnis, ko.category);
  if (!s && !darfEinstellen) {
    return null;
  }
  return (
    <section data-testid="bib-weisung" className="text-[12px] leading-relaxed">
      {s ? (
        <div data-testid="bib-weisung-sichtung" data-ergebnis={s.ergebnis?.art ?? "offen"}>
          {s.ergebnis ? (
            <p className="text-muted">
              {t(ergebnisSchluessel, {
                name: nameOf(s.ergebnis.von),
                zeit: formatKoTimestamp(s.ergebnis.am, i18n.language) ?? s.ergebnis.am,
              })}
            </p>
          ) : (
            <p
              data-testid="bib-weisung-frist"
              data-ueberfaellig={ueberfaellig ? "ja" : "nein"}
              className={ueberfaellig ? "font-medium text-trust-warn-text" : "text-muted"}
            >
              {t(fristSchluessel, {
                name: nameOf(s.verantwortlich),
                frist: kalendertag(s.frist, i18n.language),
              })}
            </p>
          )}
          {!s.ergebnis && s.verantwortlich === angemeldet && ko.status === "validiert" ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="bib-weisung-bestaetigen"
                disabled={sichten.isPending}
                onClick={() => sichten.mutate("bestaetigt")}
              >
                {t("pruefablauf.sichtung.bestaetigen")}
              </Button>
              <Button
                variant="ghost"
                data-testid="bib-weisung-widerrufen"
                disabled={sichten.isPending}
                onClick={() => sichten.mutate("widerrufen")}
              >
                {t("pruefablauf.sichtung.widerrufen")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {darfEinstellen ? (
        <WeisungEinstellen
          koId={ko.id}
          bereich={ko.category}
          angemeldet={angemeldet}
          heute={heute}
        />
      ) : null}
    </section>
  );
}

function auffrischeWeisung(qc: ReturnType<typeof useQueryClient>, koId: string): void {
  void qc.invalidateQueries({ queryKey: ["ko", koId] });
  void qc.invalidateQueries({ queryKey: ["kos"] });
  void qc.invalidateQueries({ queryKey: ["validation"] });
}

/**
 * Das Formular zum Einstellen — ein eigener Baustein, damit das Personenverzeichnis nur geladen wird,
 * wenn das Formular wirklich dasteht (nicht bei jedem Öffnen eines Eintrags).
 */
function WeisungEinstellen({
  koId,
  bereich,
  angemeldet,
  heute,
}: {
  koId: string;
  bereich: string;
  angemeldet: string | undefined;
  heute: string;
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const directory = useDirectory();
  const [verantwortlich, setVerantwortlich] = useState("");
  const [frist, setFrist] = useState("");
  const [dubletteOffen, setDubletteOffen] = useState(false);
  const einstellen = useMutation({
    mutationFn: (dubletteGesehen: boolean) =>
      endpoints.ko.act(koId, {
        action: "weisung-validate",
        sichtung: { verantwortlich, frist },
        ...(dubletteGesehen ? { duplicateAcknowledged: true as const } : {}),
      }),
    onSuccess: () => {
      setDubletteOffen(false);
      auffrischeWeisung(qc, koId);
      push("success", t("pruefablauf.weisung.gesetzt"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "DUPLICATE_ACK_REQUIRED") {
        setDubletteOffen(true);
      }
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });
  const personen = (Array.isArray(directory.data) ? directory.data : []).filter(
    (p) => p.id !== angemeldet,
  );
  const auswahlKlasse =
    "rounded-card border border-hairline bg-surface px-2 py-1 text-[12.5px] text-text";
  return (
    <div
      data-testid="bib-weisung-einstellen"
      className="mt-2 rounded-card border border-hairline p-2.5"
    >
      <p className="font-medium text-text">{t("pruefablauf.weisung.titel")}</p>
      <p className="mt-0.5 text-muted">{t("pruefablauf.weisung.hinweis", { bereich })}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] text-muted">
          {t("pruefablauf.weisung.verantwortlich")}
          <select
            data-testid="bib-weisung-verantwortlich"
            value={verantwortlich}
            onChange={(e) => setVerantwortlich(e.target.value)}
            className={auswahlKlasse}
          >
            <option value="">{t("pruefablauf.weisung.verantwortlichWaehlen")}</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] text-muted">
          {t("pruefablauf.weisung.frist")}
          <input
            type="date"
            data-testid="bib-weisung-frist-eingabe"
            min={heute}
            value={frist}
            onChange={(e) => setFrist(e.target.value)}
            className={auswahlKlasse}
          />
        </label>
        <Button
          variant="primary"
          data-testid="bib-weisung-knopf"
          disabled={einstellen.isPending || verantwortlich === "" || frist === ""}
          onClick={() => einstellen.mutate(false)}
        >
          {t("pruefablauf.weisung.knopf")}
        </Button>
        {dubletteOffen ? (
          <Button
            variant="ghost"
            disabled={einstellen.isPending}
            onClick={() => einstellen.mutate(true)}
          >
            {t("verantwortung.freigebenDublette")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
