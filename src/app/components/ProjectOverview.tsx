import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Progress } from "@/app/components/ui/progress";
import { FolderGit2, FolderOpen, Plus, ExternalLink, GitBranch, Star, Clock, Users, Trash2, RefreshCw, FileText } from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  lastCommit: string;
  uncommittedChanges: number;
  ahead: number;
  behind: number;
  stars: number;
  collaborators: number;
  url: string;
}

const mockProjects: Project[] = [];

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";

type UpdateStage = "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";

interface UpdateUiState {
  stage: UpdateStage;
  latestVersion?: string;
  releaseNotes?: string;
  progressPercent?: number;
  errorMessage?: string;
}

export function ProjectOverview() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [gitBusy, setGitBusy] = useState<string | null>(null);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(
    () => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || ""
  );
  const [activeProjectName, setActiveProjectName] = useState<string>(
    () => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || ""
  );

  const [todoLoading, setTodoLoading] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [todoUserName, setTodoUserName] = useState<string | null>(null);
  const [todoMatchKeys, setTodoMatchKeys] = useState<string[]>([]);
  const [todoTodosDirExists, setTodoTodosDirExists] = useState(false);
  const [todoDocs, setTodoDocs] = useState<
    { fileName: string; filePath: string; tasks: { checked: boolean; text: string }[] }[]
  >([]);

  const loadProjects = async () => {
    if (!window.easyGithub) return;
    try {
      const saved = await window.easyGithub.store.getProjects();
      if (Array.isArray(saved) && saved.length > 0) {
        setProjects(saved);
      }
    } catch {
      // 저장된 프로젝트 로드 실패는 치명적이지 않음
    }
  };

  const persistProjects = async (nextProjects: Project[]) => {
    if (!window.easyGithub) return;

    await window.easyGithub.store.saveProjects(nextProjects);
  };

  const refreshTodos = async () => {
    if (!window.easyGithub) return;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    const repoName = localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "";

    // 탭 간 선택 프로젝트가 바뀌면 로컬 상태도 동기화한다.
    setActiveProjectPath(repoPath);
    setActiveProjectName(repoName);

    if (!repoPath) {
      setTodoError(null);
      setTodoUserName(null);
      setTodoMatchKeys([]);
      setTodoTodosDirExists(false);
      setTodoDocs([]);
      return;
    }

    setTodoLoading(true);
    setTodoError(null);

    try {
      const result = await window.easyGithub.todos.list(repoPath);

      setTodoUserName(result?.userName ?? null);
      setTodoMatchKeys(Array.isArray(result?.matchKeys) ? result.matchKeys : []);
      setTodoTodosDirExists(Boolean(result?.todosDirExists));
      setTodoDocs(Array.isArray(result?.docs) ? result.docs : []);
    } catch (err: any) {
      setTodoError(err?.message || "TODO 목록을 불러오지 못했습니다");
      setTodoDocs([]);
    } finally {
      setTodoLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();

    // 사용자 PC에 Git이 없으면 모든 Git 기능이 실패하므로, 처음에 한 번만 안내한다.
    // (설치 파일에 Git을 포함하지 않는 구조라서 OS에 설치된 Git이 필요)
    if (window.easyGithub) {
      window.easyGithub.git
        .checkInstalled()
        .then((status) => {
          if (!status?.installed) {
            toast.error("Git이 설치되어 있지 않아 Git 기능을 사용할 수 없습니다", {
              description: "Git 설치 후 앱을 재시작해주세요 (git-scm.com)"
            });
          }
        })
        .catch(() => {
          // 체크 실패는 치명적이지 않으므로 무시
        });
    }
  }, []);

  useEffect(() => {
    void refreshTodos();

    const handleActiveProjectChanged = () => {
      void refreshTodos();
    };

    window.addEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    return () => window.removeEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");

  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [updateState, setUpdateState] = useState<UpdateUiState>({ stage: "idle" });

  useEffect(() => {
    if (!window.easyGithub) return;

    // 보안/UX:
    // - 업데이트 상태는 main process에서만 알 수 있으므로 이벤트로만 전달받는다.
    // - 구독 해제 함수를 반드시 호출해 메모리 누수를 막는다.
    const unsubscribe = window.easyGithub.app.onUpdateEvent((payload: any) => {
      const type = String(payload?.type ?? "");

      if (type === "checking") {
        setUpdateState((prev) => ({ ...prev, stage: "checking", errorMessage: undefined }));
        return;
      }

      if (type === "available") {
        const version = String(payload?.info?.version ?? "");
        const releaseNotes = payload?.info?.releaseNotes ? String(payload.info.releaseNotes) : undefined;

        setUpdateState({ stage: "available", latestVersion: version, releaseNotes });
        setUpdateDialogOpen(true);
        return;
      }

      if (type === "not-available") {
        setUpdateState({ stage: "not-available" });
        toast.success("이미 최신 버전입니다");
        return;
      }

      if (type === "progress") {
        const percent = Number(payload?.info?.percent ?? 0);
        setUpdateState((prev) => ({
          ...prev,
          stage: "downloading",
          progressPercent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
        }));
        setUpdateDialogOpen(true);
        return;
      }

      if (type === "downloaded") {
        const version = String(payload?.info?.version ?? "");
        setUpdateState((prev) => ({ ...prev, stage: "downloaded", latestVersion: version }));
        setUpdateDialogOpen(true);
        return;
      }

      if (type === "error") {
        const message = String(payload?.info?.message ?? "업데이트 중 오류가 발생했습니다");
        setUpdateState({ stage: "error", errorMessage: message });
        setUpdateDialogOpen(true);
        return;
      }
    });

    window.easyGithub.app
      .getAppVersion()
      .then((v) => setAppVersion(v))
      .catch(() => {
        // 버전 조회 실패는 치명적이지 않음
      });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleSelectProjectDirectory = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 폴더 선택을 지원합니다");
      return;
    }

    try {
      const selected = await window.easyGithub.app.selectDirectory(newProjectPath || undefined);
      if (selected) {
        setNewProjectPath(selected);
      }
    } catch (err: any) {
      toast.error(err?.message || "폴더 선택에 실패했습니다");
    }
  };

  const handleCheckForUpdates = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 업데이트 확인을 지원합니다");
      return;
    }

    const toastId = toast.loading("업데이트 확인 중...");
    setUpdateBusy(true);
    setUpdateState({ stage: "checking" });

    try {
      const result = await window.easyGithub.app.checkForUpdates();
      if (result.status === "disabled") {
        toast.info("개발 모드에서는 자동 업데이트가 비활성화됩니다", { id: toastId });
        return;
      }

      // 결과(업데이트 있음/없음/에러)는 onUpdateEvent로 전달된다.
      toast.dismiss(toastId);
    } catch (err: any) {
      toast.error(err?.message || "업데이트 확인에 실패했습니다", { id: toastId });
      setUpdateState({ stage: "error", errorMessage: err?.message || "업데이트 확인에 실패했습니다" });
      setUpdateDialogOpen(true);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.easyGithub) return;

    setUpdateBusy(true);
    setUpdateState((prev) => ({ ...prev, stage: "downloading", progressPercent: 0 }));

    try {
      const result = await window.easyGithub.app.downloadUpdate();
      if (result.status === "disabled") {
        toast.info("개발 모드에서는 자동 업데이트가 비활성화됩니다");
        return;
      }

      // 진행률/완료는 onUpdateEvent로 들어온다.
    } catch (err: any) {
      toast.error(err?.message || "업데이트 다운로드에 실패했습니다");
      setUpdateState({ stage: "error", errorMessage: err?.message || "업데이트 다운로드에 실패했습니다" });
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.easyGithub) return;

    try {
      await window.easyGithub.app.installUpdate();
    } catch (err: any) {
      toast.error(err?.message || "업데이트 설치에 실패했습니다");
    }
  };

  const applyStatusToProject = (projectId: string, status: any) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        const uncommitted =
          Number(status?.modified ?? 0) +
          Number(status?.untracked ?? 0) +
          Number(status?.deleted ?? 0);
        return {
          ...p,
          currentBranch: status?.current ?? p.currentBranch,
          ahead: Number(status?.ahead ?? p.ahead),
          behind: Number(status?.behind ?? p.behind),
          uncommittedChanges: uncommitted
        };
      });
      persistProjects(next);
      return next;
    });
  };

  const setActiveProject = (projectPath: string, projectName: string) => {
    localStorage.setItem("activeProjectPath", projectPath);
    localStorage.setItem("activeProjectName", projectName);

    // 탭 간 동기화: activeProjectPath 변경을 이벤트로 통지한다.
    window.dispatchEvent(
      new CustomEvent("easygithub:active-project-changed", {
        detail: { projectPath, projectName }
      })
    );
  };

  const handleCloneProject = async () => {
    if (!newProjectUrl || !newProjectPath) {
      toast.error("저장소 URL과 경로를 모두 입력해주세요");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Clone을 지원합니다");
      return;
    }

    const projectName = newProjectUrl.split("/").pop()?.replace(".git", "") || "new-project";

    const toastId = toast.loading("프로젝트 다운로드 중...");
    setGitBusy("clone");

    try {
      await window.easyGithub.git.clone(newProjectUrl, newProjectPath);
      setActiveProject(newProjectPath, projectName);

      const newProject: Project = {
        id: Date.now().toString(),
        name: projectName,
        path: newProjectPath,
        currentBranch: "main",
        lastCommit: "방금",
        uncommittedChanges: 0,
        ahead: 0,
        behind: 0,
        stars: 0,
        collaborators: 1,
        url: newProjectUrl
      };

      setProjects((prev) => {
        const next = [newProject, ...prev];
        persistProjects(next);
        return next;
      });
      setNewProjectUrl("");
      setNewProjectPath("");
      setShowAddProject(false);

      try {
        const status = await window.easyGithub.git.status(newProjectPath);
        applyStatusToProject(newProject.id, status);
      } catch {
        // 상태 조회 실패는 치명적이지 않으므로 무시
      }

      toast.success(`${projectName} 프로젝트가 추가되었습니다!`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Clone에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handleRemoveProject = (id: string, name: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistProjects(next);
      return next;
    });
    toast.success(`${name} 프로젝트가 제거되었습니다`);
  };

  const handleCheckStatus = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Git 상태 확인을 지원합니다");
      return;
    }

    const toastId = toast.loading("상태 확인 중...");
    setGitBusy(projectId);

    try {
       setActiveProject(projectPath, projectName);
       const status = await window.easyGithub.git.status(projectPath);

      applyStatusToProject(projectId, status);
      toast.success(
        `브랜치 ${status.current} · 수정 ${status.modified} · 스테이징 ${status.staged} · 미추적 ${status.untracked} · ahead ${status.ahead} · behind ${status.behind}`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err?.message || "Git 상태 확인에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handleFetch = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Fetch를 지원합니다");
      return;
    }

    const toastId = toast.loading("원격 변경사항 확인 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.fetch(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("Fetch 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Fetch에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handlePull = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Pull을 지원합니다");
      return;
    }

    const toastId = toast.loading("Pull 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.pull(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("Pull 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Pull에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handlePush = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Push를 지원합니다");
      return;
    }

    const toastId = toast.loading("Push 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.push(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("Push 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Push에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업데이트</DialogTitle>
            <DialogDescription>
              현재 버전: <span className="font-mono">{appVersion || "-"}</span>
              {updateState.latestVersion ? (
                <>
                  {" "}· 최신 버전: <span className="font-mono">{updateState.latestVersion}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm">
              {updateState.stage === "idle" && "업데이트 상태를 확인할 수 있습니다"}
              {updateState.stage === "checking" && "업데이트를 확인하고 있어요"}
              {updateState.stage === "available" && "새 버전이 있습니다. 다운로드할까요?"}
              {updateState.stage === "not-available" && "이미 최신 버전입니다"}
              {updateState.stage === "downloading" && "다운로드 중입니다"}
              {updateState.stage === "downloaded" && "다운로드 완료! 재시작하면 적용됩니다"}
              {updateState.stage === "error" && (updateState.errorMessage || "업데이트 중 오류가 발생했습니다")}
            </div>

            {updateState.stage === "downloading" ? (
              <div className="space-y-2">
                <Progress value={updateState.progressPercent ?? 0} />
                <div className="text-xs text-muted-foreground">{Math.round(updateState.progressPercent ?? 0)}%</div>
              </div>
            ) : null}

            {updateState.releaseNotes ? (
              <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {updateState.releaseNotes}
              </pre>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              닫기
            </Button>

            {updateState.stage === "available" ? (
              <Button type="button" onClick={handleDownloadUpdate} disabled={updateBusy}>
                다운로드
              </Button>
            ) : null}

            {updateState.stage === "downloading" ? (
              <Button type="button" disabled>
                다운로드 중...
              </Button>
            ) : null}

            {updateState.stage === "downloaded" ? (
              <Button type="button" onClick={handleInstallUpdate}>
                재시작하여 적용
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">전체 프로젝트</p>
                <p className="text-3xl font-bold mt-1">{projects.length}</p>
              </div>
              <FolderGit2 className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">변경사항</p>
                <p className="text-3xl font-bold mt-1">
                  {projects.reduce((sum, p) => sum + p.uncommittedChanges, 0)}
                </p>
              </div>
              <FileText className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Push 대기</p>
                <p className="text-3xl font-bold mt-1">
                  {projects.reduce((sum, p) => sum + p.ahead, 0)}
                </p>
              </div>
              <RefreshCw className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pull 필요</p>
                <p className="text-3xl font-bold mt-1">
                  {projects.reduce((sum, p) => sum + p.behind, 0)}
                </p>
              </div>
              <GitBranch className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User TODO List */}
      <Card className="border-2 border-emerald-500/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>내 TODO</CardTitle>
              <CardDescription>
                {activeProjectName ? (
                  <span>
                    현재 프로젝트: <strong>{activeProjectName}</strong>
                  </span>
                ) : (
                  "현재 프로젝트가 선택되지 않았습니다"
                )}
                <span className="block text-xs text-muted-foreground mt-1">
                  매칭 키(하나가 안 맞으면 다른 것도 탐색):
                  {todoMatchKeys.length > 0 ? (
                    <>
                      {" "}
                      {todoMatchKeys.map((k) => (
                        <code key={k} className="font-mono ml-1">
                          {k}
                        </code>
                      ))}
                    </>
                  ) : (
                    <>
                      {" "}
                      <code className="font-mono">(없음)</code>
                    </>
                  )}
                </span>
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshTodos()}
              disabled={todoLoading || !activeProjectPath}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${todoLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeProjectPath ? (
            <div className="text-sm text-muted-foreground">
              먼저 프로젝트를 선택해주세요. (프로젝트 카드에서 <strong>상태</strong> 버튼을 누르면 선택됩니다)
            </div>
          ) : todoError ? (
            <div className="text-sm text-red-600">{todoError}</div>
          ) : todoLoading ? (
            <div className="text-sm text-muted-foreground">TODO를 불러오는 중...</div>
          ) : !todoTodosDirExists ? (
            <div className="text-sm text-muted-foreground">
              이 저장소에 <code className="font-mono">todos</code> 폴더가 없습니다. 예: <code className="font-mono">todos/{todoMatchKeys[0] ?? todoUserName ?? "your-name"}.md</code>
            </div>
          ) : todoDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {todoMatchKeys.length > 0 ? (
                <>
                  <code className="font-mono">todos</code> 폴더에서 파일명이 일치하는 문서를 찾지 못했습니다: {" "}
                  {todoMatchKeys.map((k) => (
                    <code key={k} className="font-mono ml-1">
                      {k}
                    </code>
                  ))}
                </>
              ) : (
                <>
                  매칭 키를 만들 수 없습니다. (<code className="font-mono">git config user.name</code> 또는 GitHub 로그인이 필요합니다)
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {todoDocs.map((doc) => {
                const doneCount = doc.tasks.filter((t) => t.checked).length;
                const totalCount = doc.tasks.length;

                return (
                  <Card key={doc.filePath} className="bg-muted/20">
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-mono">{doc.fileName}</CardTitle>
                        <Badge variant="outline">
                          {doneCount}/{totalCount}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      {doc.tasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">할 일 항목(- [ ])이 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {doc.tasks.map((task, index) => (
                            <div key={`${doc.filePath}:${index}`} className="flex items-start gap-2">
                              <Checkbox checked={task.checked} disabled />
                              <span
                                className={`text-sm ${task.checked ? "line-through text-muted-foreground" : ""}`}
                              >
                                {task.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Project Button */}
      {!showAddProject && (
        <Card
          className="border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
          onClick={() => setShowAddProject(true)}
        >
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-blue-600 p-4 rounded-full">
                  <Plus className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">프로젝트 추가하기</h3>
                <p className="text-blue-700 dark:text-blue-200 mt-2">
                  GitHub에서 코드를 다운로드하거나 새 프로젝트를 시작하세요
                </p>
              </div>
              <Button size="lg" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                시작하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Project Form */}
      {showAddProject && (
        <Card className="border-2 border-blue-500 shadow-lg">
          <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              새 프로젝트 추가
            </CardTitle>
            <CardDescription className="text-base">
              GitHub 저장소를 Clone(다운로드)하거나 로컬 프로젝트를 추가하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">💡</span>
                  <div className="text-sm text-yellow-900 dark:text-yellow-100">
                    <p className="font-semibold mb-1">처음이신가요?</p>
                    <p>GitHub 저장소 페이지에서 초록색 "Code" 버튼을 누르면 URL을 복사할 수 있어요!</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="repo-url" className="text-base font-semibold">
                저장소 URL (GitHub 주소)
              </Label>
              <Input
                id="repo-url"
                placeholder="예: https://github.com/username/repository.git"
                value={newProjectUrl}
                onChange={(e) => setNewProjectUrl(e.target.value)}
                className="text-base"
              />
              <p className="text-sm text-muted-foreground">
                GitHub에서 복사한 저장소 주소를 붙여넣으세요
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-path" className="text-base font-semibold">
                저장할 폴더 경로
              </Label>
              <div className="flex gap-2">
                <Input
                  id="local-path"
                  placeholder="예: C:/내문서/프로젝트/my-project"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  className="text-base flex-1"
                />
                <Button type="button" variant="outline" onClick={handleSelectProjectDirectory}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  폴더 선택
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                컴퓨터에 프로젝트를 저장할 폴더를 입력하세요
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleCloneProject} className="flex-1" size="lg" disabled={gitBusy === "clone"}>
                <Plus className="w-5 h-5 mr-2" />
                프로젝트 다운로드 시작
              </Button>
              <Button variant="outline" onClick={() => setShowAddProject(false)} size="lg">
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">내 프로젝트</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCheckForUpdates} disabled={updateBusy}>
              <RefreshCw className="w-4 h-4 mr-2" />
              업데이트 확인
            </Button>
            <Badge variant="outline" className="text-sm">
              {projects.length}개
            </Badge>
          </div>
        </div>
        
        {projects.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <FolderGit2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">아직 프로젝트가 없어요</p>
              <p className="text-sm mt-2">위의 "프로젝트 추가하기" 버튼을 눌러 시작하세요!</p>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-4">
                    {/* Project Header */}
                    <div className="flex items-center gap-3">
                      <FolderGit2 className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-lg font-semibold">{project.name}</h3>
                        <p className="text-sm text-muted-foreground font-mono">{project.path}</p>
                      </div>
                    </div>

                    {/* Branch and Status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        <GitBranch className="w-3 h-3 mr-1" />
                        {project.currentBranch}
                      </Badge>
                      
                      {project.uncommittedChanges > 0 && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                          {project.uncommittedChanges} 변경됨
                        </Badge>
                      )}
                      
                      {project.ahead > 0 && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          ↑ {project.ahead} 커밋 앞서감
                        </Badge>
                      )}
                      
                      {project.behind > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          ↓ {project.behind} 커밋 뒤처짐
                        </Badge>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{project.lastCommit}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        <span>{project.stars}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{project.collaborators}</span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleCheckStatus(project.id, project.name, project.path)}
                        disabled={gitBusy === project.id || gitBusy === "clone"}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        상태
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFetch(project.id, project.name, project.path)}
                        disabled={gitBusy === project.id || gitBusy === "clone"}
                      >
                        Fetch
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePull(project.id, project.name, project.path)}
                        disabled={gitBusy === project.id || gitBusy === "clone"}
                      >
                        Pull
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePush(project.id, project.name, project.path)}
                        disabled={gitBusy === project.id || gitBusy === "clone"}
                      >
                        Push
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => (window.easyGithub ? window.easyGithub.app.openExternal(project.url) : window.open(project.url, '_blank'))}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        GitHub
                      </Button>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProject(project.id, project.name)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}