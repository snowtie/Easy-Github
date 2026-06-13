use crate::auth_token::{clear_token, load_token, save_token};
use crate::github_api::{github_client, github_request};
use crate::AppResult;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::thread::sleep;
use std::time::{Duration, Instant};

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_OAUTH_CLIENT_ID: Option<&str> = option_env!("EASYGITHUB_GITHUB_OAUTH_CLIENT_ID");

#[derive(Deserialize)]
struct GitHubDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Serialize)]
pub(crate) struct BrowserLoginStart {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct GitHubAccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

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

#[tauri::command]
pub(crate) fn auth_start_browser_login() -> AppResult<BrowserLoginStart> {
    let client_id = GITHUB_OAUTH_CLIENT_ID.ok_or_else(|| {
        "사이트 로그인을 사용하려면 EASYGITHUB_GITHUB_OAUTH_CLIENT_ID로 GitHub OAuth App Client ID를 빌드에 넣어야 합니다.".to_string()
    })?;

    let client = github_client()?;
    let response = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id),
            ("scope", "repo read:user user:email"),
        ])
        .send()
        .map_err(|_| "GitHub 사이트 로그인 시작 중 네트워크 오류가 발생했습니다.".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub 사이트 로그인 시작에 실패했습니다: {}",
            response.status()
        ));
    }

    let code = response
        .json::<GitHubDeviceCodeResponse>()
        .map_err(|err| err.to_string())?;

    Ok(BrowserLoginStart {
        device_code: code.device_code,
        user_code: code.user_code,
        verification_uri: code.verification_uri,
        expires_in: code.expires_in,
        interval: code.interval.unwrap_or(5).max(1),
    })
}

#[tauri::command]
pub(crate) fn auth_complete_browser_login(
    device_code: String,
    interval: u64,
    expires_in: u64,
) -> AppResult<Value> {
    let client_id = GITHUB_OAUTH_CLIENT_ID.ok_or_else(|| {
        "사이트 로그인을 사용하려면 EASYGITHUB_GITHUB_OAUTH_CLIENT_ID로 GitHub OAuth App Client ID를 빌드에 넣어야 합니다.".to_string()
    })?;
    let trimmed_code = device_code.trim();
    if trimmed_code.is_empty() {
        return Err("사이트 로그인 코드가 비어있습니다.".to_string());
    }

    let client = github_client()?;
    let deadline = Instant::now() + Duration::from_secs(expires_in.max(1));
    let mut poll_interval = Duration::from_secs(interval.max(1));

    loop {
        if Instant::now() >= deadline {
            return Err("사이트 로그인 시간이 만료되었습니다. 다시 시도해주세요.".to_string());
        }

        let response = client
            .post(GITHUB_ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", client_id),
                ("device_code", trimmed_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .map_err(|_| {
                "GitHub 사이트 로그인 확인 중 네트워크 오류가 발생했습니다.".to_string()
            })?;

        if !response.status().is_success() {
            return Err(format!(
                "GitHub 사이트 로그인 확인에 실패했습니다: {}",
                response.status()
            ));
        }

        let token_response = response
            .json::<GitHubAccessTokenResponse>()
            .map_err(|err| err.to_string())?;

        if let Some(access_token) = token_response.access_token.as_deref() {
            return auth_set_token(access_token.to_string());
        }

        match token_response.error.as_deref() {
            Some("authorization_pending") => {
                sleep(poll_interval);
            }
            Some("slow_down") => {
                poll_interval += Duration::from_secs(5);
                sleep(poll_interval);
            }
            Some("expired_token") => {
                return Err("사이트 로그인 코드가 만료되었습니다. 다시 시도해주세요.".to_string());
            }
            Some("access_denied") => {
                return Err("GitHub 사이트 로그인이 취소되었습니다.".to_string());
            }
            Some(_) => {
                return Err(token_response
                    .error_description
                    .unwrap_or_else(|| "GitHub 사이트 로그인에 실패했습니다.".to_string()));
            }
            None => {
                return Err("GitHub 사이트 로그인 응답에 토큰이 없습니다.".to_string());
            }
        }
    }
}
