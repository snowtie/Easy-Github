import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { GitCommit, GitBranch, Search, Copy, Code } from "lucide-react";
import { toast } from "sonner";

interface Commit {
  id: string;
  hash: string;
  message: string;
  description?: string;
  author: string;
  authorInitials: string;
  date: string;
  branch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";

export function CommitHistory() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [showGuide, setShowGuide] = useState(true);

  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [activeProjectName, setActiveProjectName] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
  const [busy, setBusy] = useState(false);

  const refreshInFlightRef = useRef(false);

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "?";

    // 한국어 이름은 2글자 정도만 보여주는 게 가독성이 좋다.
    if (/^[가-힣]+$/.test(trimmed)) {
      return trimmed.slice(0, 2);
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  };

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 커밋 히스토리 조회를 지원합니다");
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
    const repoName = localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "";
    setActiveProjectPath(repoPath);
    setActiveProjectName(repoName);

    if (!repoPath) {
      setCommits([]);
      refreshInFlightRef.current = false;
      return;
    }

    setBusy(true);
    try {
      const log = await window.easyGithub.git.log(repoPath, 50);
      const items = (log?.all ?? []) as any[];

      const normalized: Commit[] = items.map((c) => {
        const author = c.author_name || c.author_email || "Unknown";
        return {
          id: c.hash,
          hash: String(c.hash).slice(0, 7),
          message: c.message,
          description: c.body || undefined,
          author,
          authorInitials: getInitials(author),
          date: c.date ? new Date(c.date).toLocaleString() : "",
          branch: c.refs ? String(c.refs).split(",")[0].trim() : "",
          filesChanged: 0,
          additions: 0,
          deletions: 0
        };
      });

      setCommits(normalized);
    } catch (err: any) {
      toast.error(err?.message || "커밋 히스토리 조회에 실패했습니다");
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

  const filteredCommits = useMemo(() => {
    return commits.filter((commit) => {
      const matchesSearch =
        commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.hash.includes(searchQuery.toLowerCase());

      const matchesBranch = selectedBranch === "all" || commit.branch === selectedBranch;

      return matchesSearch && matchesBranch;
    });
  }, [commits, searchQuery, selectedBranch]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success("커밋 해시가 복사되었습니다!");
  };

  const getCommitTypeColor = (message: string) => {
    if (message.startsWith("Fix:") || message.startsWith("Bugfix:")) {
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/20 dark:text-red-100 dark:border-red-900";
    }
    if (message.startsWith("Feature:") || message.startsWith("Feat:")) {
      return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/20 dark:text-green-100 dark:border-green-900";
    }
    if (message.startsWith("Refactor:")) {
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/20 dark:text-blue-100 dark:border-blue-900";
    }
    if (message.startsWith("Docs:")) {
      return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/20 dark:text-purple-100 dark:border-purple-900";
    }
    if (message.startsWith("Style:")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/20 dark:text-yellow-100 dark:border-yellow-900";
    }
    return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/40 dark:text-slate-100 dark:border-slate-800";
  };

  const branches = useMemo(() => {
    return ["all", ...Array.from(new Set(commits.map((c) => c.branch).filter(Boolean)))];
  }, [commits]);

  return (
    <div className="space-y-6">
      {/* Guide Card */}
      {showGuide && (
        <Card className="border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-purple-900 dark:text-purple-100 flex items-center gap-2">
                📖 커밋 히스토리란?
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(false)}
                className="text-purple-700 dark:text-purple-200"
              >
                닫기
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-purple-900 dark:text-purple-100">
            <p className="font-semibold">프로젝트의 타임라인이에요!</p>
            <div className="space-y-2 text-sm">
              <p>• <strong>누가</strong> 코드를 바꿨는지</p>
              <p>• <strong>언제</strong> 바꿨는지</p>
              <p>• <strong>무엇을</strong> 바꿨는지</p>
              <p>• <strong>왜</strong> 바꿨는지 (커밋 메시지)</p>
            </div>
            <div className="bg-card/60 p-3 rounded-lg mt-3">
              <p className="text-xs">
                💡 <strong>활용법:</strong> 버그가 언제 생겼는지 찾거나, 팀원들의 작업을 확인하거나, 
                이전 버전으로 되돌릴 때 사용해요!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>커밋 히스토리</CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="커밋 메시지, 작성자, 해시로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={refresh} disabled={busy}>
              새로고침
            </Button>
          </div>

          {/* Branch Filter */}
          <div className="flex gap-2 flex-wrap">
            {branches.map(branch => (
              <Badge
                key={branch}
                variant={selectedBranch === branch ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedBranch(branch)}
              >
                <GitBranch className="w-3 h-3 mr-1" />
                {branch === "all" ? "모든 브랜치" : branch}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{filteredCommits.length}</p>
              <p className="text-sm text-muted-foreground mt-1">총 커밋</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                +{filteredCommits.reduce((sum, c) => sum + c.additions, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">추가된 줄</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                -{filteredCommits.reduce((sum, c) => sum + c.deletions, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">삭제된 줄</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                {filteredCommits.reduce((sum, c) => sum + c.filesChanged, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">변경된 파일</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commit List */}
      <div className="space-y-4">
        {!activeProjectPath ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GitCommit className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
              <p className="text-sm mt-2">"프로젝트" 탭에서 Clone 후 상태 버튼을 눌러 선택해주세요.</p>
            </CardContent>
          </Card>
        ) : filteredCommits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GitCommit className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>검색 결과가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          filteredCommits.map((commit, index) => (
            <Card key={commit.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <GitCommit className="w-5 h-5 text-blue-600" />
                    </div>
                    {index < filteredCommits.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border my-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getCommitTypeColor(commit.message)}>
                            {commit.message}
                          </Badge>
                          {commit.branch && (
                            <Badge variant="outline" className="font-mono text-xs">
                              <GitBranch className="w-3 h-3 mr-1" />
                              {commit.branch}
                            </Badge>
                          )}
                        </div>
                        {commit.description && (
                          <p className="text-sm text-muted-foreground mt-2">{commit.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Author and Date */}
                    <div className="flex items-center gap-3">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">{commit.authorInitials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{commit.author}</span>
                      <span className="text-sm text-muted-foreground/70">•</span>
                      <span className="text-sm text-muted-foreground">{commit.date}</span>
                    </div>

                    {/* Stats and Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Code className="w-4 h-4 text-muted-foreground/70" />
                          <span className="text-muted-foreground">{commit.filesChanged} files</span>
                        </div>
                        <span className="text-green-600">+{commit.additions}</span>
                        <span className="text-red-600">-{commit.deletions}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyHash(commit.hash)}
                          className="font-mono text-xs"
                        >
                          {commit.hash}
                          <Copy className="w-3 h-3 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}