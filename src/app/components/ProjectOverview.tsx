import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Progress } from "@/app/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
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
  const [todoUpdatingKey, setTodoUpdatingKey] = useState<string | null>(null);
  const [todoInputByDoc, setTodoInputByDoc] = useState<Record<string, string>>({});
  const [todoAddingKey, setTodoAddingKey] = useState<string | null>(null);
  const [todoNewFileName, setTodoNewFileName] = useState("");
  const [todoNewTaskText, setTodoNewTaskText] = useState("");
  const [todoCreatingKey, setTodoCreatingKey] = useState<string | null>(null);

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
      const nextDocs = Array.isArray(result?.docs) ? result.docs : [];
      setTodoDocs(nextDocs);

      setTodoInputByDoc((prev) => {
        const nextInputs: Record<string, string> = {};
        for (const doc of nextDocs) {
          const existing = prev[doc.filePath];
          if (typeof existing === "string") {
            nextInputs[doc.filePath] = existing;
          } else {
            nextInputs[doc.filePath] = "";
          }
        }
        return nextInputs;
      });
    } catch (err: any) {
      setTodoError(err?.message || "TODO 목록을 불러오지 못했습니다");
      setTodoDocs([]);
    } finally {
      setTodoLoading(false);
    }
  };

  const handleTodoToggle = async (docFilePath: string, taskIndex: number, checked: boolean) => {
    if (!window.easyGithub) return;

    if (!activeProjectPath) {
      toast.error("프로젝트가 선택되어 있지 않습니다");
      return;
    }

    const updateKey = `${docFilePath}:${taskIndex}`;
    setTodoUpdatingKey(updateKey);

    try {
      const result = await window.easyGithub.todos.update(activeProjectPath, docFilePath, taskIndex, checked);
      if (!result.success) {
        toast.error("TODO 항목을 찾지 못했습니다");
        return;
      }

      setTodoDocs((prev) =>
        prev.map((doc) => (doc.filePath === docFilePath ? { ...doc, tasks: result.tasks } : doc))
      );
    } catch (err: any) {
      toast.error(err?.message || "TODO 업데이트에 실패했습니다");
    } finally {
      setTodoUpdatingKey(null);
    }
  };

  const handleTodoAdd = async (docFilePath: string) => {
    if (!window.easyGithub) return;

    if (!activeProjectPath) {
      toast.error("프로젝트가 선택되어 있지 않습니다");
      return;
    }

    const text = (todoInputByDoc[docFilePath] ?? "").trim();
    if (!text) {
      toast.error("추가할 TODO 내용을 입력해주세요");
      return;
    }

    const addKey = `${docFilePath}:add`;
    setTodoAddingKey(addKey);

    try {
      const result = await window.easyGithub.todos.add(activeProjectPath, docFilePath, text);
      if (!result.success) {
        toast.error("TODO 추가에 실패했습니다");
        return;
      }

      setTodoDocs((prev) =>
        prev.map((doc) => (doc.filePath === docFilePath ? { ...doc, tasks: result.tasks } : doc))
      );
      setTodoInputByDoc((prev) => ({ ...prev, [docFilePath]: "" }));
    } catch (err: any) {
      toast.error(err?.message || "TODO 추가에 실패했습니다");
    } finally {
      setTodoAddingKey(null);
    }
  };

  const handleTodoCreateFile = async () => {
    if (!window.easyGithub) return;

    if (!activeProjectPath) {
      toast.error("프로젝트가 선택되어 있지 않습니다");
      return;
    }

    const fileBaseName = todoNewFileName.trim();
    const taskText = todoNewTaskText.trim();

    if (!fileBaseName) {
      toast.error("새 TODO 파일 이름을 입력해주세요");
      return;
    }

    if (!/^[\w\d._-]+$/.test(fileBaseName)) {
      toast.error("파일 이름에는 영문/숫자/._- 만 사용할 수 있습니다");
      return;
    }

    if (!taskText) {
      toast.error("첫 TODO 내용을 입력해주세요");
      return;
    }

    const fileName = fileBaseName.endsWith(".md") || fileBaseName.endsWith(".txt")
      ? fileBaseName
      : `${fileBaseName}.md`;
    const normalizedRepoPath = activeProjectPath.replace(/[\\/]+$/, "");
    const filePath = `${normalizedRepoPath}/todos/${fileName}`;

    setTodoCreatingKey(filePath);

    try {
      const result = await window.easyGithub.todos.add(activeProjectPath, filePath, taskText);
      if (!result.success) {
        toast.error("TODO 파일 생성에 실패했습니다");
        return;
      }

      setTodoDocs((prev) => [
        { fileName, filePath, tasks: result.tasks },
        ...prev
      ]);
      setTodoInputByDoc((prev) => ({ ...prev, [filePath]: "" }));
      setTodoNewFileName("");
      setTodoNewTaskText("");
    } catch (err: any) {
      toast.error(err?.message || "TODO 파일 생성에 실패했습니다");
    } finally {
      setTodoCreatingKey(null);
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

  const [cloneMode, setCloneMode] = useState<"overwrite" | "preserve">("overwrite");

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
        const releaseNotesRaw = payload?.info?.releaseNotes ? String(payload.info.releaseNotes) : undefined;
        const releaseNotes = releaseNotesRaw
          ?.replace(/<[^>]+>/g, '')
          .replace(/<\/\s*n\s*>/gi, '')
          .replace(/&lt;|&gt;/g, '')
          .replace(/\r\n?/g, '\n')
          .trim() || undefined;
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
         setUpdateDialogOpen(false);
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
      if (result.status === "busy") {
        toast.info("이미 업데이트 확인 중입니다", { id: toastId });
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
    setUpdateDialogOpen(false);

    try {
      const result = await window.easyGithub.app.downloadUpdate();
      if (result.status === "disabled") {
        toast.info("개발 모드에서는 자동 업데이트가 비활성화됩니다");
        return;
      }
      if (result.status === "busy") {
        toast.info("이미 업데이트를 다운로드 중입니다");
        return;
      }

      // 진행률/완료는 onUpdateEvent로 들어온다.
    } catch (err: any) {
      toast.error(err?.message || "업데이트 다운로드에 실패했습니다");
      setUpdateState({ stage: "error", errorMessage: err?.message || "업데이트 다운로드에 실패했습니다" });
      setUpdateDialogOpen(true);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.easyGithub) return;

    try {
      await window.easyGithub.app.installUpdate();
    } catch (err: any) {
      toast.error(err?.message || "업데이트 적용에 실패했습니다");
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
      // 덮어쓰기 모드는 빈 폴더만 허용하고, 유지 모드는 기존 파일을 보존한다.
      // 유지 모드는 기존 파일을 보존하고 없는 파일만 추가한다.
      await window.easyGithub.git.clone(newProjectUrl, newProjectPath, cloneMode);
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
      toast.error("Electron 환경에서만 다운로드(원격 확인)를 지원합니다");
      return;
    }

    const toastId = toast.loading("원격 변경사항을 다운로드 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.fetch(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("다운로드 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "다운로드에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handlePull = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 로컬로 합치기를 지원합니다");
      return;
    }

    const toastId = toast.loading("로컬로 합치는 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.pull(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("로컬로 합치기 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "로컬로 합치기에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const handlePush = async (projectId: string, projectName: string, projectPath: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 업로드를 지원합니다");
      return;
    }

    const toastId = toast.loading("업로드 중...");
    setGitBusy(projectId);

    try {
      setActiveProject(projectPath, projectName);
      await window.easyGithub.git.push(projectPath);
      const status = await window.easyGithub.git.status(projectPath);
      applyStatusToProject(projectId, status);
      toast.success("업로드 완료!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "업로드에 실패했습니다", { id: toastId });
    } finally {
      setGitBusy(null);
    }
  };

  const totalChanges = projects.reduce((sum, project) => sum + project.uncommittedChanges, 0);
  const totalAhead = projects.reduce((sum, project) => sum + project.ahead, 0);
  const totalBehind = projects.reduce((sum, project) => sum + project.behind, 0);
  const overviewMetrics = [
    { label: "전체 프로젝트", value: projects.length, icon: FolderGit2, color: "text-[#0969da]" },
    { label: "변경사항", value: totalChanges, icon: FileText, color: "text-[#fb6500]" },
    { label: "업로드 대기", value: totalAhead, icon: RefreshCw, color: "text-[#1a7f37]" },
    { label: "로컬 반영 필요", value: totalBehind, icon: GitBranch, color: "text-[#8250df]" }
  ];

  return (
    <div className="space-y-5">
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent hideOverlay overlayClassName="bg-transparent">
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
                  종료 후 업데이트 적용
                </Button>
              ) : null}

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {overviewMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-md border border-[#d8dee4] bg-white px-5 py-4 shadow-sm dark:border-[#30363d] dark:bg-[#15181e]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{metric.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${metric.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* User TODO List */}
      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader className="border-b border-[#d8dee4] pb-4 dark:border-[#30363d]">
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
                  {todoMatchKeys.length > 0 ? (
                    <>
                      매칭 키:
                      {" "}
                      {todoMatchKeys.map((k) => (
                        <code key={k} className="font-mono ml-1">
                          {k}
                        </code>
                      ))}
                    </>
                  ) : null}

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
              <CardContent className="pt-0 pb-4 min-h-[120px]">
                {doc.tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">할 일 항목(- [ ])이 없습니다.</p>
                ) : (
                  <div className="space-y-2">

                          {doc.tasks.map((task, index) => {
                            const updateKey = `${doc.filePath}:${index}`;
                            const isUpdating = todoUpdatingKey === updateKey;
 
                            return (
                              <div key={updateKey} className="flex items-start gap-2">
                                <Checkbox
                                  checked={task.checked}
                                  disabled={isUpdating}
                                  onCheckedChange={(value) => handleTodoToggle(doc.filePath, index, Boolean(value))}
                                  className="mt-0.5"
                                />
                                <span
                                  className={`text-sm leading-relaxed ${task.checked ? "line-through text-muted-foreground" : ""}`}
                                >
                                  {task.text}
                                </span>
                                {task.checked ? (
                                  <Badge variant="outline" className="text-[10px] mt-0.5 self-start">완료</Badge>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={todoInputByDoc[doc.filePath] ?? ""}
                            placeholder="새 TODO를 입력하세요"
                            onChange={(event) =>
                              setTodoInputByDoc((prev) => ({ ...prev, [doc.filePath]: event.target.value }))
                            }
                          />
                          <Button
                            type="button"
                            onClick={() => handleTodoAdd(doc.filePath)}
                            disabled={todoAddingKey === `${doc.filePath}:add`}
                          >
                            추가
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          새 항목은 <code className="font-mono">- [ ]</code> 형식으로 저장됩니다.
                        </p>
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {activeProjectPath ? (
            <Card className="border border-dashed">
              <CardHeader className="py-4">
                <CardTitle className="text-sm">새 TODO 파일 만들기</CardTitle>
                <CardDescription className="text-xs">
                  todos 폴더에 새 문서를 생성하고 첫 TODO를 추가합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs">파일 이름</Label>
                  <Input
                    placeholder="예: my-todo.md"
                    value={todoNewFileName}
                    onChange={(event) => setTodoNewFileName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">첫 TODO</Label>
                  <Input
                    placeholder="예: 로그인 테스트 정리"
                    value={todoNewTaskText}
                    onChange={(event) => setTodoNewTaskText(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleTodoCreateFile}
                  disabled={todoCreatingKey !== null}
                >
                  새 파일 생성
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      {/* Add Project Button */}
      {!showAddProject && (
        <button
          type="button"
          className="w-full rounded-md border border-dashed border-[#8c959f] bg-[#f6f8fa] px-5 py-8 text-left transition-colors hover:border-[#0969da] hover:bg-[#eef6ff] dark:border-[#30363d] dark:bg-[#15181e] dark:hover:border-[#58a6ff] dark:hover:bg-[#0d263a]"
          onClick={() => setShowAddProject(true)}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0969da] text-white">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">프로젝트 추가하기</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  GitHub에서 코드를 다운로드하거나 새 프로젝트를 시작하세요
                </p>
              </div>
            </div>
            <span className="inline-flex h-9 items-center rounded-md bg-[#1f2328] px-4 text-sm font-medium text-white dark:bg-[#f0f3f6] dark:text-[#15181e]">
              시작하기
            </span>
          </div>
        </button>
      )}

      {/* Add Project Form */}
      {showAddProject && (
        <Card className="rounded-md border-[#0969da] shadow-sm">
          <CardHeader className="border-b border-[#d8dee4] bg-[#f6f8fa] dark:border-[#30363d] dark:bg-[#15181e]">
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              새 프로젝트 추가
            </CardTitle>
            <CardDescription className="text-base">
              GitHub 저장소를 Clone(다운로드)하거나 로컬 프로젝트를 추가하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Card className="rounded-md border-[#d8dee4] bg-[#fff8c5] dark:border-[#3b3320] dark:bg-[#2d260f]">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <div className="text-sm text-[#7d4e00] dark:text-[#f0d98c]">
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
            <div className="space-y-2">
              <Label className="text-base font-semibold">클론 모드</Label>
              <Select value={cloneMode} onValueChange={(value) => setCloneMode(value as "overwrite" | "preserve")}>
                <SelectTrigger className="text-base">
                  <SelectValue placeholder="클론 모드를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">덮어쓰기 모드 (빈 폴더 필요)</SelectItem>
                  <SelectItem value="preserve">유지 모드 (기존 파일 유지)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                유지 모드는 기존 파일을 보존하고 없는 파일만 추가합니다.
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
          <Card className="rounded-md border-dashed border-[#d8dee4] dark:border-[#30363d]">
            <CardContent className="py-10 text-center text-muted-foreground">
              <FolderGit2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-semibold text-foreground">아직 프로젝트가 없습니다</p>
              <p className="text-sm mt-1">위의 프로젝트 추가 영역에서 로컬 저장소를 연결하세요.</p>
            </CardContent>
          </Card>
        ) : (
           projects.map((project) => (
             <Card
               key={project.id}
               className={`rounded-md transition-colors cursor-pointer shadow-sm ${
                 activeProjectPath === project.path
                   ? "border-[#0969da] bg-[#eef6ff] dark:border-[#58a6ff] dark:bg-[#0d263a]"
                   : "border-[#d8dee4] hover:border-[#8c959f] dark:border-[#30363d] dark:hover:border-[#8b949e]"
               }`}
               onClick={() => setActiveProject(project.path, project.name)}
             >
               <CardContent className="p-4">
                 <div className="flex items-start justify-between gap-4">

                  <div className="flex-1 space-y-4">
                    {/* Project Header */}
                    <div className="flex min-w-0 items-center gap-3">
                      <FolderGit2 className="h-5 w-5 flex-shrink-0 text-[#0969da]" />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{project.name}</h3>
                        <p className="truncate font-mono text-sm text-muted-foreground">{project.path}</p>
                      </div>
                    </div>

                    {/* Branch and Status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-[#ddf4ff] text-[#0969da] border-[#b6e3ff]">
                        <GitBranch className="w-3 h-3 mr-1" />
                        {project.currentBranch}
                      </Badge>
                      
                      {project.uncommittedChanges > 0 && (
                        <Badge variant="outline" className="bg-[#fff1e5] text-[#bc4c00] border-[#ffd8b5]">
                          {project.uncommittedChanges} 변경됨
                        </Badge>
                      )}
                      
                      {project.ahead > 0 && (
                        <Badge variant="outline" className="bg-[#dafbe1] text-[#1a7f37] border-[#aceebb]">
                          ↑ {project.ahead} 커밋 앞서감
                        </Badge>
                      )}
                      
                      {project.behind > 0 && (
                        <Badge variant="outline" className="bg-[#ffebe9] text-[#cf222e] border-[#ffcecb]">
                          ↓ {project.behind} 커밋 뒤처짐
                        </Badge>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span className="truncate">{project.lastCommit}</span>
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
                     <div className="flex flex-wrap gap-2">
                       <Button
                         size="sm"
                         variant="default"
                         onClick={(event) => {
                           event.stopPropagation();
                           handleCheckStatus(project.id, project.name, project.path);
                         }}
                         disabled={gitBusy === project.id || gitBusy === "clone"}
                       >

                        <RefreshCw className="w-4 h-4 mr-2" />
                        상태
                      </Button>
                      <Button
                         size="sm"
                         variant="outline"
                         onClick={(event) => {
                           event.stopPropagation();
                           handleFetch(project.id, project.name, project.path);
                         }}
                         disabled={gitBusy === project.id || gitBusy === "clone"}
                       >
                         다운로드
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={(event) => {
                           event.stopPropagation();
                           handlePull(project.id, project.name, project.path);
                         }}
                         disabled={gitBusy === project.id || gitBusy === "clone"}
                       >
                         로컬로 합치기
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={(event) => {
                           event.stopPropagation();
                           handlePush(project.id, project.name, project.path);
                         }}
                         disabled={gitBusy === project.id || gitBusy === "clone"}
                       >
                         업로드
                       </Button>

                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.easyGithub) {
                            window.easyGithub.app.openExternal(project.url);
                          } else {
                            window.open(project.url, '_blank');
                          }
                        }}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveProject(project.id, project.name);
                      }}
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
