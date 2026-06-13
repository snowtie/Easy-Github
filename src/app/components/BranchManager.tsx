import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { GitBranch, GitMerge, Plus, Trash2, CheckCircle2, PencilLine, GitPullRequest, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/app/components/ui/dialog";

interface Branch {
  id: string;
  name: string;
  current: boolean;
  lastCommit: string;
  author: string;
  ahead: number;
  behind: number;
  isProtected: boolean;
  isRemote: boolean;
}

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";

export function BranchManager() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [showGuide, setShowGuide] = useState(true);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [activeProjectName, setActiveProjectName] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
  const [busy, setBusy] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Branch | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBusy, setGithubBusy] = useState(false);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [githubError, setGithubError] = useState<string | null>(null);

  const refreshInFlightRef = useRef(false);

  const currentBranch = useMemo(() => branches.find((b) => b.current), [branches]);

  const resolveGithubRepo = async (repoPath: string) => {
    if (!window.easyGithub) return null;

    try {
      const originUrl = await window.easyGithub.git.originUrl(repoPath);
      if (!originUrl) return null;

      const normalized = originUrl.replace(/\.git$/, "");
      const match = normalized.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+)$/i);
      if (!match?.groups?.owner || !match?.groups?.repo) return null;

      return { owner: match.groups.owner, repo: match.groups.repo };
    } catch {
      return null;
    }
  };

  const refreshGithubData = async (repoPath: string) => {
    if (!window.easyGithub) return;

    setGithubBusy(true);
    setGithubError(null);

    try {
      const resolved = await resolveGithubRepo(repoPath);
      if (!resolved) {
        setGithubOwner("");
        setGithubRepo("");
        setPullRequests([]);
        setIssues([]);
        setGithubError("GitHub 저장소 정보를 확인할 수 없습니다. origin URL을 확인해주세요.");
        return;
      }

      setGithubOwner(resolved.owner);
      setGithubRepo(resolved.repo);

      const [prs, issueList] = await Promise.all([
        window.easyGithub.github.listPullRequests(resolved.owner, resolved.repo),
        window.easyGithub.github.listIssues(resolved.owner, resolved.repo, "open")
      ]);

      setPullRequests(Array.isArray(prs) ? prs : []);
      setIssues(Array.isArray(issueList) ? issueList : []);
    } catch (err: any) {
      setGithubError(err?.message || "GitHub 정보를 불러오지 못했습니다");
    } finally {
      setGithubBusy(false);
    }
  };

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 관리를 지원합니다");
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    const repoName = localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "";
    setActiveProjectPath(repoPath);
    setActiveProjectName(repoName);

    if (!repoPath) {
      setBranches([]);
      refreshInFlightRef.current = false;
      return;
    }

    setBusy(true);
    try {
      const result = await window.easyGithub.git.branches(repoPath);
      const all = (result?.all ?? []) as any[];

      const normalized: Branch[] = all.map((b) => ({
        id: b.name,
        name: b.name,
        current: Boolean(b.current),
        lastCommit: "",
        author: "",
        ahead: 0,
        behind: 0,
        isProtected: Boolean(b.protected),
        isRemote: Boolean(b.remote)
      }));

      const sorted = [...normalized].sort((a, b) => {
        if (a.current !== b.current) return a.current ? -1 : 1;
        if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      setBranches(sorted);

      // baseBranch 기본값을 현재 브랜치로 맞춘다.
      const current = normalized.find((b) => b.current)?.name;
      if (current) setBaseBranch(current);

      await refreshGithubData(repoPath);
    } catch (err: any) {
      toast.error(err?.message || "브랜치 목록 조회에 실패했습니다");
    } finally {
      setBusy(false);
      refreshInFlightRef.current = false;
    }
  };

  const handleSyncRemoteBranches = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 동기화를 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const toastId = toast.loading("원격 브랜치를 동기화 중...");
    setBusy(true);

    try {
      await window.easyGithub.git.fetch(activeProjectPath);
      await refresh();
      toast.success("원격 브랜치 동기화 완료", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "브랜치 동기화에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();

    const handleActiveProjectChanged = () => {
      void refresh();
    };

    window.addEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    return () => window.removeEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast.error("브랜치 이름을 입력해주세요");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 생성을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    if (branches.some((b) => !b.isRemote && b.name === newBranchName)) {
      toast.error("이미 존재하는 브랜치 이름입니다");
      return;
    }

    const toastId = toast.loading("브랜치 생성 중...");
    setBusy(true);

    try {
      // baseBranch에서 새 브랜치를 만들고 바로 전환
      await window.easyGithub.git.createBranch(activeProjectPath, newBranchName, baseBranch);
      toast.success(`${newBranchName} 브랜치가 생성되었습니다!`, { id: toastId });
      setNewBranchName("");
      setShowCreateBranch(false);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 생성에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchBranch = async (branchName: string, isRemote: boolean) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 전환을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const toastId = toast.loading(isRemote ? "원격 브랜치 내려받는 중..." : "브랜치 전환 중...");
    setBusy(true);

    try {
      if (isRemote) {
        const localName = await window.easyGithub.git.checkoutRemoteBranch(activeProjectPath, branchName);
        toast.success(`${localName} 브랜치를 로컬로 만들고 전환했습니다`, { id: toastId });
      } else {
        await window.easyGithub.git.checkoutBranch(activeProjectPath, branchName);
        toast.success(`${branchName} 브랜치로 전환되었습니다`, { id: toastId });
      }
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 전환에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const openRenameDialog = (branch: Branch) => {
    if (branch.isRemote) {
      toast.error("원격 브랜치는 로컬 이름 변경이 불가능합니다");
      return;
    }

    setRenameTarget(branch);
    setRenameInput(branch.name);
    setRenameDialogOpen(true);
  };

  const handleRenameBranch = async () => {
    if (!renameTarget) return;

    if (renameTarget.isRemote) {
      toast.error("원격 브랜치는 로컬 이름 변경이 불가능합니다");
      return;
    }

    const nextName = renameInput.trim();
    if (!nextName) {
      toast.error("새 브랜치 이름을 입력해주세요");
      return;
    }

    if (nextName === renameTarget.name) {
      toast.error("현재 브랜치 이름과 같습니다");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 이름 변경을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    if (branches.some((b) => !b.isRemote && b.name === nextName)) {
      toast.error("이미 존재하는 브랜치 이름입니다");
      return;
    }

    const toastId = toast.loading("브랜치 이름 변경 중...");
    setBusy(true);

    try {
      await window.easyGithub.git.renameBranch(activeProjectPath, renameTarget.name, nextName);
      toast.success(`${renameTarget.name} 브랜치 이름을 변경했습니다`, { id: toastId });
      setRenameDialogOpen(false);
      setRenameTarget(null);
      setRenameInput("");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 이름 변경에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBranch = async (branchName: string, isProtected: boolean, isCurrent: boolean, isRemote: boolean) => {
    if (isProtected) {
      toast.error("보호된 브랜치는 삭제할 수 없습니다");
      return;
    }

    if (isCurrent) {
      toast.error("현재 브랜치는 삭제할 수 없습니다");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 삭제를 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const isRemoteLabel = isRemote ? "원격 브랜치" : "로컬 브랜치";
    if (isRemote) {
      const confirmed = confirm(`${branchName} ${isRemoteLabel}를 삭제할까요?\n(원격 저장소에서도 사라집니다)`);
      if (!confirmed) {
        toast.error("브랜치 삭제가 취소되었습니다");
        return;
      }
    }

    const toastId = toast.loading(isRemote ? "원격 브랜치 삭제 중..." : "브랜치 삭제 중...");
    setBusy(true);

    try {
      if (isRemote) {
        await window.easyGithub.git.deleteBranch(activeProjectPath, branchName, { remote: true });
        toast.success(`${branchName} ${isRemoteLabel}가 삭제되었습니다`, { id: toastId });
        await refresh();
        return;
      }

      try {
        await window.easyGithub.git.deleteBranch(activeProjectPath, branchName);
      } catch (err: any) {
        const message = String(err?.message ?? "");
        // 복잡한 로직: 병합되지 않은 브랜치는 사용자 확인 후 강제 삭제한다.
        if (message.includes("not fully merged") || message.includes("not yet merged")) {
          const forceConfirmed = confirm(`${branchName} 브랜치는 아직 병합되지 않았습니다.\n강제로 삭제할까요?`);
          if (!forceConfirmed) {
            toast.error("브랜치 삭제가 취소되었습니다", { id: toastId });
            return;
          }
          await window.easyGithub.git.deleteBranch(activeProjectPath, branchName, { force: true });
        } else {
          throw err;
        }
      }

      toast.success(`${branchName} ${isRemoteLabel}가 삭제되었습니다`, { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 삭제에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleMergeBranch = async (branchName: string, isRemote: boolean) => {
    if (isRemote) {
      toast.error("원격 브랜치는 먼저 로컬로 내려받아야 합니다");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 병합을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    if (!currentBranch?.name) {
      toast.error("현재 브랜치를 확인할 수 없습니다");
      return;
    }

    const toastId = toast.loading("병합 중...");
    setBusy(true);

    try {
      const result = await window.easyGithub.git.merge(activeProjectPath, branchName);

      // 병합 충돌이 있으면 backend에서 conflicts 정보를 돌려준다.
      if (result?.conflicts?.length) {
        toast.error(`병합 충돌이 ${result.conflicts.length}개 발생했습니다. 충돌을 해결해주세요.`, { id: toastId });
      } else {
        toast.success(`${branchName}을(를) ${currentBranch.name}에 병합했습니다`, { id: toastId });
      }

      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "병합에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Guide Card */}
      {showGuide && (
        <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
          <CardHeader className="border-b border-[#d8dee4] pb-4 dark:border-[#30363d]">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                브랜치가 뭐예요?
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(false)}
              >
                닫기
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] p-4 dark:border-[#30363d] dark:bg-[#15181e]">
              <p className="font-semibold mb-2">Git Flow 기준으로 이해하기</p>
              <p className="text-sm">
                Git Flow는 안정 브랜치와 작업 브랜치를 나눠서 운영하는 흐름이에요.
                <strong>main</strong>은 배포용, <strong>develop</strong>은 개발 통합용으로 두고,
                기능 개발은 <strong>feature</strong>, 배포 준비는 <strong>release</strong>, 긴급 수정은 <strong>hotfix</strong>에서 처리해요.

              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="font-semibold">브랜치를 사용하는 이유:</p>
              <div className="space-y-1">
                <p><strong>역할 분리:</strong> main(배포), develop(통합), feature/release/hotfix(작업)</p>
                <p><strong>배포 안정성:</strong> release에서 충분히 테스트한 뒤 main으로 합칩니다</p>
                <p><strong>긴급 대응:</strong> hotfix로 바로 수정 → main, develop에 모두 반영</p>
                <p><strong>협업 규칙:</strong> feature는 develop로, release/hotfix는 main+develop로</p>

              </div>
            </div>

            <div className="rounded-md border border-[#d8dee4] bg-[#fff8c5] p-3 dark:border-[#3b3320] dark:bg-[#2d260f]">
              <p className="text-xs text-[#7d4e00] dark:text-[#f0d98c]">
                <strong>기억하세요:</strong> main은 배포용, develop은 통합용이며,
                feature/release/hotfix는 목적이 끝나면 합치고 정리합니다.

              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Branch Info */}
      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[#0969da]">
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle>현재 브랜치</CardTitle>
                <CardDescription className="text-lg font-semibold text-[#0969da] dark:text-[#58a6ff]">
                  {activeProjectName ? (
                    <span>
                      {currentBranch?.name || "-"}
                       <span className="ml-2 text-sm font-normal text-muted-foreground">({activeProjectName})</span>
                    </span>
                  ) : (
                    currentBranch?.name
                  )}
                </CardDescription>
                {activeProjectPath ? (
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{activeProjectPath}</div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentBranch?.isProtected && (
                <Badge className="border-[#ffd8b5] bg-[#fff1e5] text-[#bc4c00]">보호됨</Badge>
              )}
              <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

       {/* Create Branch Button */}
        {!showCreateBranch && (
          <Button
            onClick={() => setShowCreateBranch(true)}
            className="w-full"
            size="lg"
            disabled={busy || !activeProjectPath}
          >
            <Plus className="w-4 h-4 mr-2" />
            새 브랜치 만들기
          </Button>
        )}

      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader className="border-b border-[#d8dee4] pb-4 dark:border-[#30363d]">
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-slate-600" />
            GitHub 요약
          </CardTitle>
          <CardDescription>
            {githubOwner && githubRepo ? `${githubOwner}/${githubRepo}` : "GitHub 저장소 연결이 필요합니다"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubError ? (
            <div className="flex items-start gap-2 rounded-md border border-[#ffcecb] bg-[#ffebe9] px-3 py-2 text-sm text-[#cf222e]">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{githubError}</span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-[#d8dee4] bg-white p-3 dark:border-[#30363d] dark:bg-[#15181e]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">열린 PR</span>
                <span className="text-lg font-bold text-blue-600">
                  {pullRequests.filter((pr) => pr.state === "open").length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {pullRequests
                  .filter((pr) => pr.state === "open")
                  .slice(0, 3)
                  .map((pr) => (
                    <div key={pr.id} className="text-sm">
                      <span className="font-medium">#{pr.number}</span> {pr.title}
                    </div>
                  ))}
                {pullRequests.filter((pr) => pr.state === "open").length === 0 ? (
                  <div className="text-sm text-muted-foreground">PR이 없습니다</div>
                ) : null}
              </div>
            </div>
            <div className="rounded-md border border-[#d8dee4] bg-white p-3 dark:border-[#30363d] dark:bg-[#15181e]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">열린 Issue</span>
                <span className="text-lg font-bold text-orange-600">{issues.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="text-sm">
                    <span className="font-medium">#{issue.number}</span> {issue.title}
                  </div>
                ))}
                {issues.length === 0 ? <div className="text-sm text-muted-foreground">Issue가 없습니다</div> : null}
              </div>
            </div>
          </div>
          {githubBusy ? <div className="text-sm text-muted-foreground">GitHub 정보를 불러오는 중...</div> : null}
        </CardContent>
      </Card>


      {/* Create Branch Form */}
      {showCreateBranch && (
        <Card className="rounded-md border-[#0969da] shadow-sm">
          <CardHeader className="border-b border-[#d8dee4] bg-[#f6f8fa] dark:border-[#30363d] dark:bg-[#15181e]">
            <CardTitle>새 브랜치 만들기</CardTitle>
            <CardDescription className="text-base">
              새로운 작업을 위한 독립적인 공간을 만들어요
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Card className="rounded-md border-[#d8dee4] bg-[#f6f8fa] dark:border-[#30363d] dark:bg-[#15181e]">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <div className="text-sm">
                    <p className="font-semibold mb-1">브랜치란?</p>
              <p>Git Flow에서는 main/develop을 기준으로 feature/release/hotfix 브랜치를 분리해서 작업해요.</p>

                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <label className="text-base font-semibold">브랜치 이름</label>
              <Input
                placeholder="예: feature/login (Git Flow 기능 브랜치)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="text-base"
              />
              <p className="text-sm text-muted-foreground">
                Git Flow 규칙으로 작업 목적에 맞는 접두어를 붙여주세요.
              </p>
              <div className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-2 text-sm dark:border-[#30363d] dark:bg-[#15181e]">
                <p className="font-semibold">Git Flow 브랜치 예시</p>
                <ul className="mt-1 space-y-1">
                  <li><span className="font-mono">feature/login</span> - 새 기능</li>
                  <li><span className="font-mono">release/1.2.0</span> - 배포 준비</li>
                  <li><span className="font-mono">hotfix/1.2.1</span> - 긴급 수정</li>
                </ul>
              </div>


            </div>
            <div className="space-y-2">
              <label className="text-base font-semibold">어느 브랜치에서 시작할까요?</label>
              <select
                className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-base shadow-sm"
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
              >
                 {branches.map((branch) => (
                   <option key={branch.id} value={branch.name}>
                     {branch.name}
                   </option>
                 ))}
              </select>
              <p className="text-sm text-muted-foreground">
                Git Flow에서는 기능 작업은 develop에서 시작하는 경우가 많아요
              </p>

            </div>
            <div className="flex gap-3">
               <Button onClick={handleCreateBranch} className="flex-1" size="lg" disabled={busy}>
                 브랜치 만들기
               </Button>
               <Button 
                 variant="outline" 
                 onClick={() => {
                   setShowCreateBranch(false);
                   setNewBranchName("");
                 }} 
                 size="lg"
                 disabled={busy}
               >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

       {/* Branch List */}
        <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
          <CardHeader className="border-b border-[#d8dee4] pb-4 dark:border-[#30363d]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>모든 브랜치</CardTitle>
                <CardDescription>{branches.length}개의 브랜치</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncRemoteBranches}
                disabled={busy || githubBusy || !activeProjectPath}
              >
                GitHub 동기화
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">

           {!activeProjectPath ? (
             <div className="text-center py-12 text-muted-foreground">
               <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
               <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
               <p className="text-sm mt-2">"프로젝트" 탭에서 Clone 후 상태 버튼을 눌러 선택해주세요.</p>
             </div>
           ) : branches.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">
               <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
               <p>브랜치를 불러오지 못했거나, 브랜치가 없습니다</p>
             </div>
           ) : (
             branches.map((branch) => (
               <div
                 key={branch.id}
                  className={`rounded-md border p-4 transition-colors ${
branch.current
                      ? "border-[#0969da] bg-[#eef6ff] dark:border-[#58a6ff] dark:bg-[#0d263a]"
                      : "border-[#d8dee4] bg-white hover:border-[#8c959f] dark:border-[#30363d] dark:bg-[#15181e] dark:hover:border-[#8b949e]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                     {/* Branch Name */}
                      <div className="flex min-w-0 items-center gap-3">
                        <GitBranch className={`h-5 w-5 flex-shrink-0 ${branch.current ? "text-[#0969da]" : "text-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                           <div className="flex flex-wrap items-center gap-2">
                             <span className="truncate font-mono font-semibold">{branch.name}</span>
                             {branch.current && (
                               <Badge className="bg-[#0969da]">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                현재
                              </Badge>
                            )}
                            {branch.isProtected && (
                               <Badge variant="outline" className="border-[#ffd8b5] bg-[#fff1e5] text-[#bc4c00]">
                                보호됨
                              </Badge>
                            )}
                            {branch.isRemote && (
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                                원격
                              </Badge>
                            )}
                          </div>

                         <p className="text-sm text-muted-foreground mt-1">
                           {branch.author || "-"} • {branch.lastCommit || "-"}
                         </p>
                       </div>
                     </div>

                     {/* Actions */}
                       {!branch.current && (
                         <div className="flex flex-wrap gap-2 pl-0 md:pl-8">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSwitchBranch(branch.name, branch.isRemote)}
                            disabled={busy}
                          >
                            {branch.isRemote ? "로컬로 받기" : "전환"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMergeBranch(branch.name, branch.isRemote)}
                            disabled={busy || branch.isRemote}
                          >
                            <GitMerge className="w-4 h-4 mr-2" />
                            병합
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRenameDialog(branch)}
                            disabled={busy || branch.isRemote}
                          >
                            <PencilLine className="w-4 h-4 mr-2" />
                            이름 변경
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteBranch(branch.name, branch.isProtected, branch.current, branch.isRemote)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={busy || branch.isProtected || branch.current || branch.isRemote}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Dialog open={renameDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setRenameDialogOpen(false);
            setRenameTarget(null);
            setRenameInput("");
            return;
          }
          if (!renameTarget) {
            setRenameDialogOpen(false);
            return;
          }
          setRenameDialogOpen(true);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>브랜치 이름 변경</DialogTitle>
              <DialogDescription>새 브랜치 이름을 입력해주세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="text-sm font-semibold">현재 이름</label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono">
                {renameTarget?.name ?? "-"}
              </div>
              <label className="text-sm font-semibold">새 이름</label>
              <Input
                value={renameInput}
                onChange={(event) => setRenameInput(event.target.value)}
                placeholder="예: feature/new-flow"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={busy}>
                취소
              </Button>
              <Button onClick={handleRenameBranch} disabled={busy}>
                변경
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
     </div>
   );
 }
