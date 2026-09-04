import { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BibliothekFlaeche } from "../components/bibliothek/BibliothekFlaeche";

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
export function KnowledgeDetail(): JSX.Element {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // `edit=1` gehört zu GENAU DEM Eintrag, für den der Deep-Link kam (SCRUM-417). Bliebe er beim
  // Weiterblättern stehen, risse sich das Bearbeiten-Formular an jedem nächsten Eintrag von selbst
  // auf — die Fläche montiert die Leseansicht je Eintrag neu, ein Ref-Wächter trüge dort nicht.
  const naechsteSuche = (() => {
    const p = new URLSearchParams(params);
    p.delete("edit");
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

  return (
    <div data-testid="page-wissen">
      <BibliothekFlaeche vorgewaehlt={id} beiWahl={beiWahl} beiLoeschung={beiLoeschung} />
    </div>
  );
}
