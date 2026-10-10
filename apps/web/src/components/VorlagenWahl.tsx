// ================================================================================================
// produkt:20261007:templates-default — VORLAGE WÄHLEN, WECHSELN, ERKLÄREN (im Erfassen-Editor).
// ================================================================================================
//
// Löst an dieser Stelle die feste Sechserauswahl (`BodyTemplateChooser`, SCRUM-319/342) ab und
// übernimmt deren Grundsätze: nichts wird ohne Klick eingesetzt, nichts still überschrieben.
//
//   · VORFINDEN: eine neue Eingabe findet die Vorlage nach der Vorrangregel vorgewählt
//     (verbindlich im gewählten Space → persönlicher Standard → freie Eingabe; Server,
//     `GET /api/vorlagen/start`). Ist der Standard nicht mehr verfügbar, steht das mit Grund da.
//   · WECHSELN: vor der Übernahme zeigt die Fläche, welche Abschnitte übernommen, welche
//     ausgefüllten Abschnitte ans Ende gestellt und welche leeren Hinweise entfernt werden
//     (`wechsleVorlage`). Eingegebene Werte gehen dabei nicht verloren.
//   · ERKLÄREN: Pflichtfelder, Geltung und Space-Vorgaben stehen bei der Auswahl; „Prüfen" zeigt
//     dieselben Befunde, die der Server beim Einreichen meldet. Speichern bleibt frei.
//   · FREIE EINGABE bleibt immer einen Klick entfernt und ändert den Inhalt nicht.
//
// Der Bezug (Vorlage + Fassung + Space) gehört dem Entwurf (`DraftPayload.vorlage`); diese Fläche
// meldet ihn nur über `onBezug`. Klara liest dieselben Felder über `lib/aktiveVorlage.ts`.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type PflichtBefund,
  type VorlageSicht,
  type VorlagenBezug,
  type VorlagenFassung,
  vorlagenApi,
  vorlagenFehlerSchluessel,
} from "../api/vorlagen";
import { type AktiveFassung, setzeAktiveVorlage } from "../lib/aktiveVorlage";
import { sanitizeHtml } from "../lib/richText";
import {
  type VorlagenWechsel,
  feldText,
  istInhaltLeer,
  vorlagenName,
  vorlagenSprache,
  wechsleVorlage,
} from "../lib/vorlagenStruktur";
import { SanitizedHtml } from "./SanitizedHtml";
import { Button } from "./ui";

const FREI = "frei";
const GELTUNGEN = ["standard", "unternehmen", "space", "persoenlich"] as const;

function alsFassung(v: VorlageSicht | VorlagenFassung): AktiveFassung {
  return {
    id: v.id,
    version: v.version,
    name: v.name,
    geltung: v.geltung,
    felder: v.felder,
    ...(v.sprachen ? { sprachen: v.sprachen } : {}),
  };
}

// Dieselbe Überladung wie `lib/auditAction.ts`: ein optionaler zweiter Parameter machte die echte
// i18next-`TFunction` unter `exactOptionalPropertyTypes` nicht zuweisbar.
interface Uebersetze {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/** Der Befund in Worten der Oberfläche (der Server liefert Art und Wert, nicht nur Deutsch). */
export function befundText(t: Uebersetze, b: PflichtBefund): string {
  return t(`vorlagen.befund.${b.art}`, { wert: b.wert });
}

export function VorlagenWahl({
  bodyHtml,
  onApply,
  bezug,
  onBezug,
  category,
  tags,
  kompakt = false,
}: {
  bodyHtml: string;
  onApply: (html: string) => void;
  bezug: VorlagenBezug | null;
  onBezug: (bezug: VorlagenBezug | null) => void;
  category: string;
  tags: string[];
  /**
   * Im Blatt: EINE Zeile über dem Schreibfeld — sie nennt die vorgewählte Vorlage (Standard oder
   * Space-Vorgabe) bzw. die verwendete, setzt sie mit einem Klick ein und öffnet sich zur Auswahl.
   */
  kompakt?: boolean;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const sprache = vorlagenSprache(i18n.language);
  const qc = useQueryClient();
  const [offen, setOffen] = useState(!kompakt);
  const [spaceId, setSpaceId] = useState<string | null>(bezug?.spaceId ?? null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<VorlagenWechsel | null>(null);

  // Ein geladener Entwurf bringt seinen Space mit.
  useEffect(() => {
    if (bezug?.spaceId !== undefined) {
      setSpaceId(bezug.spaceId ?? null);
    }
  }, [bezug?.spaceId]);

  const liste = useQuery({ queryKey: ["vorlagen"], queryFn: vorlagenApi.liste, retry: false });
  const start = useQuery({
    queryKey: ["vorlagen", "start", spaceId ?? ""],
    queryFn: () => vorlagenApi.start(spaceId),
    retry: false,
  });
  // Die Fassung, mit der der Beitrag bisher geschrieben ist — Grundlage des Wechsels.
  const bisher = useQuery({
    queryKey: ["vorlage", bezug?.id ?? ""],
    queryFn: () => vorlagenApi.eintrag(bezug?.id ?? ""),
    enabled: bezug !== null,
    retry: false,
  });

  const alle = liste.data?.vorlagen ?? [];
  const angeboten = alle.filter((v) => v.darfAnwenden);
  const gewaehltId = auswahl ?? (bezug ? bezug.id : (start.data?.vorlage?.id ?? FREI));
  const gewaehlt = gewaehltId === FREI ? undefined : alle.find((v) => v.id === gewaehltId);
  const bisherFassung: VorlagenFassung | null = useMemo(() => {
    if (!bezug || !bisher.data) {
      return null;
    }
    return bisher.data.fassungen.find((f) => f.version === bezug.version) ?? null;
  }, [bezug, bisher.data]);
  const wartetAufBisher = bezug !== null && bisher.isLoading;

  const wechsel = useMemo(
    () =>
      gewaehlt && !wartetAufBisher
        ? wechsleVorlage(
            bodyHtml,
            bezug ? bisherFassung : null,
            gewaehlt,
            sprache,
            t("vorlagen.wechsel.weitere"),
          )
        : null,
    [gewaehlt, wartetAufBisher, bodyHtml, bezug, bisherFassung, sprache, t],
  );
  const schonAngewendet =
    gewaehlt !== undefined && bezug?.id === gewaehlt.id && bezug.version === gewaehlt.version;

  // Klara liest DIESELBEN Felder: die der verwendeten Fassung, sonst die der aktuellen.
  const verbindlichId = start.data?.vorgabe?.verbindlicheVorlageId ?? null;
  const verbindlich = verbindlichId ? alle.find((v) => v.id === verbindlichId) : undefined;
  const aktuell = bezug ? alle.find((v) => v.id === bezug.id) : undefined;
  useEffect(() => {
    const quelle = bisherFassung ?? aktuell;
    setzeAktiveVorlage({
      vorlage:
        bezug && quelle ? { ...alsFassung(quelle), id: bezug.id, version: bezug.version } : null,
      space: start.data?.space ?? null,
      vorgabe: start.data?.vorgabe ?? null,
      verbindlich: verbindlich ? alsFassung(verbindlich) : null,
    });
  }, [bezug, bisherFassung, aktuell, start.data, verbindlich]);
  useEffect(() => () => setzeAktiveVorlage(null), []);

  const standard = useMutation({
    mutationFn: (id: string | null) => vorlagenApi.standardSetzen(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vorlagen"] });
    },
  });
  const pruefung = useMutation({
    mutationFn: () =>
      vorlagenApi.pruefung({
        vorlage: bezug,
        bodyHtml,
        category,
        tags: tags.filter((x) => x.trim()),
      }),
  });

  function anwenden(): void {
    if (!gewaehlt || !wechsel) {
      return;
    }
    onApply(sanitizeHtml(wechsel.html));
    onBezug({ id: gewaehlt.id, version: gewaehlt.version, spaceId });
    setErgebnis(wechsel);
    setAuswahl(null);
    pruefung.reset();
  }

  function frei(): void {
    setAuswahl(FREI);
    setErgebnis(null);
    onBezug(null);
    pruefung.reset();
  }

  function spaceWaehlen(id: string | null): void {
    setSpaceId(id);
    // Ein anderer Space kann eine andere verbindliche Vorlage vorschlagen — neu vorwählen lassen.
    setAuswahl(null);
    if (bezug) {
      onBezug({ ...bezug, spaceId: id });
    }
  }

  const s = start.data;
  const vorrang = !s
    ? null
    : s.quelle === "space"
      ? t("vorlagen.vorrang.space", {
          space: s.space?.name ?? "",
          name: s.vorlage ? vorlagenName(s.vorlage, sprache) : "",
        })
      : s.quelle === "persoenlich"
        ? t("vorlagen.vorrang.persoenlich", {
            name: s.vorlage ? vorlagenName(s.vorlage, sprache) : "",
          })
        : s.ersatzFuer
          ? t(`vorlagen.vorrang.ersatz.${s.ersatzFuer.grund}`, {
              name: s.ersatzFuer.name ?? s.ersatzFuer.id,
            })
          : t("vorlagen.vorrang.frei");

  // Ein Ladefehler ist kein Fehler der Eingabe: freie Eingabe bleibt, die Fläche sagt es leise.
  if (liste.isError) {
    return kompakt ? null : (
      <div className="mb-2 rounded-card border border-hairline bg-surface p-2.5">
        <output className="block text-[11.5px] text-muted">{t("vorlagen.laden.fehler")}</output>
      </div>
    );
  }

  if (kompakt && !offen) {
    const verwendet = bisherFassung ?? aktuell;
    const vorschlag = !bezug && gewaehlt && gewaehlt.darfAnwenden && wechsel ? gewaehlt : undefined;
    return (
      <div
        data-testid="vorlagen-zeile"
        className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted"
      >
        <FileText size={13} className="text-muted-2" aria-hidden />
        <span data-testid="vorlagen-zeile-text">
          {bezug && verwendet
            ? t("vorlagen.zeile.mit", {
                name: vorlagenName(verwendet, sprache),
                version: bezug.version,
              })
            : (vorrang ?? t("vorlagen.vorrang.frei"))}
        </span>
        {vorschlag ? (
          <Button data-testid="vorlage-anwenden" onClick={anwenden}>
            {istInhaltLeer(bodyHtml)
              ? t("vorlagen.anwenden.setzen")
              : t("vorlagen.anwenden.anfuegen")}
          </Button>
        ) : null}
        <button
          type="button"
          data-testid="vorlagen-oeffnen"
          aria-expanded={false}
          onClick={() => setOffen(true)}
          className="text-[12px] text-muted underline hover:text-text"
        >
          {bezug || vorschlag ? t("vorlagen.zeile.aendern") : t("vorlagen.zeile.waehlen")}
        </button>
        {ergebnis ? (
          <output data-testid="vorlage-ergebnis" className="block w-full text-trust-pos-text">
            {textVonWechsel(t, ergebnis, false, true)}
          </output>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="vorlagen-wahl-titel"
      data-testid="vorlagen-wahl"
      className="mb-2 rounded-card border border-hairline bg-surface p-2.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <FileText size={13} className="text-muted" aria-hidden />
        <h3 id="vorlagen-wahl-titel" className="text-[11.5px] font-semibold text-ink">
          {t("vorlagen.wahl.titel")}
        </h3>
        <Link to="/vorlagen" className="ml-auto text-[11.5px] text-muted underline">
          {t("vorlagen.wahl.verwalten")}
        </Link>
        {kompakt ? (
          <button
            type="button"
            data-testid="vorlagen-schliessen"
            aria-expanded
            onClick={() => setOffen(false)}
            className="text-[11.5px] text-muted underline"
          >
            {t("vorlagen.zeile.schliessen")}
          </button>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
        {t("vorlagen.wahl.hinweis")}
      </p>

      {/* Der Space, für den geschrieben wird — er bestimmt Vorgaben und Ablage. */}
      {(liste.data?.spaces.length ?? 0) > 0 ? (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <span>{t("vorlagen.wahl.space")}</span>
          <select
            data-testid="vorlagen-space"
            className="min-w-0 max-w-full rounded-input border border-hairline bg-page px-2 py-1 text-[12px] text-text"
            value={spaceId ?? ""}
            onChange={(e) => spaceWaehlen(e.target.value || null)}
          >
            <option value="">{t("vorlagen.wahl.ohneSpace")}</option>
            {(liste.data?.spaces ?? []).map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {vorrang ? (
        <p data-testid="vorlagen-vorrang" className="mt-1.5 text-[11.5px] text-muted-2">
          {vorrang}
          {s?.verdraengt ? ` ${t("vorlagen.vorrang.verdraengt", { name: s.verdraengt.name })}` : ""}
        </p>
      ) : null}

      {/* Auswahl: Klick wählt nur aus. Gruppiert nach Geltung. */}
      <div className="mt-2 space-y-1.5" data-testid="vorlagen-liste">
        {GELTUNGEN.map((g) => {
          const gruppe = angeboten.filter((v) => v.geltung === g);
          if (gruppe.length === 0) {
            return null;
          }
          return (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2 sm:w-auto">
                {t(`vorlagen.geltung.${g}`)}
              </span>
              {gruppe.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  data-testid="vorlage-option"
                  data-vorlage={v.id}
                  aria-pressed={gewaehltId === v.id}
                  onClick={() => {
                    setAuswahl(v.id);
                    setErgebnis(null);
                  }}
                  className={`rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${
                    gewaehltId === v.id
                      ? "border-ink bg-ink text-white"
                      : "border-hairline bg-page text-muted hover:border-ink/30 hover:text-text"
                  }`}
                >
                  {vorlagenName(v, sprache)}
                  {v.istStandard ? ` · ${t("vorlagen.istStandard")}` : ""}
                </button>
              ))}
            </div>
          );
        })}
        <button
          type="button"
          data-testid="vorlage-frei"
          aria-pressed={gewaehltId === FREI}
          onClick={frei}
          className={`rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${
            gewaehltId === FREI
              ? "border-ink bg-ink text-white"
              : "border-hairline bg-page text-muted hover:border-ink/30 hover:text-text"
          }`}
        >
          {t("vorlagen.frei.knopf")}
        </button>
      </div>

      {gewaehltId === FREI ? (
        <p data-testid="vorlagen-frei-hinweis" className="mt-2 text-[11.5px] text-muted">
          {t("vorlagen.frei.hinweis")}
          {spaceId ? ` ${t("vorlagen.frei.ohneSpace")}` : ""}
        </p>
      ) : null}

      {gewaehlt ? (
        <div className="mt-2 space-y-1.5" data-testid="vorlage-gewaehlt">
          <p className="text-[11.5px] text-muted">
            <span className="font-semibold text-text">{vorlagenName(gewaehlt, sprache)}</span>
            {" · "}
            {t(`vorlagen.geltung.${gewaehlt.geltung}`)}
            {gewaehlt.spaceName ? ` „${gewaehlt.spaceName}“` : ""}
            {" · "}
            {t("vorlagen.fassung", { version: gewaehlt.version })}
          </p>
          {gewaehlt.beschreibung ? (
            <p className="text-[11.5px] text-muted-2">
              {sprache === "de"
                ? gewaehlt.beschreibung
                : (gewaehlt.sprachen?.[sprache]?.beschreibung ?? gewaehlt.beschreibung)}
            </p>
          ) : null}
          <ul className="text-[11.5px] text-muted" data-testid="vorlage-felder">
            {gewaehlt.felder.map((f) => (
              <li key={f.id}>
                {feldText(f, sprache).titel}
                {f.pflicht ? (
                  <span className="ml-1 font-semibold text-trust-warn-text">
                    {t("vorlagen.pflicht.marke")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {gewaehlt.felder.some((f) => f.pflicht) ? (
            <p className="text-[11.5px] text-muted-2" data-testid="vorlage-pflicht-erklaerung">
              {t("vorlagen.pflicht.erklaerung")}
            </p>
          ) : null}
          {gewaehlt.geltung === "unternehmen" ? (
            <p className="text-[11.5px] text-muted-2">{t("vorlagen.einschraenkung.unternehmen")}</p>
          ) : null}
          {gewaehlt.geltung === "standard" ? (
            <p className="text-[11.5px] text-muted-2">{t("vorlagen.einschraenkung.standard")}</p>
          ) : null}

          {/* Vorschau des Wechsels: was übernommen, was verschoben, was entfernt wird. */}
          {schonAngewendet ? (
            <p className="text-[11.5px] text-muted-2" data-testid="vorlage-schon">
              {t("vorlagen.wechsel.schon")}
            </p>
          ) : wechsel ? (
            <div data-testid="vorlage-wechsel" className="space-y-1">
              <p className="text-[11.5px] text-muted">
                {textVonWechsel(t, wechsel, istInhaltLeer(bodyHtml))}
              </p>
              <details>
                <summary className="cursor-pointer text-[11px] text-muted-2">
                  {t("vorlagen.wechsel.vorschau")}
                </summary>
                <SanitizedHtml
                  html={sanitizeHtml(wechsel.html)}
                  className="prose-kw mt-1 max-h-56 overflow-y-auto rounded-btn border border-hairline bg-page px-2.5 py-2 text-[12.5px]"
                />
              </details>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!schonAngewendet ? (
              <Button
                variant="primary"
                data-testid="vorlage-anwenden"
                disabled={!wechsel}
                onClick={anwenden}
              >
                {bezug
                  ? t("vorlagen.anwenden.wechseln")
                  : istInhaltLeer(bodyHtml)
                    ? t("vorlagen.anwenden.setzen")
                    : t("vorlagen.anwenden.anfuegen")}
              </Button>
            ) : null}
            {gewaehlt.istStandard ? (
              <Button
                data-testid="vorlage-standard-aufheben"
                disabled={standard.isPending}
                onClick={() => standard.mutate(null)}
              >
                {t("vorlagen.standard.aufheben")}
              </Button>
            ) : (
              <Button
                data-testid="vorlage-standard"
                disabled={standard.isPending || !gewaehlt.darfAnwenden}
                onClick={() => standard.mutate(gewaehlt.id)}
              >
                {t("vorlagen.standard.setzen")}
              </Button>
            )}
          </div>
          {standard.isError ? (
            <p role="alert" className="text-[11.5px] text-trust-crit-text">
              {t(vorlagenFehlerSchluessel(standard.error))}
            </p>
          ) : null}
        </div>
      ) : null}

      {ergebnis ? (
        <output
          data-testid="vorlage-ergebnis"
          className="mt-2 block text-[11.5px] text-trust-pos-text"
        >
          {textVonWechsel(t, ergebnis, false, true)}
        </output>
      ) : null}

      {/* Space-Vorgaben — verbindliche Angaben, bei der Auswahl erklärt. */}
      {s?.vorgabe ? (
        <div
          data-testid="vorlagen-space-vorgabe"
          className="mt-2 rounded-btn bg-page px-2.5 py-1.5"
        >
          <p className="text-[11.5px] font-semibold text-text">
            {t("vorlagen.vorgabe.titel", { space: s.space?.name ?? "" })}
          </p>
          <ul className="text-[11.5px] text-muted">
            {verbindlich ? (
              <li>
                {t("vorlagen.vorgabe.verbindlich", { name: vorlagenName(verbindlich, sprache) })}
              </li>
            ) : null}
            {s.verbindlichNichtVerfuegbar ? (
              <li>{t("vorlagen.vorgabe.verbindlichFehlt")}</li>
            ) : null}
            {s.vorgabe.kategorien.length > 0 ? (
              <li>
                {t("vorlagen.vorgabe.kategorien", { liste: s.vorgabe.kategorien.join(", ") })}
              </li>
            ) : s.vorgabe.pflichtKategorie ? (
              <li>{t("vorlagen.vorgabe.pflichtKategorie")}</li>
            ) : null}
            {s.vorgabe.mindestensTags > 0 ? (
              <li>{t("vorlagen.vorgabe.tags", { anzahl: s.vorgabe.mindestensTags })}</li>
            ) : null}
            {s.vorgabe.tags.length > 0 ? (
              <li>{t("vorlagen.vorgabe.vorschlag", { liste: s.vorgabe.tags.join(", ") })}</li>
            ) : null}
            {s.vorgabe.hinweis ? <li>{s.vorgabe.hinweis}</li> : null}
          </ul>
          <p className="text-[11px] text-muted-2">{t("vorlagen.vorgabe.wann")}</p>
        </div>
      ) : null}

      {/* Dieselbe Prüfung wie beim Einreichen — als verständliche Feldliste. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          data-testid="vorlagen-pruefen"
          disabled={pruefung.isPending}
          onClick={() => pruefung.mutate()}
        >
          {t("vorlagen.pruefen.knopf")}
        </Button>
        <output aria-live="polite" className="text-[11.5px]">
          {pruefung.isSuccess && pruefung.data.befunde.length === 0 ? (
            <span className="text-trust-pos-text" data-testid="vorlagen-pruefung-ok">
              {t("vorlagen.pruefen.ok")}
            </span>
          ) : null}
          {pruefung.isError ? (
            <span className="text-trust-crit-text">
              {t(vorlagenFehlerSchluessel(pruefung.error))}
            </span>
          ) : null}
        </output>
      </div>
      {pruefung.isSuccess && pruefung.data.befunde.length > 0 ? (
        <ul
          data-testid="vorlagen-befunde"
          className="mt-1 list-disc pl-5 text-[11.5px] text-trust-crit-text"
        >
          {pruefung.data.befunde.map((b) => (
            <li key={`${b.art}:${b.wert}`}>{befundText(t, b)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function textVonWechsel(
  t: Uebersetze,
  w: VorlagenWechsel,
  leer: boolean,
  erledigt = false,
): string {
  if (leer) {
    return t("vorlagen.wechsel.setzen");
  }
  if (w.angefuegt) {
    return t(erledigt ? "vorlagen.wechsel.angefuegtErledigt" : "vorlagen.wechsel.angefuegt");
  }
  const teile = [
    t(erledigt ? "vorlagen.wechsel.erledigt" : "vorlagen.wechsel.plan"),
    w.uebernommen.length > 0
      ? t("vorlagen.wechsel.uebernommen", { liste: w.uebernommen.join(", ") })
      : t("vorlagen.wechsel.nichtsUebernommen"),
  ];
  if (w.verschoben.length > 0) {
    teile.push(t("vorlagen.wechsel.verschoben", { liste: w.verschoben.join(", ") }));
  }
  if (w.leerEntfernt.length > 0) {
    teile.push(t("vorlagen.wechsel.leer", { liste: w.leerEntfernt.join(", ") }));
  }
  return teile.join(" ");
}
