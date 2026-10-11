// swift-tools-version:5.9
// DER GEMEINSAME KLARA-BEGLEITER (O06): EINE Menüleisten-App.
//
// · Host: Figur, Fenster, Menüleiste, Webfläche aus ff96149e (`klara-office-mac-maskottchen`).
// · BPA-04 (345b4467): Finder-Aufnahme, Markierung in Word, Übergabe-Anmeldung — als Fenster
//   „In anderen Programmen …" im selben Host, ohne eigene `@main`-App.
// · BPA-01 AC10: die Browserkarte über `KlaraBrowserKarte` aus dem Brückenpaket (`BrowserBruecke`).
//
// Bauziel macOS 13 wie in beiden Quellen (`LSMinimumSystemVersion` 13.0, BPA-04 `.macOS(.v13)`).
// Die Brücke selbst bleibt ein eigenes Programm (Chrome startet sie); sie wird im Brückenpaket gebaut.
import PackageDescription

let package = Package(
  name: "KlaraBegleiter",
  platforms: [.macOS(.v13)],
  dependencies: [
    .package(path: "BrowserBruecke")
  ],
  targets: [
    .executableTarget(
      name: "KlaraBegleiter",
      dependencies: [.product(name: "KlaraBrowserKarte", package: "BrowserBruecke")],
      path: "Sources/KlaraBegleiter")
  ]
)
