// ================================================================================================
// ENTWURFSPOOL · DIE TEXTE DES AUFTRAGS „ENTWURF BEWUSST IN DEN GEMEINSAMEN ENTWURFS-POOL GEBEN".
// ================================================================================================
//
// WOHER: `aufnahme:20260922:entwurf-in-gemeinsamen-pool-geben` (R-2099, SOLL:FR-CAP-06, Pedi
// `debbb8e8` „Beides" und `297afc57`). Ein Entwurf bleibt standardmäßig privat; der Autor kann einen
// einzelnen Entwurf bewusst in den gemeinsamen Pool geben und wieder herausnehmen.
//
// ZWEI ERKLÄRTEXTE STEHEN HIER ALS NEUE SCHLÜSSEL STATT ALS GEÄNDERTE WERTE — dasselbe Vorgehen wie
// `suchraum.ts` (R-0432, `ko.read.weitereAngaben`): `chelp.saveDraftHelp.body` und
// `seitenhilfe.entwuerfe.body` stehen im eingefrorenen Textschnappschuss (`tests/i18n-textmodule`,
// mit Prüfsumme) und sagten „Nur du siehst ihn" bzw. „niemand sonst sieht sie" ohne den Pool. Seit
// diesem Auftrag liest keine Fläche sie mehr:
//   · `entwurfspool.saveDraftHelp.body` — „Entwurf speichern" (`lib/captureHelp.ts`, Knopfblock
//     `KnopfUnterschied` und „?"-Menü des Blattes),
//   · `entwurfspool.seitenhilfe.title/body` — Seitenhilfe von „Meine Entwürfe"
//     (`pages/MeineEntwuerfe.tsx`). Der Titel ist wörtlich der bisherige; er steht hier nur, weil
//     Titel und Text einer Seitenhilfe einen gemeinsamen Stamm tragen.
//
// Die Erklärung zu „Entwurf speichern" zitiert keine Pool-Beschriftung in Anführungszeichen: sie
// steht auch auf dem Blatt, und dort darf die Hilfe nur Beschriftungen des Blattes zitieren (R-1000,
// `tests/erfassung-einstieg/fehlersatz-und-hilfe.test.ts`). Die Seitenhilfe von „Meine Entwürfe"
// zitiert die beiden Pool-Knöpfe, denn genau dort stehen sie.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "entwurfspool.",
  legacySchluessel: [],
  de: {
    "entwurfspool.aktion.geben": "In den Pool geben",
    "entwurfspool.aktion.nehmen": "Aus dem Pool nehmen",
    "entwurfspool.aktion.gebenFolge":
      "Alle mit Schreibrecht sehen diesen Entwurf dann mit deinem Namen und können ihn fortsetzen. Einreichen und löschen kannst ihn weiterhin nur du.",
    "entwurfspool.aktion.nehmenFolge": "Danach siehst nur du diesen Entwurf wieder.",
    "entwurfspool.marke": "Im gemeinsamen Pool",
    "entwurfspool.quittung.gegeben": "Entwurf in den gemeinsamen Pool gegeben.",
    "entwurfspool.quittung.genommen": "Entwurf ist wieder privat.",
    "entwurfspool.saveDraftHelp.body":
      "Sichert deinen Zwischenstand privat auf dem Server — du kannst jederzeit weitermachen, auf jedem deiner Geräte und auch nach einem Neustart. Ein Entwurf ist NICHT eingereicht: Nur du siehst ihn, solange du ihn nicht bewusst teilst, und er taucht in keiner Prüfung und keiner Antwort auf. Teilen ist eine eigene Handlung je Entwurf: Unter Meine Entwürfe kannst du einen einzelnen Entwurf bewusst in den gemeinsamen Pool geben. Dann sehen ihn alle mit Schreibrecht mit deinem Namen und können ihn fortsetzen; einreichen und löschen kannst ihn weiterhin nur du. Deine gespeicherten Entwürfe findest du zum Fortsetzen unter „Mehr“ → Entwürfe und im Menü unter Meine Entwürfe.",
    "entwurfspool.seitenhilfe.title": "Meine Entwürfe: begonnene Erfassungen fortsetzen",
    "entwurfspool.seitenhilfe.body":
      "Hier stehen die Erfassungen, die als Entwurf gespeichert und noch nicht zu einem Wissensobjekt geworden sind — dieselben Entwürfe, die auch der Editor und der Arbeitsraum zeigen, nur an einem eigenen Ort; einen zweiten Entwurfsspeicher gibt es nicht. Deine Entwürfe sind privat: Niemand sonst sieht sie, auch kein Administrator — es sei denn, du gibst einen einzelnen Entwurf mit „In den Pool geben“ bewusst in den gemeinsamen Pool. Dann sehen ihn alle mit Schreibrecht hier mit deinem Namen als Ersteller und können ihn fortsetzen; einreichen und löschen kannst ihn weiterhin nur du, und „Aus dem Pool nehmen“ macht ihn wieder privat. Genauso stehen hier die Entwürfe, die andere bewusst in den Pool gegeben haben. Das Suchfeld über der Liste durchsucht ausschließlich diese Entwürfe und kein Wissen aus der Bibliothek, „Sortieren“ ordnet sie nach Stand oder Titel. Gelöschte Entwürfe gehen in den „Papierkorb“ unter der Liste: „Wiederherstellen“ holt einen zurück, „Endgültig löschen“ entfernt ihn wirklich, und von selbst leert sich der Papierkorb nicht. Nächster Schritt: Klick „Fortsetzen“ an einer Zeile — der Entwurf öffnet sich im Editor, und noch nicht gespeicherte Eingaben werden vorher abgefragt; steht die Liste leer da, führt „Erfassen“ dorthin, wo ein neuer Entwurf entsteht.",
  },
  en: {
    "entwurfspool.aktion.geben": "Share to pool",
    "entwurfspool.aktion.nehmen": "Remove from pool",
    "entwurfspool.aktion.gebenFolge":
      "Everyone with write access then sees this draft with your name and can continue it. Only you can still submit or delete it.",
    "entwurfspool.aktion.nehmenFolge": "Afterwards only you see this draft again.",
    "entwurfspool.marke": "In the shared pool",
    "entwurfspool.quittung.gegeben": "Draft shared to the pool.",
    "entwurfspool.quittung.genommen": "Draft is private again.",
    "entwurfspool.saveDraftHelp.body":
      "Saves your interim state privately on the server — continue anytime, on any of your devices and even after a restart. A draft is NOT submitted: only you can see it unless you deliberately share it, and it appears in no review and no answer. Sharing is a separate action per draft: under My drafts you can deliberately put a single draft into the shared pool. Then all users with write access see it with your name and can continue it; only you can still submit or delete it. You find your saved drafts to resume under “More” → Drafts and in the menu under My drafts.",
    "entwurfspool.seitenhilfe.title": "My drafts: pick up what you started",
    "entwurfspool.seitenhilfe.body":
      "These are the captures saved as a draft that have not become a knowledge object yet — the same drafts the editor and the workspace show, only in a place of their own; this is not a second draft store. Your drafts are private: nobody else sees them, not even an administrator — unless you deliberately put a single draft into the shared pool with “Share to pool”. Then all users with write access see it here with your name as creator and can continue it; only you can still submit or delete it, and “Remove from pool” makes it private again. Likewise, the drafts others have deliberately shared to the pool stand here. The search field above the list covers only these drafts and no knowledge from the library, “Sort” orders them by when they were saved or by title. Deleted drafts go to the “Recycle bin” below the list: “Restore” brings one back, “Delete permanently” really removes it, and the recycle bin does not empty itself. Next step: click “Resume” on a line — the draft opens in the editor, and unsaved input is asked about beforehand; if the list stands empty, “Capture” leads to where a new draft is created.",
  },
  nl: {
    "entwurfspool.aktion.geben": "In de pool delen",
    "entwurfspool.aktion.nehmen": "Uit de pool halen",
    "entwurfspool.aktion.gebenFolge":
      "Iedereen met schrijfrechten ziet dit concept dan met jouw naam en kan het voortzetten. Indienen en verwijderen kun alleen jij.",
    "entwurfspool.aktion.nehmenFolge": "Daarna ziet alleen jij dit concept weer.",
    "entwurfspool.marke": "In de gedeelde pool",
    "entwurfspool.quittung.gegeben": "Concept in de gedeelde pool gezet.",
    "entwurfspool.quittung.genommen": "Concept is weer privé.",
    "entwurfspool.saveDraftHelp.body":
      "Bewaart je tussenstand privé op de server — je kunt altijd verdergaan, op elk van je apparaten en ook na een herstart. Een concept is NIET ingediend: alleen jij ziet het, tenzij je het bewust deelt, en het duikt in geen enkele beoordeling en geen enkel antwoord op. Delen is een aparte handeling per concept: onder Mijn concepten kun je één concept bewust in de gedeelde pool zetten. Dan zien alle gebruikers met schrijfrechten het met jouw naam en kunnen ze het voortzetten; indienen en verwijderen kun alleen jij. Je opgeslagen concepten vind je om verder te gaan onder „Meer” → Concepten en in het menu onder Mijn concepten.",
    "entwurfspool.seitenhilfe.title": "Mijn concepten: verder met wat je begon",
    "entwurfspool.seitenhilfe.body":
      "Hier staan de vastleggingen die als concept zijn opgeslagen en nog geen kennisobject zijn geworden — dezelfde concepten die ook de editor en de werkruimte tonen, alleen op een eigen plek; een tweede conceptopslag is dit niet. Je concepten zijn privé: niemand anders ziet ze, ook geen beheerder — tenzij je één concept bewust met “In de pool delen” in de gedeelde pool zet. Dan zien alle gebruikers met schrijfrechten het hier met jouw naam als maker en kunnen ze het voortzetten; indienen en verwijderen kun alleen jij, en “Uit de pool halen” maakt het weer privé. Net zo staan hier de concepten die anderen bewust in de pool hebben gezet. Het zoekveld boven de lijst doorzoekt uitsluitend deze concepten en geen kennis uit de bibliotheek, “Sorteren” ordent ze op moment van opslaan of op titel. Verwijderde concepten gaan naar de “Prullenbak” onder de lijst: “Herstellen” haalt er een terug, “Definitief verwijderen” haalt hem er echt af, en de prullenbak leegt zichzelf niet. Volgende stap: klik “Hervatten” bij een regel — het concept opent in de editor, en nog niet opgeslagen invoer wordt eerst gevraagd; staat de lijst leeg, dan leidt “Vastleggen” naar de plek waar een nieuw concept ontstaat.",
  },
} satisfies Textmodul;
