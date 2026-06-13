use crate::auth_token::load_token;
use crate::AppResult;
use reqwest::blocking::Client;
use reqwest::Method;
use serde_json::{json, Value};

pub(crate) fn require_token() -> AppResult<String> {
    load_token()?.ok_or_else(|| "로그인이 필요합니다".to_string())
}

pub(crate) fn github_client() -> AppResult<Client> {
    Client::builder()
        .user_agent("EasyGithub")
        .build()
        .map_err(|err| err.to_string())
}

pub(crate) fn github_request(method: Method, path: &str, body: Option<Value>) -> AppResult<Value> {
    let token = require_token()?;
    let url = format!("https://api.github.com{path}");
    let client = github_client()?;
    let mut request = client
        .request(method, url)
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");

    if let Some(payload) = body {
        request = request.json(&payload);
    }

    let response = request.send().map_err(|err| err.to_string())?;
    let status = response.status();
    let text = response.text().map_err(|err| err.to_string())?;

    if !status.is_success() {
        return Err(format!("GitHub API 오류: {status} {text}"));
    }

    if text.trim().is_empty() {
        return Ok(json!({}));
    }

    serde_json::from_str(&text).map_err(|err| err.to_string())
}
