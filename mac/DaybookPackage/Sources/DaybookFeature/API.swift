import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Daybook rejected the key. Check it in Settings."
        case let .server(code, message): "Daybook answered \(code): \(message)"
        }
    }
}

/// Asks Daybook on this Mac (DeviceEngine): a method, a path with its query, a JSON body.
typealias DeviceSend = @Sendable (_ method: String, _ path: String, _ body: Data?) async throws -> (status: Int, data: Data)

/// Talks to a Daybook server with DAYBOOK_KEY as a bearer token, or to Daybook
/// on this Mac, which answers the same routes the same way.
struct DaybookAPI: Sendable {
    let baseURL: URL
    let key: String
    var device: DeviceSend?

    init(baseURL: URL, key: String) {
        self.baseURL = baseURL
        self.key = key
    }

    init(device: @escaping DeviceSend) {
        baseURL = DeviceScheme.home
        key = ""
        self.device = device
    }

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = ISO8601.withFraction.date(from: s) ?? ISO8601.plain.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "bad date \(s)"))
        }
        return d
    }()

    private func request(_ path: String, query: [URLQueryItem] = [], method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
        var comps = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        let json = try body.map { try JSONSerialization.data(withJSONObject: $0) }
        let data: Data
        let code: Int
        if let device {
            (code, data) = try await device(method, "/" + path + (comps.percentEncodedQuery.map { "?" + $0 } ?? ""), json)
        } else {
            var req = URLRequest(url: comps.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
            req.httpMethod = method
            if !key.isEmpty { req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization") }
            if let json {
                req.httpBody = json
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            }
            let (read, response) = try await URLSession.shared.data(for: req)
            data = read
            code = (response as? HTTPURLResponse)?.statusCode ?? 0
        }
        if code == 401 { throw APIError.unauthorized }
        guard (200 ..< 300).contains(code) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "no details"
            throw APIError.server(code, message)
        }
        return data
    }

    func session() async throws -> DBSession {
        try Self.decoder.decode(DBSession.self, from: try await request("api/session"))
    }

    func week(containing date: String? = nil) async throws -> DBWeek {
        let q = date.map { [URLQueryItem(name: "date", value: $0)] } ?? []
        return try Self.decoder.decode(DBWeek.self, from: try await request("api/week", query: q))
    }

    /// Quick-add syntax works: "Draft deck 45m #client".
    func add(_ text: String, date: String) async throws {
        _ = try await request("api/tasks", method: "POST", body: ["text": text, "date": date])
    }

    func setDone(_ id: String, _ done: Bool) async throws {
        _ = try await request("api/tasks/\(id)", method: "PATCH", body: ["done": done])
    }

    /// nil moves the task to the backlog; "tomorrow" and YYYY-MM-DD work too.
    func move(_ id: String, to date: String?) async throws {
        _ = try await request("api/tasks/\(id)", method: "PATCH", body: ["date": date ?? NSNull()])
    }

    /// A task's place on a day (1 is first), as drag and drop saves it.
    func arrange(_ id: String, date: String, order: Int) async throws {
        _ = try await request("api/tasks/\(id)", method: "PATCH", body: ["date": date, "order": order])
    }

    func setFocus(_ focus: String, date: String) async throws {
        _ = try await request("api/day", method: "PUT", body: ["date": date, "focus": focus])
    }

    func frameSettings() async throws -> FrameSettings {
        try Self.decoder.decode(FrameSettings.self, from: try await request("api/frame/settings"))
    }

    func setFrameDesign(_ layout: String) async throws -> FrameSettings {
        try Self.decoder.decode(FrameSettings.self, from: try await request("api/frame/settings", method: "PUT", body: ["layout": layout]))
    }

    /// Every task, day and week, as one Daybook export (lib/backup.ts).
    func export() async throws -> Data {
        try await request("api/export")
    }

    /// Brings an export in, merged by id (owner only: the DAYBOOK_KEY, not a token).
    func importBackup(_ backup: Data) async throws {
        let parsed = try JSONSerialization.jsonObject(with: backup)
        _ = try await request("api/import", method: "POST", body: ["backup": parsed])
    }

    func syncFrame() async throws -> FrameSyncResult {
        try Self.decoder.decode(FrameSyncResult.self, from: try await request("api/frame", method: "POST", body: [:]))
    }
}

enum ISO8601 {
    nonisolated(unsafe) static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    nonisolated(unsafe) static let plain = ISO8601DateFormatter()
}
