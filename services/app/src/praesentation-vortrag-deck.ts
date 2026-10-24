// Ausschließlich lesender Adapter des festen PP-05-Ports (N/fbc1ef39).
// Keine Deckablage und kein neuer Folienleser. Daten-/Quellrechte kommen aus dem PP-02/03-Kontext.
import JSZip from "jszip";
import type { DeckVertrag } from "./office-datenfolien";
import type { VortragsDeck, VortragsKontext } from "./praesentation-vortrag";
import { zaehleEchteExpansion } from "./routes/capture-routes";

export type { VortragsDeck };
const normal = (s: string) => s.replace(/\s+/gu, " ").trim();
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

export async function leseVortragsDeck(
  bytes: Buffer,
  k: VortragsKontext,
): Promise<VortragsDeck | undefined> {
  const zip = await JSZip.loadAsync(bytes);
  const pfade = Object.keys(zip.files).filter((p) => /^ppt\/klara\/pp05-\d+\.json$/.test(p));
  // Mehrere Elternstände nicht aus Dateinamen oder Uhrzeit erraten. PP-07 muss sie auflösen.
  if (pfade.length !== 1) return undefined;
  const bereich = zip.folder("ppt/klara");
  if (!bereich || (await zaehleEchteExpansion(bereich, 1024 * 1024)).art !== "gemessen")
    return undefined;
  const roh: unknown = JSON.parse((await zip.file(pfade[0] ?? "")?.async("string")) ?? "null");
  if (
    !obj(roh) ||
    roh.vertrag !== "klara-pp05-v1" ||
    !Array.isArray(roh.folien) ||
    !Array.isArray(roh.belegfolien) ||
    !obj(roh.plan) ||
    !Array.isArray(roh.plan.fakten) ||
    roh.folien.length > 160 ||
    roh.belegfolien.length > 100 ||
    roh.plan.fakten.length > 100
  )
    return undefined;
  const folien: DeckVertrag["folien"] = [];
  for (const f of roh.folien) {
    if (
      !obj(f) ||
      typeof f.sldId !== "string" ||
      !["haupt", "detail", "einzelfolie"].includes(String(f.rolle)) ||
      !Array.isArray(f.datenpunkte) ||
      f.datenpunkte.length > 100 ||
      !k.folien.some((n) => n.sldId === f.sldId)
    )
      return undefined;
    const datenpunkte = f.datenpunkte.flatMap((b: unknown) =>
      obj(b) &&
      typeof b.id === "string" &&
      Number.isSafeInteger(b.fassung) &&
      k.datenpunkte.some((d) => d.id === b.id && d.fassung === b.fassung)
        ? [{ id: b.id, fassung: Number(b.fassung) }]
        : [],
    );
    folien.push({
      sldId: f.sldId,
      rolle: f.rolle as "haupt" | "detail" | "einzelfolie",
      datenpunkte,
    });
  }
  const belegfolien: DeckVertrag["belegfolien"] = [];
  for (const b of roh.belegfolien) {
    if (
      !obj(b) ||
      typeof b.datenpunktId !== "string" ||
      !Number.isSafeInteger(b.datenFassung) ||
      !Array.isArray(b.sldIds) ||
      b.sldIds.length > 160 ||
      b.sldIds.some((s: unknown) => typeof s !== "string")
    )
      continue;
    const d = k.datenpunkte.find((d) => d.id === b.datenpunktId && d.fassung === b.datenFassung);
    // Ohne vollständig rechtegeprüften aktuellen Datenpunkt weder Kennung noch Belegweg ausgeben.
    if (
      !d ||
      !d.bindungen.some(
        (n) =>
          n.koId === k.koId &&
          n.anhangId === k.anhangId &&
          (n.lage === "aktuell" || n.lage === "bestaetigt_in_neuer_fassung"),
      )
    )
      continue;
    const fakt = roh.plan.fakten.find(
      (f: unknown) => obj(f) && f.id === d.id && f.fassung === d.fassung,
    );
    if (
      !obj(fakt) ||
      !Array.isArray(fakt.belege) ||
      fakt.belege.some((s: unknown) => typeof s !== "string")
    )
      continue;
    const ids = b.sldIds as string[];
    if (
      !ids.length ||
      ids.some(
        (id) =>
          !folien.some(
            (f) =>
              f.sldId === id &&
              f.rolle === "detail" &&
              f.datenpunkte.some((a) => a.id === d.id && a.fassung === d.fassung),
          ),
      )
    )
      continue;
    // Die tatsächlich lesbaren Texte der Detailfolien müssen weiterhin den gebundenen Belegtext
    // enthalten. Manuelle Änderung/Löschung ist ein Konflikt, keine passende alte Belegfolie.
    const inhalt = ids
      .map(
        (id) =>
          k.folien
            .find((f) => f.sldId === id)
            ?.elemente.filter((e) => e.shapeId === "3")
            .map((e) => e.text)
            .join(" ") ?? "",
      )
      .join(" ");
    if (normal(inhalt) !== normal((fakt.belege as string[]).join(" "))) continue;
    belegfolien.push({ datenpunktId: d.id, datenFassung: d.fassung, sldIds: ids });
  }
  return { vertrag: "klara-pp05-v1", dateiFassung: k.dateiFassung, folien, belegfolien };
}
