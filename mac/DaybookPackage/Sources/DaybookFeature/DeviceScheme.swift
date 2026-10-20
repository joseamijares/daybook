import Foundation
import UniformTypeIdentifiers
import WebKit

/// The Mac app's own copy of the Daybook pages (Web/, built by
/// mac/scripts/build-web.sh), served as daybook://app/. Nothing behind them:
/// every request the page makes is answered in the page itself, on this Mac
/// (lib/localApi.ts), and WebKit keeps its localStorage for that origin.
@MainActor
final class DeviceScheme: NSObject, WKURLSchemeHandler {
    static let shared = DeviceScheme()
    nonisolated static let scheme = "daybook"
    nonisolated static let home = URL(string: "daybook://app/")!

    /// Where the pages are in the app, if this build has them.
    nonisolated static let root: URL? = Bundle.module.url(forResource: "Web", withExtension: nil)

    nonisolated static var isBuilt: Bool {
        root.map { FileManager.default.fileExists(atPath: $0.appending(path: "index.html").path) } ?? false
    }

    /// A page's address: daybook://app/week.
    nonisolated static func url(_ path: String) -> URL {
        URL(string: "daybook://app" + (path.hasPrefix("/") ? path : "/" + path)) ?? home
    }

    /// A file of the pages on disk (the painting of the day, for the menu bar).
    nonisolated static func file(_ path: String) -> URL? {
        guard let root, let found = resolve(path, in: root), found.status == 200 else { return nil }
        return found.file
    }

    /// The window and the menu bar's page both load the pages through this.
    static func configuration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(shared, forURLScheme: scheme)
        return config
    }

    /// The file a request is answered with: the file itself (scripts, the .txt
    /// a navigation asks for, paintings), or the page (/week is week.html), or
    /// 404.html. Never anything outside the pages.
    nonisolated static func resolve(_ path: String, in root: URL) -> (file: URL, status: Int)? {
        let clean = (path.removingPercentEncoding ?? path).split(separator: "/").map(String.init)
        guard !clean.contains(where: { $0 == ".." || $0 == "." }) else { return nil }
        let base = root.standardizedFileURL
        var isDir: ObjCBool = false
        let exists = { (url: URL) in FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) && !isDir.boolValue }
        let joined = clean.reduce(base) { $0.appending(path: $1) }
        if clean.isEmpty { return (base.appending(path: "index.html"), 200) }
        if exists(joined) { return (joined, 200) }
        let page = joined.deletingLastPathComponent().appending(path: joined.lastPathComponent + ".html")
        if exists(page) { return (page, 200) }
        let index = joined.appending(path: "index.html")
        if exists(index) { return (index, 200) }
        let missing = base.appending(path: "404.html")
        return exists(missing) ? (missing, 404) : nil
    }

    nonisolated static func mimeType(_ file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": "text/html"
        case "txt": "text/plain" // a navigation's payload (output: export reads it as text/plain)
        case "js": "text/javascript"
        case "css": "text/css"
        case "json": "application/json"
        case "webp": "image/webp"
        case "woff2": "font/woff2"
        case "svg": "image/svg+xml"
        default: UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        let data: Data
        var status = 200
        var type = "text/html"
        if let root = Self.root, Self.isBuilt {
            guard let found = Self.resolve(url.path, in: root), let read = try? Data(contentsOf: found.file) else {
                return task.didFailWithError(URLError(.fileDoesNotExist))
            }
            data = read
            status = found.status
            type = Self.mimeType(found.file)
        } else {
            // A build from Xcode without the pages: say how to get them.
            data = Data("""
            <!doctype html><meta charset="utf-8"><body style="font:16px -apple-system;padding:64px;background:#efe8da;color:#1d1f1c">
            <h1>No pages in this build</h1><p>Run <code>mac/scripts/build-web.sh</code>, then build the app again.</p>
            """.utf8)
        }
        let headers = ["Content-Type": type.hasPrefix("text/") ? "\(type); charset=utf-8" : type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            return task.didFailWithError(URLError(.cannotParseResponse))
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}
