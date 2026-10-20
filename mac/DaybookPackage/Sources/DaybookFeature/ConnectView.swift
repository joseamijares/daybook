import AppKit
import SwiftUI

/// Connecting a cloud Daybook, over the window: only from Settings (the
/// menu bar's, or the page's "Connect…"), never a first step. A new Mac keeps
/// its days here; the cloud is for the same days on other devices, agents,
/// Linear and a Frame TV. Also what a connected Mac shows when its saved key
/// stops opening that Daybook.
struct ConnectView: View {
    @Bindable var model: DaybookModel
    /// The saved key no longer opens the cloud Daybook (nothing to cancel back to).
    var rejected = false
    @State private var url = ""
    @State private var key = ""
    @State private var bringDays = true
    @State private var connecting = false
    @State private var said: String?
    @State private var appeared = false
    @FocusState private var focus: Field?

    enum Field { case url, key }

    var body: some View {
        ZStack {
            Salon.wall.opacity(rejected ? 1 : 0.55).ignoresSafeArea()
                .onTapGesture { if !rejected { close() } }
            placard
                .frame(width: 470)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 14)
        }
        .environment(\.colorScheme, .light)
        .onAppear {
            if model.place == .cloud || rejected { url = model.baseURL }
            focus = url.isEmpty ? .url : .key
            withAnimation(.easeOut(duration: 0.5)) { appeared = true }
        }
        .onExitCommand { if !rejected { close() } }
    }

    private var placard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("CLOUD").font(Salon.label()).tracking(1.6).foregroundStyle(Salon.cobalt)
            Text(rejected ? "Your key, again" : "Connect a cloud Daybook")
                .font(Salon.display(40)).foregroundStyle(Salon.ink).padding(.top, 6)
            Text(rejected
                ? "The saved key no longer opens \(host). Enter it again, or go back to keeping your days on this Mac."
                : "Your days are kept on this Mac, and that’s all most people need. A Daybook in the cloud puts the same days on your phone and other computers, and lets your AI agents, Linear and a Frame TV use them.")
                .font(Salon.text(13)).foregroundStyle(Salon.ink2).padding(.top, 8)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 18) {
                field("Its address", text: $url, prompt: "https://your-daybook.vercel.app", secure: false, field: .url)
                field("Its key", text: $key, prompt: model.hasKey ? "Saved in your Keychain" : "DAYBOOK_KEY", secure: true, field: .key)
                KeyHelp()
                if model.place == .mac {
                    Toggle(isOn: $bringDays) {
                        Text("Bring the days on this Mac along").font(Salon.text(12.5)).foregroundStyle(Salon.ink)
                    }
                    .toggleStyle(.checkbox)
                }
            }
            .padding(.top, 22)

            if let said {
                Text(said).font(Salon.text(12.5)).foregroundStyle(Salon.amber).padding(.top, 14)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }

            HStack(spacing: 10) {
                Link("No cloud Daybook yet? Set one up ↗", destination: URL(string: "https://github.com/joseamijares/daybook#deploy-your-own")!)
                    .font(Salon.text(12)).foregroundStyle(Salon.cobalt)
                Spacer()
                if rejected {
                    Button("Use this Mac only") { Task { await model.useThisMac() } }.buttonStyle(PillStyle())
                } else {
                    Button("Cancel") { close() }.buttonStyle(PillStyle())
                }
                Button(connecting ? "Connecting…" : "Connect", action: connect)
                    .buttonStyle(PillStyle(solid: true))
                    .disabled(!canConnect || connecting)
                    .keyboardShortcut(.defaultAction)
            }
            .padding(.top, 22)
        }
        .padding(36)
        .background(Rectangle().fill(Salon.paper).shadow(color: .black.opacity(0.4), radius: 40, y: 26))
        .animation(.smooth(duration: 0.3), value: said)
    }

    private var host: String {
        URL(string: model.baseURL)?.host ?? model.baseURL
    }

    /// A Daybook running on this Mac may need no key, so the address is enough to try.
    private var canConnect: Bool { !url.trimmingCharacters(in: .whitespaces).isEmpty }

    private func field(_ title: String, text: Binding<String>, prompt: String, secure: Bool, field: Field) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Salon.text(13, .semibold)).foregroundStyle(Salon.ink)
            Group {
                if secure {
                    SecureField("", text: text, prompt: Text(prompt).foregroundStyle(Salon.done))
                } else {
                    TextField("", text: text, prompt: Text(prompt).foregroundStyle(Salon.done))
                }
            }
            .textFieldStyle(.plain)
            .font(Salon.text(15))
            .foregroundStyle(Salon.ink)
            .focused($focus, equals: field)
            .padding(.vertical, 7)
            .overlay(alignment: .bottom) {
                Rectangle().fill(focus == field ? Salon.cobalt : Salon.ink.opacity(0.85)).frame(height: focus == field ? 1.5 : 1)
            }
            .onSubmit { if field == .url { focus = .key } else { connect() } }
        }
    }

    private func close() {
        withAnimation(.smooth(duration: 0.3)) { model.connecting = false }
    }

    private func connect() {
        guard canConnect, !connecting else { return }
        connecting = true
        said = nil
        Task {
            let result = await model.connect(url: url, key: key, bringDays: bringDays)
            connecting = false
            if result.connected {
                key = ""
                if let message = result.message {
                    said = message // connected; the days stayed: say so, then close
                    try? await Task.sleep(for: .seconds(6))
                }
                close()
            } else {
                said = result.message
            }
        }
    }
}

/// Where the key comes from, in the order people usually have it.
struct KeyHelp: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Where to find it").font(Salon.label()).tracking(1.2).foregroundStyle(Salon.ink2)
            line("1", "Deployed it yourself? It's **DAYBOOK_KEY**: Vercel → your Daybook project → Settings → Environment Variables → DAYBOOK_KEY → reveal and copy.")
            line("2", "Someone else's Daybook? Ask them for a token: their Settings → AI agents → **Daybook for Mac** → Create token.")
            line("3", "Running it on this Mac? It's DAYBOOK_KEY in the project's .env.local, or no key at all.")
            Text("It's kept in your Keychain, so you only enter it once.")
                .font(Salon.text(11)).foregroundStyle(Salon.ink2).padding(.top, 2)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func line(_ n: String, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(n).font(Salon.text(11, .semibold)).foregroundStyle(Salon.cobalt).frame(width: 10, alignment: .leading)
            Text(text).font(Salon.text(11.5)).foregroundStyle(Salon.ink2)
        }
    }
}
