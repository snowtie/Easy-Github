use crate::storage::{read_json_file, store_path, write_json_file};
use crate::AppResult;
use serde_json::{json, Value};

#[tauri::command]
pub(crate) fn store_get_projects() -> AppResult<Value> {
    Ok(
        read_json_file(&store_path("projects")?, json!({ "projects": [] }))
            .get("projects")
            .cloned()
            .unwrap_or_else(|| json!([])),
    )
}

#[tauri::command]
pub(crate) fn store_save_projects(projects: Value) -> AppResult<()> {
    write_json_file(&store_path("projects")?, &json!({ "projects": projects }))
}

#[tauri::command]
pub(crate) fn store_get_learning_progress() -> AppResult<Value> {
    let default_progress = json!({
        "completedTopics": [],
        "practicedCommands": [],
        "completedPracticeSteps": [],
        "lastActiveTab": "learn",
        "totalLearningMinutes": 0
    });
    Ok(read_json_file(&store_path("learning")?, json!({}))
        .get("progress")
        .cloned()
        .unwrap_or(default_progress))
}

#[tauri::command]
pub(crate) fn store_update_learning_progress(partial: Value) -> AppResult<Value> {
    let path = store_path("learning")?;
    let mut root = read_json_file(&path, json!({}));
    let current = store_get_learning_progress()?;
    let mut next = current.as_object().cloned().unwrap_or_default();
    if let Some(updates) = partial.as_object() {
        for (key, value) in updates {
            next.insert(key.clone(), value.clone());
        }
    }
    root["progress"] = Value::Object(next);
    write_json_file(&path, &root)?;
    Ok(root["progress"].clone())
}

#[tauri::command]
pub(crate) fn store_get_guide_completed() -> AppResult<bool> {
    Ok(read_json_file(&store_path("learning")?, json!({}))
        .get("guideCompleted")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

#[tauri::command]
pub(crate) fn store_set_guide_completed(completed: bool) -> AppResult<()> {
    let path = store_path("learning")?;
    let mut root = read_json_file(&path, json!({}));
    root["guideCompleted"] = json!(completed);
    write_json_file(&path, &root)
}
