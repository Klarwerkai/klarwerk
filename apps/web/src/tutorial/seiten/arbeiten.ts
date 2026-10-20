import type { SeitenEintrag } from "./typen";
export const ARBEITEN: readonly SeitenEintrag[] = [
  {
    id: "erfassen",
    pfade: ["/erfassen", "/erfassen/neu", "/capture/frontdoor", "/erfassen/vordertuer"],
    titelKey: "nav.capture",
    ziel: 'main input:not([type="hidden"]), main [contenteditable="true"]',
  },
  {
    id: "entwuerfe",
    pfade: ["/entwuerfe"],
    titelKey: "mob.drafts",
    ziel: '[data-testid="page-entwuerfe"]',
  },
  {
    id: "ablauf",
    pfade: ["/erfassen/ablauf"],
    titelKey: "nav.capture",
    ziel: '[data-testid="ablauf-datei"]',
  },
  {
    id: "aufgaben",
    pfade: ["/aufgaben"],
    titelKey: "nav.tasks",
    ziel: '[data-testid="aufgaben-persoenlich"]',
    hilfeKeys: [
      "klaraaufgabe.bedienhilfe.bearbeiten",
      "klaraerinnerung.bedienhilfe.anlegen",
      "klaranotiz.bedienhilfe.anlegen",
    ],
  },
  {
    id: "pruefen",
    pfade: ["/validierung"],
    titelKey: "kopfband.pruefen",
    ziel: '[data-testid="pruefen-warteschlange"]',
  },
  {
    id: "konflikte",
    pfade: ["/konflikte", "/konflikte/:id/vergleich"],
    titelKey: "nav.conflicts",
    ziel: '[data-testid="pruefen-flaeche"]',
  },
  {
    id: "duplikate",
    pfade: ["/duplikate", "/duplikate/:id/vergleich"],
    titelKey: "nav.duplicates",
    ziel: '[data-testid="pruefen-flaeche"]',
  },
  {
    id: "zusammenfuehren",
    pfade: ["/duplikate/:id/zusammenfuehren"],
    titelKey: "nav.duplicates",
    ziel: '[data-testid="zusammenfuehren-schritte"]',
  },
  {
    id: "spaces",
    pfade: ["/spaces", "/spaces/:id"],
    titelKey: "spaces.seite.titel",
    ziel: '[data-testid="space-detail"], [data-testid="space-eintrag"], main h1',
  },
  {
    id: "chat",
    pfade: ["/chat", "/chat/:id"],
    titelKey: "chat.seite.titel",
    ziel: '[data-testid="chat-eingabe"], [data-testid="chat-neu-oeffnen"]',
  },
  {
    id: "gemeinsam",
    pfade: ["/wissen/:id/gemeinsam"],
    titelKey: "gemeinsam.seite.titel",
    ziel: '[data-testid="gemeinsam-editor"]',
  },
  {
    id: "gesamtanweisungen",
    pfade: ["/gesamtanweisungen", "/gesamtanweisungen/:id"],
    titelKey: "ga.bereich.titel",
    ziel: "main h1",
  },
  {
    id: "besprechungen",
    pfade: ["/besprechungen", "/besprechungen/:id"],
    titelKey: "besprechungen.titel",
    ziel: '[data-testid="besprechungen-anlegen"], [data-testid="besprechung-dateien"]',
  },
  {
    id: "kalender",
    pfade: ["/kalender"],
    titelKey: "kalender.titel",
    ziel: '[data-testid="kalender-eintrag"], main h1',
    hilfeKeys: ["klaraerinnerung.bedienhilfe.anlegen"],
  },
];
