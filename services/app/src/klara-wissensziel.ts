import type { CreateKoInput } from "../../knowledge-object";

export interface WissensZiel {
  art: "artikel" | "space";
  spaceId?: string;
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  type: CreateKoInput["type"];
  category: string;
  conditions: string[];
  vorlage?: { id: string; version: number };
}

export class WissensFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export function text(x: unknown, max: number, kuerzen = true): string {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw new WissensFehler(400, "Ungültige oder fehlende Textangabe.");
  return kuerzen ? x.trim() : x;
}

export function liste(x: unknown): unknown[] {
  if (!Array.isArray(x) || x.length > 50) throw new WissensFehler(400, "Ungültige Liste.");
  return x;
}

export function objekt(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new WissensFehler(400, "Objekt erwartet.");
  return x as Record<string, unknown>;
}

export function wissensZiel(roh: unknown): WissensZiel {
  const x = objekt(roh);
  if (x.art !== "artikel" && x.art !== "space")
    throw new WissensFehler(400, "Artikel oder Space wählen.");
  if (!["intern", "vertraulich", "streng_vertraulich"].includes(String(x.confidentiality)))
    throw new WissensFehler(400, "Sichtbarkeit bewusst wählen.");
  if (
    !["bauchgefuehl", "best_practice", "lernkurve", "technik", "negativwissen"].includes(
      String(x.type),
    )
  )
    throw new WissensFehler(400, "Wissensart wählen.");
  const vorlage = x.vorlage === undefined ? undefined : objekt(x.vorlage);
  if (vorlage && (!Number.isInteger(vorlage.version) || Number(vorlage.version) < 1))
    throw new WissensFehler(400, "Vorlagenfassung fehlt.");
  return {
    art: x.art,
    ...(x.art === "space" ? { spaceId: text(x.spaceId, 200) } : {}),
    confidentiality: x.confidentiality as WissensZiel["confidentiality"],
    type: x.type as WissensZiel["type"],
    category: text(x.category, 200),
    conditions: liste(x.conditions ?? []).map((v) => text(v, 500)),
    ...(vorlage
      ? { vorlage: { id: text(vorlage.id, 200), version: Number(vorlage.version) } }
      : {}),
  };
}
