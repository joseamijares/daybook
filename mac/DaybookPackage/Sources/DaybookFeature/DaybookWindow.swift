import SwiftUI
import WebKit

/// The full Daybook (Today, Week, Backlog, Shut down) in a window: the web
/// app itself, so it always matches the server. The page's own key form signs
/// the window in once; WebKit keeps the session cookie after that. The page
/// also learns the app's version and updates, for its Settings screen.
public struct DaybookWindow: View {
    @Bindable var model: DaybookModel
    /// The launch scene plays over the window once per launch while the app checks
    /// its key and the page signs in; a Mac with no key saved goes straight to setup.
    @State private var scene: Bool
    /// The page has signed in and painted (components/mac.ts "ready"), or gave up.
    @State private var pageReady = false

    public init(model: DaybookModel) {
        self.model = model
        _scene = State(initialValue: !LaunchScene.hasPlayed && model.hasKey)
    }

    public var body: some View {
        ZStack {
            Salon.wall.ignoresSafeArea()
            if model.isConfigured, let url = model.webURL(model.windowPath) {
                WebView(url: url, key: model.key, mac: macState, check: { model.updates?.check() }, ready: { pageReady = true })
                    .ignoresSafeArea() // the painting runs under the title bar
                    .transition(.opacity)
            } else if !model.isChecking {
                // Not connected yet: the welcome screen. Never while the saved key is
                // still being checked, or it flashes by before the app opens.
                OnboardingView(model: model)
                    .transition(.opacity)
            }
        }
        .overlay {
            if scene {
                // Ready when the page says so, or when the key turned out not to open
                // the Daybook (the welcome screen is underneath).
                LaunchScene(ready: pageReady || (!model.isConfigured && !model.isChecking)) {
                    withAnimation(LaunchScene.gallery(0.6)) { scene = false }
                }
                .transition(.opacity.combined(with: .scale(scale: 1.03)))
                .onAppear { LaunchScene.hasPlayed = true }
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

    /// Read here, so the page hears when a check finds an update. Nothing for a
    /// build that doesn't update itself.
    private var macState: MacState? {
        guard let updates = model.updates, updates.isEnabled else { return nil }
        return MacState(version: updates.version, available: updates.available, canCheck: updates.canCheck)
    }
}

/// What the page knows about the app: window.daybookMac (components/mac.ts).
struct MacState: Equatable, Encodable {
    var version: String
    var available: String?
    var canCheck: Bool
}

struct WebView: NSViewRepresentable {
    let url: URL
    let key: String
    var mac: MacState?
    var check: () -> Void = {}
    var ready: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(key: key) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "daybookMac")
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator // JavaScript confirm()/alert() as sheets
        view.setValue(false, forKey: "drawsBackground")
        view.allowsBackForwardNavigationGestures = true
        view.alphaValue = 0 // fades up once the first page has painted
        context.coordinator.check = check
        context.coordinator.ready = ready
        context.coordinator.tell(view, mac: mac, home: url)
        view.load(URLRequest(url: url))
        context.coordinator.loaded = url
        context.coordinator.watch(view)
        return view
    }

    static func dismantleNSView(_ view: WKWebView, coordinator: Coordinator) {
        coordinator.stopWatching()
        view.configuration.userContentController.removeScriptMessageHandler(forName: "daybookMac")
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        context.coordinator.key = key
        context.coordinator.check = check
        context.coordinator.ready = ready
        context.coordinator.tell(view, mac: mac, home: url)
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
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var key: String
        var loaded: URL?
        var check: () -> Void = {}
        var ready: () -> Void = {}
        /// The page in view said it's ready ("ready" from components/mac.ts) before the window showed it.
        private var saidReady = false
        private var shown = false
        private var told: (mac: MacState?, origin: String?)?
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

        /// The port, with the scheme's default filled in (https://x and https://x:443 are one origin).
        private static func port(_ url: URL) -> Int? {
            url.port ?? defaultPort(url.scheme)
        }

        private static func defaultPort(_ scheme: String?) -> Int? {
            scheme == "https" ? 443 : scheme == "http" ? 80 : nil
        }

        /// The Daybook's origin as the page writes it (location.origin): no default port.
        private static func origin(_ url: URL) -> String? {
            guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
            let port = url.port.flatMap { $0 == defaultPort(scheme) ? nil : $0 }
            return "\(scheme)://\(host)" + (port.map { ":\($0)" } ?? "")
        }

        /// Sets window.daybookMac on the Daybook's own pages (as each one starts
        /// loading, and on the one showing now) and fires "daybookmac", so its
        /// Settings can show the version and Update. Nothing for other sites.
        func tell(_ view: WKWebView, mac: MacState?, home: URL) {
            let origin = Self.origin(home)
            if let told, told.mac == mac, told.origin == origin { return }
            told = (mac, origin)
            let content = view.configuration.userContentController
            content.removeAllUserScripts()
            guard let origin else { return }
            let state = mac.flatMap { try? String(data: JSONEncoder().encode($0), encoding: .utf8) } ?? "undefined"
            let quoted = (try? String(data: JSONEncoder().encode(origin), encoding: .utf8)) ?? "\"\""
            let js = """
            (() => {
              if (location.origin !== \(quoted)) return;
              window.daybookMac = \(state);
              window.dispatchEvent(new Event('daybookmac'));
            })();
            """
            content.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            if view.url != nil { view.evaluateJavaScript(js) }
        }

        /// The page's Update and Check now, "ready" once it has signed in and
        /// painted, and "haptic" as a dragged task lifts, finds a new place and
        /// lands (components/mac.ts). Only the Daybook's own page in the main
        /// frame can ask, and only for the update window, the launch scene or a
        /// tick on the trackpad.
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "daybookMac", message.frameInfo.isMainFrame, let home = loaded,
                  let body = message.body as? [String: Any], let action = body["action"] as? String,
                  ["check", "install", "ready", "haptic"].contains(action) else { return }
            let from = message.frameInfo.securityOrigin
            let fromPort = from.port == 0 ? Self.defaultPort(from.protocol) : from.port
            guard from.protocol == home.scheme, from.host.lowercased() == home.host?.lowercased(), fromPort == Self.port(home) else { return }
            switch action {
            case "haptic":
                Self.feel(body["kind"] as? String)
            case "ready":
                // A page the window hasn't shown yet (the one before the sign-in) can't end the scene.
                if shown { ready() } else { saidReady = true }
            default:
                check()
            }
        }

        /// A tick under the finger on a Force Touch trackpad (nothing with a mouse).
        private static func feel(_ kind: String?) {
            let pattern: NSHapticFeedbackManager.FeedbackPattern = switch kind {
            case "alignment": .alignment
            case "levelChange": .levelChange
            default: .generic
            }
            NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .now)
        }

        /// A new page: what the last one said about being ready no longer counts.
        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            saidReady = false
        }

        // WebKit may end the page's process while the Mac sleeps; load it again
        // instead of leaving a blank (or frozen) window.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // The key goes only to the Daybook set in Settings: never to a page a
            // redirect or a script took the window to.
            guard !triedSignIn, !key.isEmpty, let page = webView.url, let home = loaded,
                  page.scheme == home.scheme, page.host == home.host, Self.port(page) == Self.port(home) else {
                return show(webView)
            }
            triedSignIn = true
            // Sign the page in with the saved key before the window shows it, so
            // the page's own key screen never flashes by. callAsyncJavaScript runs
            // this as the body of an async function: it has to `return` (and
            // await) the result, or the window moves on before the sign-in lands.
            // This window opens a cloud Daybook, so the page never keeps its days
            // "on this device" here.
            let js = """
            const local = localStorage.getItem('daybook.mode') === 'local';
            const s = await fetch('/api/session', { credentials: 'same-origin' }).then(r => r.json());
            if (!s.authorized) {
              const r = await fetch('/api/session', { method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY }) });
              if (!r.ok) return 'failed';
            }
            localStorage.setItem('daybook.mode', 'cloud');
            return s.authorized && !local ? 'in' : 'signed';
            """
            let encoded = (try? String(data: JSONEncoder().encode(key), encoding: .utf8)) ?? "\"\""
            webView.callAsyncJavaScript(js.replacingOccurrences(of: "KEY", with: encoded), arguments: [:], in: nil, in: .page) { [weak self] result in
                switch result {
                case .success(let value as String) where value == "signed":
                    webView.reload() // still hidden; it shows when the signed-in page has loaded
                case .success(let value as String) where value == "failed":
                    // The saved key didn't open it: show the page's key form, open.
                    var parts = URLComponents(url: home, resolvingAgainstBaseURL: false)
                    parts?.queryItems = [URLQueryItem(name: "own", value: nil)]
                    if let own = parts?.url { webView.load(URLRequest(url: own)) } else { self?.show(webView) }
                default:
                    self?.show(webView)
                }
            }
        }

        /// Fades the page up the first time it's ready to be seen.
        private func show(_ webView: WKWebView) {
            shown = true
            if saidReady {
                ready()
            } else {
                // A Daybook from before "ready" never says it: give its page a moment to paint.
                Task { @MainActor [weak self] in
                    try? await Task.sleep(for: .seconds(0.8))
                    self?.ready()
                }
            }
            guard webView.alphaValue < 1 else { return }
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 1.2
                ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 1, 0.36, 1)
                webView.animator().alphaValue = 1
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.alphaValue = 1
            shown = true
            ready() // no page to wait for
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
