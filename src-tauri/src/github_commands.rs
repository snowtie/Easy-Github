use crate::github_api::github_request;
use crate::AppResult;
use reqwest::Method;
use serde_json::{json, Value};

#[tauri::command]
pub(crate) fn github_get_my_profile() -> AppResult<Value> {
    github_request(Method::GET, "/user", None)
}

#[tauri::command]
pub(crate) fn github_list_pulls(owner: String, repo: String) -> AppResult<Value> {
    github_request(
        Method::GET,
        &format!("/repos/{owner}/{repo}/pulls?state=all&per_page=100"),
        None,
    )
}

#[tauri::command]
pub(crate) fn github_review_pull(
    owner: String,
    repo: String,
    pull_number: usize,
    review_event: String,
    body: Option<String>,
) -> AppResult<Value> {
    github_request(
        Method::POST,
        &format!("/repos/{owner}/{repo}/pulls/{pull_number}/reviews"),
        Some(json!({ "event": review_event, "body": body.unwrap_or_default() })),
    )
}

#[tauri::command]
pub(crate) fn github_create_pull(
    owner: String,
    repo: String,
    title: String,
    body: String,
    head: String,
    base: String,
) -> AppResult<Value> {
    github_request(
        Method::POST,
        &format!("/repos/{owner}/{repo}/pulls"),
        Some(json!({ "title": title, "body": body, "head": head, "base": base })),
    )
}

#[tauri::command]
pub(crate) fn github_merge_pull(
    owner: String,
    repo: String,
    pull_number: usize,
) -> AppResult<Value> {
    github_request(
        Method::PUT,
        &format!("/repos/{owner}/{repo}/pulls/{pull_number}/merge"),
        None,
    )
}

#[tauri::command]
pub(crate) fn github_list_issues(owner: String, repo: String, state: String) -> AppResult<Value> {
    let value = github_request(
        Method::GET,
        &format!("/repos/{owner}/{repo}/issues?state={state}&per_page=100"),
        None,
    )?;
    if let Some(items) = value.as_array() {
        return Ok(Value::Array(
            items
                .iter()
                .filter(|item| item.get("pull_request").is_none())
                .cloned()
                .collect(),
        ));
    }
    Ok(value)
}

#[tauri::command]
pub(crate) fn github_create_issue(
    owner: String,
    repo: String,
    title: String,
    body: String,
) -> AppResult<Value> {
    github_request(
        Method::POST,
        &format!("/repos/{owner}/{repo}/issues"),
        Some(json!({ "title": title, "body": body })),
    )
}

#[tauri::command]
pub(crate) fn github_close_issue(
    owner: String,
    repo: String,
    issue_number: usize,
) -> AppResult<Value> {
    github_request(
        Method::PATCH,
        &format!("/repos/{owner}/{repo}/issues/{issue_number}"),
        Some(json!({ "state": "closed" })),
    )
}

#[tauri::command]
pub(crate) fn github_comment_issue(
    owner: String,
    repo: String,
    issue_number: usize,
    body: String,
) -> AppResult<Value> {
    github_request(
        Method::POST,
        &format!("/repos/{owner}/{repo}/issues/{issue_number}/comments"),
        Some(json!({ "body": body })),
    )
}

#[tauri::command]
pub(crate) fn github_list_repos() -> AppResult<Value> {
    github_request(Method::GET, "/user/repos?sort=updated&per_page=100", None)
}

#[tauri::command]
pub(crate) fn github_create_repo(
    name: String,
    description: String,
    is_private: bool,
) -> AppResult<Value> {
    github_request(
        Method::POST,
        "/user/repos",
        Some(json!({ "name": name, "description": description, "private": is_private })),
    )
}
