#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::{rngs::OsRng, RngCore};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, WebviewWindow};

const API_PORT: u16 = 43121;
const WEB_PORT: u16 = 43122;
const API_ORIGIN: &str = "http://127.0.0.1:43121";
const WEB_ORIGIN: &str = "http://127.0.0.1:43122";

type SharedChildren = Arc<Mutex<Vec<Child>>>;

fn electron_compatible_user_data_dir() -> io::Result<PathBuf> {
    // Match Electron's app.setName("Atlas") + app.getPath("userData") locations.
    // Do not use Tauri's identifier-derived app_data_dir: that would create a
    // second, empty profile after migration.
    #[cfg(target_os = "windows")]
    {
        let root = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "APPDATA is not set"))?;
        return Ok(root.join("Atlas"));
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
        return Ok(home
            .join("Library")
            .join("Application Support")
            .join("Atlas"));
    }

    #[cfg(target_os = "linux")]
    {
        let root = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::NotFound,
                    "Neither XDG_CONFIG_HOME nor HOME is set",
                )
            })?;
        return Ok(root.join("Atlas"));
    }
}

fn persisted_secret(user_data: &Path) -> io::Result<String> {
    fs::create_dir_all(user_data)?;
    let secret_path = user_data.join("instance.secret");
    if let Ok(existing) = fs::read_to_string(&secret_path) {
        let existing = existing.trim().to_owned();
        if existing.len() >= 48 {
            return Ok(existing);
        }
    }

    let mut bytes = [0_u8; 48];
    OsRng.fill_bytes(&mut bytes);
    let secret = bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    fs::write(&secret_path, &secret)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&secret_path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(secret)
}

fn runtime_path(resource_dir: &Path, filename: &str) -> PathBuf {
    let bundled = resource_dir.join("runtime").join(filename);
    if bundled.exists() {
        return bundled;
    }

    // CI prototype artifacts place the executable and runtime directory side by
    // side. Packaged Tauri bundles resolve resources through resource_dir().
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            let adjacent = parent.join("runtime").join(filename);
            if adjacent.exists() {
                return adjacent;
            }
        }
    }

    bundled
}

fn open_child_log(user_data: &Path, filename: &str) -> io::Result<fs::File> {
    let log_dir = user_data.join("logs");
    fs::create_dir_all(&log_dir)?;
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(filename))
}

#[cfg(windows)]
fn configure_hidden_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_hidden_console(_command: &mut Command) {}

fn spawn_api(resource_dir: &Path, user_data: &Path, secret: &str) -> io::Result<Child> {
    let executable = runtime_path(
        resource_dir,
        if cfg!(windows) {
            "atlas-api.exe"
        } else {
            "atlas-api"
        },
    );
    let log = open_child_log(user_data, "api.log")?;
    let mut command = Command::new(&executable);
    command
        .env("ATLAS_USER_DATA_DIR", user_data)
        .env("ATLAS_API_PORT", API_PORT.to_string())
        .env("JWT_SECRET", secret)
        .env("FRONTEND_ORIGIN", WEB_ORIGIN)
        .env("CORS_ORIGINS", WEB_ORIGIN)
        .env("ENVIRONMENT", "development")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log));
    configure_hidden_console(&mut command);
    command.spawn().map_err(|error| {
        io::Error::new(
            error.kind(),
            format!(
                "Failed to start API sidecar at {}: {error}",
                executable.display()
            ),
        )
    })
}

fn spawn_frontend(resource_dir: &Path, user_data: &Path) -> io::Result<Child> {
    let node = runtime_path(
        resource_dir,
        if cfg!(windows) { "node.exe" } else { "node" },
    );
    let frontend_dir = runtime_path(resource_dir, "frontend");

    // Resolve the bundled paths before handing them to a child process. This
    // avoids drive-relative paths (for example, "D:") on Windows and makes
    // missing/corrupt bundle resources fail with a useful diagnostic.
    let node = fs::canonicalize(&node).map_err(|error| {
        io::Error::new(
            error.kind(),
            format!("Could not resolve bundled Node executable {}: {error}", node.display()),
        )
    })?;
    let frontend_dir = fs::canonicalize(&frontend_dir).map_err(|error| {
        io::Error::new(
            error.kind(),
            format!(
                "Could not resolve bundled frontend directory {}: {error}",
                frontend_dir.display()
            ),
        )
    })?;
    let server = frontend_dir.join("server.js");
    if !server.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Bundled Next.js server entrypoint is missing: {}", server.display()),
        ));
    }

    let mut diagnostics = open_child_log(user_data, "desktop.log")?;
    writeln!(diagnostics, "[Atlas Tauri] frontend launch")?;
    writeln!(diagnostics, "  node={}", node.display())?;
    writeln!(diagnostics, "  frontend_dir={}", frontend_dir.display())?;
    writeln!(diagnostics, "  server={}", server.display())?;
    writeln!(diagnostics, "  server_is_file={}", server.is_file())?;
    if let Ok(cwd) = std::env::current_dir() {
        writeln!(diagnostics, "  desktop_cwd={}", cwd.display())?;
    }

    let log = open_child_log(user_data, "frontend.log")?;
    let mut command = Command::new(&node);
    command
        // Use eval as the entrypoint so Node does not try to realpath the
        // Windows drive-relative main argument before executing the script.
        // Requiring the script from the canonical working directory preserves
        // Next.js standalone's expected relative asset resolution.
        .arg("-e")
        .arg("console.log('[Atlas frontend] cwd=' + process.cwd()); require('./server.js');")
        .current_dir(&frontend_dir)
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", WEB_PORT.to_string())
        .env("NEXT_PUBLIC_API_URL", format!("{API_ORIGIN}/api/v1"))
        .env("NODE_ENV", "production")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log));
    configure_hidden_console(&mut command);
    command.spawn().map_err(|error| {
        io::Error::new(
            error.kind(),
            format!(
                "Failed to start frontend: node={}, server={}, cwd={}: {error}",
                node.display(),
                server.display(),
                frontend_dir.display()
            ),
        )
    })
}

fn wait_for_health(
    url: &'static str,
    timeout: Duration,
    children: &SharedChildren,
    child_index: usize,
) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        {
            let mut running = children
                .lock()
                .map_err(|_| "service process lock poisoned".to_owned())?;
            let child = running
                .get_mut(child_index)
                .ok_or_else(|| format!("service process for {url} is unavailable"))?;
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(format!(
                        "service for {url} exited before becoming healthy ({status})"
                    ));
                }
                Ok(None) => {}
                Err(error) => {
                    return Err(format!("could not inspect service for {url}: {error}"));
                }
            }
        }

        if ureq::get(url)
            .timeout(Duration::from_millis(700))
            .call()
            .is_ok()
        {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(250));
    }
    Err(format!(
        "{url} did not become healthy within {} seconds",
        timeout.as_secs()
    ))
}

fn stop_children(children: &SharedChildren) {
    if let Ok(mut children) = children.lock() {
        for child in children.iter_mut().rev() {
            // Do not signal an already-reaped process: its PID may have been
            // reused by an unrelated process.
            if child.try_wait().ok().flatten().is_none() {
                #[cfg(unix)]
                {
                    // Give Uvicorn/Node a chance to flush and close cleanly.
                    // Fall back to Child::kill below if graceful shutdown stalls.
                    unsafe {
                        libc::kill(child.id() as i32, libc::SIGTERM);
                    }
                    let deadline = Instant::now() + Duration::from_secs(4);
                    while Instant::now() < deadline {
                        match child.try_wait() {
                            Ok(Some(_)) => break,
                            Ok(None) => thread::sleep(Duration::from_millis(100)),
                            Err(_) => break,
                        }
                    }
                }
            }
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
        children.clear();
    }
}

fn show_startup_failure(window: &WebviewWindow, error: &str, user_data: Option<&Path>) {
    let message = format!("[Atlas Tauri] Startup failed: {error}");
    eprintln!("{message}");
    if let Some(user_data) = user_data {
        if let Ok(mut log) = open_child_log(user_data, "desktop.log") {
            let _ = writeln!(log, "{message}");
        }
    }
    let _ = window.set_title("Atlas — Startup failed");
    // The bundled shell remains visible so the user never gets a hidden or
    // permanently blank window. Detailed startup errors are appended to desktop.log.
    if let Err(show_error) = window.show() {
        eprintln!("[Atlas Tauri] Could not show startup failure: {show_error}");
    }
}

fn load_frontend_when_ready(
    window: WebviewWindow,
    api_result: Result<(), String>,
    web_result: Result<(), String>,
    user_data: PathBuf,
) {
    if let Err(error) = api_result.and(web_result) {
        show_startup_failure(&window, &error, Some(&user_data));
        return;
    }
    if let Err(error) = window.navigate(WEB_ORIGIN.parse().expect("valid local frontend URL")) {
        show_startup_failure(
            &window,
            &format!("could not open frontend: {error}"),
            Some(&user_data),
        );
        return;
    }
    if let Err(error) = window.show() {
        eprintln!("[Atlas Tauri] Could not show application window: {error}");
    }
}

fn main() {
    let children: SharedChildren = Arc::new(Mutex::new(Vec::new()));
    let shutdown_children = Arc::clone(&children);

    let app = tauri::Builder::default()
        .setup(move |app| {
            let window = app
                .get_webview_window("main")
                .expect("main window configured");
            // Keep the local startup shell visible while the sidecars boot. If a
            // service fails, the user can still see the failure state and log hint.
            let resource_dir = match app.path().resource_dir() {
                Ok(path) => path,
                Err(error) => {
                    show_startup_failure(
                        &window,
                        &format!("could not locate bundled resources: {error}"),
                        None,
                    );
                    return Ok(());
                }
            };
            let user_data = match electron_compatible_user_data_dir() {
                Ok(path) => path,
                Err(error) => {
                    show_startup_failure(
                        &window,
                        &format!("could not resolve Atlas user data: {error}"),
                        None,
                    );
                    return Ok(());
                }
            };
            let startup_started = Instant::now();
            let secret = match persisted_secret(&user_data) {
                Ok(secret) => secret,
                Err(error) => {
                    show_startup_failure(
                        &window,
                        &format!("could not read or create the installation secret: {error}"),
                        Some(&user_data),
                    );
                    return Ok(());
                }
            };

            // Spawn both local services immediately; neither waits for the other.
            let api = match spawn_api(&resource_dir, &user_data, &secret) {
                Ok(child) => child,
                Err(error) => {
                    show_startup_failure(&window, &error.to_string(), Some(&user_data));
                    return Ok(());
                }
            };
            eprintln!(
                "[Atlas Tauri startup] API process spawned: {}ms",
                startup_started.elapsed().as_millis()
            );
            let frontend = match spawn_frontend(&resource_dir, &user_data) {
                Ok(child) => child,
                Err(error) => {
                    let mut api = api;
                    let _ = api.kill();
                    let _ = api.wait();
                    show_startup_failure(&window, &error.to_string(), Some(&user_data));
                    return Ok(());
                }
            };
            eprintln!(
                "[Atlas Tauri startup] frontend process spawned: {}ms",
                startup_started.elapsed().as_millis()
            );
            {
                let mut running = match children.lock() {
                    Ok(running) => running,
                    Err(_) => {
                        let mut api = api;
                        let mut frontend = frontend;
                        let _ = frontend.kill();
                        let _ = frontend.wait();
                        let _ = api.kill();
                        let _ = api.wait();
                        show_startup_failure(
                            &window,
                            "the service process manager could not be initialized",
                            Some(&user_data),
                        );
                        return Ok(());
                    }
                };
                running.push(api);
                running.push(frontend);
            }

            let startup_window = window.clone();
            let startup_user_data = user_data.clone();
            let app_handle = app.handle().clone();
            let startup_children = Arc::clone(&children);
            thread::spawn(move || {
                let api_children = Arc::clone(&startup_children);
                let frontend_children = Arc::clone(&startup_children);
                let api_probe = thread::spawn(move || {
                    wait_for_health(
                        "http://127.0.0.1:43121/health",
                        Duration::from_secs(45),
                        &api_children,
                        0,
                    )
                });
                let frontend_probe = thread::spawn(move || {
                    wait_for_health(
                        "http://127.0.0.1:43122",
                        Duration::from_secs(45),
                        &frontend_children,
                        1,
                    )
                });
                let api_ready = api_probe
                    .join()
                    .unwrap_or_else(|_| Err("API health check thread panicked".into()));
                eprintln!(
                    "[Atlas Tauri startup] API health result at {}ms",
                    startup_started.elapsed().as_millis()
                );
                let frontend_ready = frontend_probe
                    .join()
                    .unwrap_or_else(|_| Err("frontend health check thread panicked".into()));
                eprintln!(
                    "[Atlas Tauri startup] both health checks completed at {}ms",
                    startup_started.elapsed().as_millis()
                );
                if api_ready.is_err() || frontend_ready.is_err() {
                    stop_children(&startup_children);
                }
                let _ = app_handle.run_on_main_thread(move || {
                    load_frontend_when_ready(
                        startup_window,
                        api_ready,
                        frontend_ready,
                        startup_user_data,
                    );
                    eprintln!("[Atlas Tauri startup] frontend navigation requested");
                });
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Atlas Tauri shell");

    app.run(move |_handle, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            stop_children(&shutdown_children);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn instance_secret_is_persisted_and_reused() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after Unix epoch")
            .as_nanos();
        let user_data = std::env::temp_dir().join(format!(
            "atlas-tauri-secret-test-{}-{unique}",
            std::process::id()
        ));

        let first = persisted_secret(&user_data).expect("first secret should be created");
        let second = persisted_secret(&user_data).expect("existing secret should be reused");

        assert_eq!(first, second);
        assert_eq!(first.len(), 96);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));

        fs::remove_dir_all(user_data).expect("test directory should be removable");
    }

    #[test]
    fn runtime_resources_are_resolved_under_runtime_directory() {
        let path = runtime_path(Path::new("/opt/atlas"), "atlas-api");
        assert_eq!(path, Path::new("/opt/atlas/runtime/atlas-api"));
    }

    #[cfg(unix)]
    #[test]
    fn health_check_reports_a_sidecar_exit_without_waiting_for_timeout() {
        let child = Command::new("sh")
            .args(["-c", "exit 7"])
            .spawn()
            .expect("test sidecar should start");
        let children = Arc::new(Mutex::new(vec![child]));
        let started = Instant::now();

        let error = wait_for_health("http://127.0.0.1:1", Duration::from_secs(10), &children, 0)
            .expect_err("an exited sidecar must not pass its health check");

        assert!(error.contains("exited before becoming healthy"));
        assert!(started.elapsed() < Duration::from_secs(3));
        stop_children(&children);
    }

    #[cfg(windows)]
    #[test]
    fn health_check_reports_a_sidecar_exit_without_waiting_for_timeout() {
        let child = Command::new("cmd")
            .args(["/C", "exit", "7"])
            .spawn()
            .expect("test sidecar should start");
        let children = Arc::new(Mutex::new(vec![child]));
        let started = Instant::now();

        let error = wait_for_health("http://127.0.0.1:1", Duration::from_secs(10), &children, 0)
            .expect_err("an exited sidecar must not pass its health check");

        assert!(error.contains("exited before becoming healthy"));
        assert!(started.elapsed() < Duration::from_secs(3));
        stop_children(&children);
    }

    #[test]
    fn user_data_directory_keeps_electron_application_name() {
        let path =
            electron_compatible_user_data_dir().expect("platform user-data path should resolve");
        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some("Atlas")
        );
    }
}
