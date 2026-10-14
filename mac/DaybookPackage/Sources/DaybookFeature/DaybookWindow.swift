import SwiftUI
import WebKit

/// The full Daybook (Today, Week, Backlog, Shut down) in a window: the web
/// app itself, so it always matches the server. The page's own key form signs
/// the window in once; WebKit keeps the session cookie after that.
public struct DaybookWindow: View {
    @Bindable var model: DaybookModel

    public init(model: DaybookModel) { self.model = model }

    public var body: some View {
        ZStack {
            Salon.wall.ignoresSafeArea()
            if model.isConfigured, let url = model.webURL(model.windowPath) {
                WebView(url: url, key: model.key)
                    .ignoresSafeArea() // the painting runs under the title bar
                    .transition(.opacity)
            } else {
                // Not connected yet: the welcome screen.
                OnboardingView(model: model)
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .top) {
            // Content fills the window, so give it a handle: drag here to move it,
            // double-click to zoom.
            WindowDragArea().frame(height: 40).ignoresSafeArea()
        }
        .animation(.smooth(duration: 0.8), value: model.isConfigured)
        .frame(minWidth: 900, minHeight: 640)
        .task { await model.refresh() }
    }
}

struct WebView: NSViewRepresentable {
    let url: URL
    let key: String

    func makeCoordinator() -> Coordinator { Coordinator(key: key) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator // JavaScript confirm()/alert() as sheets
        view.setValue(false, forKey: "drawsBackground")
        view.allowsBackForwardNavigationGestures = true
        view.alphaValue = 0 // fades up once the first page has painted
        view.load(URLRequest(url: url))
        context.coordinator.loaded = url
        context.coordinator.watch(view)
        return view
    }

    static func dismantleNSView(_ view: WKWebView, coordinator: Coordinator) {
        coordinator.stopWatching()
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        context.coordinator.key = key
        guard context.coordinator.loaded != url else { return }
        let previous = context.coordinator.loaded
        context.coordinator.loaded = url
        // Same Daybook: navigate inside the page so the painting crossfades
        // instead of the whole window reloading.
        if previous?.host == url.host, previous?.port == url.port {
            let path = url.path.isEmpty ? "/" : url.path
            let js = "(() => { const a = document.querySelector('nav a.link[href=\\'\(path)\\']'); if (a) { a.click(); return true } return false })()"
            view.evaluateJavaScript(js) { result, _ in
                if (result as? Bool) != true { view.load(URLRequest(url: url)) }
            }
        } else {
            view.load(URLRequest(url: url))
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var key: String
        var loaded: URL?
        private var triedSignIn = false
        private weak var webView: WKWebView?
        private var observers: [(NotificationCenter, NSObjectProtocol)] = []

        init(key: String) { self.key = key }

        /// The page's timers stop while the Mac sleeps, and a window that was
        /// already in front gets no focus event when it wakes, so the page
        /// would keep showing the day it went to sleep on. Tell it to re-read
        /// (its own focus listeners do the rest) when the Mac wakes, a moment
        /// later so the network is back, and whenever the app comes forward.
        func watch(_ view: WKWebView) {
            webView = view
            let wake = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    // Discarded and typed: as assumeIsolated's result, Xcode 26's compiler can't infer it.
                    _ = Task<Void, Never> { @MainActor [weak self] in
                        try? await Task.sleep(for: .seconds(2))
                        self?.comeBack()
                    }
                }
            }
            let active = NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.comeBack() }
            }
            observers = [(NSWorkspace.shared.notificationCenter, wake), (NotificationCenter.default, active)]
        }

        func stopWatching() {
            for (center, observer) in observers { center.removeObserver(observer) }
            observers = []
        }

        private func comeBack() {
            guard let webView, webView.url != nil else { return }
            webView.evaluateJavaScript("window.dispatchEvent(new Event('focus'))") { _, error in
                if error != nil { webView.reload() }
            }
        }

        // WebKit may end the page's process while the Mac sleeps; load it again
        // instead of leaving a blank (or frozen) window.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if webView.alphaValue < 1 {
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 1.2
                    ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 1, 0.36, 1)
                    webView.animator().alphaValue = 1
                }
            }
            // The key goes only to the Daybook set in Settings: never to a page a
            // redirect or a script took the window to.
            guard !triedSignIn, !key.isEmpty, let page = webView.url, let home = loaded,
                  page.scheme == home.scheme, page.host == home.host, page.port == home.port else { return }
            triedSignIn = true
            // Sign the page in with the saved key if it isn't already, then reload.
            // callAsyncJavaScript runs this as the body of an async function:
            // it has to `return` (and await) the result, or the window reloads
            // before the sign-in lands and shows the page's own key form.
            let js = """
            const s = await fetch('/api/session', { credentials: 'same-origin' }).then(r => r.json());
            if (s.authorized) return false;
            const r = await fetch('/api/session', { method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY }) });
            return r.ok;
            """
            let encoded = (try? String(data: JSONEncoder().encode(key), encoding: .utf8)) ?? "\"\""
            webView.callAsyncJavaScript(js.replacingOccurrences(of: "KEY", with: encoded), arguments: [:], in: nil, in: .page) { result in
                if case let .success(value) = result, (value as? Bool) == true { webView.reload() }
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.alphaValue = 1
        }

        // WebKit ignores confirm() and alert() unless the app shows them; without
        // this, every "Are you sure?" in the page silently answered no.
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor (Bool) -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Cancel")
            guard let window = webView.window else { return completionHandler(alert.runModal() == .alertFirstButtonReturn) }
            alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor () -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            guard let window = webView.window else { alert.runModal(); return completionHandler() }
            alert.beginSheetModal(for: window) { _ in completionHandler() }
        }

        // Links that leave Daybook (Linear issues, painting sources) open in the browser.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            if let target = action.request.url, let host = target.host, host != loaded?.host, action.navigationType == .linkActivated {
                NSWorkspace.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

/// An invisible strip that moves the window, like a title bar.
struct WindowDragArea: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { DragView() }
    func updateNSView(_ nsView: NSView, context: Context) {}

    final class DragView: NSView {
        override var mouseDownCanMoveWindow: Bool { true }

        override func mouseDown(with event: NSEvent) {
            if event.clickCount == 2 {
                window?.performZoom(nil)
            } else {
                window?.performDrag(with: event)
            }
        }
    }
}
