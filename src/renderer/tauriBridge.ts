import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

type Unsubscribe = () => void;
type UpdateListener = (payload: any) => void;

let updateInProgress = false;
let pendingUpdate: Update | null = null;
const updateListeners = new Set<UpdateListener>();

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

function openExternalUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.reject(new Error("외부 URL 형식이 올바르지 않습니다."));
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return Promise.reject(new Error("지원하지 않는 외부 URL 형식입니다."));
  }
  return openUrl(parsed.toString());
}

function emitUpdateEvent(payload: any): void {
  for (const listener of updateListeners) {
    listener(payload);
  }
}

function toUpdateInfo(update: Update): { version: string; releaseNotes?: string } {
  return {
    version: update.version,
    releaseNotes: update.body ?? undefined
  };
}

async function checkForTauriUpdate(): Promise<{ status: "started" | "busy" }> {
  if (updateInProgress) return { status: "busy" };

  updateInProgress = true;
  emitUpdateEvent({ type: "checking" });

  try {
    const update = await check();
    pendingUpdate = update ?? null;

    if (update) {
      emitUpdateEvent({ type: "available", info: toUpdateInfo(update) });
    } else {
      emitUpdateEvent({ type: "not-available" });
    }

    return { status: "started" };
  } catch (err: any) {
    emitUpdateEvent({ type: "error", info: { message: err?.message || "업데이트 확인에 실패했습니다" } });
    throw err;
  } finally {
    updateInProgress = false;
  }
}

async function downloadTauriUpdate(): Promise<{ status: "started" | "busy" }> {
  if (updateInProgress) return { status: "busy" };

  updateInProgress = true;

  try {
    const update = pendingUpdate ?? await check();
    if (!update) {
      emitUpdateEvent({ type: "not-available" });
      return { status: "started" };
    }

    let downloaded = 0;
    let contentLength = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        downloaded = 0;
        contentLength = event.data.contentLength ?? 0;
        emitUpdateEvent({ type: "progress", info: { percent: 0 } });
        return;
      }

      if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        const percent = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
        emitUpdateEvent({ type: "progress", info: { percent } });
        return;
      }

      if (event.event === "Finished") {
        emitUpdateEvent({ type: "progress", info: { percent: 100 } });
      }
    });

    pendingUpdate = update;
    emitUpdateEvent({ type: "downloaded", info: toUpdateInfo(update) });
    return { status: "started" };
  } catch (err: any) {
    emitUpdateEvent({ type: "error", info: { message: err?.message || "업데이트 다운로드에 실패했습니다" } });
    throw err;
  } finally {
    updateInProgress = false;
  }
}

export function installTauriEasyGithubBridge(): void {
  if (!isTauriRuntime()) return;
  if (window.easyGithub) return;

  window.easyGithub = {
    app: {
      ping: () => Promise.resolve("pong"),
      openExternal: (url: string) => openExternalUrl(url),
      selectDirectory: async (defaultPath?: string) => {
        const selected = await openDialog({
          directory: true,
          multiple: false,
          defaultPath
        });
        return typeof selected === "string" ? selected : null;
      },
      getAppVersion: () => call("app_get_app_version"),
      checkForUpdates: () => checkForTauriUpdate(),
      downloadUpdate: () => downloadTauriUpdate(),
      installUpdate: async () => {
        await relaunch();
        return { status: "started" };
      },
      onUpdateEvent: (listener: UpdateListener): Unsubscribe => {
        updateListeners.add(listener);
        return () => updateListeners.delete(listener);
      }
    },
    auth: {
      setToken: (token: string) => call("auth_set_token", { token }),
      logout: () => call("auth_logout"),
      getUser: () => call("auth_get_user"),
      getTokenStatus: () => call("auth_get_token_status")
    },
    github: {
      getMyProfile: () => call("github_get_my_profile"),
      listPullRequests: (owner: string, repo: string) => call("github_list_pulls", { owner, repo }),
      reviewPullRequest: (
        owner: string,
        repo: string,
        pullNumber: number,
        event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
        body?: string
      ) => call("github_review_pull", { owner, repo, pull_number: pullNumber, review_event: event, body }),
      mergePullRequest: (owner: string, repo: string, pullNumber: number) =>
        call("github_merge_pull", { owner, repo, pull_number: pullNumber }),
      createPullRequest: (owner: string, repo: string, title: string, body: string, head: string, base: string) =>
        call("github_create_pull", { owner, repo, title, body, head, base }),
      listIssues: (owner: string, repo: string, state: "open" | "closed" | "all") =>
        call("github_list_issues", { owner, repo, state }),
      createIssue: (owner: string, repo: string, title: string, body: string) =>
        call("github_create_issue", { owner, repo, title, body }),
      closeIssue: (owner: string, repo: string, issueNumber: number) =>
        call("github_close_issue", { owner, repo, issue_number: issueNumber }),
      commentIssue: (owner: string, repo: string, issueNumber: number, body: string) =>
        call("github_comment_issue", { owner, repo, issue_number: issueNumber, body }),
      listRepositories: () => call("github_list_repos"),
      createRepository: (name: string, description: string, isPrivate: boolean) =>
        call("github_create_repo", { name, description, is_private: isPrivate })
    },
    git: {
      clone: (repoUrl: string, targetPath: string, mode?: "overwrite" | "preserve") =>
        call("git_clone", { repo_url: repoUrl, target_path: targetPath, mode }),
      status: (repoPath: string) => call("git_status", { repo_path: repoPath }),
      fetch: (repoPath: string) => call("git_fetch", { repo_path: repoPath }),
      pull: (repoPath: string) => call("git_pull", { repo_path: repoPath }),
      push: (repoPath: string) => call("git_push", { repo_path: repoPath }),
      changes: (repoPath: string) => call("git_changes", { repo_path: repoPath }),
      stage: (repoPath: string, files: string[]) => call("git_stage", { repo_path: repoPath, files }),
      unstage: (repoPath: string, files: string[]) => call("git_unstage", { repo_path: repoPath, files }),
      commit: (repoPath: string, message: string, author?: { name: string; email: string }) =>
        call("git_commit", { repo_path: repoPath, message, author }),
      log: (repoPath: string, maxCount: number) => call("git_log", { repo_path: repoPath, max_count: maxCount }),
      graphLog: (repoPath: string, maxCount: number) =>
        call("git_graph_log", { repo_path: repoPath, max_count: maxCount }),
      diff: (repoPath: string, filePath?: string) => call("git_diff", { repo_path: repoPath, file_path: filePath }),
      branches: (repoPath: string) => call("git_branches", { repo_path: repoPath }),
      checkoutBranch: (repoPath: string, branchName: string) =>
        call("git_checkout_branch", { repo_path: repoPath, branch_name: branchName }),
      createBranch: (repoPath: string, branchName: string, baseBranch: string) =>
        call("git_create_branch", { repo_path: repoPath, branch_name: branchName, base_branch: baseBranch }),
      deleteBranch: (repoPath: string, branchName: string, options?: { force?: boolean; remote?: boolean }) =>
        call("git_delete_branch", { repo_path: repoPath, branch_name: branchName, options }),
      renameBranch: (repoPath: string, oldBranchName: string, newBranchName: string) =>
        call("git_rename_branch", { repo_path: repoPath, old_branch_name: oldBranchName, new_branch_name: newBranchName }),
      checkoutRemoteBranch: (repoPath: string, remoteBranchName: string) =>
        call("git_checkout_remote_branch", { repo_path: repoPath, remote_branch_name: remoteBranchName }),
      merge: (repoPath: string, fromBranch: string) => call("git_merge", { repo_path: repoPath, from_branch: fromBranch }),
      originUrl: (repoPath: string) => call("git_origin_url", { repo_path: repoPath }),
      checkInstalled: () => call("git_check_installed")
    },
    todos: {
      list: (repoPath: string) => call("todos_list", { repo_path: repoPath }),
      update: (repoPath: string, filePath: string, taskIndex: number, checked: boolean) =>
        call("todos_update", { repo_path: repoPath, file_path: filePath, task_index: taskIndex, checked }),
      add: (repoPath: string, filePath: string, text: string) =>
        call("todos_add", { repo_path: repoPath, file_path: filePath, text })
    },
    store: {
      getLearningProgress: () => call("store_get_learning_progress"),
      updateLearningProgress: (partial: any) => call("store_update_learning_progress", { partial }),
      getGuideCompleted: () => call("store_get_guide_completed"),
      setGuideCompleted: (completed: boolean) => call("store_set_guide_completed", { completed }),
      getProjects: () => call("store_get_projects"),
      saveProjects: (projects: any[]) => call("store_save_projects", { projects })
    }
  };
}
