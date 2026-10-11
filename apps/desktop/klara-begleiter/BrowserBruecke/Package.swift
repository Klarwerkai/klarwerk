// swift-tools-version:5.9
// BPA-01 AC10 — die Browserbrücke des Klara-Begleiters (Chrome Native Messaging).
// Ein eigenes, kleines Ziel neben dem Begleiter: Chrome startet es je Verbindung über stdin/stdout.
import PackageDescription

let package = Package(
  name: "KlaraBrowserBruecke",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(name: "KlaraBrowserBruecke", path: "Sources/KlaraBrowserBruecke")
  ]
)
