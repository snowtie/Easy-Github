import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { GitBranch, GitMerge, Plus, Trash2, CheckCircle2, Upload, Download } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  current: boolean;
  lastCommit: string;
  author: string;
  ahead: number;
  behind: number;
  isProtected: boolean;
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

  const refreshInFlightRef = useRef(false);

  const currentBranch = useMemo(() => branches.find((b) => b.current), [branches]);

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
        isProtected: Boolean(b.protected)
      }));

      setBranches(normalized);

      // baseBranch 기본값을 현재 브랜치로 맞춘다.
      const current = normalized.find((b) => b.current)?.name;
      if (current) setBaseBranch(current);
    } catch (err: any) {
      toast.error(err?.message || "브랜치 목록 조회에 실패했습니다");
    } finally {
      setBusy(false);
      refreshInFlightRef.current = false;
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

    if (branches.some((b) => b.name === newBranchName)) {
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

  const handleSwitchBranch = async (branchName: string) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 브랜치 전환을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const toastId = toast.loading("브랜치 전환 중...");
    setBusy(true);

    try {
      await window.easyGithub.git.checkoutBranch(activeProjectPath, branchName);
      toast.success(`${branchName} 브랜치로 전환되었습니다`, { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 전환에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBranch = async (branchName: string, isProtected: boolean, isCurrent: boolean) => {
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

    const toastId = toast.loading("브랜치 삭제 중...");
    setBusy(true);

    try {
      await window.easyGithub.git.deleteBranch(activeProjectPath, branchName);
      toast.success(`${branchName} 브랜치가 삭제되었습니다`, { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "브랜치 삭제에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleMergeBranch = async (branchName: string) => {
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

      // simple-git merge 충돌이 있으면 conflicts 정보가 들어올 수 있다.
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
    <div className="space-y-6">
      {/* Guide Card */}
      {showGuide && (
        <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-900 dark:text-green-100 flex items-center gap-2">
                🌿 브랜치가 뭐예요?
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(false)}
                className="text-green-700 dark:text-green-200"
              >
                닫기
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-green-900 dark:text-green-100">
            <div className="bg-card/60 p-4 rounded-lg">
              <p className="font-semibold mb-2">🎮 게임으로 이해하기:</p>
              <p className="text-sm">
                Git Flow는 안정 브랜치와 작업 브랜치를 나눠서 운영하는 흐름이에요.
                <strong>main</strong>은 배포용, <strong>develop</strong>은 개발 통합용으로 두고,
                기능 개발은 <strong>feature</strong>, 배포 준비는 <strong>release</strong>, 긴급 수정은 <strong>hotfix</strong>에서 처리해요.

              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="font-semibold">브랜치를 사용하는 이유:</p>
              <div className="space-y-1">
                <p>✅ <strong>역할 분리:</strong> main(배포), develop(통합), feature/release/hotfix(작업)</p>
                <p>✅ <strong>배포 안정성:</strong> release에서 충분히 테스트한 뒤 main으로 합칩니다</p>
                <p>✅ <strong>긴급 대응:</strong> hotfix로 바로 수정 → main, develop에 모두 반영</p>
                <p>✅ <strong>협업 규칙:</strong> feature는 develop로, release/hotfix는 main+develop로</p>

              </div>
            </div>

            <div className="bg-amber-100 p-3 rounded-lg border border-amber-300 dark:bg-amber-950/30 dark:border-amber-900">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                <strong>📌 기억하세요:</strong> main은 배포용, develop은 통합용이며,
                feature/release/hotfix는 목적이 끝나면 합치고 정리합니다.

              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Branch Info */}
      <Card className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-blue-900 dark:text-blue-100">현재 브랜치</CardTitle>
                <CardDescription className="text-blue-700 font-semibold text-lg">
                  {activeProjectName ? (
                    <span>
                      {currentBranch?.name || "-"}
                      <span className="ml-2 text-sm font-normal text-blue-700/80">({activeProjectName})</span>
                    </span>
                  ) : (
                    currentBranch?.name
                  )}
                </CardDescription>
                {activeProjectPath ? (
                  <div className="text-xs font-mono text-blue-800/70 mt-1">{activeProjectPath}</div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentBranch?.isProtected && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">보호됨</Badge>
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

      {/* Create Branch Form */}
      {showCreateBranch && (
        <Card className="border-2 border-green-500 shadow-lg">
          <CardHeader className="bg-green-50 dark:bg-green-950/20">
            <CardTitle>새 브랜치 만들기</CardTitle>
            <CardDescription className="text-base">
              새로운 작업을 위한 독립적인 공간을 만들어요
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">💡</span>
                  <div className="text-sm text-blue-900 dark:text-blue-100">
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
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
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
       <Card>
         <CardHeader>
           <CardTitle>모든 브랜치</CardTitle>
           <CardDescription>{branches.length}개의 브랜치</CardDescription>
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
                 className={`p-4 rounded-lg border transition-all ${
branch.current
                      ? "bg-blue-50 border-blue-300 shadow-sm dark:bg-blue-950/30 dark:border-blue-900"
                      : "bg-card border-border hover:border-border/80"
                 }`}
               >
                 <div className="flex items-start justify-between gap-4">
                   <div className="flex-1 space-y-3">
                     {/* Branch Name */}
                     <div className="flex items-center gap-3">
                       <GitBranch className={`w-5 h-5 ${branch.current ? "text-blue-600" : "text-muted-foreground"}`} />
                       <div className="flex-1">
                         <div className="flex items-center gap-2">
                           <span className="font-semibold font-mono">{branch.name}</span>
                           {branch.current && (
                             <Badge className="bg-blue-600">
                               <CheckCircle2 className="w-3 h-3 mr-1" />
                               현재
                             </Badge>
                           )}
                           {branch.isProtected && (
                             <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                               보호됨
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
                       <div className="flex gap-2 pl-8">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleSwitchBranch(branch.name)}
                           disabled={busy}
                         >
                           전환
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleMergeBranch(branch.name)}
                           disabled={busy}
                         >
                           <GitMerge className="w-4 h-4 mr-2" />
                           병합
                         </Button>
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => handleDeleteBranch(branch.name, branch.isProtected, branch.current)}
                           className="text-red-600 hover:text-red-700 hover:bg-red-50"
                           disabled={busy || branch.isProtected || branch.current}
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
    </div>
  );
}