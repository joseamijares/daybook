import AppKit
import SwiftUI

/// The first thing the window shows: a painting on the wall and a placard
/// with two questions, where your Daybook lives and its key. As soon as the
/// address answers, the painting becomes that Daybook's painting of the day.
public struct OnboardingView: View {
    @Bindable var model: DaybookModel
    @State private var url = ""
    @State private var key = ""
    @State private var connecting = false
    @State private var failed: String?
    @State private var drift = false
    @State private var appeared = false
    @FocusState private var focus: Field?

    enum Field { case url, key }

    public init(model: DaybookModel) { self.model = model }

    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Salon.wall.ignoresSafeArea()
                wall(geo.size)
                credit
                    .padding(.leading, 56)
                    .padding(.bottom, 48)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                placard
                    .frame(width: min(460, geo.size.width * 0.42))
                    .padding(.trailing, 48)
                    .padding(.vertical, 48)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 18)
            }
        }
        .ignoresSafeArea()
        .environment(\.colorScheme, .light)
        .onAppear {
            url = model.baseURL == "http://localhost:3000" ? "" : model.baseURL
            focus = url.isEmpty ? .url : .key
            withAnimation(.easeOut(duration: 0.9).delay(0.25)) { appeared = true }
            drift = true
            if !url.isEmpty { Task { await model.probe(url) } }
        }
        .task(id: url) {
            // Ask the address who it is once typing pauses.
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            failed = nil
            await model.probe(url)
        }
    }

    // MARK: The wall

    private var paintingURL: URL? { model.probeArtURL() }

    @ViewBuilder
    private func wall(_ size: CGSize) -> some View {
        let image = Group {
            if let remote = paintingURL {
                AsyncImage(url: remote, transaction: .init(animation: .easeOut(duration: 1.6))) { phase in
                    if let i = phase.image { i.resizable().scaledToFill() } else { welcome }
                }
            } else {
                welcome
            }
        }
        ZStack(alignment: .leading) {
            // The same painting, out of focus, behind everything.
            image
                .frame(width: size.width + 120, height: size.height + 120)
                .blur(radius: 46)
                .brightness(-0.08)
                .saturation(1.15)
                .offset(x: -60, y: -60)
                .clipped()
            // The painting itself on the left, fading into its blur.
            image
                .frame(width: size.width * 0.72, height: size.height)
                .clipped()
                .scaleEffect(drift ? 1.045 : 1.0, anchor: .init(x: 0.3, y: 0.5))
                .animation(.easeInOut(duration: 48).repeatForever(autoreverses: true), value: drift)
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.62), .init(color: .black.opacity(0.6), location: 0.82), .init(color: .clear, location: 1)], startPoint: .leading, endPoint: .trailing))
            LinearGradient(colors: [.clear, .black.opacity(0.45)], startPoint: .center, endPoint: .bottom)
        }
        .id(paintingURL)
        .transition(.opacity)
        .animation(.easeOut(duration: 1.4), value: paintingURL)
        .frame(width: size.width, height: size.height)
        .clipped()
    }

    private var welcome: some View {
        Group {
            if let path = Bundle.module.url(forResource: "welcome", withExtension: "webp"), let ns = NSImage(contentsOf: path) {
                Image(nsImage: ns).resizable().scaledToFill()
            } else {
                Salon.wall
            }
        }
    }

    private var credit: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let art = model.probe?.art {
                Text(art.title).font(Salon.italic(24))
                Text("\(art.artist), \(art.date)").font(Salon.text(13)).opacity(0.85)
            } else {
                Text("The Loire").font(Salon.italic(24))
                Text("Alfred Sisley, 1896").font(Salon.text(13)).opacity(0.85)
            }
        }
        .foregroundStyle(Salon.bone)
        .animation(.easeOut(duration: 0.6), value: model.probe?.art)
    }

    // MARK: The placard

    private var placard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("WELCOME").font(Salon.label()).tracking(1.6).foregroundStyle(Salon.cobalt)
            Text("Daybook").font(Salon.display(76)).foregroundStyle(Salon.ink).padding(.top, 6)
            Text("A painting a day, and a plan to match.")
                .font(Salon.italic(25)).foregroundStyle(Salon.ink).padding(.top, 2)

            VStack(alignment: .leading, spacing: 26) {
                step(1, "Where is your Daybook?") {
                    field(text: $url, prompt: "https://your-daybook.vercel.app", secure: false, field: .url)
                    status
                    HStack(spacing: 14) {
                        Button("Use a local one") { url = "http://localhost:3000" }
                        Link("Deploy your own ↗", destination: URL(string: "https://github.com/joseamijares/daybook#deploy-vercel--upstash")!)
                    }
                    .buttonStyle(.plain)
                    .font(Salon.text(12.5))
                    .foregroundStyle(Salon.cobalt)
                }
                step(2, "Your key") {
                    field(text: $key, prompt: "DAYBOOK_KEY or a dbk_ token", secure: true, field: .key)
                    Text("The DAYBOOK_KEY on your server (Vercel → Settings → Environment Variables), or a token from Settings → AI agents → Daybook for Mac. It's kept in your Keychain.")
                        .font(Salon.text(11.5)).foregroundStyle(Salon.ink2).fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.top, 34)

            Spacer(minLength: 24)

            if let failed {
                Text(failed).font(Salon.text(12.5)).foregroundStyle(Salon.amber).padding(.bottom, 12)
                    .transition(.opacity)
            }
            HStack {
                Text(model.probe?.needsKey == false ? "No key needed on this one." : " ")
                    .font(Salon.text(12)).foregroundStyle(Salon.ink2)
                Spacer()
                Button(action: connect) {
                    HStack(spacing: 8) {
                        if connecting { ProgressView().controlSize(.small).tint(Salon.paper) }
                        Text(connecting ? "Opening…" : "Open Daybook")
                    }
                    .font(Salon.text(14, .semibold))
                    .foregroundStyle(Salon.paper)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(canConnect ? Salon.ink : Salon.done))
                }
                .buttonStyle(.plain)
                .disabled(!canConnect || connecting)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(.horizontal, 44)
        .padding(.top, 44)
        .padding(.bottom, 30)
        .frame(maxHeight: .infinity, alignment: .top)
        // The shadow belongs to the card, not to every line of text on it.
        .background(Rectangle().fill(Salon.paper).shadow(color: .black.opacity(0.4), radius: 40, y: 26))
        .animation(.smooth(duration: 0.35), value: failed)
    }

    private var canConnect: Bool {
        model.probe != nil && (model.probe?.needsKey == false || !key.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    @ViewBuilder
    private var status: some View {
        HStack(spacing: 6) {
            if let s = model.probe {
                Circle().fill(Salon.cobalt).frame(width: 6, height: 6)
                Text(s.needsKey ? "Found it. Now its key." : "Found it.")
            } else if let e = model.probeError, !url.isEmpty {
                Circle().fill(Salon.amber).frame(width: 6, height: 6)
                Text(e)
            } else {
                Text("Paste the address of your deployment.").foregroundStyle(Salon.ink2)
            }
        }
        .font(Salon.text(12.5))
        .foregroundStyle(model.probe != nil ? Salon.cobalt : Salon.amber)
        .animation(.smooth(duration: 0.3), value: model.probe?.today)
    }

    private func step<Content: View>(_ n: Int, _ title: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Text("\(n)")
                .font(Salon.display(22))
                .foregroundStyle(Salon.ink)
                .frame(width: 30, height: 30)
                .overlay(Circle().strokeBorder(Salon.ink.opacity(0.85), lineWidth: 1))
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(Salon.text(16, .semibold)).foregroundStyle(Salon.ink)
                content()
            }
        }
    }

    private func field(text: Binding<String>, prompt: String, secure: Bool, field: Field) -> some View {
        Group {
            if secure {
                SecureField("", text: text, prompt: Text(prompt).foregroundStyle(Salon.done))
            } else {
                TextField("", text: text, prompt: Text(prompt).foregroundStyle(Salon.done))
            }
        }
        .textFieldStyle(.plain)
        .font(Salon.text(16))
        .foregroundStyle(Salon.ink)
        .focused($focus, equals: field)
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) {
            Rectangle().fill(focus == field ? Salon.cobalt : Salon.ink.opacity(0.85)).frame(height: focus == field ? 1.5 : 1)
        }
        .onSubmit { if field == .url { focus = .key } else { connect() } }
    }

    private func connect() {
        guard canConnect, !connecting else { return }
        connecting = true
        failed = nil
        Task {
            await model.saveSettings(url: url, key: key)
            connecting = false
            if model.isConfigured {
                key = ""
            } else {
                failed = model.session?.authorized == false ? "That key didn’t open this Daybook. Check it and try again." : (model.error ?? "Couldn’t connect.")
            }
        }
    }
}
