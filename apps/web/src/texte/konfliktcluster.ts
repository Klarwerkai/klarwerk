// ================================================================================================
// R-1637 · KONFLIKT-CLUSTER-ERKENNUNG — die Texte der Cluster-Auskunft auf der Konfliktseite.
// ================================================================================================
//
// Der Hinweis sagt, WAS den Cluster bildet (gemeinsame Beiträge) und was er NICHT tut: entschieden
// wird weiter je Widerspruch. Ableitung und Begriff: `apps/web/src/lib/konfliktCluster.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "konfliktcluster.",
  legacySchluessel: [],
  de: {
    "konfliktcluster.titel": "Konflikt-Cluster: {{n}} Widersprüche zwischen {{m}} Beiträgen",
    "konfliktcluster.erklaerung":
      "Diese Widersprüche hängen über gemeinsame Beiträge zusammen. Zusammen zeigen sie eine Unklarheit im ganzen Thema, nicht nur einen einzelnen Widerspruch. Entschieden wird weiterhin je Widerspruch.",
    "konfliktcluster.beitraege": "Beteiligte Beiträge",
    "konfliktcluster.widersprueche": "Widersprüche im Cluster",
    "konfliktcluster.paar": "{{a}} ↔ {{b}}",
  },
  en: {
    "konfliktcluster.titel": "Conflict cluster: {{n}} contradictions between {{m}} items",
    "konfliktcluster.erklaerung":
      "These contradictions are linked through shared items. Together they point to an unclear topic as a whole, not just a single contradiction. Decisions are still made per contradiction.",
    "konfliktcluster.beitraege": "Items involved",
    "konfliktcluster.widersprueche": "Contradictions in this cluster",
    "konfliktcluster.paar": "{{a}} ↔ {{b}}",
  },
  nl: {
    "konfliktcluster.titel": "Conflictcluster: {{n}} tegenstrijdigheden tussen {{m}} bijdragen",
    "konfliktcluster.erklaerung":
      "Deze tegenstrijdigheden hangen samen via gedeelde bijdragen. Samen wijzen ze op onduidelijkheid in het hele onderwerp, niet alleen op één tegenstrijdigheid. Er wordt nog steeds per tegenstrijdigheid beslist.",
    "konfliktcluster.beitraege": "Betrokken bijdragen",
    "konfliktcluster.widersprueche": "Tegenstrijdigheden in dit cluster",
    "konfliktcluster.paar": "{{a}} ↔ {{b}}",
  },
} satisfies Textmodul;
