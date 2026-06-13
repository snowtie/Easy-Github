use crate::AppResult;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn app_data_dir() -> AppResult<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| "앱 데이터 폴더를 확인할 수 없습니다".to_string())?;
    let dir = base.join("EasyGithub");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

pub(crate) fn read_json_file(path: &Path, fallback: Value) -> Value {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or(fallback),
        Err(_) => fallback,
    }
}

pub(crate) fn write_json_file(path: &Path, value: &Value) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(value).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

pub(crate) fn store_path(name: &str) -> AppResult<PathBuf> {
    Ok(app_data_dir()?.join(format!("{name}.json")))
}
