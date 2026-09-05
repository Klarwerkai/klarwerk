import { useSearchParams } from "react-router-dom";
import { Blatt } from "../components/erfassen/Blatt";
import { CaptureArbeitsraum } from "./Capture";

// ================================================================================================
// JOB 3062 · H3 — DER ZUHÖRENDE EINSTIEG IST DAS BLATT GEWORDEN.
// ================================================================================================
//
// `/erfassen/neu` hatte eine eigene Überschrift („Was weißt du, das andere wissen sollten?"), vier
// Starter-Chips, ein sechszeiliges Textfeld, eine Live-Reaktionszone, Struktur-Chips und einen
// Beruhigungssatz — eine dritte Fläche für denselben Zweck.
//
// WAS DAVON WO WEITERLEBT (Auftrag §5a):
//   · Starter-Chips (Entscheidung · Fehler · Wie es läuft · Was sich geändert hat)
//         → Titel-Menü des LEEREN Blattes (`Blatt.tsx`, `blatt-menue-titel`).
//   · Live-Reaktion („Ähnliches existiert schon", „könnte widersprechen")
//         → EIN stiller Chip unter dem Blatt, nur im Fall, mit Klick auf die Fundstelle.
//   · Struktur-Chips (Titel · Kategorie · Quelle)
//         → Blatt-Titel, Menü „Bereich", und die Quelle als Zeile im „…"-Menü unter „Status".
//   · Beispiel-Wissensobjekt aus dem Leerzustand
//         → „…"-Menü → „Beispiel ansehen".
//   · „Wissen ablegen" und der Abschluss „Geschafft" mit „Wissensobjekt ansehen"
//         → Knopf „Einreichen" und die Erfolgszeile mit Link.
//
// DER DEEP-LINK-INHALT BLEIBT EIN DEEP-LINK-INHALT: `?text=` startet als Text im Blatt
// (Lieferung 1). Er wird NICHT gespeichert und nicht als Vorschlag ausgegeben — es ist der Text
// des Menschen, der ihn mitgebracht hat.
export function KnowledgeIntake(): JSX.Element {
  const [params] = useSearchParams();
  const startText = params.get("text") ?? undefined;
  return (
    <Blatt
      startText={startText}
      arbeitsraum={({ modus, onEntwurfInsBlatt }) => (
        <CaptureArbeitsraum modus={modus} onEntwurfInsBlatt={onEntwurfInsBlatt} />
      )}
    />
  );
}
