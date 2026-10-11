// ================================================================================================
// R-1632 / R-1633 (aufnahme:20260922:gesamt-standortwissen) — GELTUNG SEHEN, SETZEN, BEIM FRAGEN.
// ================================================================================================
//
// Drei Bauteile, eine Beschriftung:
//   · `GeltungFeld`       — am Wissensobjekt (Abschnitt „Provenienz"): Konzern-Standard,
//                           Werks-Praxis oder Schicht-spezifisch, optional Rolle; ändern darf, wer
//                           das Objekt bearbeiten darf (Server: `ko.create`).
//   · `FragekontextWahl`  — auf der Fragen-Seite: „Ich frage für" Werk/Schicht/Rolle. Vorschläge
//                           kommen aus den Geltungen, die der Bestand schon führt — nichts erfunden.
//   · `GeltungsAuskunft`  — unter der Antwort: wofür gewichtet wurde und wie jede herangezogene
//                           Quelle dazu passt. Das sagt der SERVER (`AskResponse.geltung`); diese
//                           Fläche rechnet die Passung nicht nach.
// Die Regel selbst (Vererbung, Rang) steht nur am Server: services/knowledge-object/src/geltung.ts.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AskGeltungsauskunft,
  Fragekontext,
  GeltungsEbene,
  KnowledgeObject,
  KoGeltung,
} from "../api/types";
import { Button, TextInput } from "./ui";

// Als Überladung ohne `undefined`-Fall — dieselbe Form und derselbe Grund wie `Translate` in
// `lib/auditAction.ts` (die i18next-`TFunction` passt sonst unter `exactOptionalPropertyTypes` nicht).
interface Uebersetze {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/** „Werks-Praxis · Werk Nord · Rolle Instandhaltung" — dieselbe Form an Objekt und Fragen-Seite. */
export function geltungsBeschriftung(geltung: KoGeltung, t: Uebersetze): string {
  return [t(`geltung.ebene.${geltung.ebene}`), geltung.werk, geltung.schicht, geltung.rolle]
    .filter((teil): teil is string => typeof teil === "string" && teil.length > 0)
    .join(" · ");
}

/** Der Fragekontext als kurze Zeile („Werk Nord · Frühschicht"), leer wenn nichts angegeben ist. */
export function fragekontextBeschriftung(kontext: Fragekontext): string {
  return [kontext.werk, kontext.schicht, kontext.rolle]
    .map((teil) => teil?.trim() ?? "")
    .filter((teil) => teil.length > 0)
    .join(" · ");
}

/** Nur gefüllte Angaben — ein leerer Kontext ist `undefined` (dann wird nichts mitgeschickt). */
export function fragekontextZumSenden(kontext: Fragekontext): Fragekontext | undefined {
  const werk = kontext.werk?.trim();
  const schicht = kontext.schicht?.trim();
  const rolle = kontext.rolle?.trim();
  if (!werk && !schicht && !rolle) {
    return undefined;
  }
  return {
    ...(werk ? { werk } : {}),
    ...(schicht ? { schicht } : {}),
    ...(rolle ? { rolle } : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// Am Wissensobjekt
// ------------------------------------------------------------------------------------------------

export function GeltungFeld({
  geltung,
  darfAendern,
  wartet,
  onSpeichern,
}: {
  geltung: KoGeltung | undefined;
  darfAendern: boolean;
  wartet: boolean;
  onSpeichern: (geltung: KoGeltung | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [ebene, setEbene] = useState<GeltungsEbene | "">(geltung?.ebene ?? "");
  const [werk, setWerk] = useState(geltung?.werk ?? "");
  const [schicht, setSchicht] = useState(geltung?.schicht ?? "");
  const [rolle, setRolle] = useState(geltung?.rolle ?? "");
  // Was zur gewählten Ebene fehlt — derselbe Vertrag wie am Server (`normalizeGeltung`); der Server
  // bleibt die Instanz, hier wird nur verhindert, dass ein sicher abgewiesener Wert erst losgeht.
  const fehlt =
    ebene === "werk" && !werk.trim()
      ? t("geltung.feld.werk")
      : ebene === "schicht" && !schicht.trim()
        ? t("geltung.feld.schicht")
        : null;
  const entwurf: KoGeltung | null =
    ebene === ""
      ? null
      : {
          ebene,
          ...(ebene !== "konzern" && werk.trim() ? { werk: werk.trim() } : {}),
          ...(ebene === "schicht" && schicht.trim() ? { schicht: schicht.trim() } : {}),
          ...(rolle.trim() ? { rolle: rolle.trim() } : {}),
        };
  const unveraendert = JSON.stringify(entwurf) === JSON.stringify(geltung ?? null);
  return (
    <div data-testid="ko-geltung" className="mt-3 border-t border-hairline pt-3 text-[12.5px]">
      <p className="font-semibold text-text">{t("geltung.titel")}</p>
      <p data-testid="ko-geltung-wert" className="mt-0.5 text-muted">
        {geltung ? geltungsBeschriftung(geltung, t) : t("geltung.keine")}
      </p>
      {darfAendern ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-muted">
            <span>{t("geltung.feld.ebene")}</span>
            <select
              data-testid="ko-geltung-ebene"
              value={ebene}
              disabled={wartet}
              onChange={(e) => setEbene(e.target.value as GeltungsEbene | "")}
              className="rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px] text-text"
            >
              <option value="">{t("geltung.feld.ohne")}</option>
              <option value="konzern">{t("geltung.ebene.konzern")}</option>
              <option value="werk">{t("geltung.ebene.werk")}</option>
              <option value="schicht">{t("geltung.ebene.schicht")}</option>
            </select>
          </label>
          {ebene === "werk" || ebene === "schicht" ? (
            <TextInput
              data-testid="ko-geltung-werk"
              aria-label={t("geltung.feld.werk")}
              placeholder={t("geltung.feld.werk")}
              value={werk}
              maxLength={80}
              onChange={(e) => setWerk(e.target.value)}
            />
          ) : null}
          {ebene === "schicht" ? (
            <TextInput
              data-testid="ko-geltung-schicht"
              aria-label={t("geltung.feld.schicht")}
              placeholder={t("geltung.feld.schicht")}
              value={schicht}
              maxLength={80}
              onChange={(e) => setSchicht(e.target.value)}
            />
          ) : null}
          {ebene !== "" ? (
            <TextInput
              data-testid="ko-geltung-rolle"
              aria-label={t("geltung.feld.rolle")}
              placeholder={t("geltung.feld.rolle")}
              value={rolle}
              maxLength={80}
              onChange={(e) => setRolle(e.target.value)}
            />
          ) : null}
          {fehlt ? (
            <p className="text-trust-warn-text">{t("geltung.unvollstaendig", { feld: fehlt })}</p>
          ) : null}
          <p className="text-muted-2">{t("geltung.erklaerung")}</p>
          <div>
            <Button
              data-testid="ko-geltung-speichern"
              variant="primary"
              disabled={wartet || unveraendert || fehlt !== null}
              onClick={() => onSpeichern(entwurf)}
            >
              {t("geltung.speichern")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Auf der Fragen-Seite
// ------------------------------------------------------------------------------------------------

/** Die im Bestand schon geführten Werke, Schichten und Rollen — Vorschläge, keine Vorgabe. */
export function geltungsVorschlaege(kos: readonly KnowledgeObject[]): {
  werke: string[];
  schichten: string[];
  rollen: string[];
} {
  const werke = new Set<string>();
  const schichten = new Set<string>();
  const rollen = new Set<string>();
  for (const ko of kos) {
    const g = ko.geltung;
    if (g?.werk) {
      werke.add(g.werk);
    }
    if (g?.schicht) {
      schichten.add(g.schicht);
    }
    if (g?.rolle) {
      rollen.add(g.rolle);
    }
  }
  const sortiert = (s: Set<string>): string[] => [...s].sort((a, b) => a.localeCompare(b, "de"));
  return { werke: sortiert(werke), schichten: sortiert(schichten), rollen: sortiert(rollen) };
}

export function FragekontextWahl({
  wert,
  onWert,
  kos,
}: {
  wert: Fragekontext;
  onWert: (kontext: Fragekontext) => void;
  kos: readonly KnowledgeObject[];
}): JSX.Element {
  const { t } = useTranslation();
  // Zugeklappt stehen KEINE Eingabefelder im Baum: das Fragefeld bleibt das erste Eingabefeld der
  // Seite (Tastaturfolge und die Flächentests, die es so finden).
  const [offen, setOffen] = useState(false);
  const vorschlaege = geltungsVorschlaege(kos);
  const zeile = fragekontextBeschriftung(wert);
  const feld = (
    schluessel: keyof Fragekontext,
    beschriftung: string,
    liste: string[],
  ): JSX.Element => (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-0.5">
      {/* Ausdrücklich über `htmlFor`/`id` verknüpft — `TextInput` erkennt die a11y-Prüfung im
          umschließenden Label nicht als Eingabefeld. */}
      <label htmlFor={`ask-fragekontext-${schluessel}-feld`}>{beschriftung}</label>
      <TextInput
        id={`ask-fragekontext-${schluessel}-feld`}
        data-testid={`ask-fragekontext-${schluessel}`}
        list={`ask-fragekontext-${schluessel}-liste`}
        value={wert[schluessel] ?? ""}
        maxLength={80}
        onChange={(e) => onWert({ ...wert, [schluessel]: e.target.value })}
        className="h-8 text-[12.5px]"
      />
      <datalist id={`ask-fragekontext-${schluessel}-liste`}>
        {liste.map((eintrag) => (
          <option key={eintrag} value={eintrag} />
        ))}
      </datalist>
    </div>
  );
  return (
    <div
      data-testid="ask-fragekontext"
      className="mb-2 rounded-btn bg-page px-3 py-1.5 text-[12.5px] text-muted"
    >
      <button
        type="button"
        data-testid="ask-fragekontext-umschalten"
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="text-left"
      >
        {t("geltung.frage.titel")}:{" "}
        <span data-testid="ask-fragekontext-zeile" className="font-semibold text-text">
          {zeile || t("geltung.frage.leer")}
        </span>
      </button>
      {offen ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {feld("werk", t("geltung.feld.werk"), vorschlaege.werke)}
            {feld("schicht", t("geltung.feld.schicht"), vorschlaege.schichten)}
            {feld("rolle", t("geltung.feld.rolle"), vorschlaege.rollen)}
          </div>
          <p className="mt-2 text-muted-2">{t("geltung.frage.hinweis")}</p>
          {zeile ? (
            <button
              type="button"
              data-testid="ask-fragekontext-leeren"
              onClick={() => onWert({})}
              className="mt-1 text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
            >
              {t("geltung.frage.leeren")}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function GeltungsAuskunft({
  auskunft,
  titelVon,
}: {
  auskunft: AskGeltungsauskunft;
  titelVon: (id: string) => string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="ask-geltung"
      className="mt-3 rounded-btn bg-page px-3 py-2 text-[12.5px] text-muted"
    >
      <p className="font-semibold text-text">
        {t("geltung.frage.gewichtet", {
          kontext: fragekontextBeschriftung(auskunft.fragekontext),
        })}
      </p>
      {auskunft.quellen.length > 0 ? (
        <>
          <p className="mt-1">{t("geltung.frage.quellen")}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {auskunft.quellen.map((q) => (
              <li
                key={q.id}
                data-testid="ask-geltung-quelle"
                data-passung={q.passung}
                className="flex flex-wrap gap-x-2"
              >
                <span className="text-text">{titelVon(q.id)}</span>
                <span>{q.geltung ? geltungsBeschriftung(q.geltung, t) : t("geltung.keine")}</span>
                <span className="font-semibold">{t(`geltung.passung.${q.passung}`)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
