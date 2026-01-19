import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Bug, AlertCircle, CheckCircle2, MessageSquare, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  type: "bug" | "enhancement" | "question";
  status: "open" | "closed";
  priority: "low" | "medium" | "high";
  author: string;
  authorInitials: string;
  assignee?: string;
  assigneeInitials?: string;
  created: string;
  comments: number;
  labels: string[];
}

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";

function parseOwnerRepoFromRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  const withoutGit = trimmed.endsWith(".git") ? trimmed.slice(0, -4) : trimmed;

  const sshMatch = withoutGit.match(/^git@github\.com:(.+?)\/(.+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

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

function mapLabelsToType(labels: string[]): Issue["type"] {
  // 초보자 UX: 라벨 기반으로 대략적인 유형을 자동 분류
  if (labels.includes("bug")) return "bug";
  if (labels.includes("question") || labels.includes("help wanted")) return "question";
  return "enhancement";
}

function mapLabelsToPriority(labels: string[]): Issue["priority"] {
  if (labels.includes("priority-high") || labels.includes("P0") || labels.includes("P1")) return "high";
  if (labels.includes("priority-medium") || labels.includes("P2")) return "medium";
  return "low";
}

export function IssueTracker() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [showGuide, setShowGuide] = useState(true);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [repoOwner, setRepoOwner] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refreshInFlightRef = useRef(false);

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ number: number; title: string } | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Issue 관리를 지원합니다");
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    setActiveProjectPath(repoPath);

    if (!repoPath) {
      setIssues([]);
      refreshInFlightRef.current = false;
      return;
    }

    setBusy(true);
    try {
      const originUrl = await window.easyGithub.git.originUrl(repoPath);
      const parsed = originUrl ? parseOwnerRepoFromRemoteUrl(originUrl) : null;

      if (!parsed) {
        toast.error("원격(origin) URL에서 GitHub 저장소를 확인할 수 없습니다");
        setIssues([]);
        return;
      }

      setRepoOwner(parsed.owner);
      setRepoName(parsed.repo);

      const raw = await window.easyGithub.github.listIssues(parsed.owner, parsed.repo, "all");
      const list = (raw as any[]).map((issue) => {
        const labels = (issue.labels || []).map((l: any) => l.name).filter(Boolean);
        const author = issue.user?.login || "Unknown";

        return {
          id: String(issue.id),
          number: issue.number,
          title: issue.title,
          description: issue.body || "",
          type: mapLabelsToType(labels),
          status: issue.state === "closed" ? "closed" : "open",
          priority: mapLabelsToPriority(labels),
          author,
          authorInitials: getInitials(author),
          assignee: issue.assignee?.login,
          assigneeInitials: issue.assignee?.login ? getInitials(issue.assignee.login) : undefined,
          created: issue.created_at ? new Date(issue.created_at).toLocaleString() : "",
          comments: Number(issue.comments ?? 0),
          labels
        } as Issue;
      });

      setIssues(list);
    } catch (err: any) {
      toast.error(err?.message || "이슈 조회에 실패했습니다");
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

  const filteredIssues = useMemo(() => issues.filter((issue) => issue.status === activeTab), [issues, activeTab]);

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) {
      toast.error("이슈 제목을 입력해주세요");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Issue 생성을 지원합니다");
      return;
    }

    if (!repoOwner || !repoName) {
      toast.error("저장소 정보를 확인할 수 없습니다");
      return;
    }

    const toastId = toast.loading("이슈 생성 중...");
    setBusy(true);

    try {
      await window.easyGithub.github.createIssue(repoOwner, repoName, newIssueTitle.trim(), newIssueDescription.trim());
      setNewIssueTitle("");
      setNewIssueDescription("");
      setShowCreateIssue(false);
      toast.success("이슈가 생성되었습니다!", { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "이슈 생성에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleCloseIssue = async (issueNumber: number) => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 Issue 닫기를 지원합니다");
      return;
    }

    if (!repoOwner || !repoName) {
      toast.error("저장소 정보를 확인할 수 없습니다");
      return;
    }

    const toastId = toast.loading("이슈 닫는 중...");
    setBusy(true);

    try {
      await window.easyGithub.github.closeIssue(repoOwner, repoName, issueNumber);
      toast.success("이슈가 닫혔습니다", { id: toastId });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "이슈 닫기에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const openComment = (issueNumber: number, title: string) => {
    setCommentTarget({ number: issueNumber, title });
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
      await window.easyGithub.github.commentIssue(repoOwner, repoName, commentTarget.number, commentBody.trim());
      toast.success("코멘트가 등록되었습니다", { id: toastId });
      setCommentOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "코멘트 등록에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };


  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="w-5 h-5 text-red-600" />;
      case "enhancement":
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case "question":
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      bug: "bg-red-100 text-red-800 border-red-300",
      enhancement: "bg-blue-100 text-blue-800 border-blue-300",
      question: "bg-purple-100 text-purple-800 border-purple-300"
    };

    return (
      <Badge variant="outline" className={variants[type as keyof typeof variants]}>
        {type}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-100",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-100",
      high: "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-100"
    };

    const labels = {
      low: "낮음",
      medium: "보통",
      high: "높음"
    };

    return (
      <Badge className={variants[priority as keyof typeof variants]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
      bug: "bg-red-100 text-red-800",
      enhancement: "bg-blue-100 text-blue-800",
      "priority-high": "bg-red-200 text-red-900",
      authentication: "bg-orange-100 text-orange-800",
      ui: "bg-pink-100 text-pink-800",
      mobile: "bg-green-100 text-green-800",
      documentation: "bg-purple-100 text-purple-800",
      performance: "bg-yellow-100 text-yellow-800",
      backend: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-100"
    };

    return colors[label] || "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-100";
  };

  const openCount = issues.filter((i) => i.status === "open").length;
  const closedCount = issues.filter((i) => i.status === "closed").length;

  return (
    <div className="space-y-6">
      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이슈 코멘트 달기</DialogTitle>
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
              placeholder="예: 재현 방법을 알려주세요"
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

      {/* Guide Card */}
      {showGuide && (
        <Card className="border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-orange-900 dark:text-orange-100 flex items-center gap-2">
                🐛 이슈(Issue)란?
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(false)}
                className="text-orange-700 dark:text-orange-200"
              >
                닫기
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-orange-900 dark:text-orange-100">
            <div className="bg-card/60 p-4 rounded-lg">
              <p className="font-semibold mb-2">📋 할 일 목록이에요!</p>
              <p className="text-sm">
                버그, 새로운 기능 아이디어, 질문 등을 기록하고 관리하는 곳이에요.
                팀 프로젝트의 할 일 목록(To-Do List)이라고 생각하면 돼요!
              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="font-semibold">이슈의 종류:</p>
              <div className="space-y-1">
                <p>🐛 <strong>Bug:</strong> 프로그램이 제대로 작동하지 않을 때</p>
                <p>✨ <strong>Enhancement:</strong> 새로운 기능이나 개선 아이디어</p>
                <p>❓ <strong>Question:</strong> 궁금한 점이나 논의가 필요할 때</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">이슈를 언제 만드나요?</p>
              <p>• 버그를 발견했을 때</p>
              <p>• 새로운 기능이 필요할 때</p>
              <p>• 코드를 개선하고 싶을 때</p>
              <p>• 팀원에게 질문할 게 있을 때</p>
            </div>

            <div className="bg-blue-100 p-3 rounded-lg border border-blue-300 dark:bg-blue-950/30 dark:border-blue-900">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                <strong>💡 팁:</strong> 이슈를 만들 때는 구체적으로 작성하세요! 
                "버튼이 안 돼요" 보다는 "로그인 버튼 클릭 시 404 에러 발생"이 훨씬 좋아요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{openCount}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{closedCount}</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugs</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {issues.filter(i => i.type === "bug" && i.status === "open").length}
                </p>
              </div>
              <Bug className="w-10 h-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {issues.filter(i => i.priority === "high" && i.status === "open").length}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

       {/* Create Issue Button */}
       {!showCreateIssue && (
         <Button
           onClick={() => setShowCreateIssue(true)}
           className="w-full"
           size="lg"
           disabled={busy || !activeProjectPath}
         >
           <Plus className="w-4 h-4 mr-2" />
           새 이슈 만들기
         </Button>
       )}

      {/* Create Issue Form */}
      {showCreateIssue && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle>새 이슈 만들기</CardTitle>
            <CardDescription>버그 리포트, 기능 요청, 질문 등을 작성하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">제목 *</label>
              <Input
                placeholder="이슈를 간단히 요약하세요"
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명</label>
              <Textarea
                placeholder="이슈에 대한 자세한 설명을 작성하세요..."
                value={newIssueDescription}
                onChange={(e) => setNewIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateIssue} className="flex-1">
                생성
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateIssue(false);
                  setNewIssueTitle("");
                  setNewIssueDescription("");
                }} 
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

       {/* Issue List */}
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between gap-4">
             <div>
               <CardTitle>이슈</CardTitle>
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
             <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
               새로고침
             </Button>
           </div>
         </CardHeader>
         <CardContent>
           {!activeProjectPath ? (
             <div className="text-center py-12 text-muted-foreground">
               <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
               <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
               <p className="text-sm mt-2">"프로젝트" 탭에서 Clone 후 상태 버튼을 눌러 선택해주세요.</p>
             </div>
           ) : (
             <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="open">
                Open ({openCount})
              </TabsTrigger>
              <TabsTrigger value="closed">
                Closed ({closedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredIssues.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>이슈가 없습니다</p>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <Card key={issue.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="mt-1">
                            {getTypeIcon(issue.type)}
                          </div>
                          <div className="flex-1 space-y-3">
                            {/* Title */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{issue.title}</h3>
                                  <span className="text-muted-foreground text-sm">#{issue.number}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{issue.description}</p>
                              </div>
                              <div className="flex gap-2">
                                {getTypeBadge(issue.type)}
                                {getPriorityBadge(issue.priority)}
                              </div>
                            </div>

                            {/* Labels */}
                            {issue.labels.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {issue.labels.map((label) => (
                                  <Badge
                                    key={label}
                                    className={getLabelColor(label)}
                                  >
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarFallback className="text-xs">
                                    {issue.authorInitials}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{issue.author}</span>
                              </div>
                              {issue.assignee && (
                                <>
                                  <span className="text-muted-foreground/70">assigned to</span>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-5 h-5">
                                      <AvatarFallback className="text-xs">
                                        {issue.assigneeInitials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{issue.assignee}</span>
                                  </div>
                                </>
                              )}
                              <span>•</span>
                              <span>{issue.created}</span>
                              {issue.comments > 0 && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>{issue.comments}</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Actions */}
                            {issue.status === "open" && (
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleCloseIssue(issue.number)}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Close
                                </Button>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => openComment(issue.number, issue.title)}
                                   disabled={busy}
                                 >
                                   <MessageSquare className="w-4 h-4 mr-2" />
                                   Comment
                                 </Button>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => (window.easyGithub ? window.easyGithub.app.openExternal(`https://github.com/${repoOwner}/${repoName}/issues/${issue.number}`) : window.open(`https://github.com/${repoOwner}/${repoName}/issues/${issue.number}`, "_blank"))}
                                 >
                                   <ExternalLink className="w-4 h-4" />
                                 </Button>
                              </div>
                            )}
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