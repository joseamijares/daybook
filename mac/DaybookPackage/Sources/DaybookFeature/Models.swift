import Foundation

// Mirrors the Daybook API (see ../../../../lib/daybook.ts and app/api/*).

public struct LinearSource: Codable, Hashable, Sendable {
    public var key: String
    public var url: String
}

public struct DBTask: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var date: String?
    public var estimate: Int?
    public var tag: String?
    public var done: Bool
    public var source: LinearSource? = nil
    public var rolledFrom: String? = nil
}

public struct DBDay: Codable, Hashable, Sendable, Identifiable {
    public var date: String
    public var focus: String?
    public var note: String?
    public var shutdownAt: String?
    public var isToday: Bool
    public var tasks: [DBTask]
    public var planned: Int
    public var remaining: Int
    public var doneCount: Int
    public var capacity: Int
    public var over: Int

    public var id: String { date }
    public var openCount: Int { tasks.filter { !$0.done }.count }
}

public struct DBEvent: Codable, Hashable, Sendable, Identifiable {
    public var title: String
    public var location: String?
    public var allDay: Bool
    public var date: String
    public var start: Date?
    public var end: Date?

    public var id: String { "\(title)|\(start?.timeIntervalSince1970 ?? 0)|\(date)" }
}

public struct DBWeek: Codable, Sendable {
    public var weekOf: String
    public var focus: String?
    public var today: String
    public var days: [DBDay]
    public var backlog: [DBTask]
    public var events: [String: [DBEvent]]?

    public func day(_ ymd: String) -> DBDay? { days.first { $0.date == ymd } }
}

public struct DBArt: Codable, Hashable, Sendable {
    public var title: String
    public var artist: String
    public var date: String
    public var image: String
    public var collection: String?
}

public struct DBSession: Codable, Sendable {
    /// False when that server has no cloud Daybook (no storage or no key): it can
    /// only be used in a browser, on that device. Missing from older servers.
    public var cloud: Bool?
    public var authorized: Bool
    public var needsKey: Bool
    public var locale: String
    public var today: String
    public var tz: String
    public var capacity: Int
    public var linear: Bool
    public var frame: Bool
    public var frameAutoSync: Bool?
    public var art: DBArt?
    public var linearSyncedAt: Date?
    public var frameSentAt: Date?
    public var appearance: DBAppearance?
    public var closedToday: Bool?
}

/// The design and palette chosen in Settings → Appearance.
public struct DBAppearance: Codable, Sendable, Equatable {
    public var style: String // wall, timetable, notebook
    public var palette: String // salon, modern, nocturne
    public var eveningNocturne: Bool
}

public struct FrameSyncResult: Codable, Sendable {
    public struct Pulled: Codable, Sendable {
        public var done: Int
        public var undone: Int
        public var added: Int
        public var removed: Int
        public var focus: Int
        public var total: Int { done + undone + added + removed + focus }
    }

    public var ok: Bool
    public var pulled: Pulled
    public var pushedDays: Int
}

/// Minutes as the web app shows them: 45m, 2h, 1h 30m.
public func minutesLabel(_ minutes: Int) -> String {
    guard minutes > 0 else { return "0m" }
    let h = minutes / 60, m = minutes % 60
    if h == 0 { return "\(m)m" }
    return m == 0 ? "\(h)h" : "\(h)h \(m)m"
}

public struct FrameDesign: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var description: String
}

public struct FrameSettings: Codable, Sendable {
    public var layout: String?
    public var layouts: [FrameDesign]
    public var supported: Bool
}
