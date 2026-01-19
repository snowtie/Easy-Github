import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { FolderGit2, Plus, ExternalLink, GitBranch, Star, Clock, Users, Trash2, RefreshCw, FileText } from "lucide-react";
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

export function ProjectOverview() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [gitBusy, setGitBusy] = useState<string | null>(null);

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

  useEffect(() => {
    loadProjects();
  }, []);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");

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
              <Input
                id="local-path"
                placeholder="예: C:/내문서/프로젝트/my-project"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                className="text-base"
              />
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
          <Badge variant="outline" className="text-sm">
            {projects.length}개
          </Badge>
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