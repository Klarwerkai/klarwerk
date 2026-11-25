import { ablaeufe } from "./ablaeufe";
import { ergaenzungen } from "./ergaenzungen";
import type { Belegart, Redaktionseintrag } from "./redaktion";
import { klara } from "./register-klara";
import { klarwerk } from "./register-klarwerk";
import { themen } from "./themen";
import type { Funktionskatalog, KatalogEintrag, KatalogStatus, KatalogText } from "./vertrag";

function text(de: string, en: string, nl: string): KatalogText {
  return { de, en, nl };
}

const belegtitel: Record<Belegart, KatalogText> = {
  register: text(
    "Funktionsregister · Eintrag",
    "Feature register · entry",
    "Functieregister · vermelding",
  ),
  appendix: text(
    "Funktionsanhang · PDF-Seite",
    "Feature appendix · PDF page",
    "Functiebijlage · PDF-pagina",
  ),
  historic: text(
    "Historischer Funktionsauftrag",
    "Historical feature brief",
    "Historische functieopdracht",
  ),
  investor: text(
    "Investorenpräsentation UK · Folie",
    "UK investor presentation · slide",
    "Britse investeerderspresentatie · dia",
  ),
  oldrelease: text(
    "Lieferstand laut Oktoberregister",
    "Delivery recorded in the October register",
    "Levering volgens het oktoberregister",
  ),
  contract: text(
    "Teilbeleg im zugeordneten Vertrag",
    "Partial evidence in the associated contract",
    "Deelbewijs in de bijbehorende opdracht",
  ),
  delivery: text(
    "Geprüfte Produktlieferung",
    "Verified product delivery",
    "Getoetste productlevering",
  ),
  mac: text(
    "Prüfung an der installierten Mac-App",
    "Check on the installed Mac app",
    "Toets op de geïnstalleerde Mac-app",
  ),
};

const umfang: Record<KatalogStatus, KatalogText> = {
  available: text(
    "Der Beleg gilt für den beschriebenen Arbeitsweg und die angegebene Fassung.",
    "The evidence applies to the documented workflow and version.",
    "Het bewijs geldt voor de beschreven werkwijze en versie.",
  ),
  partial: text(
    "Für Teile des zugeordneten Arbeitswegs gibt es einen Beleg. Die Abnahme des gesamten Umfangs steht aus.",
    "Parts of the associated workflow have supporting evidence. Acceptance of the complete scope is outstanding.",
    "Voor onderdelen van de bijbehorende werkwijze is er bewijs. Acceptatie van het volledige bereik staat nog open.",
  ),
  commissioned: text(
    "Das Register enthält einen Auftrag. Die Ausführung im beschriebenen Gesamtumfang ist offen.",
    "The register records a commission. Delivery of the complete workflow is still open.",
    "Het register bevat een opdracht. De levering van de volledige werkwijze staat nog open.",
  ),
  planned: text(
    "Der Eintrag beschreibt das geplante Verhalten.",
    "This entry describes the intended behaviour.",
    "Deze vermelding beschrijft de beoogde werking.",
  ),
  idea: text(
    "Die Quelle beschreibt einen Vorschlag. Eine Entscheidung über die Umsetzung steht aus.",
    "The source describes a proposal. An implementation decision is outstanding.",
    "De bron beschrijft een voorstel. Een besluit over uitvoering staat nog open.",
  ),
  deferred: text(
    "Die Quelle ordnet dies einer späteren Ausbaustufe zu.",
    "The source assigns this to a later stage of development.",
    "De bron plaatst dit in een latere ontwikkelfase.",
  ),
  excluded: text(
    "Diese Funktion liegt außerhalb des dokumentierten Erstumfangs.",
    "This feature is outside the documented initial scope.",
    "Deze functie valt buiten de gedocumenteerde eerste versie.",
  ),
  historical: text(
    "Die Quelle hält ein früheres Ziel der Produktplanung fest.",
    "The source records an earlier product planning objective.",
    "De bron legt een eerdere doelstelling van de productplanning vast.",
  ),
};

const oktoberstand: Record<KatalogStatus, KatalogText> = {
  available: text(
    "Oktoberstand · im PoC belegt",
    "October status · verified in the proof of concept",
    "Oktoberstatus · aangetoond in de proefversie",
  ),
  partial: text(
    "Oktoberstand · teilweise belegt",
    "October status · partially evidenced",
    "Oktoberstatus · deels aangetoond",
  ),
  commissioned: text(
    "Oktoberstand · beauftragt",
    "October status · commissioned",
    "Oktoberstatus · opdracht gegeven",
  ),
  planned: text("Oktoberstand · geplant", "October status · planned", "Oktoberstatus · gepland"),
  idea: text("Oktoberstand · Idee", "October status · idea", "Oktoberstatus · idee"),
  deferred: text(
    "Oktoberstand · zurückgestellt",
    "October status · deferred",
    "Oktoberstatus · uitgesteld",
  ),
  excluded: text(
    "Oktoberstand · außerhalb des Erstumfangs",
    "October status · outside initial scope",
    "Oktoberstatus · buiten de eerste versie",
  ),
  historical: text(
    "Oktoberstand · historisches Ziel",
    "October status · historical target",
    "Oktoberstatus · historisch doel",
  ),
};

function erschliesse({ ablauf, belege, oktober, ...eintrag }: Redaktionseintrag): KatalogEintrag {
  const schritte = ablaeufe[ablauf];
  if (!schritte) throw new Error(`Fehlender Ablauf im Funktionsregister: ${eintrag.id}`);
  const sources = belege.map(([art, reference]) => ({ label: belegtitel[art], reference }));
  if (oktober) sources.push({ label: oktoberstand[oktober], reference: "19.10.2026" });
  return {
    ...eintrag,
    ...schritte,
    scope: eintrag.scope ?? umfang[eintrag.status],
    sources,
  };
}

export const funktionskatalog: Funktionskatalog = {
  stand: "2026-11-25",
  groups: themen,
  entries: [...klarwerk, ...klara, ...ergaenzungen].map(erschliesse),
};
