export type KatalogSprache = "de" | "en" | "nl";
export type KatalogText = Record<KatalogSprache, string>;
export type KatalogPlattform = "klarwerk" | "office" | "app";
export type KatalogStatus =
  | "available"
  | "poc"
  | "contract"
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

export type KatalogKantenstand = "nachgewiesen" | "dokumentiert" | "vorgesehen";

export interface KatalogVerbindung {
  von: string;
  nach: string;
  text: KatalogText;
  stand: KatalogKantenstand;
  beleg: KatalogText;
}

export interface KatalogWeg {
  id: string;
  titel: KatalogText;
  verbindungen: KatalogVerbindung[];
}

export interface Funktionskatalog {
  stand: string;
  groups: { id: string; label: KatalogText }[];
  entries: KatalogEintrag[];
  wege: KatalogWeg[];
}
