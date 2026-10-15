import AppKit
import SwiftUI

/// The menu bar popover: today's painting with the day set over it, then the
/// bone placard: focus, schedule, to-dos, quick add and the week.
public struct PopoverView: View {
    @Bindable var model: DaybookModel
    @State private var showSettings = false
    @State private var dayHeight: CGFloat = 0
    /// Off for offscreen snapshots, which can't draw a scroll view.
    var scrolls = true

    public init(model: DaybookModel) { self.model = model }

    init(model: DaybookModel, scrolls: Bool) {
        self.model = model
        self.scrolls = scrolls
    }

    public var body: some View {
        VStack(spacing: 0) {
            if showSettings || !model.isConfigured {
                SettingsView(model: model) { showSettings = false }
            } else {
                Hero(model: model)
                VStack(alignment: .leading, spacing: 18) {
                    // Switching days slides the day's content in, like turning a page.
                    // A long day scrolls inside the popover instead of running off the screen.
                    Group {
                        if scrolls {
                            ScrollView {
                                day.background(GeometryReader { g in
                                    Color.clear.preference(key: DayHeightKey.self, value: g.size.height)
                                })
                            }
                            .scrollIndicators(.never)
                            .frame(height: min(max(dayHeight, 1), popoverBodyHeight))
                            .onPreferenceChange(DayHeightKey.self) { dayHeight = $0 }
                        } else {
                            day
                        }
                    }
                    .id(model.shownDate)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .offset(y: 12)),
                        removal: .opacity
                    ))
                    WeekStrip(model: model)
                    footer
                }
                .animation(.smooth(duration: 0.5), value: model.shownDate)
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 14)
                .background(Salon.paper)
            }
        }
        .frame(width: 380)
        .background(Salon.paper)
        .preferredColorScheme(.light)
        .environment(\.colorScheme, .light)
        .background(LightAppearance())
        .task { await model.refresh() }
    }

    private var day: some View {
        VStack(alignment: .leading, spacing: 18) {
            FocusField(model: model)
            if !model.events.isEmpty { Schedule(model: model) }
            Tasks(model: model)
        }
    }

    /// Room for the day between the painting and the week strip, so the whole
    /// popover fits on the screen it opens on.
    private var popoverBodyHeight: CGFloat {
        let screen = NSScreen.main?.visibleFrame.height ?? 900
        return max(260, min(560, screen - 190 - 170 - 60))
    }

    private var footer: some View {
        HStack(spacing: 10) {
            let problem = model.error ?? model.frameStatus
            if problem == nil, let updates = model.updates, let version = updates.available {
                Button("Daybook \(version) is available") { updates.check() }
                    .buttonStyle(.plain)
                    .font(Salon.text(11, .medium))
                    .foregroundStyle(Salon.cobalt)
                    .lineLimit(1)
                    .help("Install the update")
            } else {
                Text(problem ?? status)
                    .font(Salon.text(11))
                    .foregroundStyle(problem == nil ? Salon.ink2 : Salon.amber)
                    .lineLimit(1)
                    .help(problem ?? status)
            }
            Spacer()
            Button("Open Daybook") { model.open(model.isShowingToday ? "/" : "/?date=\(model.shownDate)") }
                .buttonStyle(PillStyle(solid: true))
            Button { showSettings = true } label: {
                Image(systemName: "slider.horizontal.3").font(.system(size: 12)).foregroundStyle(Salon.ink2)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Settings")
        }
    }

    private var status: String {
        guard let last = model.lastSync else { return "Connecting…" }
        let t = Dates.time(last, .current)
        if model.session?.frame == true, let f = model.lastFrameSync {
            return "Synced \(t) · Frame \(Dates.time(f, .current))"
        }
        return "Synced \(t)"
    }
}

// MARK: - The painting

struct Hero: View {
    @Bindable var model: DaybookModel
    @State private var drift = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Salon.wall
            // The painting fades up out of a soft focus, then drifts very slowly.
            AsyncImage(url: model.artURL(), transaction: .init(animation: .easeOut(duration: 1.6))) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                        .transition(.opacity.combined(with: .scale(scale: 1.06)))
                } else {
                    Salon.wall
                }
            }
            .id(model.artURL())
            .scaleEffect(drift ? 1.06 : 1.0, anchor: .init(x: 0.35, y: 0.5))
            .animation(.easeInOut(duration: 38).repeatForever(autoreverses: true), value: drift)
            .frame(width: 380, height: 190)
            .clipped()
            .onAppear { drift = true }

            LinearGradient(
                stops: [.init(color: .black.opacity(0.45), location: 0), .init(color: .clear, location: 0.35), .init(color: .black.opacity(0.7), location: 1)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(width: 380, height: 190)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Text("Daybook").font(Salon.display(20)).foregroundStyle(Salon.bone)
                    Spacer()
                    Button { model.open("/shutdown") } label: {
                        Text("Shut down").font(Salon.text(11.5, .medium)).foregroundStyle(Salon.bone)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(.black.opacity(0.35)))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                Text(model.isShowingToday ? (model.locale == "es" ? "Hoy" : "Today") : Dates.format(model.shownDate, "EEEE", locale: model.locale))
                    .font(Salon.display(40))
                    .foregroundStyle(Salon.bone)
                HStack(alignment: .firstTextBaseline) {
                    Text(Dates.format(model.shownDate, "EEEE, MMMM d", locale: model.locale).uppercased())
                        .font(Salon.label()).tracking(1.4).foregroundStyle(Salon.bone.opacity(0.85))
                    Spacer()
                    if let art = model.session?.art {
                        Text("\(art.title) · \(art.artist)")
                            .font(Salon.italic(13)).foregroundStyle(Salon.bone.opacity(0.85)).lineLimit(1)
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
            .frame(width: 380, height: 190, alignment: .topLeading)
        }
    }
}

// MARK: - Focus

struct FocusField: View {
    @Bindable var model: DaybookModel
    @State private var draft = ""
    @FocusState private var editing: Bool

    var body: some View {
        TextField(model.locale == "es" ? "¿Qué haría de hoy un buen día?" : "What would make today a good day?", text: $draft, axis: .vertical)
            .textFieldStyle(.plain)
            .font(Salon.italic(23))
            .foregroundStyle(Salon.ink)
            .focused($editing)
            .lineLimit(1 ... 3)
            .onSubmit { commit() }
            .onChange(of: editing) { _, now in if !now { commit() } }
            .onChange(of: model.shownDay?.focus, initial: true) { _, focus in if !editing { draft = focus ?? "" } }
    }

    private func commit() {
        let value = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        Task { await model.setFocus(value) }
    }
}

// MARK: - Schedule (meetings from Frame Dashboard's calendars)

struct Schedule: View {
    @Bindable var model: DaybookModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHead(title: model.locale == "es" ? "Agenda" : "Schedule", trailing: "\(model.events.count)")
            ForEach(model.events) { e in
                let live = e.start.map { $0 <= model.now } == true && e.end.map { $0 > model.now } == true
                HStack(spacing: 12) {
                    Text(e.allDay ? "All day" : Dates.time(e.start, model.timeZone))
                        .font(Salon.text(12.5)).monospacedDigit()
                        .foregroundStyle(live ? Salon.cobalt : Salon.ink2)
                        .frame(width: 44, alignment: .leading)
                    Text(e.title).font(Salon.text(13.5)).foregroundStyle(Salon.ink).lineLimit(1)
                    Spacer(minLength: 0)
                    if live { Text("NOW").font(Salon.label()).tracking(1).foregroundStyle(Salon.cobalt) }
                }
                .padding(.vertical, 6)
                Divider().overlay(Salon.rule)
            }
        }
    }
}

// MARK: - To-dos

struct Tasks: View {
    @Bindable var model: DaybookModel
    @State private var newTask = ""

    var body: some View {
        let day = model.shownDay
        VStack(alignment: .leading, spacing: 0) {
            SectionHead(
                title: model.locale == "es" ? "Por hacer" : "To do",
                trailing: day.map { "\(minutesLabel($0.planned)) of \(minutesLabel($0.capacity)) · \($0.doneCount)/\($0.tasks.count)" },
                trailingColor: (day?.over ?? 0) > 0 ? Salon.amber : Salon.ink2
            )
            if let day {
                LoadBar(day: day).padding(.bottom, 2)
                ForEach(day.tasks) { task in
                    VStack(spacing: 0) {
                        TaskRow(model: model, task: task)
                        Divider().overlay(Salon.rule)
                    }
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .offset(y: -6)),
                        removal: .opacity.combined(with: .offset(x: 24))
                    ))
                }
            }
            HStack(spacing: 12) {
                Text("+").font(Salon.text(16)).foregroundStyle(Salon.cobalt).frame(width: 16)
                TextField(model.locale == "es" ? "Agregar · “Deck 45m #cliente”" : "Add a task · “Draft deck 45m #client”", text: $newTask)
                    .textFieldStyle(.plain)
                    .font(Salon.text(13.5))
                    .foregroundStyle(Salon.ink)
                    .onSubmit {
                        let text = newTask
                        newTask = ""
                        Task { await model.add(text) }
                    }
            }
            .padding(.vertical, 8)
        }
        .animation(.spring(duration: 0.45, bounce: 0.2), value: day?.tasks)
    }
}

struct LoadBar: View {
    let day: DBDay

    var body: some View {
        GeometryReader { geo in
            let done = day.tasks.filter(\.done).reduce(0) { $0 + ($1.estimate ?? 0) }
            let w = { (m: Int) in geo.size.width * min(1, CGFloat(m) / CGFloat(max(day.capacity, 1))) }
            HStack(spacing: 0) {
                Rectangle().fill(day.over > 0 ? Salon.amber : Salon.cobalt).frame(width: w(done))
                Rectangle().fill((day.over > 0 ? Salon.amber : Salon.cobalt).opacity(0.35)).frame(width: w(day.planned - done))
                Spacer(minLength: 0)
            }
        }
        .frame(height: 3)
        .background(Salon.rule)
        .animation(.smooth(duration: 0.9), value: day.tasks)
    }
}

struct TaskRow: View {
    @Bindable var model: DaybookModel
    let task: DBTask
    @State private var hover = false

    var body: some View {
        HStack(spacing: 12) {
            Button { Task { await model.toggle(task) } } label: {
                ZStack {
                    Circle().strokeBorder(task.done ? Salon.done : Salon.ink, lineWidth: 1.4)
                    Circle().fill(Salon.done)
                        .scaleEffect(task.done ? 1 : 0.2)
                        .opacity(task.done ? 1 : 0)
                    Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)).foregroundStyle(Salon.paper)
                        .scaleEffect(task.done ? 1 : 0.4)
                        .opacity(task.done ? 1 : 0)
                        .symbolEffect(.bounce, value: task.done)
                }
                .frame(width: 16, height: 16)
                .scaleEffect(hover ? 1.1 : 1)
                .animation(.spring(duration: 0.4, bounce: 0.45), value: task.done)
                .animation(.smooth(duration: 0.2), value: hover)
                // A ring is only its outline to hit-testing (the fill is
                // invisible until done): make the whole circle and a margin
                // around it clickable.
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(task.done ? "Mark not done" : "Mark done")
            // A tick on a Force Touch trackpad as a task is done.
            .sensoryFeedback(.levelChange, trigger: task.done) { _, done in done }

            Text(task.title)
                .font(Salon.text(14))
                .foregroundStyle(task.done ? Salon.done : Salon.ink)
                .lineLimit(1)
                .help(task.title)
                // A line sweeps through the words when it's done.
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Rectangle().fill(Salon.done)
                            .frame(width: task.done ? g.size.width : 0, height: 1)
                            .offset(y: g.size.height * 0.55)
                    }
                }
                .animation(.easeOut(duration: 0.45), value: task.done)
            Spacer(minLength: 6)
            // Hovering swaps the tag for "Tomorrow", which grows in from the right.
            Group {
                if hover && !task.done {
                    Button("Tomorrow") { Task { await model.moveToTomorrow(task) } }
                        .buttonStyle(PillStyle(small: true))
                        .transition(.opacity.combined(with: .scale(scale: 0.85, anchor: .trailing)))
                } else if let key = task.source?.key {
                    Text(key).font(Salon.label()).tracking(0.6).foregroundStyle(Salon.cobalt)
                        .transition(.opacity)
                } else if let tag = task.tag {
                    Text(tag.uppercased()).font(Salon.label()).tracking(1.2).foregroundStyle(Salon.ink2).lineLimit(1)
                        .transition(.opacity)
                }
            }
            .animation(.snappy(duration: 0.22), value: hover)
            Text(task.estimate.map(minutesLabel) ?? "")
                .font(Salon.text(12.5)).monospacedDigit()
                .foregroundStyle(task.done ? Salon.done : Salon.ink)
                .frame(width: 42, alignment: .trailing)
        }
        .padding(.vertical, 7)
        .contentShape(Rectangle())
        .onHover { hover = $0 }
    }
}

// MARK: - Week strip

struct WeekStrip: View {
    @Bindable var model: DaybookModel
    @Namespace private var selection

    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Salon.ink).frame(height: 1).padding(.bottom, 10)
            HStack(spacing: 0) {
                ForEach(Array((model.week?.days ?? []).enumerated()), id: \.element.id) { index, day in
                    let selected = day.date == model.shownDate
                    Button { Task { await model.select(day.date) } } label: {
                        VStack(spacing: 2) {
                            Text(Dates.format(day.date, "EEE", locale: model.locale).uppercased())
                                .font(Salon.label()).tracking(1.2)
                                .foregroundStyle(day.isToday ? Salon.cobalt : Salon.ink2)
                            Text(String(Int(day.date.suffix(2)) ?? 0))
                                .font(Salon.display(22))
                                .foregroundStyle(Salon.ink)
                                .overlay(alignment: .bottom) {
                                    if selected {
                                        Rectangle().fill(Salon.cobalt).frame(height: 1.5).offset(y: 2)
                                            .matchedGeometryEffect(id: "selected", in: selection)
                                    }
                                }
                            Text(day.planned > 0 ? minutesLabel(day.planned).replacingOccurrences(of: " ", with: "") : "–")
                                .font(Salon.text(10))
                                .foregroundStyle(day.over > 0 ? Salon.amber : (day.isToday ? Salon.cobalt : Salon.ink2))
                        }
                        .frame(maxWidth: .infinity)
                        .opacity(index >= 5 ? 0.6 : 1)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .animation(.spring(duration: 0.45, bounce: 0.25), value: model.shownDate)
        }
    }
}

// MARK: - Buttons

struct PillStyle: ButtonStyle {
    var solid = false
    var small = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Salon.text(small ? 11 : 12, .medium))
            .foregroundStyle(solid ? Salon.paper : Salon.ink)
            .padding(.horizontal, small ? 8 : 12)
            .padding(.vertical, small ? 3 : 6)
            .background(Capsule().fill(solid ? Salon.ink : .clear))
            .overlay(Capsule().strokeBorder(Salon.ink, lineWidth: solid ? 0 : 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

private struct DayHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}
