use crate::auth_token::{clear_token, load_token, save_token};
use crate::github_api::{github_client, github_request};
use crate::AppResult;
use reqwest::Method;
use serde_json::{json, Value};

#[tauri::command]
pub(crate) fn auth_get_token_status() -> AppResult<Value> {
    Ok(json!({ "authenticated": load_token()?.is_some() }))
}

#[tauri::command]
pub(crate) fn auth_logout() -> AppResult<()> {
    clear_token()
}

#[tauri::command]
pub(crate) fn auth_get_user() -> AppResult<Value> {
    if load_token()?.is_none() {
        return Ok(Value::Null);
    }
    github_request(Method::GET, "/user", None)
}

#[tauri::command]
pub(crate) fn auth_set_token(token: String) -> AppResult<Value> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err(
            "토큰이 비어있습니다. GitHub Personal Access Token을 입력해주세요.".to_string(),
        );
    }

    let client = github_client()?;
    let response = client
        .get("https://api.github.com/user")
        .bearer_auth(trimmed)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|_| {
            "토큰 검증 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.".to_string()
        })?;

    if response.status().as_u16() == 401 {
        return Err("토큰 인증에 실패했습니다. 토큰이 유효한지 확인해주세요.".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("토큰 검증에 실패했습니다: {}", response.status()));
    }

    let user = response.json::<Value>().map_err(|err| err.to_string())?;
    save_token(trimmed)?;
    Ok(user)
}
