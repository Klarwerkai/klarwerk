export interface KlaraBeschaffungsziel {
  produkt: string;
  bedarf: string;
  menge: string;
  termin: string;
  empfaengerVorschlaege: string[];
  erlaubteEmpfaenger: string[];
  quellen: { id: string; fassung: number; status: string }[];
  aussenwirkung: "keine";
  offen?: string[];
}

import type { ErkannterAuftrag } from "./klaraAuftragErkennung";

/** Widersprüchliche Angaben bleiben offen, damit die vorhandene gezielte Rückfrage entscheidet. */
function eindeutigeAngabe(
  text: string,
  muster: RegExp,
  schluessel: (wert: string) => string = (wert) => wert,
): string {
  const werte = new Map<string, string>();
  for (const treffer of text.matchAll(muster)) {
    const wert = (treffer[1] ?? treffer[2])?.trim();
    if (wert) werte.set(schluessel(wert), wert);
  }
  return werte.size === 1 ? (werte.values().next().value ?? "") : "";
}

/** Nur eine ausdrückliche Angebote-Vorbereitung aus dem Auftragseingang, nie aus Quellen. */
export function erkenneBeschaffung(s: string): ErkannterAuftrag | null {
  const m =
    /^(?:besorge|hole|bereite|prepare|get|vraag|bereid)\s+(?:mir\s+)?(?:neue\s+|new\s+|nieuwe\s+)?(?:angebote|offers|quotes|offertes)\s+(.+)$/iu.exec(
      s,
    );
  if (!m) return null;
  const rest = m[1] ?? "";
  const produkt = eindeutigeAngabe(
    rest,
    // Ganze zitierte Namen überspringen; nur ausdrücklich außerhalb genannte Produkte vergleichen.
    /(?:produkt|product)\s+(?:[„“"«]([^“”"»]+)[“”"»]|([\p{L}\p{N}][\p{L}\p{N}._/-]*)(?=\s|[,;.]|$))|[„“"«][^“”"»]*[“”"»]/giu,
  );
  // Zitierte Produkt-, Quellen- und Empfängernamen sind Daten, keine Mengen-/Terminangaben.
  const angaben = rest.replace(/[„“"«][^“”"»]*[“”"»]/gu, " ");
  const menge = eindeutigeAngabe(
    angaben,
    /(?:^|[\s:;,])(\d+(?:[.,]\d+)?\s+(?:stück|stueck|pieces|units|stuks|kg|tonnen|t|liter|l|m²|m2|meter|m))(?=\s|[,;.]|$)/giu,
    (wert) => {
      const [zahl, einheit] = wert.split(/\s+/);
      return `${Number(zahl?.replace(",", "."))} ${einheit?.toLocaleLowerCase()}`;
    },
  );
  const termin = eindeutigeAngabe(angaben, /(?:^|[\s:;,])(\d{4}-\d{2}-\d{2})(?=\s|[,;.]|$)/gu);
  const quelle = /(?:quelle|source|bron)\s+[„“"«]([^“”"»]+)[“”"»]/iu.exec(rest)?.[1]?.trim();
  const empfaenger =
    /(?:empfängervorschlag|empfaengervorschlag|recipient proposal|ontvangervoorstel)\s+[„“"«]([^“”"»]+)[“”"»]/iu
      .exec(rest)?.[1]
      ?.trim();
  const grenze = rest.search(
    /(?:produkt|product)\s|(?:für|fuer|for|voor)\s+\d|(?:bis|by|voor)\s+\d{4}-|(?:quelle|source|bron|empfängervorschlag|recipient proposal|ontvangervoorstel)\s/iu,
  );
  const bedarf = (grenze < 0 ? rest : rest.slice(0, grenze))
    .replace(/^(?:für|fuer|for|voor)\s+(?:(?:die|das|den|the|de|het)\s+)?/iu, "")
    .replace(/\s+(?:von|of|van)\s*$/iu, "")
    .replace(/[ ,;:]+$/u, "")
    .trim();
  return {
    beschaffung: {
      produkt,
      bedarf,
      menge,
      termin,
      empfaengerVorschlaege: empfaenger ? [empfaenger] : [],
      erlaubteEmpfaenger: [],
      quellen: [],
      aussenwirkung: "keine",
    },
    ...(quelle ? { beschaffungsQuelle: quelle } : {}),
    schritte: ["Anforderung", "Anfrage"].map((name) => ({
      aktion: "entwurf_erstellen",
      suche: "neu",
      name,
    })),
  };
}
export function fehlendeBeschaffungsangaben(
  b: KlaraBeschaffungsziel,
): ("produkt" | "bedarf" | "menge" | "termin")[] {
  const datum =
    /^\d{4}-\d{2}-\d{2}$/.test(b.termin) &&
    !Number.isNaN(Date.parse(b.termin)) &&
    new Date(b.termin).toISOString().slice(0, 10) === b.termin;
  return [
    ...(!b.bedarf.trim() || b.bedarf.length > 500 ? ["bedarf" as const] : []),
    ...(!b.produkt.trim() || b.produkt.length > 200 ? ["produkt" as const] : []),
    ...(!/^\d+(?:[.,]\d+)?\s+\p{L}[\p{L}\s./²-]*$/u.test(b.menge) ||
    Number(b.menge.split(/\s/)[0]?.replace(",", ".")) <= 0
      ? ["menge" as const]
      : []),
    ...(!datum ? ["termin" as const] : []),
  ];
}
