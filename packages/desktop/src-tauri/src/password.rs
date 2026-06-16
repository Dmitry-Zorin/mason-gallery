use std::collections::HashMap;
use std::sync::Mutex;

/// In-memory password cache for the current session
pub struct PasswordCache {
    passwords: Mutex<HashMap<String, String>>,
}

impl PasswordCache {
    pub fn new() -> Self {
        Self {
            passwords: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, archive_path: &str) -> Option<String> {
        let map = self.passwords.lock().ok()?;
        map.get(archive_path).cloned()
    }

    pub fn set(&self, archive_path: &str, password: &str) {
        if let Ok(mut map) = self.passwords.lock() {
            map.insert(archive_path.to_string(), password.to_string());
        }
    }

    pub fn remove(&self, archive_path: &str) {
        if let Ok(mut map) = self.passwords.lock() {
            map.remove(archive_path);
        }
    }
}
