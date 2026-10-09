import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import {
  BEZUG_ARTEN,
  type BezugArt,
  type Geltungskontext,
  KONTEXT_ACHSEN,
  anlagenAdresse,
  anlagenPfad,
  bezuegeVon,
  kontextVon,
} from "../../lib/anlagenzugang";
import { QR_RUHEZONE, QrZuLangFehler, qrMatrix, qrSvgPfad } from "../../lib/qrCode";
import { RoleLink } from "../RoleLink";
import { Button } from "../ui";

// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DER QR-CODE EINES BEZUGS.
// ================================================================================================
//
// „Jede Anlage bekommt einen QR-Code. Smartphone scannen → KLARWERK öffnet die Wissens-Sicht für
// DIESE Anlage." Der Code steht dort, wo die Bezüge am Wissen hängen: im Abschnitt „Kopplung und
// Anlagen" der Leseansicht. Er kodiert die Adresse aus `lib/anlagenzugang.ts` — die Bibliothek mit
// der Facette der gewählten Anlage, des Bauteils oder des Materials — unter dem Ursprung, unter dem
// KLARWERK gerade läuft.
//
// DER GELTUNGSKONTEXT KANN MIT AUF DAS ETIKETT: Standort und Anlagenversion stehen an einer Maschine
// fest, die Schicht ebenso, wenn je Schicht ein Etikett hängt. Angeboten werden nur die Werte, die
// dieses Objekt nennt; ohne Wahl bleibt der Kontext offen und wird nach dem Scan in der
// Kontextleiste der Bibliothek gewählt.
//
// Ohne jeden Bezug am Objekt gibt es keinen Code (keine Zeile, kein Platzhalter). Ist die Adresse
// für Version 10-M zu lang, sagt die Fläche das, statt einen abgeschnittenen Link zu drucken.
export function AnlagenQrCode({
  ko,
}: {
  ko: Pick<KnowledgeObject, "asset" | "assets" | "anlagenkontext">;
}): JSX.Element | null {
  const { t } = useTranslation();
  const bezuege = useMemo(() => {
    const alle = bezuegeVon(ko);
    return BEZUG_ARTEN.flatMap((art) => alle[art].map((kennung) => ({ art, kennung })));
  }, [ko]);
  const kontextListen = useMemo(() => kontextVon(ko), [ko]);
  const [wahl, setWahl] = useState(0);
  const [kontext, setKontext] = useState<Geltungskontext>({});
  const bezug: { art: BezugArt; kennung: string } | undefined = bezuege[wahl] ?? bezuege[0];
  // Nur Kontextwerte, die dieses Objekt (noch) nennt — eine überholte Wahl fällt weg.
  const wirksamerKontext: Geltungskontext = {};
  for (const { param } of KONTEXT_ACHSEN) {
    const wert = kontext[param];
    if (wert && kontextListen[param].includes(wert)) {
      wirksamerKontext[param] = wert;
    }
  }
  const kontextSchluessel = JSON.stringify(wirksamerKontext);
  const bezugArt = bezug?.art;
  const bezugKennung = bezug?.kennung;

  const code = useMemo(() => {
    if (!bezugArt || !bezugKennung) {
      return null;
    }
    const adresse = anlagenAdresse(
      window.location.origin,
      bezugKennung,
      bezugArt,
      JSON.parse(kontextSchluessel) as Geltungskontext,
    );
    try {
      const matrix = qrMatrix(adresse);
      return { seite: matrix.length + 2 * QR_RUHEZONE, pfad: qrSvgPfad(matrix) };
    } catch (fehler) {
      if (fehler instanceof QrZuLangFehler) {
        return "zuLang" as const;
      }
      throw fehler;
    }
  }, [bezugArt, bezugKennung, kontextSchluessel]);

  if (!bezug || code === null) {
    return null;
  }

  const auswahl =
    bezuege.length > 1 ? (
      <select
        data-testid="anlagen-qr-bezug"
        aria-label={t("anlagenzugang.qr.bezug")}
        value={String(bezuege.indexOf(bezug))}
        onChange={(e) => setWahl(Number(e.target.value))}
        className="h-8 max-w-full rounded-input border border-hairline bg-surface px-2 text-[12px] text-text"
      >
        {bezuege.map((b, i) => (
          <option key={`${b.art}:${b.kennung}`} value={String(i)}>
            {`${t(`anlagenzugang.art.${b.art}`)}: ${b.kennung}`}
          </option>
        ))}
      </select>
    ) : null;
  const kontextAchsen = KONTEXT_ACHSEN.filter((achse) => kontextListen[achse.param].length > 0);
  const kontextWahl = kontextAchsen.map(({ param }) => (
    <select
      key={param}
      data-testid={`anlagen-qr-kontext-${param}`}
      aria-label={t(`anlagenzugang.kontext.${param}`)}
      value={wirksamerKontext[param] ?? ""}
      onChange={(e) => setKontext((alt) => ({ ...alt, [param]: e.target.value }))}
      className="h-8 max-w-full rounded-input border border-hairline bg-surface px-2 text-[12px] text-text"
    >
      <option value="">{t(`anlagenzugang.kontext.alle.${param}`)}</option>
      {kontextListen[param].map((wert) => (
        <option key={wert} value={wert}>
          {wert}
        </option>
      ))}
    </select>
  ));
  // Ben Nacharbeit 3: die Kontextwahl bleibt in JEDEM Zustand bedienbar — auch wenn sie die Adresse
  // über die Kapazität des Codes treibt. Sonst bliebe eine wirksame Wahl stehen, die niemand mehr
  // zurücknehmen kann. Dazu eine sichtbare Rücksetzung, sobald überhaupt ein Kontext gewählt ist.
  const kontextGewaehlt = Object.keys(wirksamerKontext).length > 0;
  const kontextBlock =
    kontextWahl.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {kontextWahl}
        {kontextGewaehlt ? (
          <Button
            variant="ghost"
            data-testid="anlagen-qr-kontext-zuruecksetzen"
            onClick={() => setKontext({})}
          >
            {t("anlagenzugang.qr.kontextZuruecksetzen")}
          </Button>
        ) : null}
      </div>
    ) : null;

  if (code === "zuLang") {
    return (
      <div className="mt-2.5 flex flex-col gap-1.5 border-t border-hairline pt-2.5">
        {auswahl}
        {kontextBlock}
        <p data-testid="anlagen-qr-zu-lang" className="text-[12px] text-trust-warn-text">
          {t("anlagenzugang.qr.zuLang")}
        </p>
      </div>
    );
  }

  const pfad = anlagenPfad(bezug.kennung, bezug.art, wirksamerKontext);
  const bildText = t("anlagenzugang.qr.bild", { anlage: bezug.kennung });
  const herunterladen = (): void => {
    // Dieselbe Zeichnung als eigenständige Datei: weißer Grund (das Etikett), schwarze Module.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${code.seite} ${code.seite}" width="${code.seite * 8}" height="${code.seite * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${code.pfad}" fill="#000"/></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `klarwerk-${bezug.art}-${bezug.kennung.replace(/[^A-Za-z0-9._-]+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="anlagen-qr"
      className="mt-2.5 flex flex-wrap items-start gap-3 border-t border-hairline pt-2.5"
    >
      <svg
        data-testid="anlagen-qr-bild"
        role="img"
        aria-label={bildText}
        viewBox={`0 0 ${code.seite} ${code.seite}`}
        shapeRendering="crispEdges"
        className="h-32 w-32 shrink-0 rounded-input border border-hairline"
      >
        <title>{bildText}</title>
        {/* Weißer Grund auch im dunklen Thema: ein Scanner braucht den Kontrast des Etiketts. */}
        <rect width="100%" height="100%" fill="#fff" />
        <path d={code.pfad} fill="#000" />
      </svg>
      <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-text">
          {t("anlagenzugang.qr.titel", { anlage: bezug.kennung })}
        </span>
        <p className="text-[12px] text-muted">{t("anlagenzugang.qr.hinweis")}</p>
        {auswahl}
        {kontextBlock}
        <RoleLink
          to={pfad}
          testId="anlagen-qr-oeffnen"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ai"
          hoverClassName="hover:underline"
        >
          {(erreichbar) => (
            <>
              {t("anlagenzugang.qr.oeffnen")}
              {erreichbar ? <span aria-hidden="true">→</span> : null}
            </>
          )}
        </RoleLink>
        <span>
          <Button variant="ghost" onClick={herunterladen}>
            <Download size={14} aria-hidden="true" />
            {t("anlagenzugang.qr.herunterladen")}
          </Button>
        </span>
      </div>
    </div>
  );
}
