// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0935 / R-0924 / P-HILFE-ANWENDERSPRACHE — DIE HÄUFIGEN FRAGEN DER
// HILFESEITE, IN ANWENDERSPRACHE UND IN DE/EN/NL.
// ================================================================================================
//
// WARUM NICHT `faqContent.ts` WÖRTLICH: Die Berater-Lieferung 3a (`lib/faqContent.ts`) ist Klaras
// Wissensbasis und der Prüfgegenstand von DOK1 (`tests/dok1-export-wahrheit`). Auf `/hilfe` wörtlich
// eingeblendet brachte sie Rollen- und Prüfbegriffe zurück („Darf ein Controller den Beitrag eines
// Admins prüfen?", „Prüf-Board", „Bus-Faktor") — genau das, was P-HILFE-ANWENDERSPRACHE von der
// Hilfeseite verlangt fernzuhalten. Diese Datei ist deshalb die LESEFASSUNG für Menschen: dieselben
// Fragen, dieselben Absprungziele (`route` = Route des Originals), in Anwendersprache neu gefasst
// und in alle drei Sprachen übertragen. `faqContent.ts` bleibt unverändert.
//
// AUSWAHL: je Bereich die Fragen, deren Antwort am heutigen Quelltext und an den geprüften
// Hilfekapiteln (`help.*.body`) trägt. Nicht übernommen sind Fragen, deren Antwort eine Fläche
// nennt, die es so nicht (mehr) gibt (z. B. ein „Glossar der Hilfeseite", `faq.meta.1`), und
// Fragen, die allein Rollenmechanik erklären (`faq.pruefen.8`, `faq.verwaltung.2`). Die Liste der
// ausgelassenen Kennungen steht in `docs/hilfe/aufnahme-20260922-gesamt-hilfen.md`.
//
// DIE EINE ROLLENAUSNAHME (P-DOK1, Entscheidung 31): Beim Export aus der Bibliothek dürfen genau die
// Rollen Administrator und Controller vertrauliches Wissen mitnehmen — und nur validiertes. Das ist
// eine Regel ÜBER ROLLEN und lässt sich ohne die Rollennamen nicht wahr sagen. Die Einträge, die sie
// nennen, tragen `rollenausnahme: true`; nur dort dürfen Rollennamen stehen (Wächter:
// `tests/hilfe-faq-sammlung/hilfe-faq-anwendersprache.test.ts`, der die Regel zusätzlich gegen den
// echten Rollenvertrag `services/rbac/src/policy.ts` hält).
export type HilfeFaqSprache = "de" | "en" | "nl";

type Text = Readonly<Record<HilfeFaqSprache, string>>;

export interface HilfeFaqEintrag {
  /** Kennung des Originals in `faqContent.ts`. */
  readonly id: string;
  /** Absprungziel — dieselbe Route wie im Original. */
  readonly route: string;
  readonly frage: Text;
  readonly antwort: Text;
  /** Nur hier dürfen Rollennamen stehen: die Export-Rollenausnahme aus P-DOK1. */
  readonly rollenausnahme?: true;
}

/** UI-Sprache → Sprache der FAQ. Alles außer en/nl fällt auf Deutsch, wie `fallbackLng`. */
export function hilfeFaqSprache(lng: string): HilfeFaqSprache {
  if (lng.startsWith("en")) return "en";
  if (lng.startsWith("nl")) return "nl";
  return "de";
}

const H = "/hilfe";

export const HILFE_FAQ: readonly HilfeFaqEintrag[] = [
  // ---- Grundverständnis -------------------------------------------------------------------------
  {
    id: "faq.grund.1",
    route: H,
    frage: {
      de: "Ist KLARWERK ein Chatbot wie ChatGPT?",
      en: "Is KLARWERK a chatbot like ChatGPT?",
      nl: "Is KLARWERK een chatbot zoals ChatGPT?",
    },
    antwort: {
      de: "Nein. KLARWERK antwortet nur aus dem Wissen eurer eigenen Organisation und nennt zu jeder Antwort die Einträge, auf die sie sich stützt — mit ihrem Stand. Gibt es kein passendes Wissen, sagt KLARWERK das offen, statt etwas zu erfinden.",
      en: "No. KLARWERK answers only from your own organisation’s knowledge and names the entries each answer relies on — together with their status. If there is no suitable knowledge, KLARWERK says so openly instead of making something up.",
      nl: "Nee. KLARWERK antwoordt alleen vanuit de kennis van je eigen organisatie en noemt bij elk antwoord de vermeldingen waarop het steunt — met hun status. Is er geen passende kennis, dan zegt KLARWERK dat eerlijk in plaats van iets te verzinnen.",
    },
  },
  {
    id: "faq.grund.3",
    route: H,
    frage: {
      de: "Was heißt „validiert“?",
      en: "What does “validated” mean?",
      nl: "Wat betekent “gevalideerd”?",
    },
    antwort: {
      de: "Validiert heißt: Kolleginnen und Kollegen, die das Thema beurteilen können, haben die Aussage geprüft und freigegeben — mit so vielen Freigaben, wie eure Organisation festgelegt hat. Es heißt nicht, dass eine KI zugestimmt hat, und auch nicht, dass etwas für immer gilt.",
      en: "Validated means: colleagues who can judge the topic have checked and approved the statement — with as many approvals as your organisation has set. It does not mean an AI agreed, nor that something holds forever.",
      nl: "Gevalideerd betekent: collega’s die het onderwerp kunnen beoordelen hebben de uitspraak gecontroleerd en vrijgegeven — met zoveel vrijgaven als je organisatie heeft vastgelegd. Het betekent niet dat een AI akkoord ging, en ook niet dat iets voor altijd geldt.",
    },
  },
  {
    id: "faq.grund.7",
    route: H,
    frage: {
      de: "Kann sich die KI irren oder etwas erfinden?",
      en: "Can the AI be wrong or make things up?",
      nl: "Kan de AI zich vergissen of iets verzinnen?",
    },
    antwort: {
      de: "Ja — deshalb ist jeder KI-Vorschlag nur ein Vorschlag. Gespeichert wird nichts von allein, bei Auszügen aus Dokumenten nennt die KI die Fundstelle wörtlich, und als gesichert gilt Wissen erst nach der Prüfung durch Menschen.",
      en: "Yes — that is why every AI suggestion is only a suggestion. Nothing is saved on its own, for excerpts from documents the AI quotes the passage word for word, and knowledge only counts as secured after people have checked it.",
      nl: "Ja — daarom is elk AI-voorstel alleen een voorstel. Er wordt niets vanzelf opgeslagen, bij fragmenten uit documenten citeert de AI de vindplaats letterlijk, en kennis geldt pas als zeker na controle door mensen.",
    },
  },
  // ---- Erfassen ---------------------------------------------------------------------------------
  {
    id: "faq.erfassen.1",
    route: "/erfassen",
    frage: {
      de: "Wie fange ich an — muss ich etwas Bestimmtes ausfüllen?",
      en: "How do I start — do I have to fill in anything specific?",
      nl: "Hoe begin ik — moet ik iets bepaalds invullen?",
    },
    antwort: {
      de: "Nein. Öffne „Wissen erfassen“ und schreib in eigenen Worten auf, was du weißt — Stichpunkte reichen. Kategorie, Schlagwörter und Anhänge helfen beim Finden, sind aber freiwillig. Die KI schlägt danach eine Struktur vor, du entscheidest.",
      en: "No. Open “Capture Knowledge” and write down what you know in your own words — bullet points are enough. Category, tags and attachments help with finding it but are optional. The AI then suggests a structure; you decide.",
      nl: "Nee. Open “Kennis vastleggen” en schrijf in je eigen woorden op wat je weet — steekwoorden zijn genoeg. Categorie, trefwoorden en bijlagen helpen bij het vinden, maar zijn vrijwillig. De AI stelt daarna een structuur voor, jij beslist.",
    },
  },
  {
    id: "faq.erfassen.3",
    route: "/erfassen",
    frage: {
      de: "Kann ich ein Dokument mitbringen und Wissen daraus ziehen?",
      en: "Can I bring a document and extract knowledge from it?",
      nl: "Kan ik een document meebrengen en er kennis uit halen?",
    },
    antwort: {
      de: "Ja. Unter „Wissen erfassen“ im Werkzeug „Datei“ wählst du „Datei importieren“. „In Punkte analysieren“ schlägt einzelne Wissenspunkte mit wörtlicher Belegstelle vor, und du wählst aus; „Ganzes Dokument übernehmen“ legt einen vollständigen Entwurf an. Gespeichert wird nichts ohne dein Zutun.",
      en: "Yes. Under “Capture Knowledge”, in the “File” tool, choose “Import file”. “Analyze into points” suggests individual knowledge points with a literal source passage, and you choose; “Take over whole document” creates one complete draft. Nothing is saved without you.",
      nl: "Ja. Onder “Kennis vastleggen” kies je in het hulpmiddel “Bestand” voor “Bestand importeren”. “In punten analyseren” stelt afzonderlijke kennispunten met letterlijke bronpassage voor, en jij kiest; “Hele document overnemen” maakt één volledig concept aan. Zonder jou wordt niets opgeslagen.",
    },
  },
  {
    id: "faq.erfassen.5",
    route: "/erfassen",
    frage: {
      de: "Speichert KLARWERK automatisch?",
      en: "Does KLARWERK save automatically?",
      nl: "Slaat KLARWERK automatisch op?",
    },
    antwort: {
      de: "Nein. Die KI macht Vorschläge, und erst dein Klick übernimmt sie — als Entwurf oder als Einreichung. So bleibt immer klar, was ein Mensch bewusst festgehalten hat.",
      en: "No. The AI makes suggestions, and only your click takes them over — as a draft or as a submission. That way it is always clear what a person deliberately recorded.",
      nl: "Nee. De AI doet voorstellen, en pas jouw klik neemt ze over — als concept of als inzending. Zo blijft altijd duidelijk wat een mens bewust heeft vastgelegd.",
    },
  },
  {
    id: "faq.erfassen.6",
    route: "/erfassen",
    frage: {
      de: "Was ist der Unterschied zwischen „Entwurf“ und „Einreichen“?",
      en: "What is the difference between “draft” and “submit”?",
      nl: "Wat is het verschil tussen “concept” en “indienen”?",
    },
    antwort: {
      de: "Ein Entwurf gehört dir allein: nur du siehst ihn, du kannst weiterschreiben oder ihn verwerfen. Mit dem Einreichen wird daraus ein Wissensobjekt, das andere sehen — deutlich als „in Prüfung“ gekennzeichnet, bis es freigegeben ist.",
      en: "A draft is yours alone: only you see it, you can keep writing or discard it. Submitting turns it into a knowledge object that others can see — clearly marked “In review” until it has been approved.",
      nl: "Een concept is alleen van jou: alleen jij ziet het, je kunt verder schrijven of het verwerpen. Met indienen wordt het een kennisobject dat anderen zien — duidelijk gemarkeerd als “In beoordeling” tot het is vrijgegeven.",
    },
  },
  {
    id: "faq.erfassen.7",
    route: "/erfassen",
    frage: {
      de: "Was passiert, nachdem ich eingereicht habe?",
      en: "What happens after I submit?",
      nl: "Wat gebeurt er nadat ik heb ingediend?",
    },
    antwort: {
      de: "Dein Beitrag steht danach unter „Validierung“ und wartet dort auf die Prüfung durch Kolleginnen und Kollegen. Du musst nichts weiter tun. Hast du beim Einreichen jemanden um die Prüfung gebeten, sieht diese Person den Beitrag in ihrer Liste.",
      en: "Your contribution then appears under “Validation” and waits there to be checked by colleagues. You don’t have to do anything else. If you asked someone to check it when submitting, that person sees it in their list.",
      nl: "Je bijdrage staat daarna onder “Validatie” en wacht daar op controle door collega’s. Je hoeft verder niets te doen. Heb je bij het indienen iemand om controle gevraagd, dan ziet die persoon de bijdrage in zijn of haar lijst.",
    },
  },
  // ---- Prüfen und Freigeben ---------------------------------------------------------------------
  {
    id: "faq.pruefen.1",
    route: "/validierung",
    frage: {
      de: "Wie viele Freigaben braucht mein Beitrag, und wo sehe ich den Stand?",
      en: "How many approvals does my contribution need, and where can I see the status?",
      nl: "Hoeveel vrijgaven heeft mijn bijdrage nodig, en waar zie ik de stand?",
    },
    antwort: {
      de: "Die Zahl legt eure Organisation fest; möglich sind eine bis fünf. Wie viele noch fehlen, steht an jeder Karte unter „Validierung“. Validiert ist der Beitrag, wenn genug Freigaben da sind und keine Ablehnung dagegensteht.",
      en: "Your organisation sets the number; one to five are possible. How many are still missing is shown on each card under “Validation”. The contribution is validated once there are enough approvals and no rejection stands against it.",
      nl: "Je organisatie legt het aantal vast; één tot vijf is mogelijk. Hoeveel er nog ontbreken, staat op elke kaart onder “Validatie”. De bijdrage is gevalideerd zodra er genoeg vrijgaven zijn en er geen afwijzing tegenover staat.",
    },
  },
  {
    id: "faq.pruefen.2",
    route: "/validierung",
    frage: {
      de: "Wer prüft meinen Beitrag?",
      en: "Who checks my contribution?",
      nl: "Wie controleert mijn bijdrage?",
    },
    antwort: {
      de: "Beim Einreichen kannst du bestimmte Kolleginnen und Kollegen um die Prüfung bitten; sie bekommen eine Benachrichtigung. Bittest du niemanden, steht dein Beitrag unter „Validierung“ für alle bereit, die in eurer Organisation prüfen dürfen.",
      en: "When submitting, you can ask specific colleagues to check it; they get a notification. If you ask nobody, your contribution is available under “Validation” to everyone in your organisation who is allowed to check.",
      nl: "Bij het indienen kun je bepaalde collega’s om controle vragen; zij krijgen een melding. Vraag je niemand, dan staat je bijdrage onder “Validatie” klaar voor iedereen in je organisatie die mag controleren.",
    },
  },
  {
    id: "faq.pruefen.3",
    route: "/validierung",
    frage: {
      de: "Kann ich meinen eigenen Beitrag freigeben?",
      en: "Can I approve my own contribution?",
      nl: "Kan ik mijn eigen bijdrage vrijgeven?",
    },
    antwort: {
      de: "Nein, und das ist Absicht: Wissen wird belastbar, wenn jemand anderes es unabhängig beurteilt. Das gilt für alle in der Organisation gleich.",
      en: "No, and that is intentional: knowledge becomes reliable when someone else judges it independently. This applies equally to everyone in the organisation.",
      nl: "Nee, en dat is bewust: kennis wordt betrouwbaar als iemand anders haar onafhankelijk beoordeelt. Dat geldt voor iedereen in de organisatie gelijk.",
    },
  },
  {
    id: "faq.pruefen.5",
    route: "/validierung",
    frage: {
      de: "Warum hält eine einzige Ablehnung den Beitrag auf, obwohl andere zugestimmt haben?",
      en: "Why does a single rejection hold the contribution back although others approved?",
      nl: "Waarom houdt één afwijzing de bijdrage tegen, terwijl anderen akkoord gingen?",
    },
    antwort: {
      de: "Weil ein begründeter fachlicher Einwand nicht überstimmt werden soll. Die Begründung geht an die Person, die den Beitrag erfasst hat; nach der Überarbeitung wird neu geprüft. So kann man validiertem Wissen trauen.",
      en: "Because a reasoned professional objection should not be outvoted. The reason goes to the person who captured the contribution; after revision it is checked again. That is why validated knowledge can be trusted.",
      nl: "Omdat een onderbouwd vakinhoudelijk bezwaar niet overstemd mag worden. De motivering gaat naar de persoon die de bijdrage heeft vastgelegd; na bewerking wordt opnieuw gecontroleerd. Zo kun je gevalideerde kennis vertrouwen.",
    },
  },
  {
    id: "faq.pruefen.6",
    route: "/validierung",
    frage: {
      de: "Mein Beitrag kam mit einer Rückfrage zurück — was jetzt?",
      en: "My contribution came back with a query — what now?",
      nl: "Mijn bijdrage kwam terug met een vraag — wat nu?",
    },
    antwort: {
      de: "Lies zuerst den Kommentar am Wissensobjekt: Er sagt, was fehlt oder unklar ist. Überarbeite den Beitrag; jede inhaltliche Änderung wird als neue Version festgehalten, danach wird erneut geprüft. Eine Rückfrage ist kein Makel, sondern der normale Weg.",
      en: "First read the comment on the knowledge object: it says what is missing or unclear. Revise the contribution; every change to the content is kept as a new version, after which it is checked again. A query is no stain but the normal route.",
      nl: "Lees eerst de opmerking bij het kennisobject: die zegt wat ontbreekt of onduidelijk is. Bewerk de bijdrage; elke inhoudelijke wijziging wordt als nieuwe versie vastgelegd, daarna wordt opnieuw gecontroleerd. Een vraag is geen smet, maar de normale weg.",
    },
  },
  // ---- Vertrauen und Vertraulichkeit ------------------------------------------------------------
  {
    id: "faq.vertrauen.1",
    route: "/bibliothek",
    frage: {
      de: "Was bedeutet der Vertrauenswert?",
      en: "What does the confidence value mean?",
      nl: "Wat betekent de vertrouwenswaarde?",
    },
    antwort: {
      de: "Er entsteht aus den Bewertungen der Kolleginnen und Kollegen und aus der Bewährung im Alltag. Er sagt, wie belastbar eine Aussage gerade ist — eine Garantie ist er nicht. Lies ihn zusammen mit dem Stand und den Belegen.",
      en: "It comes from colleagues’ ratings and from how the knowledge has proven itself in daily work. It says how reliable a statement is right now — it is not a guarantee. Read it together with the status and the evidence.",
      nl: "Die ontstaat uit de beoordelingen van collega’s en uit hoe de kennis zich in de praktijk bewijst. Ze zegt hoe betrouwbaar een uitspraak nu is — een garantie is het niet. Lees haar samen met de status en de bewijzen.",
    },
  },
  {
    id: "faq.vertrauen.5",
    route: "/bibliothek",
    rollenausnahme: true,
    frage: {
      de: "Was heißt „vertraulich“ bei einem Eintrag — und kann ihn jemand exportieren?",
      en: "What does “confidential” mean for an entry — and can someone export it?",
      nl: "Wat betekent “vertrouwelijk” bij een vermelding — en kan iemand die exporteren?",
    },
    antwort: {
      de: "Vertraulich und streng vertraulich markieren sensibles Wissen; jede Änderung der Stufe wird festgehalten. Beim Export aus der Bibliothek gilt eine Ausnahme nach Rolle: Nur wer die Rolle Administrator oder Controller hat, nimmt vertrauliche Einträge mit — und auch dann nur solche, die bereits validiert sind. Bei allen anderen bleiben vertrauliche Einträge aus dem Export draußen.",
      en: "Confidential and strictly confidential mark sensitive knowledge; every change of level is recorded. When exporting from the library, one exception depends on the role: only someone with the role Administrator or Controller takes confidential entries along — and even then only those that are already validated. For everyone else, confidential entries stay out of the export.",
      nl: "Vertrouwelijk en strikt vertrouwelijk markeren gevoelige kennis; elke wijziging van het niveau wordt vastgelegd. Bij export uit de bibliotheek geldt één uitzondering per rol: alleen wie de rol Administrator of Controller heeft, neemt vertrouwelijke vermeldingen mee — en ook dan alleen die al gevalideerd zijn. Bij alle anderen blijven vertrouwelijke vermeldingen buiten de export.",
    },
  },
  {
    id: "faq.vertrauen.7",
    route: "/bibliothek",
    frage: {
      de: "Woran erkenne ich, ob ich einem Eintrag trauen kann?",
      en: "How can I tell whether I can rely on an entry?",
      nl: "Hoe zie ik of ik een vermelding kan vertrouwen?",
    },
    antwort: {
      de: "Schau auf vier Dinge: den Stand (validiert oder noch in Prüfung), den Vertrauenswert, die Belege und die Hinweise am Eintrag, etwa einen offenen Widerspruch. Erst alle vier zusammen ergeben ein ehrliches Bild.",
      en: "Look at four things: the status (validated or still “In review”), the confidence value, the evidence and the notes on the entry, such as an open contradiction. Only all four together give an honest picture.",
      nl: "Kijk naar vier dingen: de status (gevalideerd of nog “In beoordeling”), de vertrouwenswaarde, de bewijzen en de opmerkingen bij de vermelding, zoals een open tegenspraak. Pas alle vier samen geven een eerlijk beeld.",
    },
  },
  // ---- Bibliothek -------------------------------------------------------------------------------
  {
    id: "faq.bibliothek.1",
    route: "/bibliothek",
    frage: {
      de: "Wo finde ich das Wissen, das schon da ist?",
      en: "Where do I find the knowledge that already exists?",
      nl: "Waar vind ik de kennis die er al is?",
    },
    antwort: {
      de: "In der Bibliothek. Über das Suchfeld findest du einen Eintrag; Filter, Sortierung und gespeicherte Sichten liegen im Menü „…“ über der Liste. Ein Klick öffnet den Eintrag mit Aussage, Stand und Quelle.",
      en: "In the library. Use the search field to find an entry; filters, sorting and saved views are in the “…” menu above the list. A click opens the entry with its statement, status and source.",
      nl: "In de bibliotheek. Via het zoekveld vind je een vermelding; filters, sortering en opgeslagen weergaven staan in het menu “…” boven de lijst. Eén klik opent de vermelding met uitspraak, status en bron.",
    },
  },
  {
    id: "faq.bibliothek.5",
    route: "/bibliothek",
    frage: {
      de: "Kann ich sehen, was sich an einem Eintrag geändert hat?",
      en: "Can I see what has changed in an entry?",
      nl: "Kan ik zien wat er aan een vermelding is veranderd?",
    },
    antwort: {
      de: "Ja. Jede inhaltliche Änderung erzeugt eine neue Version; unter „Mehr“ am Eintrag siehst du Versionen und Verlauf — wer wann was geändert hat. Nichts wird still überschrieben.",
      en: "Yes. Every change to the content creates a new version; under “More” on the entry you see versions and history — who changed what and when. Nothing is silently overwritten.",
      nl: "Ja. Elke inhoudelijke wijziging maakt een nieuwe versie; onder “Meer” bij de vermelding zie je versies en geschiedenis — wie wat wanneer heeft gewijzigd. Niets wordt stil overschreven.",
    },
  },
  {
    id: "faq.bibliothek.6",
    route: "/bibliothek",
    rollenausnahme: true,
    frage: {
      de: "Kann ich Wissen exportieren, zum Beispiel als PDF?",
      en: "Can I export knowledge, for example as a PDF?",
      nl: "Kan ik kennis exporteren, bijvoorbeeld als pdf?",
    },
    antwort: {
      de: "Exportieren geht über das Menü „…“ über der Liste in der Bibliothek — als JSON, als Markdown, als MediaWiki-Text oder als HTML; ein PDF-Export ist nicht dabei. Für vertrauliche Einträge gilt eine Ausnahme nach Rolle: Nur wer die Rolle Administrator oder Controller hat, exportiert sie mit — und nur, wenn sie bereits validiert sind. Bei allen anderen bleiben vertrauliche Einträge aus dem Export draußen.",
      en: "You export via the “…” menu above the list in the library — as JSON, as Markdown, as MediaWiki text or as HTML; a PDF export is not included. For confidential entries one exception depends on the role: only someone with the role Administrator or Controller exports them along — and only if they are already validated. For everyone else, confidential entries stay out of the export.",
      nl: "Exporteren gaat via het menu “…” boven de lijst in de bibliotheek — als JSON, als Markdown, als MediaWiki-tekst of als HTML; een pdf-export zit er niet bij. Voor vertrouwelijke vermeldingen geldt één uitzondering per rol: alleen wie de rol Administrator of Controller heeft, exporteert ze mee — en alleen als ze al gevalideerd zijn. Bij alle anderen blijven vertrouwelijke vermeldingen buiten de export.",
    },
  },
  // ---- Fragen stellen ---------------------------------------------------------------------------
  {
    id: "faq.fragen.1",
    route: "/fragen",
    frage: {
      de: "Wie stelle ich eine Frage, und woher kommt die Antwort?",
      en: "How do I ask a question, and where does the answer come from?",
      nl: "Hoe stel ik een vraag, en waar komt het antwoord vandaan?",
    },
    antwort: {
      de: "Stell deine Frage unter „Fragen“ in eigenen Worten. Die Antwort wird aus dem vorhandenen Wissen eurer Organisation zusammengestellt und nennt die Einträge, auf die sie sich stützt, jeweils mit ihrem Stand.",
      en: "Ask your question under “Ask” in your own words. The answer is put together from your organisation’s existing knowledge and names the entries it relies on, each with its status.",
      nl: "Stel je vraag onder “Vragen” in je eigen woorden. Het antwoord wordt samengesteld uit de bestaande kennis van je organisatie en noemt de vermeldingen waarop het steunt, elk met hun status.",
    },
  },
  {
    id: "faq.fragen.3",
    route: "/fragen",
    frage: {
      de: "Ist eine Wissenslücke ein Fehler?",
      en: "Is a knowledge gap an error?",
      nl: "Is een kennishiaat een fout?",
    },
    antwort: {
      de: "Nein. Eine Lücke sagt offen: Zu dieser Frage gibt es noch kein passendes Wissen. Ein System, das trotzdem flüssig antwortet, rät — KLARWERK tut das bewusst nicht. Jede Lücke ist eine Gelegenheit, wichtiges Wissen festzuhalten.",
      en: "No. A gap says openly: there is no suitable knowledge for this question yet. A system that answers fluently anyway is guessing — KLARWERK deliberately does not. Every gap is a chance to record important knowledge.",
      nl: "Nee. Een hiaat zegt eerlijk: voor deze vraag is er nog geen passende kennis. Een systeem dat toch vlot antwoordt, gokt — KLARWERK doet dat bewust niet. Elk hiaat is een kans om belangrijke kennis vast te leggen.",
    },
  },
  {
    id: "faq.fragen.4",
    route: "/fragen",
    frage: {
      de: "Was mache ich mit einer Wissenslücke?",
      en: "What do I do with a knowledge gap?",
      nl: "Wat doe ik met een kennishiaat?",
    },
    antwort: {
      de: "Offene Lücken stehen unter „Risiko & Lücken“. Dort schätzt du die Dringlichkeit ein, weist die Lücke einer Fachperson zu oder schließt sie selbst mit „Wissen erfassen“. Danach läuft der normale Weg über die Prüfung.",
      en: "Open gaps are listed under “Risk & Gaps”. There you assess the urgency, assign the gap to a specialist or close it yourself with “Capture Knowledge”. After that, the normal route through checking follows.",
      nl: "Open hiaten staan onder “Risico & hiaten”. Daar schat je de urgentie in, wijs je het hiaat toe aan een vakpersoon of sluit je het zelf met “Kennis vastleggen”. Daarna volgt de normale weg via de controle.",
    },
  },
  // ---- Widersprüche und Doppelungen -------------------------------------------------------------
  {
    id: "faq.konflikte.1",
    route: "/konflikte",
    frage: {
      de: "Was ist ein „Konflikt“ — habe ich etwas falsch gemacht?",
      en: "What is a “conflict” — did I do something wrong?",
      nl: "Wat is een “conflict” — heb ik iets fout gedaan?",
    },
    antwort: {
      de: "Nein. Ein Konflikt heißt nur: Zwei Einträge sagen über dieselbe Sache etwas, das nicht zusammenpasst — etwa sechs bar und acht bar als Grenze. KLARWERK macht das sichtbar, damit Menschen es klären können.",
      en: "No. A conflict only means: two entries say something about the same thing that does not fit together — such as six bar and eight bar as a limit. KLARWERK makes this visible so people can clear it up.",
      nl: "Nee. Een conflict betekent alleen: twee vermeldingen zeggen iets over hetzelfde dat niet samengaat — bijvoorbeeld zes bar en acht bar als grens. KLARWERK maakt dat zichtbaar, zodat mensen het kunnen ophelderen.",
    },
  },
  {
    id: "faq.konflikte.2",
    route: "/konflikte",
    frage: {
      de: "Entscheidet KLARWERK, welche Aussage stimmt?",
      en: "Does KLARWERK decide which statement is right?",
      nl: "Beslist KLARWERK welke uitspraak klopt?",
    },
    antwort: {
      de: "Nein. Unter „Konflikte“ stehen die zwei Aussagen nebeneinander, und ein Mensch wählt, welche gilt, ob beide je nach Zusammenhang gelten oder ob gar kein Widerspruch vorliegt. Die Wahl wird festgehalten, gelöscht wird nichts.",
      en: "No. Under “Conflicts” the two statements stand side by side, and a person chooses which one applies, whether both apply depending on context, or whether there is no contradiction at all. The choice is recorded; nothing is deleted.",
      nl: "Nee. Onder “Conflicten” staan de twee uitspraken naast elkaar, en een mens kiest welke geldt, of beide afhankelijk van de context gelden, of dat er helemaal geen tegenspraak is. De keuze wordt vastgelegd, er wordt niets verwijderd.",
    },
  },
  {
    id: "faq.konflikte.6",
    route: "/duplikate",
    frage: {
      de: "Was tue ich mit zwei Einträgen, die dasselbe sagen?",
      en: "What do I do with two entries that say the same thing?",
      nl: "Wat doe ik met twee vermeldingen die hetzelfde zeggen?",
    },
    antwort: {
      de: "Sie stehen unter „Duplikate“ als Paar. Du entscheidest, welche Seite maßgeblich ist, ob beide bleiben und als verwandt vermerkt werden oder ob es gar keine Doppelung ist. Zusammengeführt oder gelöscht wird dabei nichts; beide Einträge bleiben unverändert.",
      en: "They appear as a pair under “Duplicates”. You decide which side is authoritative, whether both stay and are noted as related, or whether it is no duplicate at all. Nothing is merged or deleted; both entries stay unchanged.",
      nl: "Ze staan als paar onder “Duplicaten”. Jij beslist welke kant maatgevend is, of beide blijven en als verwant worden genoteerd, of dat het helemaal geen dubbeling is. Er wordt niets samengevoegd of verwijderd; beide vermeldingen blijven ongewijzigd.",
    },
  },
  // ---- Risiko -----------------------------------------------------------------------------------
  {
    id: "faq.busfaktor.1",
    route: "/risiko",
    frage: {
      de: "Was heißt es, wenn ein Fachgebiet rot markiert ist?",
      en: "What does it mean when a subject area is marked red?",
      nl: "Wat betekent het als een vakgebied rood is gemarkeerd?",
    },
    antwort: {
      de: "Rot heißt: Alles, was in diesem Fachgebiet festgehalten ist, stammt von einer einzigen Person. Fällt sie aus — Urlaub, Krankheit, Ruhestand —, fehlt dieses Wissen. Was dagegen hilft, steht unter „Risiko & Lücken“ direkt an der roten Zeile.",
      en: "Red means: everything recorded in this subject area comes from a single person. If that person is away — holiday, illness, retirement — this knowledge is missing. What helps is shown under “Risk & Gaps” right on the red row.",
      nl: "Rood betekent: alles wat in dit vakgebied is vastgelegd, komt van één persoon. Valt die weg — vakantie, ziekte, pensioen — dan ontbreekt deze kennis. Wat helpt, staat onder “Risico & hiaten” direct bij de rode regel.",
    },
  },
  {
    id: "faq.busfaktor.3",
    route: "/risiko",
    frage: {
      de: "Ist die rote Markierung eine Bewertung von Mitarbeitenden?",
      en: "Is the red marking an assessment of employees?",
      nl: "Is de rode markering een beoordeling van medewerkers?",
    },
    antwort: {
      de: "Nein. Sie zeigt, wie Wissen verteilt ist, nicht wie gut jemand arbeitet. Ein rotes Gebiet entsteht gerade dadurch, dass eine Person dort viel weiß — ein Auftrag an die Organisation, eine zweite Person einzubinden.",
      en: "No. It shows how knowledge is distributed, not how well someone works. A red area arises precisely because one person knows a lot there — a task for the organisation to involve a second person.",
      nl: "Nee. Ze toont hoe kennis verdeeld is, niet hoe goed iemand werkt. Een rood gebied ontstaat juist doordat één persoon er veel weet — een opdracht aan de organisatie om een tweede persoon te betrekken.",
    },
  },
  // ---- KI und Datenschutz -----------------------------------------------------------------------
  {
    id: "faq.ki.1",
    route: "/admin",
    frage: {
      de: "Woran sehe ich, welche KI gerade arbeitet?",
      en: "How can I see which AI is working right now?",
      nl: "Waaraan zie ik welke AI nu werkt?",
    },
    antwort: {
      de: "Am Info-Zeichen neben einem KI-Knopf: Es nennt die Aufgabe, die eingestellte KI und ob die Verarbeitung im Haus bleibt oder an einen externen Anbieter geht. Du musst also nicht raten.",
      en: "At the info sign next to an AI button: it names the task, the configured AI and whether processing stays in-house or goes to an external provider. So you don’t have to guess.",
      nl: "Aan het info-teken naast een AI-knop: het noemt de taak, de ingestelde AI en of de verwerking intern blijft of naar een externe aanbieder gaat. Je hoeft dus niet te raden.",
    },
  },
  {
    id: "faq.ki.3",
    route: "/admin",
    frage: {
      de: "Verlassen meine Daten das Haus, wenn ich die KI benutze?",
      en: "Does my data leave the organisation when I use the AI?",
      nl: "Verlaten mijn gegevens het huis als ik de AI gebruik?",
    },
    antwort: {
      de: "Das hängt von der eingestellten KI ab, und die Kennzeichnung am Info-Zeichen sagt es dir: Steht dort „DSGVO-konform“, bleibt die Verarbeitung bei euch; steht dort „Externe Verarbeitung“, gehen die Inhalte der jeweiligen Aufgabe an den Anbieter. Zugangsschlüssel für KI liegen nur auf dem Server, nie im Browser.",
      en: "That depends on the configured AI, and the label at the info sign tells you: if it says “GDPR-compliant”, processing stays with you; if it says “External processing”, the content of that task goes to the provider. AI access keys are kept only on the server, never in the browser.",
      nl: "Dat hangt af van de ingestelde AI, en de markering bij het info-teken zegt het je: staat er “AVG-conform”, dan blijft de verwerking bij jullie; staat er “Externe verwerking”, dan gaat de inhoud van die taak naar de aanbieder. Toegangssleutels voor AI staan alleen op de server, nooit in de browser.",
    },
  },
  {
    id: "faq.ki.4",
    route: "/admin",
    frage: {
      de: "Was passiert, wenn keine KI verbunden ist?",
      en: "What happens if no AI is connected?",
      nl: "Wat gebeurt er als er geen AI is gekoppeld?",
    },
    antwort: {
      de: "Dann arbeitet die App regelbasiert weiter — mit einfacheren Vorschlägen und Standardfragen, klar gekennzeichnet. Sie täuscht keine Fähigkeit vor, die gerade nicht da ist.",
      en: "Then the app keeps working rule-based — with simpler suggestions and standard questions, clearly labelled. It does not pretend to have abilities that are not available right now.",
      nl: "Dan werkt de app regelgebaseerd verder — met eenvoudigere voorstellen en standaardvragen, duidelijk gemarkeerd. Ze doet niet alsof ze iets kan wat er nu niet is.",
    },
  },
  // ---- Verwaltung -------------------------------------------------------------------------------
  {
    id: "faq.verwaltung.3",
    route: "/admin",
    frage: {
      de: "Wo stellt man ein, wie viele Freigaben ein Beitrag braucht?",
      en: "Where do you set how many approvals a contribution needs?",
      nl: "Waar stel je in hoeveel vrijgaven een bijdrage nodig heeft?",
    },
    antwort: {
      de: "Unter „Admin“ im Bereich „Prüfungen“; erlaubt sind eine bis fünf Freigaben. Die Zahl gilt für neue Einreichungen, bereits eingereichte Beiträge behalten ihre. Ändern kann das nur, wer Verwaltungsrechte hat, und jede Änderung wird festgehalten.",
      en: "Under “Admin” in the “Reviews” section; one to five approvals are allowed. The number applies to new submissions; contributions already submitted keep theirs. Only people with administration rights can change it, and every change is recorded.",
      nl: "Onder “Admin” in het onderdeel “Beoordelingen”; één tot vijf vrijgaven zijn toegestaan. Het aantal geldt voor nieuwe inzendingen, al ingediende bijdragen houden het hunne. Alleen wie beheerrechten heeft kan dit wijzigen, en elke wijziging wordt vastgelegd.",
    },
  },
  {
    id: "faq.verwaltung.5",
    route: "/admin",
    frage: {
      de: "Wie probiere ich KLARWERK mit Beispieldaten aus — und werde sie wieder los?",
      en: "How do I try KLARWERK with example data — and get rid of it again?",
      nl: "Hoe probeer ik KLARWERK uit met voorbeeldgegevens — en raak ik ze weer kwijt?",
    },
    antwort: {
      de: "„Demodaten laden“ unter „Admin“ legt einen Beispielbestand an, an dem sich jeder Bereich gefahrlos ausprobieren lässt. „Demodaten entfernen“ nimmt ihn wieder weg; euer echter Bestand bleibt unberührt. Beides braucht Verwaltungsrechte.",
      en: "“Load demo data” under “Admin” creates an example stock on which every area can be tried out safely. “Remove demo data” takes it away again; your real stock stays untouched. Both need administration rights.",
      nl: "“Demogegevens laden” onder “Admin” maakt een voorbeeldbestand aan waarop elk onderdeel veilig kan worden uitgeprobeerd. “Demogegevens verwijderen” haalt het weer weg; jullie echte bestand blijft onaangeroerd. Beide vereisen beheerrechten.",
    },
  },
  // ---- Mobil ------------------------------------------------------------------------------------
  {
    id: "faq.mobil.1",
    route: "/mobile",
    frage: {
      de: "Kann ich unterwegs mit dem Handy arbeiten?",
      en: "Can I work on my phone while on the move?",
      nl: "Kan ik onderweg met mijn telefoon werken?",
    },
    antwort: {
      de: "Ja. Die mobile Ansicht hat die Reiter „Erfassen“, „Fragen“ und „Suchen“: unterwegs etwas festhalten, etwas wissen wollen, etwas nachschlagen. Prüfen und Freigeben gibt es dort nicht; dafür führt „Zur Vollversion“ zurück.",
      en: "Yes. The mobile view has the tabs “Capture”, “Ask” and “Search”: record something on the move, want to know something, look something up. Checking and approving are not available there; “To full version” leads back for that.",
      nl: "Ja. De mobiele weergave heeft de tabbladen “Vastleggen”, “Vragen” en “Zoeken”: onderweg iets vastleggen, iets willen weten, iets opzoeken. Controleren en vrijgeven zijn daar niet beschikbaar; daarvoor leidt “Naar volledige versie” terug.",
    },
  },
  {
    id: "faq.mobil.2",
    route: "/mobile",
    frage: {
      de: "Was passiert, wenn ich gerade kein Internet habe?",
      en: "What happens if I have no internet right now?",
      nl: "Wat gebeurt er als ik even geen internet heb?",
    },
    antwort: {
      de: "Dann wird allein das Speichern eines Entwurfs vorgemerkt und später nachgetragen. Fragen und Suchen sagen offen, dass sie eine Verbindung brauchen.",
      en: "Then only saving a draft is queued and completed later. Asking and searching say openly that they need a connection.",
      nl: "Dan wordt alleen het opslaan van een concept vastgehouden en later bijgewerkt. Vragen en zoeken zeggen eerlijk dat ze een verbinding nodig hebben.",
    },
  },
  // ---- Hilfe ------------------------------------------------------------------------------------
  {
    id: "faq.meta.2",
    route: H,
    frage: {
      de: "Meine Frage steht hier nicht — was tun?",
      en: "My question is not listed here — what now?",
      nl: "Mijn vraag staat hier niet — wat nu?",
    },
    antwort: {
      de: "Frag Klara über das Fragezeichen unten rechts: Sie durchsucht die Hilfe und erklärt die Seite, auf der du gerade bist. Findet sie nichts Passendes, sagt sie das offen. Für alles Weitere steht oben auf dieser Seite, wie du den Support dieser Installation erreichst.",
      en: "Ask Klara via the question mark at the bottom right: she searches the help and explains the page you are on. If she finds nothing suitable, she says so openly. For anything else, the top of this page shows how to reach the support for this installation.",
      nl: "Vraag het aan Klara via het vraagteken rechtsonder: zij doorzoekt de help en legt de pagina uit waarop je nu bent. Vindt ze niets passends, dan zegt ze dat eerlijk. Voor al het andere staat bovenaan deze pagina hoe je de support van deze installatie bereikt.",
    },
  },
  {
    id: "faq.meta.4",
    route: H,
    frage: {
      de: "Warum sieht meine Kollegin andere Knöpfe als ich?",
      en: "Why does my colleague see different buttons than I do?",
      nl: "Waarom ziet mijn collega andere knoppen dan ik?",
    },
    antwort: {
      de: "Weil jede Person nur die Handlungen sieht, die ihre Rechte erlauben — wer nur lesen darf, sieht zum Beispiel keine Knöpfe zum Erfassen. Das ist kein Fehler. Welche Rolle du hast, steht in deinem Profil neben deinem Namen.",
      en: "Because each person sees only the actions their rights allow — someone who may only read sees no capture buttons, for example. That is not an error. Which role you have is shown in your profile next to your name.",
      nl: "Omdat iedereen alleen de handelingen ziet die zijn of haar rechten toestaan — wie alleen mag lezen, ziet bijvoorbeeld geen knoppen om vast te leggen. Dat is geen fout. Welke rol je hebt, staat in je profiel naast je naam.",
    },
  },
];
