import { Blatt } from "../components/erfassen/Blatt";
import { CaptureArbeitsraum } from "./Capture";

// ================================================================================================
// JOB 3062 · H3 — DIE VORDERTÜR IST DAS BLATT GEWORDEN.
// ================================================================================================
//
// Diese Datei hatte 1686 Zeilen: Kopf mit Kicker „Erfassen / Dokument-Editor", Titelfeld mit
// Hilfe-Tipp, Vertraulichkeits-Auswahlliste mit Hilfe-Tipp, den Editor, einen umrandeten KI-Kasten
// mit zwei Auslösern und vier Hinweiszeilen, drei Knöpfe, dazu rechts eine Status-Karte und eine
// Karte „Mehr Erfassungswege" mit aufklappbarer Liste — neun `HelpTip`s insgesamt.
//
// IHRE LOGIK IST NICHT VERSCHWUNDEN, SIE IST UMGEZOGEN. Entwurf laden und speichern, Einreichen
// über den Promote-Weg, der Vorgangsschlüssel und sein Rückweg aus dem 409, der Standkonflikt, die
// Leerwert-Semantik des Rumpfes, der KI-Vorschlag mit ausschliesslich bewusster Übernahme, der
// Navigations- und der Entladewächter — alles steht jetzt in `components/erfassen/Blatt.tsx`, mit
// den Begründungen der jeweiligen Entscheidung. Es gibt keine zweite Fassung davon.
//
// WARUM DIE ROUTE BLEIBT: `/erfassen/vordertuer` steht in Links, Lesezeichen und in der
// Navigationstabelle. Sie zeigt jetzt dasselbe Blatt wie `/erfassen` und `/erfassen/neu` — eine
// Adresse, die ins Leere liefe, wäre ein Verlust ohne Gewinn.
export function CaptureFrontDoor(): JSX.Element {
  return (
    <Blatt
      arbeitsraum={({ modus, onEntwurfInsBlatt }) => (
        <CaptureArbeitsraum modus={modus} onEntwurfInsBlatt={onEntwurfInsBlatt} />
      )}
    />
  );
}
