import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
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
  LogIn,
  LogOut,
  Globe,
  Copy,
  Sun,
  Moon,
  Laptop
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { AppContextPanel } from "@/app/components/layout/AppContextPanel";
import { AppNavigation } from "@/app/components/layout/AppNavigation";
import { toast } from "sonner";

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";

type BrowserLoginInfo = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

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
  const [activeProjectPath, setActiveProjectPath] = useState(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [activeProjectName, setActiveProjectName] = useState(() => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
  const [showGuide, setShowGuide] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [authenticated, setAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [browserLoginInfo, setBrowserLoginInfo] = useState<BrowserLoginInfo | null>(null);

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
    const syncActiveProject = () => {
      setActiveProjectPath(localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
      setActiveProjectName(localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
    };

    syncActiveProject();
    window.addEventListener("easygithub:active-project-changed", syncActiveProject);
    window.addEventListener("storage", syncActiveProject);
    return () => {
      window.removeEventListener("easygithub:active-project-changed", syncActiveProject);
      window.removeEventListener("storage", syncActiveProject);
    };
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

    setTokenInput("");
    setBrowserLoginInfo(null);
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

  const handleBrowserLogin = async () => {
    if (!window.easyGithub) return;

    setAuthBusy(true);
    setBrowserLoginInfo(null);
    try {
      const loginInfo = await window.easyGithub.auth.startBrowserLogin();
      setBrowserLoginInfo(loginInfo);
      await window.easyGithub.app.openExternal(loginInfo.verification_uri);
      toast.success("GitHub 사이트가 열렸습니다. 표시된 코드를 입력해주세요.");

      await window.easyGithub.auth.completeBrowserLogin(
        loginInfo.device_code,
        loginInfo.interval,
        loginInfo.expires_in
      );
      setTokenDialogOpen(false);
      setTokenInput("");
      setBrowserLoginInfo(null);
      await refreshAuth();
      toast.success("사이트 로그인 완료!");
    } catch (err: any) {
      toast.error(err?.message || "사이트 로그인에 실패했습니다");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCopyBrowserCode = async () => {
    if (!browserLoginInfo) return;
    await navigator.clipboard.writeText(browserLoginInfo.user_code);
    toast.success("로그인 코드가 복사되었습니다");
  };

  useEffect(() => {
    if (!window.easyGithub || !authenticated) return;

    const checkNotifications = async () => {
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

    void checkNotifications();

    const handleActiveProjectChanged = () => {
      void checkNotifications();
    };

    window.addEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    return () => {
      window.removeEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
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
    branches: "Git Flow 기준으로 브랜치를 나눠 관리해요. main/develop, feature/release/hotfix 흐름을 따르는 곳이에요!",

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

  const navItems = [
    { value: "overview", label: "프로젝트", icon: FolderGit2, description: "repo 선택과 TODO" },
    { value: "changes", label: "변경사항", icon: FileText, description: "stage와 commit" },
    { value: "commits", label: "커밋", icon: GitCommit, description: "기록 확인" },
    { value: "branches", label: "브랜치", icon: GitBranch, description: "작업 흐름" },
    { value: "pulls", label: "리뷰", icon: GitPullRequest, description: "PR 관리" },
    { value: "issues", label: "이슈", icon: Bug, description: "할 일과 버그" }
  ];

  const activeNavItem = navItems.find((item) => item.value === activeTab) ?? navItems[0];
  const ActiveIcon = activeNavItem.icon;

  const renderWorkspace = () => {
    if (activeTab === "overview") return <ProjectOverview />;
    if (activeTab === "changes") return <FileChanges />;
    if (activeTab === "commits") return <CommitHistory />;
    if (activeTab === "branches") return <BranchManager />;
    if (activeTab === "pulls") return <PullRequestManager />;
    if (activeTab === "issues") return <IssueTracker />;
    return <ProjectOverview />;
  };

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0d1117]">
      {/* Beginner Guide Modal */}
      {showGuide && <BeginnerGuide onClose={handleCloseGuide} />}

      <Dialog
        open={tokenDialogOpen}
        onOpenChange={(open) => {
          if (!open && authBusy) return;
          setTokenDialogOpen(open);
          if (!open) {
            setTokenInput("");
            setBrowserLoginInfo(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>GitHub 로그인</DialogTitle>
            <DialogDescription>
              사이트 로그인 또는 Personal Access Token으로 로그인할 수 있습니다. 토큰은 PC 안에서만 암호화 저장됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] p-4 dark:border-[#30363d] dark:bg-[#15181e]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">사이트로 로그인</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  GitHub 사이트에서 승인하면 앱에 토큰이 저장됩니다.
                </p>
              </div>
              <Button type="button" onClick={() => void handleBrowserLogin()} disabled={authBusy}>
                <Globe className="mr-2 h-4 w-4" />
                사이트로 로그인
              </Button>
            </div>
            {browserLoginInfo ? (
              <div className="mt-4 rounded-md border border-[#d8dee4] bg-white p-3 dark:border-[#30363d] dark:bg-[#0d1117]">
                <p className="text-xs text-muted-foreground">GitHub 화면에 이 코드를 입력하세요.</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="rounded bg-[#f6f8fa] px-3 py-2 font-mono text-lg font-semibold tracking-widest dark:bg-[#15181e]">
                    {browserLoginInfo.user_code}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyBrowserCode()}>
                    <Copy className="mr-2 h-4 w-4" />
                    복사
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#d8dee4] dark:bg-[#30363d]" />
              <span className="text-xs text-muted-foreground">또는 토큰으로 로그인</span>
              <div className="h-px flex-1 bg-[#d8dee4] dark:bg-[#30363d]" />
            </div>
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
              disabled={authBusy}
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
                disabled={authBusy}
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

      <div className="min-h-screen bg-[#f6f7f9] text-[#1f2328] dark:bg-[#0f1115] dark:text-[#f0f3f6]">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_288px]">
          <AppNavigation
            activeTab={activeTab}
            navItems={navItems}
            themeLabel={themeLabel}
            ThemeIcon={ThemeIcon}
            themeMounted={themeMounted}
            onSelectTab={setActiveTab}
            onOpenGuide={() => setShowGuide(true)}
            onToggleTheme={handleToggleTheme}
          />

          <main className="min-w-0">
            <header className="sticky top-0 z-20 border-b border-[#d8dee4] bg-[#f6f7f9]/90 px-5 py-3 backdrop-blur dark:border-[#30363d] dark:bg-[#0f1115]/90">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ActiveIcon className="h-3.5 w-3.5" />
                    <span>Workspace</span>
                  </div>
                  <h1 className="truncate text-xl font-semibold leading-tight tracking-tight">{activeNavItem.label}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden max-w-[280px] items-center gap-2 rounded-md border border-[#d8dee4] bg-white px-3 py-1.5 text-xs dark:border-[#30363d] dark:bg-[#15181e] md:flex">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{activeProjectName || "프로젝트 미선택"}</span>
                  </div>
                  {authenticated ? (
                    <Button variant="outline" size="sm" onClick={handleLogout} disabled={authBusy}>
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleLogin} disabled={authBusy}>
                      <LogIn className="mr-2 h-4 w-4" />
                      로그인
                    </Button>
                  )}
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[1180px] px-5 py-5">
              <div className="min-w-0">{renderWorkspace()}</div>
            </div>
          </main>

          <AppContextPanel
            authenticated={authenticated}
            authUser={authUser}
            activeProjectName={activeProjectName}
            activeProjectPath={activeProjectPath}
            activeTab={activeTab}
            activeLabel={activeNavItem.label}
            showHelp={showHelp}
            tabHelpText={tabHelpText}
            onToggleHelp={() => setShowHelp((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}
