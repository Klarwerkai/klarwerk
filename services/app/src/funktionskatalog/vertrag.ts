export type KatalogSprache = "de" | "en" | "nl";
export type KatalogText = Record<KatalogSprache, string>;
export type KatalogPlattform = "klarwerk" | "office" | "app";
export type KatalogStatus =
  | "available"
  | "partial"
  | "commissioned"
  | "planned"
  | "idea"
  | "deferred"
  | "excluded"
  | "historical";

export interface KatalogEintrag {
  id: string;
  platforms: KatalogPlattform[];
  group: string;
  status: KatalogStatus;
  title: KatalogText;
  description: KatalogText;
  input: KatalogText;
  output: KatalogText;
  sources: { label: KatalogText; reference: string }[];
  scope?: KatalogText;
}

export interface Funktionskatalog {
  stand: string;
  groups: { id: string; label: KatalogText }[];
  entries: KatalogEintrag[];
}
