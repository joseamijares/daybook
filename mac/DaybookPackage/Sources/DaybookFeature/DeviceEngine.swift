import Foundation
import WebKit

/// Daybook on this Mac, for the menu bar: the same pages the window shows
/// (DeviceScheme), loaded out of sight, answer the popover's requests with
/// the same routes and JSON as a Daybook server (window.daybookDevice,
/// components/client.tsx). Both read and write the one localStorage, so an
/// edit in either shows in the other on its next read.
@MainActor
final class DeviceEngine: NSObject, WKNavigationDelegate {
    enum Failure: LocalizedError {
        case notBuilt, noAnswer

        var errorDescription: String? {
            switch self {
            case .notBuilt: "This build of Daybook has no pages. Run mac/scripts/build-web.sh and build it again."
            case .noAnswer: "Daybook on this Mac didn’t answer. Open the window and try again."
            }
        }
    }

    private var view: WKWebView?
    private var loading: Task<Void, Error>?

    /// One request, answered as app/api would: its status and its JSON.
    func send(_ method: String, _ path: String, _ body: Data?) async throws -> (status: Int, data: Data) {
        try await ready()
        guard let view else { throw Failure.noAnswer }
        let reply = try await view.callAsyncJavaScript(
            "return await window.daybookDevice(method, path, body === null ? undefined : JSON.parse(body))",
            arguments: ["method": method, "path": path, "body": body.flatMap { String(data: $0, encoding: .utf8) } ?? NSNull()],
            contentWorld: .page
        )
        guard let text = reply as? String, let object = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
              let status = object["status"] as? Int else { throw Failure.noAnswer }
        let data = try JSONSerialization.data(withJSONObject: object["data"] ?? [:], options: .fragmentsAllowed)
        return (status, data)
    }

    /// Loads the pages once, and waits until they can answer.
    private func ready() async throws {
        guard DeviceScheme.isBuilt else { throw Failure.notBuilt }
        if let loading { return try await loading.value }
        let view = WKWebView(frame: .init(x: 0, y: 0, width: 800, height: 600), configuration: DeviceScheme.configuration())
        view.navigationDelegate = self
        self.view = view
        let task = Task<Void, Error> { @MainActor in
            view.load(URLRequest(url: DeviceScheme.home))
            // The page's scripts set window.daybookDevice as they start.
            for _ in 0 ..< 100 {
                if (try? await view.evaluateJavaScript("typeof window.daybookDevice === 'function'")) as? Bool == true { return }
                try await Task.sleep(for: .milliseconds(100))
            }
            throw Failure.noAnswer
        }
        loading = task
        do {
            try await task.value
        } catch {
            reset()
            throw error
        }
    }

    private func reset() {
        loading = nil
        view?.navigationDelegate = nil
        view = nil
    }

    // WebKit may end the page's process (the Mac slept, memory ran low): load it again next time.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        reset()
    }
}
