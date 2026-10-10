import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useKo } from "../api/hooks";
import { AufgegangenHinweis } from "../components/AufgegangenHinweis";
import { ChatGespraechKnopf } from "../components/ChatGespraechKnopf";
import { HelpTip } from "../components/HelpTip";
import { LesevarianteHinweis } from "../components/LesevarianteHinweis";
import { SanitizedHtml } from "../components/SanitizedHtml";
import { SpaceZeile } from "../components/SpaceZeile";
import { BibliothekFlaeche } from "../components/bibliothek/BibliothekFlaeche";
import { Card, SectionLabel } from "../components/ui";
import { STELLE_PARAM } from "../lib/belegstelle";
import { sprachcode, useFrischeLesevariante } from "../lib/lesevariante";
import { FASSUNG_PARAM, fassungsLage, leseFassung } from "../lib/objektbezug";
import { useGelesenerStand } from "../lib/useGelesenerStand";

// ==================================================================================================
// JOB 3063 · H4 — DAS WISSENSOBJEKT-DETAIL IST DIE LESEFLÄCHE DER BIBLIOTHEK GEWORDEN.
// ==================================================================================================
//
// Diese Datei trug bis zu diesem Auftrag 2.625 Zeilen und rendete dreizehn `<Card>`-Abschnitte
// untereinander (Konflikt · Quellen & Belege · Externes Wissen · Quelle/Beitrag · Provenienz ·
// Kopplung · Herkunftskette · Historie · Belege · Schnappschüsse · Kommentare · Anhänge ·
// Nachbarschaft), dazu vier Hilfe-Tipps. Gemessen am 04.09.2026 in Chromium an der gebauten Seite:
// 3.082 Zeichen sichtbarer Text und zwanzig Karten an einem frisch erfassten Objekt.
//
// JETZT: `/wissen/:id` zeigt DIESELBE Fläche wie `/bibliothek` — Liste links, dieser Eintrag rechts
// vorgewählt. Die dreizehn Abschnitte liegen hinter der einen Zeile „Mehr" (zugeklappt als Vorgabe),
// mit unveränderten Funktionen. Alle Deep-Links bleiben gültig: `?edit=1` (Validierungsboard),
// `?rework=review` (Nacharbeit), `?demo=stage1` (Pilotpfad) und die Verweise aus Word und Fragen.
//
// WARUM DIE SEITE BLEIBT UND NICHT DIE ROUTE VERSCHWINDET: `routes.tsx` gehört zu JOB H1 (Hülle) und
// ist hier ausdrücklich nicht Zielpfad. Die Route zeigt deshalb weiter auf diese Datei; sie ist nur
// vom Seitenaufbau zum Adress-Adapter geworden.
//
// ==================================================================================================
// JOB 3326 · LESEVARIANTE — DIE ÜBERSETZTE LESEANSICHT STEHT VOR DER FLÄCHE.
// ==================================================================================================
//
// Steht die Oberfläche auf einer anderen Sprache als das Original UND liegt für dieses Objekt eine
// Leseübersetzung vor, führt diese Seite die übersetzte Leseansicht (Titel, Kernaussage, Inhalt) mit
// dem sichtbaren Hinweis „Übersetzung · Original: Englisch" und dem Umschalter „Original anzeigen".
// Die Fläche darunter bleibt WÖRTLICH unverändert: dieselbe Kennung, dieselbe Quelle, derselbe
// Prüfstatus, dieselbe Freigabe, derselbe Originaltext. Das ist die Zusage dieses Jobs — die
// Übersetzung ist eine zweite LESART, nie eine zweite Wahrheit.
//
// WARUM DIE ÜBERSETZUNG NICHT IN DIE FLÄCHE HINEINGESCHRIEBEN WIRD: `components/bibliothek/*`
// gehört nicht zu den Zielpfaden dieses Auftrags. Die übersetzte Lesart steht deshalb VOR ihr,
// ausdrücklich benannt, statt still in fremden Dateien den Titel auszutauschen. Was daraus folgt
// (die Bibliotheks-LISTE zeigt weiter den Originaltitel), steht in der Rückgabe unter ABWEICHUNGEN.
export function KnowledgeDetail(): JSX.Element {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // `edit=1` gehört zu GENAU DEM Eintrag, für den der Deep-Link kam (SCRUM-417). Bliebe er beim
  // Weiterblättern stehen, risse sich das Bearbeiten-Formular an jedem nächsten Eintrag von selbst
  // auf — die Fläche montiert die Leseansicht je Eintrag neu, ein Ref-Wächter trüge dort nicht.
  const naechsteSuche = (() => {
    const p = new URLSearchParams(params);
    p.delete("edit");
    // R-0326/R-0329: Belegstelle und Abschnittssprung gehören ebenso nur zu DIESEM Eintrag — und
    // die Fassung des Rückwegs (Arbeitswege am selben Artikel) ebenso. `fassung` ist EIN Parameter
    // für beide Wege (`lib/belegstelle.ts` und `lib/objektbezug.ts` nennen denselben Namen).
    p.delete(STELLE_PARAM);
    p.delete(FASSUNG_PARAM);
    p.delete("abschnitt");
    return p.toString();
  })();

  // Ein Klick auf einen anderen Eintrag wechselt hier die ADRESSE mit — sonst zeigte `/wissen/:id`
  // einen anderen Eintrag, als sie nennt. `replace`, weil das Blättern in der Liste kein Ortswechsel
  // ist: der Zurück-Knopf soll die Bibliothek verlassen, nicht durch jede gelesene Zeile stolpern.
  const beiWahl = useCallback(
    (naechste: string) => {
      navigate(`/wissen/${naechste}${naechsteSuche ? `?${naechsteSuche}` : ""}`, { replace: true });
    },
    [navigate, naechsteSuche],
  );
  const beiLoeschung = useCallback(() => {
    navigate("/bibliothek");
  }, [navigate]);

  // JOB 3326 R3: Diese Fläche fragt SELBST und bei jedem Öffnen — Titel, Kernaussage, Fließtext und
  // die beiden Vorbehalte kommen ausschliesslich aus DIESER frischen Antwort. Der Vorrat
  // (`useLesevariante`) wird hier bewusst NICHT mehr gelesen: er ist eine je Sprache einmal gefüllte
  // Liste, und eine Warnung, die aus einer Liste von vorhin stammt, ist keine. Die ausgeschriebene
  // Begründung samt der zwei gemessenen Befunde steht in `lib/lesevariante.ts`.
  const sprache = sprachcode(i18n.language);
  const lage = useFrischeLesevariante(id, sprache);
  const variante = lage.zustand === "da" ? lage.variante : undefined;
  const [zeigtOriginal, setZeigtOriginal] = useState(false);
  // Arbeitswege am selben Artikel: genannte Fassung (Adresse) gegen die, die die Lesefläche
  // gerade zeigt (`meldeGelesenenStand` — kein eigener Abruf). Ein anderer Artikel zählt nicht.
  const genannteFassung = leseFassung(params);
  const gelesen = useGelesenerStand();
  const aktuelleFassung = gelesen?.koId === id ? gelesen.fassung : null;
  // Sprachwechsel UND Eintragswechsel setzen die Wahl „Original anzeigen" zurück: sie gehörte zur
  // vorherigen Anzeige. Beim Eintragswechsel bleibt die Fläche darunter montiert — ohne diesen
  // Rückfall trüge der nächste Eintrag die Entscheidung des vorherigen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sprache`/`id` sind der AUSLÖSER, nicht gelesene Größen.
  useEffect(() => {
    setZeigtOriginal(false);
  }, [sprache, id]);

  // WISSENSDETAIL (R-0907/R-1037) — DER BROWSER NENNT DEN EINTRAG, DEN DIE ADRESSE NENNT.
  // Bis hierher stand im Tab auf jeder `/wissen/:id` derselbe Produktname: wer zwei Einträge in zwei
  // Tabs offen hatte oder im Verlauf zurücksuchte, fand ihn nicht wieder. Jetzt steht vorn der Titel,
  // den die Seite gerade zeigt (die Übersetzung, solange sie dasteht), dahinter der bisherige
  // Dokumenttitel — er wird nicht ersetzt, nur ergänzt, und beim Verlassen zurückgestellt.
  // `useKo` ist DIESELBE Abfrage, die die Lesefläche stellt (gleicher Schlüssel): kein zweiter Abruf.
  // Nur hier, nicht auf `/bibliothek`: dort ist die Vorwahl rechts keine getroffene Wahl.
  const eintrag = useKo(id);
  const gezeigterTitel = variante && !zeigtOriginal ? variante.title : eintrag.data?.title;
  const tabTitel = (gezeigterTitel ?? "").trim();
  useEffect(() => {
    if (tabTitel.length === 0) {
      return;
    }
    const vorher = document.title;
    document.title = `${tabTitel} · ${vorher}`;
    return () => {
      document.title = vorher;
    };
  }, [tabTitel]);

  return (
    <div data-testid="page-wissen">
      {/* ==========================================================================================
          JOB 3669 — DIE SEITENHILFE DIESER SEITE (Zahnrad → „Seitenhilfe").
          ==========================================================================================
          `/wissen/:id` ist keine Navigationsstation, also gibt es hier auch keinen Nav-Erklärsatz:
          das Zahnrad zeigte unter „Seitenhilfe" den Leersatz — auf der Seite, auf der ein Neuling
          zum ersten Mal ein einzelnes Wissensobjekt vor sich hat. Der Text sagt, was er da liest
          (dieselbe Fläche wie die Bibliothek, dieser Eintrag vorgewählt), wo das Übrige liegt
          (hinter „Mehr") und was der nächste Schritt ist.

          Die Leseübersetzung wird ausdrücklich als solche benannt — der Text verspricht keine
          Übersetzung, sondern sagt, WANN eine dasteht. Kein Sichtfeld-Element: `HelpTip` rendert
          nichts. */}
      <HelpTip title={t("seitenhilfe.wissen.title")} body={t("seitenhilfe.wissen.body")} />
      {variante ? (
        <Card className="mb-3" data-testid="lesevariante-leseansicht">
          <LesevarianteHinweis
            variante={variante}
            zeigtOriginal={zeigtOriginal}
            onUmschalten={() => setZeigtOriginal((v) => !v)}
          />
          {zeigtOriginal ? (
            <p className="mt-2 text-[12.5px] text-muted">{t("lesevariante.originalUnten")}</p>
          ) : (
            <div className="mt-2">
              <SectionLabel>{t("lesevariante.leseansicht")}</SectionLabel>
              <h2 data-testid="lesevariante-titel" className="text-[17px] font-semibold text-text">
                {variante.title}
              </h2>
              <p className="mt-1 text-[13px] text-muted">{variante.statement}</p>
              <SanitizedHtml
                html={variante.bodyHtml}
                className="prose-kw mt-2 text-[13px] text-muted"
              />
            </div>
          )}
        </Card>
      ) : null}
      {lage.zustand === "fehlt" ? (
        <p data-testid="lesevariante-fehler" className="mb-3 text-[12.5px] text-trust-warn-text">
          {t("lesevariante.abrufFehler")}
        </p>
      ) : null}
      {/* Arbeitswege am selben Artikel: der Rückweg (aus Fragen oder Klara) nennt die Fassung, aus
          der er kam. Hat sich der Beitrag seitdem geändert, steht das hier — ausserhalb der Fläche,
          die keinen Erklärtext trägt, und nur dann; bei gleicher Fassung bleibt die Seite still.
          Trägt die Adresse eine Belegstelle (`stelle`, R-0326), meldet die Lesefläche die andere
          Fassung schon selbst (`belegLage` „andereFassung“) — dann steht hier nichts doppelt. */}
      {!params.has(STELLE_PARAM) &&
      fassungsLage(genannteFassung, aktuelleFassung) === "abweichend" ? (
        <p
          data-testid="objektbezug-fassung-abweichend"
          data-fassung={genannteFassung ?? undefined}
          data-aktuell={aktuelleFassung ?? undefined}
          className="mb-3 text-[12.5px] text-trust-warn-text"
        >
          {t("arbeitsweg.lesen.fassungAbweichend", {
            genannt: genannteFassung,
            aktuell: aktuelleFassung,
          })}
        </p>
      ) : null}
      {/* R-1107: ist dieser Eintrag in einem Führungsartikel aufgegangen, sagt die Zeile worin. */}
      <AufgegangenHinweis koId={id} />
      <BibliothekFlaeche
        vorgewaehlt={id}
        beiWahl={beiWahl}
        beiLoeschung={beiLoeschung}
        // produkt:20261007:spaces: führender Space, Spacezuständigkeit und Artikelverantwortung
        // getrennt, dazu der Spacewechsel mit Rechtevorschau. Unsichtbar → der Server sagt 404,
        // die Zeile zeichnet dann nichts.
        // LESEN-INHALT-ZUERST (Ben, nacharbeit-6): die Zeile stand VOR der ganzen Fläche und schob
        // Titel, Status und erste Regel mobil um etwa 260 px nach unten. Sie steht jetzt in der
        // Lesespalte NACH dem fachlichen Inhalt — dieselbe Komponente, dieselben Rechte.
        // produkt:20261007:interner-chat: dahinter der Weg in das Gespräch zu genau diesem Artikel.
        nachDemInhalt={
          <>
            <SpaceZeile koId={id} />
            <div className="mt-3">
              <ChatGespraechKnopf ziel={{ art: "artikel", koId: id }} />
            </div>
          </>
        }
      />
    </div>
  );
}
