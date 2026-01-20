import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { ProjectOverview } from "@/app/components/ProjectOverview";
import { CommitHistory } from "@/app/components/CommitHistory";
import { BranchManager } from "@/app/components/BranchManager";
import { FileChanges } from "@/app/components/FileChanges";
import { PullRequestManager } from "@/app/components/PullRequestManager";
import { IssueTracker } from "@/app/components/IssueTracker";
import { BeginnerGuide } from "@/app/components/BeginnerGuide";
import {
  GitBranch,
  FileText,
  GitCommit,
  GitPullRequest,
  Bug,
  FolderGit2,
  HelpCircle,
  BookOpen,
  X,
  LogIn,
  LogOut,
  User,
  Sun,
  Moon,
  Laptop
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { toast } from "sonner";

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";

function parseOwnerRepoFromRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  const withoutGit = trimmed.endsWith(".git") ? trimmed.slice(0, -4) : trimmed;
  const sshMatch = withoutGit.match(/^git@github\.com:(.+?)\/(.+)$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

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

export function GitHubManager() {
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);

  const [activeTab, setActiveTab] = useState("overview");
  const [showGuide, setShowGuide] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [authenticated, setAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const lastCountsRef = useRef({ initialized: false, prOpen: 0, issueOpen: 0 });

  const refreshAuth = async () => {
    if (!window.easyGithub) {
      // 웹 환경에서 렌더링될 수 있는 경우를 고려한 방어 코드
      setAuthenticated(false);
      setAuthUser(null);
      return;
    }

    const status = await window.easyGithub.auth.getTokenStatus();
    setAuthenticated(Boolean(status?.authenticated));

    if (status?.authenticated) {
      try {
        const user = await window.easyGithub.auth.getUser();
        setAuthUser(user);
      } catch {
        setAuthUser(null);
      }
    } else {
      setAuthUser(null);
    }
  };

  useEffect(() => {
    // next-themes는 브라우저 저장소(localStorage) 기반이라, 마운트 이후에만 값을 신뢰한다.
    // (Electron 환경에서도 초기 렌더 타이밍에 theme 값이 흔들릴 수 있어 방어한다.)
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    const loadGuideState = async () => {
      if (window.easyGithub) {
        const completed = await window.easyGithub.store.getGuideCompleted();
        setShowGuide(!completed);
        return;
      }

      const hasSeenGuide = localStorage.getItem("hasSeenGuide");
      setShowGuide(!hasSeenGuide);
    };

    loadGuideState();
  }, []);

  const handleLogin = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 GitHub 로그인을 지원합니다");
      return;
    }

    // 브라우저 로그인 대신 토큰(PAT) 입력 다이얼로그를 연다.
    setTokenInput("");
    setTokenDialogOpen(true);
  };

  const handleSubmitToken = async () => {
    if (!window.easyGithub) return;

    setAuthBusy(true);
    try {
      // 토큰은 main process에서만 안전하게 저장한다.
      await window.easyGithub.auth.setToken(tokenInput);
      setTokenDialogOpen(false);
      setTokenInput("");
      await refreshAuth();
      toast.success("토큰 로그인 완료!");
    } catch (err: any) {
      toast.error(err?.message || "토큰 로그인에 실패했습니다");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!window.easyGithub || !authenticated) return;

    let cancelled = false;

    const pollNotifications = async () => {
      if (cancelled) return;

      const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
      if (!repoPath) return;

      try {
        const originUrl = await window.easyGithub.git.originUrl(repoPath);
        const parsed = originUrl ? parseOwnerRepoFromRemoteUrl(originUrl) : null;
        if (!parsed) return;

        // PR/Issue는 너무 자주 호출하면 rate limit에 걸릴 수 있어 2분 주기로 확인한다.
        const prList = await window.easyGithub.github.listPullRequests(parsed.owner, parsed.repo);
        const openPrCount = (prList as any[]).filter((pr) => pr.state === "open").length;

        const issueList = await window.easyGithub.github.listIssues(parsed.owner, parsed.repo, "open");
        const openIssueCount = Array.isArray(issueList) ? issueList.length : 0;

        const last = lastCountsRef.current;
        if (last.initialized) {
          if (openPrCount > last.prOpen) {
            toast.success(`새 PR이 ${openPrCount - last.prOpen}개 생겼어요`);
          }
          if (openIssueCount > last.issueOpen) {
            toast.success(`새 이슈가 ${openIssueCount - last.issueOpen}개 생겼어요`);
          }
        }

        lastCountsRef.current = {
          initialized: true,
          prOpen: openPrCount,
          issueOpen: openIssueCount
        };
      } catch {
        // 알림은 참고용이므로 실패해도 조용히 무시
      }
    };

    pollNotifications();
    const interval = setInterval(pollNotifications, 120_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authenticated]);

  const handleLogout = async () => {
    if (!window.easyGithub) return;

    setAuthBusy(true);
    try {
      await window.easyGithub.auth.logout();
      await refreshAuth();
      toast.success("로그아웃되었습니다");
    } catch (err: any) {
      toast.error(err?.message || "로그아웃에 실패했습니다");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCloseGuide = async () => {
    localStorage.setItem("hasSeenGuide", "true");
    if (window.easyGithub) {
      await window.easyGithub.store.setGuideCompleted(true);
    }
    setShowGuide(false);
  };

  const tabHelpText: Record<string, string> = {
    overview: "프로젝트를 추가하고 전체 상태를 확인할 수 있어요. GitHub에서 코드를 다운로드(Clone)하는 곳이에요!",
    changes: "수정한 파일들을 확인하고 저장(Commit)할 수 있어요. 작업한 내용을 기록하는 곳이에요!",
    commits: "지금까지 저장한 모든 작업 기록을 볼 수 있어요. 언제 누가 무엇을 바꿨는지 확인할 수 있어요!",
    branches: "여러 작업을 동시에 진행할 수 있는 브랜치를 관리해요. 실험적인 작업도 안전하게 할 수 있어요!",
    pulls: "다른 사람과 협업할 때 코드 리뷰를 요청하는 곳이에요. 팀 프로젝트에서 중요해요!",
    issues: "버그나 할 일을 기록하고 관리하는 곳이에요. 프로젝트 관리에 유용해요!"
  };

  const handleToggleTheme = () => {
    // UX: system → light → dark → system 순서로 순환
    if (theme === "system") {
      setTheme("light");
      return;
    }

    if (theme === "light") {
      setTheme("dark");
      return;
    }

    setTheme("system");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;
  const themeLabel = theme === "dark" ? "다크" : theme === "light" ? "라이트" : "시스템";


  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Beginner Guide Modal */}
      {showGuide && <BeginnerGuide onClose={handleCloseGuide} />}

      <Dialog
        open={tokenDialogOpen}
        onOpenChange={(open) => {
          setTokenDialogOpen(open);
          if (!open) setTokenInput("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>GitHub 토큰으로 로그인</DialogTitle>
            <DialogDescription>
              토큰은 PC 안에서만 암호화 저장되며, 브라우저 로그인을 사용하지 않습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="GitHub Personal Access Token (PAT)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmitToken();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              필요 권한 예시: private repo 사용 시 <code className="px-1">repo</code>, 공개 repo만이면 최소 권한으로도 동작합니다.
            </p>
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.easyGithub?.app.openExternal("https://github.com/settings/tokens")}
              >
                토큰 만들기
              </Button>
              <div className="flex gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setTokenDialogOpen(false)} disabled={authBusy}>
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmitToken()}
                  disabled={authBusy || tokenInput.trim().length === 0}
                >
                  로그인
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-950 dark:to-blue-900 text-white shadow-lg border-b border-blue-800 dark:border-blue-900">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <FolderGit2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Easy Github</h1>

                <p className="text-blue-100 text-sm">쉽고 간단하게 코드를 관리하세요 ✨</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-md px-3 py-1">
                <User className="w-4 h-4" />
                <span className="text-sm">
                  {authenticated ? (authUser?.login ?? "로그인됨") : "로그인 안됨"}
                </span>
              </div>

              {authenticated ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={authBusy}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  로그아웃
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogin}
                  disabled={authBusy}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  토큰 로그인
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleTheme}
                disabled={!themeMounted}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                title="테마 변경 (시스템/라이트/다크)"
              >
                <ThemeIcon className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{themeLabel}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGuide(true)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                시작 가이드
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                도움말
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6 bg-card shadow-sm">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4" />
              <span className="hidden sm:inline">프로젝트</span>
            </TabsTrigger>
            <TabsTrigger value="changes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">변경사항</span>
            </TabsTrigger>
            <TabsTrigger value="commits" className="flex items-center gap-2">
              <GitCommit className="w-4 h-4" />
              <span className="hidden sm:inline">커밋</span>
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">브랜치</span>
            </TabsTrigger>
            <TabsTrigger value="pulls" className="flex items-center gap-2">
              <GitPullRequest className="w-4 h-4" />
              <span className="hidden sm:inline">리뷰</span>
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              <span className="hidden sm:inline">이슈</span>
            </TabsTrigger>
          </TabsList>

          {/* Help Card */}
            {showHelp && (
             <Card className="mb-6 border-2 border-blue-500 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    현재 페이지 도움말
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHelp(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  💡 {tabHelpText[activeTab]}
                </p>
              </CardContent>
            </Card>
          )}

          <TabsContent value="overview">
            {activeTab === "overview" && <ProjectOverview />}
          </TabsContent>

          <TabsContent value="changes">
            {activeTab === "changes" && <FileChanges />}
          </TabsContent>

          <TabsContent value="commits">
            {activeTab === "commits" && <CommitHistory />}
          </TabsContent>

          <TabsContent value="branches">
            {activeTab === "branches" && <BranchManager />}
          </TabsContent>

          <TabsContent value="pulls">
            {activeTab === "pulls" && <PullRequestManager />}
          </TabsContent>

          <TabsContent value="issues">
            {activeTab === "issues" && <IssueTracker />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
