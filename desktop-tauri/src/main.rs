#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::{rngs::OsRng, RngCore};
use std::{
    fs, io,
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
    fs::OpenOptions::new().create(true).append(true).open(log_dir.join(filename))
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
    let executable = runtime_path(resource_dir, if cfg!(windows) { "atlas-api.exe" } else { "atlas-api" });
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
    command.spawn().map_err(|error| io::Error::new(
        error.kind(),
        format!("Failed to start API sidecar at {}: {error}", executable.display()),
    ))
}

fn spawn_frontend(resource_dir: &Path, user_data: &Path) -> io::Result<Child> {
    let node = runtime_path(resource_dir, if cfg!(windows) { "node.exe" } else { "node" });
    let frontend_dir = runtime_path(resource_dir, "frontend");
    let server = frontend_dir.join("server.js");
    let log = open_child_log(user_data, "frontend.log")?;
    let mut command = Command::new(&node);
    command
        .arg(&server)
        // Next.js resolves .next relative to its working directory.
        .current_dir(&frontend_dir)
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", WEB_PORT.to_string())
        .env("NEXT_PUBLIC_API_URL", format!("{API_ORIGIN}/api/v1"))
        .env("NODE_ENV", "production")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log));
    configure_hidden_console(&mut command);
    command.spawn().map_err(|error| io::Error::new(
        error.kind(),
        format!(
            "Failed to start frontend: node={}, server={}, cwd={}: {error}",
            node.display(), server.display(), frontend_dir.display()
        ),
    ))
}

fn wait_for_health(url: &'static str, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
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
            #[cfg(unix)]
            {
                // Give Uvicorn/Node a chance to flush and close cleanly.
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
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
        children.clear();
    }
}

fn load_frontend_when_ready(
    window: WebviewWindow,
    api_result: Result<(), String>,
    web_result: Result<(), String>,
) {
    if let Err(error) = api_result.and(web_result) {
        eprintln!("[Atlas Tauri] Startup failed: {error}");
        return;
    }
    if let Err(error) = window.navigate(WEB_ORIGIN.parse().expect("valid local frontend URL")) {
        eprintln!("[Atlas Tauri] Could not open frontend: {error}");
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
            let resource_dir = app.path().resource_dir()?;
            let user_data = electron_compatible_user_data_dir()?;
            let startup_started = Instant::now();
            let secret = persisted_secret(&user_data)?;

            // Spawn both local services immediately; neither waits for the other.
            let api = spawn_api(&resource_dir, &user_data, &secret)?;
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
                    return Err(error.into());
                }
            };
            eprintln!(
                "[Atlas Tauri startup] frontend process spawned: {}ms",
                startup_started.elapsed().as_millis()
            );
            {
                let mut running = children
                    .lock()
                    .map_err(|_| io::Error::other("service process lock poisoned"))?;
                running.push(api);
                running.push(frontend);
            }

            let startup_window = window.clone();
            let app_handle = app.handle().clone();
            let startup_children = Arc::clone(&children);
            thread::spawn(move || {
                let api_probe = thread::spawn(|| {
                    wait_for_health("http://127.0.0.1:43121/health", Duration::from_secs(45))
                });
                let frontend_probe = thread::spawn(|| {
                    wait_for_health("http://127.0.0.1:43122", Duration::from_secs(45))
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
                    load_frontend_when_ready(startup_window, api_ready, frontend_ready);
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
