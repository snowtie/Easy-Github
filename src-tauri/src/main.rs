use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::process::Command;
use walkdir::WalkDir;

mod auth_commands;
mod auth_token;
mod github_api;
mod github_commands;
mod storage;
mod store_commands;

type AppResult<T> = Result<T, String>;

#[derive(Debug, Deserialize, Serialize, Clone)]
struct AuthorOverride {
    name: String,
    email: String,
}

#[derive(Debug, Deserialize, Default)]
struct DeleteBranchOptions {
    force: Option<bool>,
    remote: Option<bool>,
}

#[derive(Debug, Serialize)]
struct GitStatusSummary {
    modified: usize,
    staged: usize,
    untracked: usize,
    deleted: usize,
    conflicted: usize,
    ahead: usize,
    behind: usize,
    current: String,
}

#[derive(Debug, Serialize)]
struct GitFileChange {
    path: String,
    #[serde(rename = "type")]
    change_type: String,
    additions: usize,
    deletions: usize,
    staged: bool,
}

#[derive(Debug, Serialize)]
struct GitBranchInfo {
    name: String,
    current: bool,
    protected: bool,
    remote: bool,
}

#[derive(Debug, Serialize)]
struct GitBranchList {
    current: String,
    all: Vec<GitBranchInfo>,
}

#[derive(Debug, Serialize)]
struct GitInstallationStatus {
    installed: bool,
    version: Option<String>,
    error: Option<String>,
}

fn ensure_git_installed() -> AppResult<()> {
    match Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => Err(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        Err(_) => Err("Git이 설치되어 있지 않거나 PATH에 등록되어 있지 않습니다".to_string()),
    }
}

fn run_git(args: &[&str], cwd: Option<&str>) -> AppResult<String> {
    ensure_git_installed()?;
    let mut command = Command::new("git");
    command.args(args);
    if let Some(path) = cwd {
        command.current_dir(path);
    }

    let output = command.output().map_err(|err| err.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Err(if !stderr.is_empty() { stderr } else { stdout })
}

fn parse_status(repo_path: &str) -> AppResult<GitStatusSummary> {
    let output = run_git(&["status", "--porcelain=v1", "--branch"], Some(repo_path))?;
    let mut current = String::new();
    let mut ahead = 0usize;
    let mut behind = 0usize;
    let mut modified = 0usize;
    let mut staged = 0usize;
    let mut untracked = 0usize;
    let mut deleted = 0usize;
    let mut conflicted = 0usize;

    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            let branch_part = rest.split("...").next().unwrap_or(rest);
            current = branch_part
                .split(' ')
                .next()
                .unwrap_or(branch_part)
                .to_string();
            if let Some(meta) = rest
                .split('[')
                .nth(1)
                .and_then(|part| part.split(']').next())
            {
                for item in meta.split(',') {
                    let trimmed = item.trim();
                    if let Some(value) = trimmed.strip_prefix("ahead ") {
                        ahead = value.parse().unwrap_or(0);
                    }
                    if let Some(value) = trimmed.strip_prefix("behind ") {
                        behind = value.parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let status = &line[0..2];
        let index = status.chars().next().unwrap_or(' ');
        let worktree = status.chars().nth(1).unwrap_or(' ');

        if status == "??" {
            untracked += 1;
            continue;
        }
        if matches!(status, "UU" | "AA" | "DD" | "AU" | "UA" | "DU" | "UD") {
            conflicted += 1;
        }
        if index != ' ' {
            staged += 1;
        }
        if index == 'D' || worktree == 'D' {
            deleted += 1;
        } else if worktree != ' ' || index == 'M' || index == 'A' {
            modified += 1;
        }
    }

    if current.is_empty() {
        current = run_git(&["branch", "--show-current"], Some(repo_path))?
            .trim()
            .to_string();
    }

    Ok(GitStatusSummary {
        modified,
        staged,
        untracked,
        deleted,
        conflicted,
        ahead,
        behind,
        current,
    })
}

fn parse_status_files(repo_path: &str) -> AppResult<Vec<(String, String, bool)>> {
    let output = run_git(&["status", "--porcelain=v1"], Some(repo_path))?;
    let mut files = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }

        let status = &line[0..2];
        let raw_path = line[3..].trim();
        let file_path = raw_path
            .split(" -> ")
            .last()
            .unwrap_or(raw_path)
            .to_string();
        let index = status.chars().next().unwrap_or(' ');
        let worktree = status.chars().nth(1).unwrap_or(' ');
        let staged = index != ' ' && index != '?';
        let change_type = if status == "??" {
            "untracked"
        } else if index == 'D' || worktree == 'D' {
            "deleted"
        } else if index == 'A' {
            "added"
        } else {
            "modified"
        };

        files.push((file_path, change_type.to_string(), staged));
    }

    Ok(files)
}

fn diff_stats(repo_path: &str) -> HashMap<String, (usize, usize)> {
    let mut stats = HashMap::new();
    for args in [
        ["diff", "--numstat"].as_slice(),
        ["diff", "--cached", "--numstat"].as_slice(),
    ] {
        if let Ok(output) = run_git(args, Some(repo_path)) {
            for line in output.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() < 3 {
                    continue;
                }
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let entry = stats.entry(parts[2].to_string()).or_insert((0, 0));
                entry.0 += additions;
                entry.1 += deletions;
            }
        }
    }
    stats
}

fn copy_directory_preserve(source: &Path, target: &Path) -> AppResult<()> {
    for entry in WalkDir::new(source) {
        let entry = entry.map_err(|err| err.to_string())?;
        let relative = entry
            .path()
            .strip_prefix(source)
            .map_err(|err| err.to_string())?;
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target_path = target.join(relative);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path).map_err(|err| err.to_string())?;
            continue;
        }

        if target_path.exists() {
            continue;
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        fs::copy(entry.path(), target_path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn normalize_todo_key(value: &str) -> String {
    value.trim().to_lowercase().replace([' ', '_', '-'], "")
}

fn extract_todo_tasks(content: &str) -> Vec<Value> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            let rest = trimmed
                .strip_prefix("- [")
                .or_else(|| trimmed.strip_prefix("* ["))?;
            let marker = rest.chars().next()?;
            let text = rest.get(2..)?.trim();
            if text.is_empty() {
                return None;
            }
            Some(json!({
                "checked": marker == 'x' || marker == 'X',
                "text": text.replace(" + 완료", "")
            }))
        })
        .collect()
}

fn ensure_todo_file_extension(path: &Path) -> AppResult<()> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if matches!(extension.as_str(), "md" | "markdown" | "txt") {
        Ok(())
    } else {
        Err("TODO 파일은 md, markdown, txt 형식만 사용할 수 있습니다".to_string())
    }
}

fn canonical_todos_dir(repo_path: &str) -> AppResult<std::path::PathBuf> {
    let repo = Path::new(repo_path)
        .canonicalize()
        .map_err(|err| err.to_string())?;
    let todos_dir = repo.join("todos");
    fs::create_dir_all(&todos_dir).map_err(|err| err.to_string())?;
    todos_dir.canonicalize().map_err(|err| err.to_string())
}

fn validate_todo_target(
    repo_path: &str,
    file_path: &str,
    require_existing: bool,
) -> AppResult<std::path::PathBuf> {
    let todos_dir = canonical_todos_dir(repo_path)?;
    let target = Path::new(file_path);
    ensure_todo_file_extension(target)?;

    let normalized_target = if require_existing {
        target.canonicalize().map_err(|err| err.to_string())?
    } else {
        let parent = target.parent().unwrap_or(&todos_dir);
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        let normalized_parent = parent.canonicalize().map_err(|err| err.to_string())?;
        let file_name = target
            .file_name()
            .ok_or_else(|| "TODO 파일 경로가 올바르지 않습니다".to_string())?;
        normalized_parent.join(file_name)
    };

    if !normalized_target.starts_with(&todos_dir) {
        return Err("TODO 파일 경로가 올바르지 않습니다".to_string());
    }

    Ok(normalized_target)
}

#[tauri::command]
fn app_get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn git_check_installed() -> GitInstallationStatus {
    match Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => GitInstallationStatus {
            installed: true,
            version: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            error: None,
        },
        Ok(output) => GitInstallationStatus {
            installed: false,
            version: None,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(err) => GitInstallationStatus {
            installed: false,
            version: None,
            error: Some(err.to_string()),
        },
    }
}

#[tauri::command]
fn git_clone(repo_url: String, target_path: String, mode: Option<String>) -> AppResult<()> {
    let repo_url = repo_url.trim();
    let target_path = target_path.trim();
    if repo_url.is_empty() {
        return Err("저장소 URL을 입력해주세요".to_string());
    }
    if target_path.is_empty() {
        return Err("저장할 폴더 경로를 입력해주세요".to_string());
    }

    fs::create_dir_all(target_path).map_err(|err| err.to_string())?;
    let mode = mode.unwrap_or_else(|| "overwrite".to_string());

    if mode == "preserve" {
        let temp = tempfile::tempdir().map_err(|err| err.to_string())?;
        let temp_path = temp.path().to_string_lossy().to_string();
        run_git(&["clone", repo_url, &temp_path], None)?;
        copy_directory_preserve(temp.path(), Path::new(target_path))?;
        return Ok(());
    }

    let is_empty = fs::read_dir(target_path)
        .map_err(|err| err.to_string())?
        .next()
        .is_none();
    if !is_empty {
        return Err("저장 경로가 비어있지 않습니다. 빈 폴더를 선택해주세요.".to_string());
    }
    run_git(&["clone", repo_url, target_path], None).map(|_| ())
}

#[tauri::command]
fn git_status(repo_path: String) -> AppResult<GitStatusSummary> {
    parse_status(&repo_path)
}

#[tauri::command]
fn git_fetch(repo_path: String) -> AppResult<()> {
    run_git(&["fetch", "--all", "--prune"], Some(&repo_path)).map(|_| ())
}

#[tauri::command]
fn git_pull(repo_path: String) -> AppResult<Value> {
    let output = run_git(&["pull"], Some(&repo_path))?;
    Ok(json!({ "output": output }))
}

#[tauri::command]
fn git_push(repo_path: String) -> AppResult<Value> {
    match run_git(&["push"], Some(&repo_path)) {
        Ok(output) => Ok(json!({ "output": output })),
        Err(err) if err.contains("has no upstream branch") => {
            let branch = run_git(&["branch", "--show-current"], Some(&repo_path))?
                .trim()
                .to_string();
            let output = run_git(&["push", "-u", "origin", &branch], Some(&repo_path))?;
            Ok(json!({ "output": output }))
        }
        Err(err) => Err(err),
    }
}

#[tauri::command]
fn git_changes(repo_path: String) -> AppResult<Vec<GitFileChange>> {
    let stats = diff_stats(&repo_path);
    Ok(parse_status_files(&repo_path)?
        .into_iter()
        .map(|(path, change_type, staged)| {
            let (additions, deletions) = stats.get(&path).cloned().unwrap_or((0, 0));
            GitFileChange {
                path,
                change_type,
                additions,
                deletions,
                staged,
            }
        })
        .collect())
}

#[tauri::command]
fn git_stage(repo_path: String, files: Vec<String>) -> AppResult<()> {
    let mut args = vec!["add", "--"];
    let refs: Vec<&str> = files.iter().map(String::as_str).collect();
    args.extend(refs);
    run_git(&args, Some(&repo_path)).map(|_| ())
}

#[tauri::command]
fn git_unstage(repo_path: String, files: Vec<String>) -> AppResult<()> {
    let mut args = vec!["reset", "--"];
    let refs: Vec<&str> = files.iter().map(String::as_str).collect();
    args.extend(refs);
    run_git(&args, Some(&repo_path)).map(|_| ())
}

#[tauri::command]
fn git_commit(
    repo_path: String,
    message: String,
    author: Option<AuthorOverride>,
) -> AppResult<Value> {
    if message.trim().is_empty() {
        return Err("커밋 메시지를 입력해주세요".to_string());
    }

    let mut args = vec!["commit", "-m", message.as_str()];
    let author_arg;
    if let Some(author) = author {
        author_arg = format!("{} <{}>", author.name.trim(), author.email.trim());
        args.push("--author");
        args.push(author_arg.as_str());
    }

    let output = run_git(&args, Some(&repo_path))?;
    Ok(json!({ "output": output }))
}

#[tauri::command]
fn git_log(repo_path: String, max_count: usize) -> AppResult<Value> {
    let count_arg = format!("--max-count={}", max_count.max(1));
    let output = run_git(
        &[
            "log",
            count_arg.as_str(),
            "--date=iso",
            "--pretty=format:%H%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%b%x1e",
        ],
        Some(&repo_path),
    )?;
    let items: Vec<Value> = output
        .split('\u{1e}')
        .filter_map(|record| {
            let fields: Vec<&str> = record.trim().split('\u{1f}').collect();
            if fields.len() < 5 {
                return None;
            }
            Some(json!({
                "hash": fields[0],
                "author_name": fields[1],
                "author_email": fields[2],
                "date": fields[3],
                "message": fields[4],
                "body": fields.get(5).copied().unwrap_or("")
            }))
        })
        .collect();
    Ok(json!({ "all": items }))
}

#[tauri::command]
fn git_graph_log(repo_path: String, max_count: usize) -> AppResult<Vec<Value>> {
    let count_arg = format!("--max-count={}", max_count.max(1));
    let output = run_git(
        &[
            "log",
            "--date=iso",
            count_arg.as_str(),
            "--pretty=%H|%P|%an|%ae|%ad|%s|%D",
        ],
        Some(&repo_path),
    )?;
    Ok(output
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split('|').collect();
            if fields.len() < 6 {
                return None;
            }
            Some(json!({
                "hash": fields[0],
                "parents": fields[1].split(' ').filter(|v| !v.is_empty()).collect::<Vec<&str>>(),
                "authorName": fields[2],
                "authorEmail": fields[3],
                "date": fields[4],
                "message": fields[5],
                "refs": fields.get(6).copied().unwrap_or("").split(',').map(str::trim).filter(|v| !v.is_empty()).collect::<Vec<&str>>()
            }))
        })
        .collect())
}

#[tauri::command]
fn git_diff(repo_path: String, file_path: Option<String>) -> AppResult<String> {
    if let Some(file_path) = file_path.filter(|path| !path.trim().is_empty()) {
        return run_git(&["diff", "--", file_path.as_str()], Some(&repo_path));
    }
    run_git(&["diff"], Some(&repo_path))
}

#[tauri::command]
fn git_branches(repo_path: String) -> AppResult<GitBranchList> {
    let current = run_git(&["branch", "--show-current"], Some(&repo_path))?
        .trim()
        .to_string();
    let output = run_git(&["branch", "-a"], Some(&repo_path))?;
    let mut seen = HashSet::new();
    let mut all = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim().trim_start_matches("* ").trim();
        if trimmed.is_empty() || trimmed.contains("->") {
            continue;
        }
        let remote = trimmed.starts_with("remotes/");
        let name = if remote {
            trimmed.trim_start_matches("remotes/").to_string()
        } else {
            trimmed.to_string()
        };
        if !seen.insert(name.clone()) {
            continue;
        }
        let base = name.trim_start_matches("origin/");
        all.push(GitBranchInfo {
            current: name == current,
            protected: matches!(base, "main" | "master" | "develop"),
            remote,
            name,
        });
    }

    Ok(GitBranchList { current, all })
}

#[tauri::command]
fn git_checkout_branch(repo_path: String, branch_name: String) -> AppResult<()> {
    run_git(&["checkout", branch_name.as_str()], Some(&repo_path)).map(|_| ())
}

#[tauri::command]
fn git_create_branch(repo_path: String, branch_name: String, base_branch: String) -> AppResult<()> {
    run_git(
        &["checkout", "-b", branch_name.as_str(), base_branch.as_str()],
        Some(&repo_path),
    )
    .map(|_| ())
}

#[tauri::command]
fn git_delete_branch(
    repo_path: String,
    branch_name: String,
    options: Option<DeleteBranchOptions>,
) -> AppResult<()> {
    let options = options.unwrap_or_default();
    if options.remote.unwrap_or(false) {
        let (remote, branch) = branch_name
            .split_once('/')
            .ok_or_else(|| "원격 브랜치 이름 형식이 올바르지 않습니다".to_string())?;
        return run_git(&["push", remote, "--delete", branch], Some(&repo_path)).map(|_| ());
    }

    let flag = if options.force.unwrap_or(false) {
        "-D"
    } else {
        "-d"
    };
    run_git(&["branch", flag, branch_name.as_str()], Some(&repo_path)).map(|_| ())
}

#[tauri::command]
fn git_rename_branch(
    repo_path: String,
    old_branch_name: String,
    new_branch_name: String,
) -> AppResult<()> {
    let current = run_git(&["branch", "--show-current"], Some(&repo_path))?
        .trim()
        .to_string();
    if old_branch_name == current {
        run_git(
            &["branch", "-m", new_branch_name.as_str()],
            Some(&repo_path),
        )
        .map(|_| ())
    } else {
        run_git(
            &[
                "branch",
                "-m",
                old_branch_name.as_str(),
                new_branch_name.as_str(),
            ],
            Some(&repo_path),
        )
        .map(|_| ())
    }
}

#[tauri::command]
fn git_checkout_remote_branch(repo_path: String, remote_branch_name: String) -> AppResult<String> {
    let (_, local_name) = remote_branch_name
        .split_once('/')
        .ok_or_else(|| "원격 브랜치 이름 형식이 올바르지 않습니다".to_string())?;
    let local_branches = run_git(&["branch", "--format=%(refname:short)"], Some(&repo_path))?;
    if local_branches.lines().any(|line| line.trim() == local_name) {
        run_git(&["checkout", local_name], Some(&repo_path))?;
        return Ok(local_name.to_string());
    }
    run_git(
        &["checkout", "-b", local_name, remote_branch_name.as_str()],
        Some(&repo_path),
    )?;
    Ok(local_name.to_string())
}

#[tauri::command]
fn git_merge(repo_path: String, from_branch: String) -> AppResult<Value> {
    match run_git(&["merge", from_branch.as_str()], Some(&repo_path)) {
        Ok(output) => Ok(json!({ "output": output, "conflicts": [] })),
        Err(err) => {
            let conflicts = parse_status(&repo_path)
                .map(|status| status.conflicted)
                .unwrap_or(0);
            if conflicts > 0 {
                Ok(
                    json!({ "output": err, "conflicts": vec![Value::String("conflict".to_string()); conflicts] }),
                )
            } else {
                Err(err)
            }
        }
    }
}

#[tauri::command]
fn git_origin_url(repo_path: String) -> AppResult<Option<String>> {
    match run_git(&["remote", "get-url", "origin"], Some(&repo_path)) {
        Ok(output) => {
            let trimmed = output.trim().to_string();
            Ok(if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            })
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn todos_list(repo_path: String) -> AppResult<Value> {
    let user_name = run_git(&["config", "--get", "user.name"], Some(&repo_path))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let todos_dir = Path::new(&repo_path).join("todos");

    if !todos_dir.is_dir() {
        return Ok(
            json!({ "userName": user_name, "matchKeys": [], "todosDirExists": false, "docs": [] }),
        );
    }

    let mut keys = Vec::new();
    if let Some(name) = &user_name {
        keys.push(name.clone());
    }
    if let Ok(user) = auth_commands::auth_get_user() {
        if let Some(login) = user.get("login").and_then(Value::as_str) {
            keys.push(login.to_string());
        }
    }

    let key_map: HashMap<String, String> = keys
        .into_iter()
        .map(|key| (normalize_todo_key(&key), key))
        .filter(|(normalized, _)| !normalized.is_empty())
        .collect();
    let match_keys: Vec<String> = key_map.values().cloned().collect();
    if key_map.is_empty() {
        return Ok(
            json!({ "userName": user_name, "matchKeys": [], "todosDirExists": true, "docs": [] }),
        );
    }

    let mut docs = Vec::new();
    for entry in fs::read_dir(todos_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !matches!(extension.as_str(), "md" | "markdown" | "txt") {
            continue;
        }
        let stem = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if !key_map.contains_key(&normalize_todo_key(stem)) {
            continue;
        }
        let content = fs::read_to_string(&path).unwrap_or_default();
        docs.push(json!({
            "fileName": path.file_name().and_then(|value| value.to_str()).unwrap_or(""),
            "filePath": path.to_string_lossy(),
            "tasks": extract_todo_tasks(&content)
        }));
    }

    Ok(
        json!({ "userName": user_name, "matchKeys": match_keys, "todosDirExists": true, "docs": docs }),
    )
}

#[tauri::command]
fn todos_update(
    repo_path: String,
    file_path: String,
    task_index: usize,
    checked: bool,
) -> AppResult<Value> {
    let target = validate_todo_target(&repo_path, &file_path, true)?;
    let content = fs::read_to_string(&target).map_err(|err| err.to_string())?;
    let mut current_index = 0usize;
    let mut updated = false;
    let lines: Vec<String> = content
        .lines()
        .map(|line| {
            let trimmed = line.trim_start();
            let is_task = trimmed.starts_with("- [") || trimmed.starts_with("* [");
            if !is_task {
                return line.to_string();
            }
            if current_index != task_index {
                current_index += 1;
                return line.to_string();
            }
            current_index += 1;
            updated = true;
            let marker = if checked { "x" } else { " " };
            let mut chars: Vec<char> = line.chars().collect();
            if chars.len() > 3 {
                chars[3] = marker.chars().next().unwrap();
            }
            let mut next: String = chars.into_iter().collect();
            next = next.replace(" + 완료", "");
            if checked {
                next.push_str(" + 완료");
            }
            next
        })
        .collect();

    let next_content = format!("{}\n", lines.join("\n"));
    fs::write(&target, &next_content).map_err(|err| err.to_string())?;
    Ok(json!({ "success": updated, "tasks": extract_todo_tasks(&next_content) }))
}

#[tauri::command]
fn todos_add(repo_path: String, file_path: String, text: String) -> AppResult<Value> {
    let target = validate_todo_target(&repo_path, &file_path, false)?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("TODO 내용을 입력해주세요".to_string());
    }
    if let Some(parent) = target.as_path().parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let current = fs::read_to_string(&target).unwrap_or_default();
    let line = if trimmed.starts_with("- [ ]") {
        trimmed.to_string()
    } else {
        format!("- [ ] {trimmed}")
    };
    let next_content = if current.trim().is_empty() {
        format!("{line}\n")
    } else {
        format!("{}\n{line}\n", current.trim_end())
    };
    fs::write(&target, &next_content).map_err(|err| err.to_string())?;
    Ok(json!({ "success": true, "tasks": extract_todo_tasks(&next_content) }))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            app_get_app_version,
            auth_commands::auth_get_token_status,
            auth_commands::auth_logout,
            auth_commands::auth_get_user,
            auth_commands::auth_set_token,
            auth_commands::auth_start_browser_login,
            auth_commands::auth_complete_browser_login,
            store_commands::store_get_projects,
            store_commands::store_save_projects,
            store_commands::store_get_learning_progress,
            store_commands::store_update_learning_progress,
            store_commands::store_get_guide_completed,
            store_commands::store_set_guide_completed,
            git_check_installed,
            git_clone,
            git_status,
            git_fetch,
            git_pull,
            git_push,
            git_changes,
            git_stage,
            git_unstage,
            git_commit,
            git_log,
            git_graph_log,
            git_diff,
            git_branches,
            git_checkout_branch,
            git_create_branch,
            git_delete_branch,
            git_rename_branch,
            git_checkout_remote_branch,
            git_merge,
            git_origin_url,
            github_commands::github_get_my_profile,
            github_commands::github_list_pulls,
            github_commands::github_review_pull,
            github_commands::github_create_pull,
            github_commands::github_merge_pull,
            github_commands::github_list_issues,
            github_commands::github_create_issue,
            github_commands::github_close_issue,
            github_commands::github_comment_issue,
            github_commands::github_list_repos,
            github_commands::github_create_repo,
            todos_list,
            todos_update,
            todos_add
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
