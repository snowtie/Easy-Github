import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FileText, FilePlus, FileX, FileEdit, GitCommit, Upload } from "lucide-react";
import { toast } from "sonner";

interface FileChange {
  id: string;
  path: string;
  type: "added" | "modified" | "deleted" | "untracked";
  additions: number;
  deletions: number;
  selected: boolean;
  staged: boolean;
}

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";

export function FileChanges() {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitDescription, setCommitDescription] = useState("");
  const [showExplanation, setShowExplanation] = useState(true);

  const [branchList, setBranchList] = useState<{ current: string; all: { name: string; current: boolean }[] } | null>(null);
  const [branchBusy, setBranchBusy] = useState(false);

  const PAGE_SIZE = 200;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [activeProjectName, setActiveProjectName] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
  const [busy, setBusy] = useState(false);

  const refreshInFlightRef = useRef(false);

  const [selectedDiffFile, setSelectedDiffFile] = useState<string>("");
  const [diffText, setDiffText] = useState<string>("");

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 변경사항 조회를 지원합니다");
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    const repoName = localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "";
    setActiveProjectPath(repoPath);
    setActiveProjectName(repoName);

    if (!repoPath) {
      setChanges([]);
      setBranchList(null);
      setVisibleCount(PAGE_SIZE);
      refreshInFlightRef.current = false;
      return;
    }

    setBusy(true);
    try {
      const [rawChanges, branches] = await Promise.all([
        window.easyGithub.git.changes(repoPath),
        window.easyGithub.git.branches(repoPath)
      ]);
      const normalized: FileChange[] = (rawChanges as any[]).map((c) => ({
        id: c.path,
        path: c.path,
        type: c.type,
        additions: Number(c.additions ?? 0),
        deletions: Number(c.deletions ?? 0),
        staged: Boolean(c.staged),
        selected: true
      }));

      setChanges(normalized);
      setBranchList(branches ?? null);
      setVisibleCount(Math.min(PAGE_SIZE, normalized.length));
    } catch (err: any) {
      toast.error(err?.message || "변경사항 조회에 실패했습니다");
    } finally {
      setBusy(false);
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    refresh();

    // 탭 간 프로젝트 선택 동기화: 1초 폴링은 렌더러를 심하게 느리게 만들 수 있다.
    // 동일 창 내에서는 커스텀 이벤트로 알려주고, 그때만 refresh 한다.
    const handleActiveProjectChanged = () => {
      void refresh();
    };

    window.addEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    return () => window.removeEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadDiff = async () => {
      if (!window.easyGithub) return;
      if (!activeProjectPath) return;
      if (!selectedDiffFile) {
        setDiffText("");
        return;
      }

      try {
        const diff = await window.easyGithub.git.diff(activeProjectPath, selectedDiffFile);
        setDiffText(diff);
      } catch {
        setDiffText("");
      }
    };

    loadDiff();
  }, [activeProjectPath, selectedDiffFile]);

  const toggleFileSelection = (id: string) => {
    setChanges(changes.map(change =>
      change.id === id ? { ...change, selected: !change.selected } : change
    ));
  };

  const toggleAllFiles = () => {
    // 대량 파일 처리 시에도 UX를 유지하기 위해 전체 선택을 유지한다.
    setChanges((prev) => prev.map((change) => ({ ...change, selected: !allSelected })));
  };

  const handleBranchCheckout = async (branchName: string) => {
    if (!window.easyGithub) return;
    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    if (branchName === branchList?.current) return;

    setBranchBusy(true);
    try {
      const status = await window.easyGithub.git.status(activeProjectPath);
      const hasChanges =
        Number(status?.modified ?? 0) +
          Number(status?.untracked ?? 0) +
          Number(status?.deleted ?? 0) >
        0;

      if (hasChanges) {
        const confirmSwitch = window.confirm(
          "미커밋 변경사항이 있습니다.\n브랜치를 전환하면 커밋 메시지와 선택 상태가 초기화됩니다. 계속하시겠습니까?"
        );
        if (!confirmSwitch) {
          return;
        }
      }

      await window.easyGithub.git.checkoutBranch(activeProjectPath, branchName);
      setCommitMessage("");
      setCommitDescription("");
      setSelectedDiffFile("");
      setDiffText("");
      const updated = await window.easyGithub.git.branches(activeProjectPath);
      setBranchList(updated ?? null);
      await refresh();
      toast.success(`브랜치 ${branchName}로 전환되었습니다`);
    } catch (err: any) {
      toast.error(err?.message || "브랜치 전환에 실패했습니다");
    } finally {
      setBranchBusy(false);
    }
  };

  const handleCommit = async () => {
    const selectedFiles = changes.filter((c) => c.selected);

    if (selectedFiles.length === 0) {
      toast.error("커밋할 파일을 선택해주세요");
      return;
    }

    if (!commitMessage.trim()) {
      toast.error("커밋 메시지를 입력해주세요");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 커밋을 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const toastId = toast.loading("커밋 중...");
    setBusy(true);

    try {
      // 초보자 UX: '선택한 파일'을 자동으로 스테이징 후 커밋한다.
      const filesToStage = selectedFiles.map((f) => f.path);
      await window.easyGithub.git.stage(activeProjectPath, filesToStage);

      const fullMessage = commitDescription.trim()
        ? `${commitMessage.trim()}\n\n${commitDescription.trim()}`
        : commitMessage.trim();

      // GitHub 로그인 상태라면, 커밋 작성자(Author)를 GitHub 계정으로 고정한다.
      // 로컬 Git 설정(user.name/user.email)이 잘못되어 있거나(예: 다른 도구가 덮어쓴 경우)
      // GitHub에서 작성자가 엉뚱하게 표시되는 문제를 줄이기 위함이다.
      let author: { name: string; email: string } | undefined;
      try {
        const user = await window.easyGithub.auth.getUser();
        const login = typeof user?.login === "string" ? user.login : "";
        const id = typeof user?.id === "number" ? user.id : null;

        if (login && id !== null) {
          const nameFromProfile = typeof user?.name === "string" ? user.name.trim() : "";
          const authorName = nameFromProfile || login;
          const authorEmail = `${id}+${login}@users.noreply.github.com`;
          author = { name: authorName, email: authorEmail };
        }
      } catch {
        author = undefined;
      }

      await window.easyGithub.git.commit(activeProjectPath, fullMessage, author);

      toast.success(`${selectedFiles.length}개 파일이 커밋되었습니다!`, { id: toastId });
      setCommitMessage("");
      setCommitDescription("");

      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "커밋에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handlePush = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Push를 지원합니다");
      return;
    }

    if (!activeProjectPath) {
      toast.error("먼저 '프로젝트' 탭에서 저장소를 선택/Clone 해주세요");
      return;
    }

    const toastId = toast.loading("Push 중...");
    setBusy(true);

    try {
      await window.easyGithub.git.push(activeProjectPath);
      toast.success("변경사항이 원격 저장소에 푸시되었습니다!", { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Push에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "added":
        return <FilePlus className="w-4 h-4 text-green-600" />;
      case "deleted":
        return <FileX className="w-4 h-4 text-red-600" />;
      case "modified":
        return <FileEdit className="w-4 h-4 text-blue-600" />;
      case "untracked":
        return <FilePlus className="w-4 h-4 text-muted-foreground" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      added: "bg-green-100 text-green-800 border-green-300",
      deleted: "bg-red-100 text-red-800 border-red-300",
      modified: "bg-blue-100 text-blue-800 border-blue-300",
      untracked: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/40 dark:text-slate-100 dark:border-slate-800"
    };

    const labels = {
      added: "추가됨",
      deleted: "삭제됨",
      modified: "수정됨",
      untracked: "미추적"
    };

    return (
      <Badge variant="outline" className={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    );
  };

  const selectedCount = useMemo(() => changes.filter((c) => c.selected).length, [changes]);
  const totalAdditions = useMemo(
    () => changes.filter((c) => c.selected).reduce((sum, c) => sum + c.additions, 0),
    [changes]
  );
  const totalDeletions = useMemo(
    () => changes.filter((c) => c.selected).reduce((sum, c) => sum + c.deletions, 0),
    [changes]
  );
  const allSelected = useMemo(() => changes.length > 0 && changes.every((c) => c.selected), [changes]);

  const visibleChanges = useMemo(() => changes.slice(0, visibleCount), [changes, visibleCount]);
  const remainingChanges = Math.max(0, changes.length - visibleCount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* File List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Explanation Card */}
        {showExplanation && (
          <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  📚 변경사항 탭이란?
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExplanation(false)}
                  className="text-blue-700 dark:text-blue-200"
                >
                  닫기
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-blue-900 dark:text-blue-100">
              <p className="font-semibold">이곳에서 무엇을 하나요?</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-lg">1️⃣</span>
                  <span><strong>파일 확인:</strong> 어떤 파일을 수정했는지 확인해요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">2️⃣</span>
                  <span><strong>변경사항 선택:</strong> 저장하고 싶은 파일을 선택해요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">3️⃣</span>
                  <span><strong>커밋 메시지 작성:</strong> 무엇을 바꿨는지 메모해요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">4️⃣</span>
                  <span><strong>커밋하기:</strong> 변경사항을 역사에 기록해요!</span>
                </li>
              </ul>
              <div className="bg-card/60 p-3 rounded-lg mt-3">
                <p className="text-xs">
                  💡 <strong>비유하자면:</strong> 게임을 저장하는 것처럼, 코드 작업을 저장하는 거예요. 
                  나중에 문제가 생기면 이전 저장 지점으로 돌아갈 수 있어요!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>변경된 파일</CardTitle>
                <CardDescription>
                  {activeProjectName ? (
                    <span>
                      현재 프로젝트: <strong>{activeProjectName}</strong>
                    </span>
                  ) : (
                    "현재 프로젝트가 선택되지 않았습니다"
                  )}
                  {activeProjectPath ? (
                    <span className="block text-xs font-mono mt-1">{activeProjectPath}</span>
                  ) : null}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">브랜치</span>
                  <Select
                    value={branchList?.current ?? ""}
                    onValueChange={handleBranchCheckout}
                    disabled={busy || branchBusy || !branchList}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue placeholder="브랜치 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branchList?.all ?? []).map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
                  새로고침
                </Button>
                <Button variant="outline" size="sm" onClick={toggleAllFiles} disabled={busy}>
                  {allSelected ? "전체 해제" : "전체 선택"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activeProjectPath ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
                <p className="text-sm mt-2">"프로젝트" 탭에서 Clone 후 상태 버튼을 눌러 선택해주세요.</p>
              </div>
             ) : changes.length === 0 ? (
               <div className="text-center py-12 text-muted-foreground">
                 <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                 <p>변경된 파일이 없습니다</p>
                 <p className="text-sm mt-2">모든 변경사항이 커밋되었습니다</p>
               </div>
             ) : (
               <>
                 {visibleChanges.map((change) => (
                   <div
                     key={change.id}
                     className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                       change.selected ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900" : "bg-card border-border"
                     }`}
                   >
                     <Checkbox
                       checked={change.selected}
                       onCheckedChange={() => toggleFileSelection(change.id)}
                     />
 
                     <div className="flex-1 flex items-center gap-3">
                       {getFileIcon(change.type)}
                       <div className="flex-1">
                         <p className="font-mono text-sm font-medium">{change.path}</p>
                         <div className="flex items-center gap-2 mt-1">
                           {getTypeBadge(change.type)}
                           {change.staged && (
                             <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                               스테이징됨
                             </Badge>
                           )}
                           <span className="text-xs text-green-600">+{change.additions}</span>
                           <span className="text-xs text-red-600">-{change.deletions}</span>
                         </div>
                       </div>
                     </div>
 
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => {
                         // 파일 선택과는 별개로 diff를 보고 싶을 수 있어 별도 버튼 제공
                         setSelectedDiffFile(change.path);
                       }}
                     >
                       <FileText className="w-4 h-4" />
                     </Button>
                   </div>
                 ))}
                 {remainingChanges > 0 ? (
                   <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                     <span>아직 {remainingChanges.toLocaleString()}개 파일이 더 있습니다.</span>
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, changes.length))}
                     >
                       더 보기
                     </Button>
                   </div>
                 ) : null}
               </>
             )}

          </CardContent>
        </Card>

        {/* Diff Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>변경 내용 미리보기</CardTitle>
                <CardDescription>선택한 파일의 변경사항</CardDescription>
              </div>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                읽는 방법 👇
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2 text-sm text-amber-900">
                  <p className="font-semibold mb-2">🔍 Diff 읽는 법:</p>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-300 rounded"></div>
                      <span><strong>빨간색:</strong> 삭제된 코드 (- 기호)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-300 rounded"></div>
                      <span><strong>초록색:</strong> 추가된 코드 (+ 기호)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-border rounded"></div>
                      <span><strong>회색:</strong> 변경되지 않은 코드</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              {!selectedDiffFile ? (
                <div className="text-muted-foreground/70">
                  오른쪽 목록에서 파일 아이콘(문서 버튼)을 눌러 변경 내용을 확인하세요.
                </div>
              ) : diffText ? (
                <pre className="whitespace-pre-wrap break-words">{diffText}</pre>
              ) : (
                <div className="text-muted-foreground/70">
                  선택한 파일의 diff를 불러오지 못했습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commit Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>커밋 정보</CardTitle>
            <CardDescription>선택한 파일을 커밋합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-950/20 dark:to-blue-900/10 dark:border-blue-900">
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
                    <p className="text-xs text-muted-foreground">선택한 파일</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">+{totalAdditions}</p>
                    <p className="text-xs text-muted-foreground">추가된 줄</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">-{totalDeletions}</p>
                    <p className="text-xs text-muted-foreground">삭제된 줄</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">💡 커밋 메시지 팁</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• 현재형으로 작성하세요 (예: "Add" not "Added")</p>
                <p>• 50자 이내로 간결하게</p>
                <p>• 무엇을, 왜 변경했는지 설명</p>
                <p>• 이슈 번호 참조 (#123)</p>
              </CardContent>
            </Card>

            {/* Common Mistakes */}
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-sm text-red-900">⚠️ 초보자가 자주 하는 실수</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-red-800 space-y-2">
                <p>• <strong>커밋 메시지를 대충 쓰기:</strong> "수정", "변경" 같은 메시지는 나중에 혼란스러워요</p>
                <p>• <strong>너무 많은 변경사항을 한 번에:</strong> 작은 단위로 자주 커밋하는 게 좋아요</p>
                <p>• <strong>테스트 안 된 코드 커밋:</strong> 작동하는 코드만 커밋하세요</p>
                <p>• <strong>커밋 전에 Pull 안 하기:</strong> 작업 전 항상 최신 코드를 받아오세요</p>
              </CardContent>
            </Card>

            {/* Commit Message */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">커밋 메시지 (무엇을 바꿨나요?) *</label>
              <Input
                placeholder="예: 로그인 기능 추가"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
            </div>

            {/* Commit Description */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">상세 설명 (선택사항)</label>
              <Textarea
                placeholder="더 자세한 설명을 추가할 수 있어요..."
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button 
                onClick={handleCommit} 
                className="w-full"
                size="lg"
                disabled={busy || selectedCount === 0 || !commitMessage.trim()}
              >
                <GitCommit className="w-5 h-5 mr-2" />
                변경사항 저장 (Commit)
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                커밋하면 작업 내용이 기록됩니다
              </p>
              <Button 
                onClick={handlePush} 
                variant="outline" 
                className="w-full"
                size="lg"
                disabled={busy}
              >
                <Upload className="w-5 h-5 mr-2" />
                GitHub에 업로드 (Push)
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                GitHub 서버에 코드를 올립니다
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}