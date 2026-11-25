export interface Quellabsatz {
  text: string;
  quellen: string[];
}

// Der HTTP-Weg liefert die geprüfte Zuordnung als `absaetze` aus. Das Symbol erhält die
// Bindung bei Objektkopien auf dem Dienstweg, ohne einen zweiten Antworttext in JSON abzulegen.
export const QUELLWORTLAUTE = Symbol("Quellwortlaute");

export function formatiereQuellwortlaute(
  stimmen: readonly { ref: { id: string; title: string }; text: string }[],
  einleitung: string,
  rueckfrage?: string,
): { text: string; abschnitte: Quellabsatz[] } {
  const mehrere = stimmen.length > 1;
  const ids = stimmen.map((s) => s.ref.id);
  const abschnitte = [
    ...(mehrere ? [{ text: einleitung, quellen: ids }] : []),
    ...stimmen.map(({ ref, text }) => ({
      text: mehrere ? `${ref.title}: ${text}` : text,
      quellen: [ref.id],
    })),
    ...(mehrere && rueckfrage ? [{ text: rueckfrage, quellen: ids }] : []),
  ];
  return { text: abschnitte.map((a) => a.text).join("\n\n"), abschnitte };
}
