import AppKit
import SwiftUI

/// Where your days live (this Mac, or a cloud Daybook and its key), the
/// shutdown reminder, the Frame (two-way sync and the TV's design) and updates. Every control is drawn in the salon
/// style, so nothing inherits the menu bar's dark appearance.
struct SettingsView: View {
    @Bindable var model: DaybookModel
    var done: () -> Void
    @State private var url = ""
    @State private var key = ""
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            header

            if model.place == .mac {
                SettingsSection(title: "Your days") {
                    SettingRow(title: "Kept on this Mac", caption: "A cloud Daybook is only needed for the same days on your phone, your AI agents, Linear or a Frame TV.") {
                        Button("Connect…") { model.showConnect(); done() }.buttonStyle(PillStyle())
                    }
                }
            } else {
                SettingsSection(title: "Cloud Daybook") {
                    LineField(title: "Daybook URL", text: $url, prompt: "https://your-daybook.vercel.app",
                              hint: "Your deployment, or http://localhost:3000 while developing.")
                    LineField(title: "Key", text: $key, prompt: model.hasKey ? "Saved in your Keychain" : "DAYBOOK_KEY or a dbk_ token",
                              hint: needsKey
                                  ? "Required, see below."
                                  : model.hasKey ? "Leave empty to keep the saved key." : "Your DAYBOOK_KEY, or a token made for this Mac.",
                              secure: true,
                              highlight: needsKey)
                    if needsKey || !model.hasKey { KeyHelp() }
                    SettingRow(title: "Use this Mac only", caption: "Back to the days kept on this Mac. The cloud Daybook stays as it is.") {
                        Button("Switch") { Task { await model.useThisMac(); done() } }.buttonStyle(PillStyle())
                    }
                }

                SettingsSection(title: "Linear and AI agents") {
                    SettingRow(title: "Connections", caption: "Connect Linear, the Frame, and Claude, ChatGPT, Cursor, Grok and others.") {
                        Button("Open") { model.open("/settings") }.buttonStyle(PillStyle())
                    }
                }
            }

            SettingsSection(title: "Rituals") {
                SettingRow(title: "Wrap-up reminder", caption: "A nudge to review the day and write one line.") {
                    SalonToggle(isOn: $model.reminderOn)
                }
                if model.reminderOn {
                    TimeStepper(minutes: $model.reminderMinutes)
                        .transition(.opacity.combined(with: .offset(y: -4)))
                }
            }

            SettingsSection(title: "Frame") {
                if model.place == .mac {
                    SettingRow(title: "Your plan on a Frame TV", caption: "The Frame reads a cloud Daybook: connect one above, then Frame Dashboard on it.") {
                        EmptyView()
                    }
                } else {
                    SettingRow(
                        title: "Two-way sync",
                        caption: model.session?.frame == true
                            ? "Every 2 minutes. Ticks made on Frame Desk or the TV come back here."
                            : "Connect Frame Dashboard on your Daybook server first."
                    ) {
                        SalonToggle(isOn: $model.frameSyncOn)
                    }
                    DesignPicker(model: model)
                }
            }

            if let updates = model.updates { UpdatesSection(updates: updates) }

            if let error = model.error, !needsKey {
                Text(error).font(Salon.text(12)).foregroundStyle(Salon.amber)
            }

            HStack(spacing: 8) {
                Spacer()
                if model.place == .mac {
                    Button("Done") { done() }.buttonStyle(PillStyle(solid: true)).keyboardShortcut(.defaultAction)
                } else {
                    if model.isConfigured { Button("Cancel") { done() }.buttonStyle(PillStyle()) }
                    save
                }
            }
        }
        .animation(.smooth(duration: 0.35), value: model.reminderOn)
        .padding(24)
        .frame(width: 380)
        .background(Salon.paper)
        .environment(\.colorScheme, .light)
        .background(LightAppearance())
        .task { await model.loadFrameSettings() }
        .onAppear { url = model.baseURL }
    }

    private var save: some View {
                Button(saving ? "Connecting…" : "Save") {
                    saving = true
                    Task {
                        await model.saveSettings(url: url, key: key)
                        saving = false
                        key = ""
                        if model.isConfigured { done() }
                    }
                }
                .buttonStyle(PillStyle(solid: true))
                .disabled(saving || url.isEmpty)
                .keyboardShortcut(.defaultAction)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SETTINGS").font(Salon.label()).tracking(1.4).foregroundStyle(Salon.cobalt)
            Text("Your Daybook").font(Salon.display(40)).foregroundStyle(Salon.ink)
            HStack(spacing: 6) {
                Circle().fill(model.isConfigured ? Salon.cobalt : Salon.amber).frame(width: 6, height: 6)
                Text(model.place == .mac ? "On this Mac" : model.isConfigured ? "Connected to \(host)" : needsKey ? "Reached \(host) · it needs your key" : "Not connected yet")
                    .font(Salon.text(12)).foregroundStyle(needsKey ? Salon.amber : Salon.ink2)
            }
        }
    }

    /// The server answered but wants a key we don't have (or have wrong).
    private var needsKey: Bool { model.session != nil && model.session?.authorized == false }

    private var host: String {
        URL(string: model.baseURL).map { [$0.host, $0.port.map(String.init)].compactMap { $0 }.joined(separator: ":") } ?? model.baseURL
    }
}

/// The version that's running, the daily check, and Check now / Install.
struct UpdatesSection: View {
    @Bindable var updates: Updates

    var body: some View {
        SettingsSection(title: "Updates") {
            if updates.isEnabled {
                SettingRow(title: "Check automatically", caption: "Once a day, in the background.") {
                    SalonToggle(isOn: $updates.checksAutomatically)
                }
                SettingRow(
                    title: updates.available.map { "Daybook \($0) is available" } ?? "Daybook \(updates.version)",
                    caption: updates.available == nil ? "The version you're running." : "It installs here, then Daybook reopens."
                ) {
                    Button(updates.available == nil ? "Check now" : "Install…") { updates.check() }
                        .buttonStyle(PillStyle(solid: updates.available != nil))
                        .disabled(!updates.canCheck)
                }
            } else {
                SettingRow(title: "Daybook \(updates.version)", caption: "This build doesn't update itself. New versions are on GitHub.") {
                    Button("Open") { NSWorkspace.shared.open(Updates.releasesPage) }.buttonStyle(PillStyle())
                }
            }
        }
    }
}

// MARK: - Building blocks

struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHead(title: title)
            content
        }
    }
}

struct SettingRow<Control: View>: View {
    let title: String
    var caption: String? = nil
    @ViewBuilder var control: Control

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(Salon.text(14, .medium)).foregroundStyle(Salon.ink)
                if let caption { Text(caption).font(Salon.text(11.5)).foregroundStyle(Salon.ink2).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 8)
            control
        }
    }
}

/// An underlined field with a readable placeholder (the system one turns white in dark mode).
struct LineField: View {
    let title: String
    @Binding var text: String
    let prompt: String
    let hint: String
    var secure = false
    var highlight = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(Salon.label()).tracking(1.2).foregroundStyle(Salon.ink2)
            Group {
                if secure {
                    SecureField("", text: $text, prompt: Text(prompt).foregroundStyle(Salon.done))
                } else {
                    TextField("", text: $text, prompt: Text(prompt).foregroundStyle(Salon.done))
                }
            }
            .textFieldStyle(.plain)
            .font(Salon.text(14.5))
            .foregroundStyle(Salon.ink)
            .padding(.vertical, 6)
            .overlay(alignment: .bottom) { Rectangle().fill(highlight ? Salon.amber : Salon.ink.opacity(0.85)).frame(height: highlight ? 1.5 : 1) }
            Text(hint).font(Salon.text(11)).foregroundStyle(highlight ? Salon.amber : Salon.ink2).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A capsule switch in card ink, with a little spring.
struct SalonToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                Capsule().fill(isOn ? Salon.ink : Salon.rule)
                Circle().fill(Salon.paper)
                    .padding(3)
                    .shadow(color: .black.opacity(0.18), radius: 2, y: 1)
            }
            .frame(width: 40, height: 23)
            .animation(.spring(duration: 0.3, bounce: 0.3), value: isOn)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isOn ? "On" : "Off")
    }
}

/// The reminder time, in quarter hours: − 6:00 pm +
struct TimeStepper: View {
    @Binding var minutes: Int

    var body: some View {
        HStack(spacing: 0) {
            step("minus") { minutes = (minutes - 15 + 1440) % 1440 }
            Text(label)
                .font(Salon.display(22))
                .foregroundStyle(Salon.ink)
                .contentTransition(.numericText())
                .frame(minWidth: 96)
                .animation(.smooth(duration: 0.25), value: minutes)
            step("plus") { minutes = (minutes + 15) % 1440 }
            Spacer()
            Text("every day").font(Salon.text(11.5)).foregroundStyle(Salon.ink2)
        }
        .padding(.leading, 2)
    }

    private var label: String {
        let h = minutes / 60, m = minutes % 60
        return String(format: "%d:%02d %@", h % 12 == 0 ? 12 : h % 12, m, h < 12 ? "am" : "pm")
    }

    private func step(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Salon.ink)
                .frame(width: 26, height: 26)
                .overlay(Circle().strokeBorder(Salon.ink.opacity(0.8), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Keeps AppKit pieces (text cursors, focus rings) in the light appearance
/// even when the menu bar and the system are dark.
struct LightAppearance: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let v = NSView()
        DispatchQueue.main.async { v.window?.appearance = NSAppearance(named: .aqua) }
        return v
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        nsView.window?.appearance = NSAppearance(named: .aqua)
    }
}

// MARK: - Frame design

struct DesignPicker: View {
    @Bindable var model: DaybookModel

    var body: some View {
        if let fs = model.frameSettings, fs.supported, !fs.layouts.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("DESIGN").font(Salon.label()).tracking(1.2).foregroundStyle(Salon.ink2)
                HStack(spacing: 10) {
                    ForEach(fs.layouts) { design in
                        DesignCard(design: design, selected: fs.layout == design.id, art: model.artURL()) {
                            Task { await model.setFrameDesign(design.id) }
                        }
                    }
                }
                Text(fs.layouts.first { $0.id == fs.layout }?.description ?? " ")
                    .font(Salon.text(11.5)).foregroundStyle(Salon.ink2)
                    .contentTransition(.opacity)
                    .animation(.smooth(duration: 0.3), value: fs.layout)
            }
        } else if model.frameSettings?.supported == false {
            Text("Update Frame Dashboard to choose its design.").font(Salon.text(11.5)).foregroundStyle(Salon.ink2)
        }
    }
}

struct DesignCard: View {
    let design: FrameDesign
    let selected: Bool
    let art: URL?
    let action: () -> Void
    @State private var hover = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 7) {
                DesignPreview(kind: design.id, art: art)
                    .frame(height: 58)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(selected ? Salon.ink : Salon.rule, lineWidth: selected ? 1.5 : 1))
                    .overlay(alignment: .topTrailing) {
                        if selected {
                            Image(systemName: "checkmark")
                                .font(.system(size: 7, weight: .bold))
                                .foregroundStyle(Salon.paper)
                                .frame(width: 14, height: 14)
                                .background(Circle().fill(Salon.ink))
                                .offset(x: 4, y: -4)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                    .scaleEffect(hover && !selected ? 1.03 : 1)
                Text(design.name)
                    .font(Salon.text(12, selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Salon.ink : Salon.ink2)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hover = $0 }
        .animation(.spring(duration: 0.35, bounce: 0.3), value: selected)
        .animation(.smooth(duration: 0.2), value: hover)
        .help(design.description)
    }
}

/// A tiny drawing of each design, made with today's painting.
struct DesignPreview: View {
    let kind: String
    let art: URL?

    var body: some View {
        GeometryReader { g in
            switch kind {
            case "painting": painting(g.size)
            case "salon": salon(g.size)
            default:
                // Day and night: the painting by day, the salon after dark.
                HStack(spacing: 0) {
                    painting(g.size).frame(width: g.size.width / 2, alignment: .leading).clipped()
                    salon(g.size).frame(width: g.size.width / 2, alignment: .trailing).clipped()
                }
                .overlay(Rectangle().fill(Salon.paper.opacity(0.7)).frame(width: 1))
            }
        }
    }

    private func image(_ size: CGSize) -> some View {
        AsyncImage(url: art) { phase in
            if let i = phase.image {
                i.resizable().scaledToFill()
            } else {
                LinearGradient(colors: [Color(hex: 0x8A9A86), Color(hex: 0x4D5A4A)], startPoint: .top, endPoint: .bottom)
            }
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }

    // The painting fills the screen; a bone placard on the right.
    private func painting(_ s: CGSize) -> some View {
        ZStack(alignment: .trailing) {
            image(s)
            VStack(alignment: .leading, spacing: 3) {
                RoundedRectangle(cornerRadius: 1).fill(Salon.ink.opacity(0.75)).frame(width: s.width * 0.14, height: 4)
                ForEach(0 ..< 3, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1).fill(Salon.ink2.opacity(0.45)).frame(width: s.width * (i == 2 ? 0.12 : 0.18), height: 2)
                }
            }
            .padding(5)
            .frame(width: s.width * 0.3, height: s.height * 0.74, alignment: .topLeading)
            .background(Salon.paper)
            .padding(.trailing, s.width * 0.06)
        }
    }

    // The painting in a gilt frame on the green-grey wall; the day as light text beside it.
    private func salon(_ s: CGSize) -> some View {
        ZStack {
            Salon.wall
            HStack(spacing: s.width * 0.08) {
                image(CGSize(width: s.width * 0.36, height: s.height * 0.5))
                    .padding(2)
                    .background(Salon.gilt)
                VStack(alignment: .leading, spacing: 3) {
                    RoundedRectangle(cornerRadius: 1).fill(Salon.bone.opacity(0.85)).frame(width: s.width * 0.16, height: 4)
                    ForEach(0 ..< 3, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 1).fill(Salon.bone.opacity(0.4)).frame(width: s.width * (i == 2 ? 0.12 : 0.2), height: 2)
                    }
                }
            }
        }
    }
}
