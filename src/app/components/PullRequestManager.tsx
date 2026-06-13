import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { GitPullRequest, MessageSquare, CheckCircle2, XCircle, Clock, GitMerge, ExternalLink, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  author: string;
  authorInitials: string;
  status: "open" | "merged" | "closed";
  sourceBranch: string;
  targetBranch: string;
  created: string;
  comments: number;
  approvals: number;
  changesRequested: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  labels: string[];
}

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";

function parseOwnerRepoFromRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  // 지원 형태
  // - https://github.com/OWNER/REPO.git
  // - git@github.com:OWNER/REPO.git
  // - https://github.com/OWNER/REPO
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  const withoutGit = trimmed.endsWith(".git") ? trimmed.slice(0, -4) : trimmed;

  // SSH
  const sshMatch = withoutGit.match(/^git@github\.com:(.+?)\/(.+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS
  try {
    const url = new URL(withoutGit);
    if (url.hostname !== "github.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  if (/^[가-힣]+$/.test(trimmed)) return trimmed.slice(0, 2);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function PullRequestManager() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"open" | "merged" | "closed">("open");
  const [showGuide, setShowGuide] = useState(true);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [repoOwner, setRepoOwner] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refreshInFlightRef = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newPrTitle, setNewPrTitle] = useState("");
  const [newPrBody, setNewPrBody] = useState("");
  const [newPrBase, setNewPrBase] = useState("main");
  const [newPrHead, setNewPrHead] = useState("");

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 PR 관리를 지원합니다");
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    setActiveProjectPath(repoPath);

    if (!repoPath) {
      setPrs([]);
      refreshInFlightRef.current = false;
      return;
    }

    setBusy(true);
    try {
      const originUrl = await window.easyGithub.git.originUrl(repoPath);
      const parsed = originUrl ? parseOwnerRepoFromRemoteUrl(originUrl) : null;

      if (!parsed) {
        toast.error("원격(origin) URL에서 GitHub 저장소를 확인할 수 없습니다");
        setPrs([]);
        return;
      }

      setRepoOwner(parsed.owner);
      setRepoName(parsed.repo);

      // PR 생성 기본값을 현재 로컬 브랜치 기준으로 잡는다.
      try {
        const status = await window.easyGithub.git.status(repoPath);
        setNewPrHead(String(status?.current ?? ""));
      } catch {
        setNewPrHead("");
      }

      const raw = await window.easyGithub.github.listPullRequests(parsed.owner, parsed.repo);
      const list = (raw as any[]).map((pr) => {
        const isMerged = Boolean(pr.merged_at);
        const status: PullRequest["status"] = isMerged ? "merged" : pr.state === "closed" ? "closed" : "open";

        return {
          id: String(pr.id),
          number: pr.number,
          title: pr.title,
          description: pr.body || "",
          author: pr.user?.login || "Unknown",
          authorInitials: getInitials(pr.user?.login || "Unknown"),
          status,
          sourceBranch: pr.head?.ref || "",
          targetBranch: pr.base?.ref || "",
          created: pr.created_at ? new Date(pr.created_at).toLocaleString() : "",
          comments: Number(pr.comments ?? 0),
          approvals: 0,
          changesRequested: 0,
          filesChanged: Number(pr.changed_files ?? 0) || 0,
          additions: Number(pr.additions ?? 0) || 0,
          deletions: Number(pr.deletions ?? 0) || 0,
          labels: (pr.labels || []).map((l: any) => l.name).filter(Boolean)
        };
      });

      setPrs(list);
    } catch (err: any) {
      toast.error(err?.message || "Pull Request 조회에 실패했습니다");
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

  const filteredPRs = useMemo(() => prs.filter((pr) => pr.status === activeTab), [prs, activeTab]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <GitPullRequest className="w-5 h-5 text-green-600" />;
      case "merged":
        return <GitMerge className="w-5 h-5 text-purple-600" />;
      case "closed":
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      open: "bg-green-100 text-green-800 border-green-300",
      merged: "bg-purple-100 text-purple-800 border-purple-300",
      closed: "bg-red-100 text-red-800 border-red-300"
    };

    const labels = {
      open: "Open",
      merged: "Merged",
      closed: "Closed"
    };

    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
      feature: "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-100",
      bugfix: "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-100",
      enhancement: "bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-100",
      performance: "bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-100",
      backend: "bg-orange-100 text-orange-800 dark:bg-orange-950/20 dark:text-orange-100",
      ui: "bg-pink-100 text-pink-800 dark:bg-pink-950/20 dark:text-pink-100",
      testing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-100",
      "priority-high": "bg-red-200 text-red-900 dark:bg-red-950/30 dark:text-red-100"
    };

    return colors[label] || "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-100";
  };

  const openCount = prs.filter((pr) => pr.status === "open").length;
  const mergedCount = prs.filter((pr) => pr.status === "merged").length;
  const closedCount = prs.filter((pr) => pr.status === "closed").length;

  const handleApprove = async (pullNumber: number) => {
    if (!window.easyGithub) return;
    if (!repoOwner || !repoName) {
      toast.error("저장소 정보를 확인할 수 없습니다");
      return;
    }

    const toastId = toast.loading("Approve 중...");
    setBusy(true);
    try {
      await window.easyGithub.github.reviewPullRequest(repoOwner, repoName, pullNumber, "APPROVE");
      toast.success("승인 완료!", { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "승인에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async (pullNumber: number) => {
    if (!window.easyGithub) return;
    if (!repoOwner || !repoName) {
      toast.error("저장소 정보를 확인할 수 없습니다");
      return;
    }

    const toastId = toast.loading("Merge 중...");
    setBusy(true);
    try {
      await window.easyGithub.github.mergePullRequest(repoOwner, repoName, pullNumber);
      toast.success("병합 완료!", { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "병합에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ number: number; title: string } | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const openComment = (prNumber: number, title: string) => {
    setCommentTarget({ number: prNumber, title });
    setCommentBody("");
    setCommentOpen(true);
  };

  const submitComment = async () => {
    if (!window.easyGithub) return;
    if (!repoOwner || !repoName) {
      toast.error("저장소 정보를 확인할 수 없습니다");
      return;
    }
    if (!commentTarget) return;

    if (!commentBody.trim()) {
      toast.error("코멘트 내용을 입력해주세요");
      return;
    }

    const toastId = toast.loading("코멘트 등록 중...");
    setBusy(true);
    try {
      // PR은 Review COMMENT로 코멘트를 남긴다.
      await window.easyGithub.github.reviewPullRequest(repoOwner, repoName, commentTarget.number, "COMMENT", commentBody.trim());
      toast.success("코멘트가 등록되었습니다", { id: toastId });
      setCommentOpen(false);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "코멘트 등록에 실패했습니다", { id: toastId });
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
                Pull Request가 뭐예요?
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
              <p className="font-semibold mb-2">쉽게 말하면</p>
              <p className="text-sm">
                "내가 작업한 코드를 확인해주세요! 괜찮으면 메인 코드에 합쳐주세요!" 
                라고 요청하는 거예요.
              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Pull Request 과정:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="border-[#b6e3ff] bg-[#ddf4ff] text-[#0969da]">1. 코드 작성</Badge>
                <span>→</span>
                <Badge className="border-[#aceebb] bg-[#dafbe1] text-[#1a7f37]">2. PR 생성</Badge>
                <span>→</span>
                <Badge className="border-[#d8dee4] bg-[#f6f8fa] text-[#57606a]">3. 팀원 리뷰</Badge>
                <span>→</span>
                <Badge className="border-[#ffd8b5] bg-[#fff1e5] text-[#bc4c00]">4. 승인</Badge>
                <span>→</span>
                <Badge className="border-[#aceebb] bg-[#dafbe1] text-[#1a7f37]">5. 병합 완료</Badge>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">왜 필요한가요?</p>
              <p><strong>코드 리뷰:</strong> 다른 사람이 내 코드를 검토해요</p>
              <p><strong>버그 방지:</strong> 문제를 미리 발견할 수 있어요</p>
              <p><strong>지식 공유:</strong> 팀원들이 변경사항을 알 수 있어요</p>
              <p><strong>품질 관리:</strong> 코드 품질을 높게 유지해요</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{openCount}</p>
              </div>
              <GitPullRequest className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Merged</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{mergedCount}</p>
              </div>
              <GitMerge className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{closedCount}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PR 코멘트 달기</DialogTitle>
            <DialogDescription>
              {commentTarget ? (
                <span>
                  #{commentTarget.number} · {commentTarget.title}
                </span>
              ) : (
                "대상을 선택하세요"
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">코멘트</label>
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={4}
              placeholder="예: 이 부분은 왜 이렇게 구현했나요?"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentOpen(false)} disabled={busy}>
              취소
            </Button>
            <Button onClick={submitComment} disabled={busy || !commentTarget}>
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* PR List */}
       <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
         <CardHeader className="border-b border-[#d8dee4] pb-4 dark:border-[#30363d]">
           <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
             <div className="min-w-0">
               <CardTitle>Pull Requests</CardTitle>
               <CardDescription>
                 {activeProjectPath ? (
                   repoOwner && repoName ? (
                     <span>
                       현재 저장소: <strong>{repoOwner}/{repoName}</strong>
                     </span>
                   ) : (
                     "현재 저장소를 확인 중입니다"
                   )
                 ) : (
                   "현재 프로젝트가 선택되지 않았습니다"
                 )}
               </CardDescription>
             </div>
             <div className="flex flex-wrap gap-2">
               <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                 <DialogTrigger asChild>
                   <Button size="sm" disabled={busy || !activeProjectPath || !repoOwner || !repoName}>
                     <Plus className="w-4 h-4 mr-2" />
                     새 PR
                   </Button>
                 </DialogTrigger>
                  <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Pull Request 만들기</DialogTitle>
                     <DialogDescription>
                       초보자 팁: 보통 <strong>내 작업 브랜치</strong>에서 <strong>main</strong>으로 PR을 만들어요.
                     </DialogDescription>
                   </DialogHeader>

                   <div className="space-y-3">
                     <div>
                       <label className="text-sm font-medium">제목 *</label>
                       <Input value={newPrTitle} onChange={(e) => setNewPrTitle(e.target.value)} placeholder="예: 로그인 기능 추가" />
                     </div>
                     <div>
                       <label className="text-sm font-medium">설명</label>
                       <Textarea value={newPrBody} onChange={(e) => setNewPrBody(e.target.value)} rows={4} placeholder="무엇을/왜 변경했는지 적어주세요" />
                     </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                       <div>
                         <label className="text-sm font-medium">내 브랜치(head)</label>
                         <Input value={newPrHead} onChange={(e) => setNewPrHead(e.target.value)} placeholder="예: feature/login" />
                       </div>
                       <div>
                         <label className="text-sm font-medium">대상 브랜치(base)</label>
                         <Input value={newPrBase} onChange={(e) => setNewPrBase(e.target.value)} placeholder="예: main" />
                       </div>
                     </div>
                   </div>

                   <DialogFooter>
                     <Button
                       variant="outline"
                       onClick={() => setCreateOpen(false)}
                       disabled={busy}
                     >
                       취소
                     </Button>
                     <Button
                       onClick={async () => {
                         if (!window.easyGithub) return;
                         if (!newPrTitle.trim()) {
                           toast.error("PR 제목을 입력해주세요");
                           return;
                         }
                         if (!repoOwner || !repoName) {
                           toast.error("저장소 정보를 확인할 수 없습니다");
                           return;
                         }
                         if (!newPrHead.trim() || !newPrBase.trim()) {
                           toast.error("head/base 브랜치를 입력해주세요");
                           return;
                         }

                         const toastId = toast.loading("PR 생성 중...");
                         setBusy(true);
                         try {
                           await window.easyGithub.github.createPullRequest(
                             repoOwner,
                             repoName,
                             newPrTitle.trim(),
                             newPrBody.trim(),
                             newPrHead.trim(),
                             newPrBase.trim()
                           );
                           toast.success("PR이 생성되었습니다!", { id: toastId });
                           setCreateOpen(false);
                           setNewPrTitle("");
                           setNewPrBody("");
                           await refresh();
                         } catch (err: any) {
                           toast.error(err?.message || "PR 생성에 실패했습니다", { id: toastId });
                         } finally {
                           setBusy(false);
                         }
                       }}
                       disabled={busy}
                     >
                       생성
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>

               <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
                 <RefreshCw className="w-4 h-4 mr-2" />
                 새로고침
               </Button>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           {!activeProjectPath ? (
             <div className="text-center py-12 text-muted-foreground">
               <GitPullRequest className="w-16 h-16 mx-auto mb-4 opacity-50" />
               <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
               <p className="text-sm mt-2">"프로젝트" 탭에서 Clone 후 상태 버튼을 눌러 선택해주세요.</p>
             </div>
           ) : (
             <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="open">
                Open ({openCount})
              </TabsTrigger>
              <TabsTrigger value="merged">
                Merged ({mergedCount})
              </TabsTrigger>
              <TabsTrigger value="closed">
                Closed ({closedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredPRs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitPullRequest className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Pull Request가 없습니다</p>
                </div>
              ) : (
                filteredPRs.map((pr) => (
                  <Card key={pr.id} className="rounded-md border-[#d8dee4] transition-colors hover:border-[#8c959f] dark:border-[#30363d] dark:hover:border-[#8b949e]">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start gap-4">
                          <div className="mt-1">
                            {getStatusIcon(pr.status)}
                          </div>
                           <div className="min-w-0 flex-1 space-y-2">
                             <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                               <div className="min-w-0 flex-1">
                                 <div className="mb-2 flex flex-wrap items-center gap-2">
                                   <h3 className="min-w-0 truncate text-lg font-semibold">{pr.title}</h3>
                                  <span className="text-muted-foreground">#{pr.number}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{pr.description}</p>
                              </div>
                              {getStatusBadge(pr.status)}
                            </div>

                            {/* Branches */}
                             <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="outline" className="font-mono">
                                {pr.sourceBranch}
                              </Badge>
                              <span className="text-muted-foreground/70">→</span>
                              <Badge variant="outline" className="font-mono">
                                {pr.targetBranch}
                              </Badge>
                            </div>

                            {/* Labels */}
                            {pr.labels.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {pr.labels.map((label) => (
                                  <Badge
                                    key={label}
                                    className={getLabelColor(label)}
                                  >
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Meta Info */}
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarFallback className="text-xs">
                                    {pr.authorInitials}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{pr.author}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{pr.created}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                <span>{pr.comments}</span>
                              </div>
                              {pr.approvals > 0 && (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{pr.approvals}</span>
                                </div>
                              )}
                            </div>

                            {/* Stats */}
                             <div className="flex flex-wrap items-center gap-4 text-sm">
                              <span className="text-muted-foreground">{pr.filesChanged} files changed</span>
                              <span className="text-green-600">+{pr.additions}</span>
                              <span className="text-red-600">-{pr.deletions}</span>
                            </div>

                            {/* Actions */}
                             <div className="flex flex-wrap gap-2 pt-2">
                               {pr.status === "open" && (
                                 <>
                                   <Button size="sm" variant="default" onClick={() => handleApprove(pr.number)} disabled={busy}>
                                     <CheckCircle2 className="w-4 h-4 mr-2" />
                                     Approve
                                   </Button>
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     onClick={() => openComment(pr.number, pr.title)}
                                     disabled={busy}
                                   >
                                     <MessageSquare className="w-4 h-4 mr-2" />
                                     Comment
                                   </Button>
                                   <Button size="sm" variant="outline" onClick={() => handleMerge(pr.number)} disabled={busy}>
                                     <GitMerge className="w-4 h-4 mr-2" />
                                     Merge
                                   </Button>
                                 </>
                               )}
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => (window.easyGithub ? window.easyGithub.app.openExternal(`https://github.com/${repoOwner}/${repoName}/pull/${pr.number}`) : window.open(`https://github.com/${repoOwner}/${repoName}/pull/${pr.number}`, "_blank"))}
                               >
                                 <ExternalLink className="w-4 h-4" />
                               </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
           </Tabs>
           )}
         </CardContent>
       </Card>
    </div>
  );
}
