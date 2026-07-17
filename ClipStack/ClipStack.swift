import SwiftUI
import AppKit

// MARK: - Model

struct ClipItem: Identifiable, Codable, Equatable {
    let id: UUID
    var text: String
    let date: Date

    init(text: String) {
        self.id = UUID()
        self.text = text
        self.date = Date()
    }
}

// MARK: - Store

@MainActor
final class ClipStore: ObservableObject {
    @Published private(set) var history: [ClipItem] = []
    @Published private(set) var phrases: [ClipItem] = []
    @Published var copiedItemID: UUID?

    private let pasteboard = NSPasteboard.general
    private var lastChangeCount: Int
    private var timer: Timer?
    private let maxHistory = 50

    private static let storageDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory,
                                            in: .userDomainMask)[0]
        return base.appendingPathComponent("ClipStack", isDirectory: true)
    }()
    private static var phrasesURL: URL { storageDir.appendingPathComponent("phrases.json") }
    private static var historyURL: URL { storageDir.appendingPathComponent("history.json") }

    init() {
        lastChangeCount = pasteboard.changeCount
        load()
        let t = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.pollPasteboard() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    // Watch the system clipboard for new copies.
    private func pollPasteboard() {
        guard pasteboard.changeCount != lastChangeCount else { return }
        lastChangeCount = pasteboard.changeCount

        // Skip content marked as concealed (password managers etc.)
        let concealed = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")
        if pasteboard.types?.contains(concealed) == true { return }

        guard let text = pasteboard.string(forType: .string) else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        history.removeAll { $0.text == text }
        history.insert(ClipItem(text: text), at: 0)
        if history.count > maxHistory {
            history.removeLast(history.count - maxHistory)
        }
        saveHistory()
    }

    // Put an item's text on the clipboard, ready to paste.
    func copy(_ item: ClipItem) {
        pasteboard.clearContents()
        pasteboard.setString(item.text, forType: .string)
        // Don't re-record our own write in history.
        lastChangeCount = pasteboard.changeCount

        copiedItemID = item.id
        let id = item.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            if self?.copiedItemID == id { self?.copiedItemID = nil }
        }
    }

    func addPhrase(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !phrases.contains(where: { $0.text == trimmed }) else { return }
        phrases.append(ClipItem(text: trimmed))
        savePhrases()
    }

    func deletePhrase(_ item: ClipItem) {
        phrases.removeAll { $0.id == item.id }
        savePhrases()
    }

    // Promote a history item to a saved phrase.
    func pin(_ item: ClipItem) {
        guard !phrases.contains(where: { $0.text == item.text }) else { return }
        phrases.append(ClipItem(text: item.text))
        savePhrases()
    }

    func removeFromHistory(_ item: ClipItem) {
        history.removeAll { $0.id == item.id }
        saveHistory()
    }

    func clearHistory() {
        history.removeAll()
        saveHistory()
    }

    // MARK: Persistence

    private func load() {
        phrases = Self.read(from: Self.phrasesURL)
        history = Self.read(from: Self.historyURL)
    }

    private func savePhrases() { Self.write(phrases, to: Self.phrasesURL) }
    private func saveHistory() { Self.write(history, to: Self.historyURL) }

    private static func read(from url: URL) -> [ClipItem] {
        guard let data = try? Data(contentsOf: url),
              let items = try? JSONDecoder().decode([ClipItem].self, from: data)
        else { return [] }
        return items
    }

    private static func write(_ items: [ClipItem], to url: URL) {
        do {
            try FileManager.default.createDirectory(at: storageDir,
                                                    withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(items)
            try data.write(to: url, options: .atomic)
        } catch {
            NSLog("ClipStack: failed to save \(url.lastPathComponent): \(error)")
        }
    }
}

// MARK: - Views

struct ContentView: View {
    @EnvironmentObject var store: ClipStore
    @State private var newPhrase = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    phrasesSection
                    historySection
                }
                .padding(12)
            }
            .frame(maxHeight: 440)

            Divider()
            footer
        }
        .frame(width: 340)
    }

    private var header: some View {
        HStack {
            Image(systemName: "doc.on.clipboard")
                .foregroundColor(.accentColor)
            Text("ClipStack")
                .font(.headline)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var phrasesSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SAVED PHRASES")
                .font(.caption2.weight(.semibold))
                .foregroundColor(.secondary)

            HStack(spacing: 6) {
                TextField("Add a phrase to save…", text: $newPhrase)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(addPhrase)
                Button(action: addPhrase) {
                    Image(systemName: "plus.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundColor(.accentColor)
                .disabled(newPhrase.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if store.phrases.isEmpty {
                Text("No saved phrases yet.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 4)
            } else {
                ForEach(store.phrases) { item in
                    ClipRow(item: item,
                            isCopied: store.copiedItemID == item.id,
                            onCopy: { store.copy(item) }) {
                        Button {
                            store.deletePhrase(item)
                        } label: {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(.secondary)
                        .help("Delete phrase")
                    }
                }
            }
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("RECENTLY COPIED")
                .font(.caption2.weight(.semibold))
                .foregroundColor(.secondary)

            if store.history.isEmpty {
                Text("Copy something and it will show up here.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 4)
            } else {
                ForEach(store.history) { item in
                    ClipRow(item: item,
                            isCopied: store.copiedItemID == item.id,
                            onCopy: { store.copy(item) }) {
                        Button {
                            store.pin(item)
                        } label: {
                            Image(systemName: "pin")
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(.secondary)
                        .help("Save as phrase")

                        Button {
                            store.removeFromHistory(item)
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(.secondary)
                        .help("Remove from history")
                    }
                }
            }
        }
    }

    private var footer: some View {
        HStack {
            Button("Clear History") { store.clearHistory() }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.secondary)
                .disabled(store.history.isEmpty)
            Spacer()
            Button("Quit") { NSApplication.shared.terminate(nil) }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func addPhrase() {
        store.addPhrase(newPhrase)
        newPhrase = ""
    }
}

// One clickable clipboard entry, with optional trailing action buttons.
struct ClipRow<Accessory: View>: View {
    let item: ClipItem
    let isCopied: Bool
    let onCopy: () -> Void
    @ViewBuilder let accessory: () -> Accessory

    @State private var hovering = false

    var body: some View {
        HStack(spacing: 8) {
            Button(action: onCopy) {
                HStack(spacing: 6) {
                    Image(systemName: isCopied ? "checkmark.circle.fill" : "doc.on.doc")
                        .foregroundColor(isCopied ? .green : .secondary)
                        .frame(width: 14)
                    Text(item.text)
                        .lineLimit(2)
                        .truncationMode(.tail)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(isCopied ? "Copied!" : "Click to copy")

            if hovering {
                accessory()
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(hovering ? Color.primary.opacity(0.08) : Color.primary.opacity(0.04))
        )
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.1), value: isCopied)
    }
}

// MARK: - App

@main
struct ClipStackApp: App {
    @StateObject private var store = ClipStore()

    var body: some Scene {
        MenuBarExtra {
            ContentView()
                .environmentObject(store)
        } label: {
            Image(systemName: "doc.on.clipboard")
        }
        .menuBarExtraStyle(.window)
    }
}
