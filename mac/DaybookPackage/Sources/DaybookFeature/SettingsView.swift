import SwiftUI

/// Where your Daybook lives, its key, Frame sync and the shutdown reminder.
struct SettingsView: View {
    @Bindable var model: DaybookModel
    var done: () -> Void
    @State private var url = ""
    @State private var key = ""
    @State private var reminder = Date()
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("SETTINGS").font(Salon.label()).tracking(1.4).foregroundStyle(Salon.cobalt)
                Text("Your Daybook").font(Salon.display(40)).foregroundStyle(Salon.ink)
            }

            field("Daybook URL", hint: "Your deployment, or http://localhost:3000 while developing.") {
                TextField("https://your-daybook.vercel.app", text: $url)
            }
            field("Key", hint: model.hasKey ? "Saved in your Keychain. Leave empty to keep it." : "DAYBOOK_KEY. Leave empty if your local Daybook has none.") {
                SecureField(model.hasKey ? "••••••••" : "DAYBOOK_KEY", text: $key)
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionHead(title: "Rituals and Frame")
                Toggle(isOn: $model.reminderOn) {
                    Text("Remind me to shut down").font(Salon.text(13.5)).foregroundStyle(Salon.ink)
                }
                .toggleStyle(.switch).tint(Salon.cobalt)
                if model.reminderOn {
                    DatePicker("At", selection: $reminder, displayedComponents: .hourAndMinute)
                        .font(Salon.text(13))
                        .onChange(of: reminder) { _, value in
                            let c = Calendar.current.dateComponents([.hour, .minute], from: value)
                            model.reminderMinutes = (c.hour ?? 18) * 60 + (c.minute ?? 0)
                        }
                }
                Toggle(isOn: $model.frameSyncOn) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Sync with Frame every 2 minutes").font(Salon.text(13.5)).foregroundStyle(Salon.ink)
                        Text(model.session?.frame == true ? "Ticks made on Frame Desk or the TV come back here." : "Connect Frame Dashboard on your Daybook server first (FRAME_DASHBOARD_URL).")
                            .font(Salon.text(11)).foregroundStyle(Salon.ink2)
                    }
                }
                .toggleStyle(.switch).tint(Salon.cobalt)

                if let fs = model.frameSettings, fs.supported, !fs.layouts.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Frame design").font(Salon.text(13.5)).foregroundStyle(Salon.ink)
                        Picker("Frame design", selection: Binding(
                            get: { fs.layout ?? fs.layouts[0].id },
                            set: { id in Task { await model.setFrameDesign(id) } }
                        )) {
                            ForEach(fs.layouts) { Text($0.name).tag($0.id) }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                        Text(fs.layouts.first { $0.id == fs.layout }?.description ?? "")
                            .font(Salon.text(11)).foregroundStyle(Salon.ink2)
                    }
                    .padding(.top, 4)
                } else if model.frameSettings?.supported == false {
                    Text("Update Frame Dashboard to choose its design.").font(Salon.text(11)).foregroundStyle(Salon.ink2)
                }
            }

            if let error = model.error {
                Text(error).font(Salon.text(12)).foregroundStyle(Salon.amber)
            }

            HStack {
                Spacer()
                if model.isConfigured { Button("Cancel") { done() }.buttonStyle(PillStyle()) }
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
        }
        .padding(24)
        .frame(width: 380)
        .background(Salon.paper)
        .task { await model.loadFrameSettings() }
        .onAppear {
            url = model.baseURL
            reminder = Calendar.current.date(bySettingHour: model.reminderMinutes / 60, minute: model.reminderMinutes % 60, second: 0, of: Date()) ?? Date()
        }
    }

    private func field(_ title: String, hint: String, @ViewBuilder input: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(Salon.label()).tracking(1.4).foregroundStyle(Salon.ink)
            input()
                .textFieldStyle(.plain)
                .font(Salon.text(14))
                .foregroundStyle(Salon.ink)
                .padding(.vertical, 6)
                .overlay(alignment: .bottom) { Rectangle().fill(Salon.ink).frame(height: 1) }
            Text(hint).font(Salon.text(11)).foregroundStyle(Salon.ink2)
        }
    }
}
