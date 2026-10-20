const de = {
  titel: "Klara · Lesekiosk",
  hinweis: "Fragen und zuhören. Dieser Kiosk verändert keine Inhalte.",
  pruefen: "Zugang wird geprüft …",
  gesperrt:
    "Der Lesekiosk ist für diese Installation oder Sitzung nicht freigegeben. Ein zulässiges Zugangsprofil fehlt.",
  bereit: "Bereit für Ihre Frage",
  hoeren: "Ich höre zu …",
  laden: "Die Antwort wird gesucht …",
  lesen: "Antwort wird vorgelesen …",
  start: "Sprachbedienung starten",
  stop: "Sprachbedienung stoppen",
  wieder: "Antwort erneut vorlesen",
  fehlt: "Dieser Browser bietet die benötigte Spracherkennung oder Sprachausgabe nicht an.",
  mikrofon:
    "Die Spracherkennung wurde beendet. Prüfen Sie die Mikrofonberechtigung und starten Sie bewusst neu.",
  fehler: "Die Frage konnte nicht beantwortet werden. Prüfen Sie den Zugang und starten Sie neu.",
  frage: "Ihre Frage",
  antwort: "Antwort",
  quellen: "Quellen und Prüfstand",
  fassung: "Fassung",
  vorbehalt: "Die vollständige Prüfung dieser Antwort ist nicht belegt.",
  konflikt: "Die Quellenlage enthält einen Konflikt oder ist ungeklärt.",
  luecke: "Dazu liegt in diesem Leseprofil keine belegte Antwort vor.",
  anleitung:
    "Nach dem Start genügt eine gesprochene Frage. Die Antwort wird automatisch vorgelesen. Sagen Sie danach „noch einmal“ oder „stopp“.",
};
const en: typeof de = {
  titel: "Klara · Reading kiosk",
  hinweis: "Ask and listen. This kiosk does not change content.",
  pruefen: "Checking access …",
  gesperrt:
    "The reading kiosk is not enabled for this installation or session. An authorized access profile is missing.",
  bereit: "Ready for your question",
  hoeren: "Listening …",
  laden: "Looking for an answer …",
  lesen: "Reading the answer …",
  start: "Start voice control",
  stop: "Stop voice control",
  wieder: "Read the answer again",
  fehlt: "This browser does not provide the required speech recognition or speech output.",
  mikrofon: "Speech recognition ended. Check microphone permission and start again deliberately.",
  fehler: "The question could not be answered. Check access and start again.",
  frage: "Your question",
  antwort: "Answer",
  quellen: "Sources and verification",
  fassung: "Version",
  vorbehalt: "Complete verification of this answer has not been established.",
  konflikt: "The sources contain a conflict or their status is unknown.",
  luecke: "There is no supported answer in this reading profile.",
  anleitung:
    "After starting, speak a question. The answer is read automatically. Afterwards, say “again” or “stop”.",
};
const nl: typeof de = {
  titel: "Klara · Leeskiosk",
  hinweis: "Vraag en luister. Deze kiosk verandert geen inhoud.",
  pruefen: "Toegang wordt gecontroleerd …",
  gesperrt:
    "De leeskiosk is niet vrijgegeven voor deze installatie of sessie. Een toegestaan toegangsprofiel ontbreekt.",
  bereit: "Klaar voor uw vraag",
  hoeren: "Ik luister …",
  laden: "Het antwoord wordt gezocht …",
  lesen: "Het antwoord wordt voorgelezen …",
  start: "Spraakbediening starten",
  stop: "Spraakbediening stoppen",
  wieder: "Antwoord opnieuw voorlezen",
  fehlt: "Deze browser biedt de vereiste spraakherkenning of spraakuitvoer niet.",
  mikrofon:
    "De spraakherkenning is beëindigd. Controleer de microfoontoestemming en start bewust opnieuw.",
  fehler: "De vraag kon niet worden beantwoord. Controleer de toegang en start opnieuw.",
  frage: "Uw vraag",
  antwort: "Antwoord",
  quellen: "Bronnen en controle",
  fassung: "Versie",
  vorbehalt: "Een volledige controle van dit antwoord is niet aangetoond.",
  konflikt: "De bronnen bevatten een conflict of hun status is onbekend.",
  luecke: "In dit leesprofiel is geen onderbouwd antwoord beschikbaar.",
  anleitung:
    "Spreek na het starten een vraag uit. Het antwoord wordt automatisch voorgelezen. Zeg daarna ‘opnieuw’ of ‘stop’.",
};
export function kioskTexte(sprache: string): typeof de {
  return sprache.startsWith("en") ? en : sprache.startsWith("nl") ? nl : de;
}
