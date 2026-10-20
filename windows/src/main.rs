// Daybook for Windows: the Daybook pages on this PC (pnpm build:windows, the
// same static copy the Mac app ships), every request answered in the page
// (lib/localApi.ts), its days in WebView2's localStorage. The window hides to
// the tray when closed; Quit is in the tray's menu.

// No console window behind the app in a release build.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::DownloadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// The tray menu in the system's language, as the pages are (lib/i18n.ts).
struct Words {
    open: &'static str,
    quit: &'static str,
}

fn words() -> Words {
    let spanish = sys_locale::get_locale().is_some_and(|l| l.to_lowercase().starts_with("es"));
    if spanish {
        Words { open: "Abrir Daybook", quit: "Salir de Daybook" }
    } else {
        Words { open: "Open Daybook", quit: "Quit Daybook" }
    }
}

/// Brings the window back: from the tray, or when Daybook is opened again.
fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        // One Daybook: opening it again shows the window that's there.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show(app)))
        .setup(|app| {
            let downloads = app.path().download_dir().ok();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("/".into()))
                .title("Daybook")
                .inner_size(1280.0, 860.0)
                .min_inner_size(900.0, 600.0)
                .center()
                // The pages' origin is where their localStorage, so the days, live:
                // http://tauri.localhost. Never change it, or this PC's days stay behind.
                .use_https_scheme(false)
                // Export a copy (lib/backup.ts): straight into Downloads, as a browser does.
                .on_download(move |_, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        if let (Some(dir), Some(name)) = (&downloads, destination.file_name()) {
                            *destination = dir.join(name);
                        }
                    }
                    true
                })
                .build()?;

            let words = words();
            let open = MenuItem::with_id(app, "open", words.open, true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", words.quit, true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let mut tray = TrayIconBuilder::with_id("daybook")
                .tooltip("Daybook")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        // Closing the window keeps Daybook in the tray, as the Mac app keeps its menu bar.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Daybook couldn't start");
}
