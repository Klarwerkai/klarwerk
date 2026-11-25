import type { KatalogEintrag, KatalogStatus, KatalogText } from "./vertrag";

export interface Ablauf {
  input: KatalogText;
  output: KatalogText;
}

export type Belegart =
  | "register"
  | "appendix"
  | "historic"
  | "investor"
  | "oldrelease"
  | "contract"
  | "planning"
  | "delivery"
  | "mac";

export interface Redaktionseintrag extends Omit<KatalogEintrag, "input" | "output" | "sources"> {
  ablauf: string;
  belege: [Belegart, string][];
  oktober?: KatalogStatus;
}
