// ================================================================================================
// JOB 4151 (BEN R3) — DIE VERSCHRÄNKUNG WIRD HERGESTELLT, NICHT HERBEIGEHOFFT.
// ================================================================================================
//
// BENs Promptverbesserung, wörtlich: „Erzwinge im Test: Beide Anfragen lesen einen fehlenden
// Wiederholschlüssel; erst danach schreibt Anfrage A vollständig, anschliessend Anfrage B. Prüfe
// identische und unterschiedliche Beziehungen. Ein zufällig grünes `Promise.all` genügt nicht als
// Parallelitätsnachweis."
//
// Genau dafür ist dieser Doppelgänger da, und er steht in EINER Datei, weil beide Ablagen ihn
// brauchen: der Speicherbestand im Tor (`schluesselbindung-parallel.test.ts`) und `PgKantenRepo`
// gegen echte, nebeneinander laufende Verbindungen
// (`bestand-postgres.integration.test.ts`). Zwei abgeschriebene Fassungen wären zwei verschiedene
// Verschränkungen — und dann sagte ein grüner Lauf je Ablage etwas anderes.
//
// WAS ER VERSTELLT: nichts. Er reicht jeden Aufruf unverändert an den echten Bestand durch und
// hält allein den Nachschlag des Wiederholschlüssels an, bis die verabredete Zahl von Anfragen dort
// angekommen ist. Er erfindet keine Antwort, unterdrückt keine und schreibt nichts. Wer ihn
// weglässt, misst denselben Fall ohne die Verschränkung — und damit nur den Zufall des Tages.
import type { KantenRepo } from "../../services/knowledge-object";

export function mitTorwaerter(echt: KantenRepo, anzahl: number): KantenRepo {
  let angekommen = 0;
  let oeffne: () => void = () => undefined;
  const tor = new Promise<void>((aufloesen) => {
    oeffne = aufloesen;
  });
  return {
    // Jede Methode steht einzeln da und reicht durch. Ein `...echt` wäre hier die stille Falle:
    // die Methoden einer Klasse liegen am Prototyp, ein Spread kopiert sie NICHT — der
    // Doppelgänger wäre halb leer, und ein Test daran grün aus dem falschen Grund.
    holeNachBeitrag: async (schluessel) => {
      // ERST lesen, DANN anhalten: so hat jede Anfrage den Schlüssel wirklich als „fehlt"
      // gesehen, bevor irgendeine schreiben darf. Andersherum stünde die Verschränkung vor der
      // Messung, und der Fall wäre ein anderer.
      const ergebnis = await echt.holeNachBeitrag(schluessel);
      angekommen += 1;
      if (angekommen >= anzahl) {
        oeffne();
      }
      await tor;
      return ergebnis;
    },
    setze: (k, o) => echt.setze(k, o),
    setzeMitBindung: (k, s) => echt.setzeMitBindung(k, s),
    hole: (id) => echt.hole(id),
    fuerKo: (id) => echt.fuerKo(id),
    fuerKos: (ids) => echt.fuerKos(ids),
    alleAktiven: () => echt.alleAktiven(),
  };
}
