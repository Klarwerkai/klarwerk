// AUFTRAG-mega59 BLOCK E — EINE KENNUNG IST KEIN NAME.
//
// DER BEFUND (Pedis Live-Durchlauf, C3): mehrere Flächen führten die rohe Wissensobjekt-Kennung als
// SICHTBAREN Text, obwohl der Titel im SELBEN Datensatz lag. Der gemeldete Ort (Quellenliste der
// Mobil-Antwort) ist geschlossen; zwei Flächen blieben — das Herkunfts-Panel der Stufe 2 und die
// Fehlerbilanz des Gruppen-Imports. Eine Kennung wie `ko_8f3a…` sagt dem Nutzer nichts; sie ist eine
// Adresse, kein Name.
//
// DIE REGEL IST BEWUSST EINE EINZIGE FUNKTION, an EINER Stelle, damit die zwei Flächen nicht
// auseinanderlaufen und der Rückfall überall dieselbe Bedeutung hat:
//
//   · Ist ein Titel da, führt der Titel.
//   · Fehlt er (leer, nur Leerzeichen, gar nicht vorhanden), bleibt die KENNUNG der Rückfall. Das
//     ist ehrlich und darf ausdrücklich NICHT durch einen leeren Platz ersetzt werden — eine Zeile
//     ohne jede Bezeichnung ist schlimmer als eine Zeile mit einer Kennung.
//
// Die Kennung bleibt an beiden Flächen erreichbar, aber nachrangig (als `title`-Tooltip bzw. kleiner
// Zusatz). Reine Funktion, kein Zustand, kein Netz — deshalb hier und nicht in einer Komponente.
export function koLabel(title: string | null | undefined, koId: string): string {
  const getrimmt = (title ?? "").trim();
  return getrimmt.length > 0 ? getrimmt : koId;
}

// Trägt diese Zeile ihren Titel, oder ist sie auf den Rückfall zurückgefallen? Die Flächen brauchen
// die Unterscheidung, um die Kennung NUR dann zusätzlich zu zeigen, wenn sie nicht schon der
// Haupttext ist — sonst stünde dieselbe Zeichenfolge zweimal in derselben Zeile.
export function hatTitel(title: string | null | undefined): boolean {
  return (title ?? "").trim().length > 0;
}
