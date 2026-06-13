use crate::storage::{read_json_file, store_path};
use crate::AppResult;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "EasyGithub";
const GITHUB_TOKEN_ACCOUNT: &str = "github-access-token";

fn token_path() -> AppResult<PathBuf> {
    store_path("auth")
}

fn github_token_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, GITHUB_TOKEN_ACCOUNT).map_err(|err| err.to_string())
}

fn load_legacy_token() -> AppResult<Option<String>> {
    let value = read_json_file(&token_path()?, json!({}));
    Ok(value
        .get("accessToken")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|token| !token.trim().is_empty()))
}

fn remove_legacy_token_file() -> AppResult<()> {
    let path = token_path()?;
    if path.exists() {
        fs::remove_file(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub(crate) fn load_token() -> AppResult<Option<String>> {
    match github_token_entry()?.get_password() {
        Ok(token) if !token.trim().is_empty() => Ok(Some(token)),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            let legacy_token = load_legacy_token()?;
            if let Some(token) = legacy_token.as_deref() {
                save_token(token)?;
            }
            remove_legacy_token_file()?;
            Ok(legacy_token)
        }
        Err(err) => Err(err.to_string()),
    }
}

pub(crate) fn save_token(token: &str) -> AppResult<()> {
    github_token_entry()?
        .set_password(token)
        .map_err(|err| err.to_string())?;
    remove_legacy_token_file()
}

pub(crate) fn clear_token() -> AppResult<()> {
    match github_token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(err) => return Err(err.to_string()),
    }
    remove_legacy_token_file()
}
