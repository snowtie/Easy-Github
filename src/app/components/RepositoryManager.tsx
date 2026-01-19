import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  FolderGit2,
  Star,
  GitFork,
  Eye,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

interface Repository {
  id: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  lastUpdated: string;
  language: string;
  isPrivate: boolean;
  url: string;
}



export function RepositoryManager() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = async () => {
    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 저장소 관리를 지원합니다");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const raw = await window.easyGithub.github.listRepositories();
      const list = (raw as any[]).map((repo) => ({
        id: String(repo.id),
        name: repo.name,
        description: repo.description || "설명 없음",
        stars: Number(repo.stargazers_count ?? 0),
        forks: Number(repo.forks_count ?? 0),
        watchers: Number(repo.watchers_count ?? 0),
        lastUpdated: repo.updated_at ? new Date(repo.updated_at).toLocaleString() : "",
        language: repo.language || "",
        isPrivate: Boolean(repo.private),
        url: repo.html_url
      }));

      setRepositories(list);
    } catch (err: any) {
      const message = err?.message || "저장소를 불러오지 못했습니다";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) {
      toast.error("저장소 이름을 입력해주세요");
      return;
    }

    if (!window.easyGithub) {
      toast.error("Electron 환경에서만 저장소 생성을 지원합니다");
      return;
    }

    const toastId = toast.loading("저장소 생성 중...");
    setBusy(true);
    try {
      await window.easyGithub.github.createRepository(newRepoName.trim(), newRepoDesc.trim(), newRepoPrivate);
      toast.success(`${newRepoName} 저장소가 생성되었습니다!`, { id: toastId });
      setNewRepoName("");
      setNewRepoDesc("");
      setNewRepoPrivate(false);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "저장소 생성에 실패했습니다", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRepo = (name: string) => {
    // 안전을 위해 실제 삭제 대신 안내만 제공
    toast.error(`${name} 저장소 삭제는 현재 버전에서 지원하지 않습니다`);
  };

  const filteredRepos = useMemo(
    () =>
      activeTab === "all"
        ? repositories
        : repositories.filter((repo) => (activeTab === "public" ? !repo.isPrivate : repo.isPrivate)),
    [repositories, activeTab]
  );

  return (
    <div className="space-y-6">
      {/* Create New Repository */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            새 저장소 만들기
          </CardTitle>
          <CardDescription>
            GitHub에 새로운 저장소를 생성합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-name">저장소 이름 *</Label>
            <Input
              id="repo-name"
              placeholder="my-awesome-project"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-desc">설명 (선택사항)</Label>
            <Input
              id="repo-desc"
              placeholder="프로젝트에 대한 간단한 설명"
              value={newRepoDesc}
              onChange={(e) => setNewRepoDesc(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="repo-private" checked={newRepoPrivate} onCheckedChange={(v) => setNewRepoPrivate(Boolean(v))} />
            <Label htmlFor="repo-private">비공개 저장소</Label>
          </div>
          <Button onClick={handleCreateRepo} className="w-full" disabled={busy}>
            <Plus className="w-4 h-4 mr-2" />
            저장소 생성
          </Button>
        </CardContent>
      </Card>

      {/* Repository List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>내 저장소</CardTitle>
              <CardDescription>
                총 {repositories.length}개의 저장소
              </CardDescription>
            </div>
             <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
               <RefreshCw className="w-4 h-4 mr-2" />
               새로고침
             </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="all">
                전체 ({repositories.length})
              </TabsTrigger>
              <TabsTrigger value="public">
                공개 ({repositories.filter(r => !r.isPrivate).length})
              </TabsTrigger>
              <TabsTrigger value="private">
                비공개 ({repositories.filter(r => r.isPrivate).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
               {filteredRepos.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground">
                   <FolderGit2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                   <p>저장소가 없습니다</p>
                   {errorMessage && <p className="text-xs mt-2">{errorMessage}</p>}
                 </div>
               ) : (
                filteredRepos.map((repo) => (
                  <Card key={repo.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          {/* Repo Header */}
                          <div className="flex items-center gap-3">
                            <FolderGit2 className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-lg text-foreground">
                              {repo.name}
                            </h3>
                            <Badge variant={repo.isPrivate ? "secondary" : "default"}>
                              {repo.isPrivate ? "비공개" : "공개"}
                            </Badge>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground pl-8">
                            {repo.description}
                          </p>

                          {/* Stats */}
                          <div className="flex items-center gap-6 pl-8 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4" />
                              <span>{repo.stars}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <GitFork className="w-4 h-4" />
                              <span>{repo.forks}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              <span>{repo.watchers}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{repo.lastUpdated}</span>
                            </div>
                          </div>

                          {/* Language */}
                          <div className="pl-8">
                            <Badge variant="outline" className="text-xs">
                              {repo.language}
                            </Badge>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (window.easyGithub ? window.easyGithub.app.openExternal(repo.url) : window.open(repo.url, '_blank'))}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                           <Button
                             variant="destructive"
                             size="sm"
                             onClick={() => handleDeleteRepo(repo.name)}
                           >
                             <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 작업</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <div className="flex items-center gap-2 mb-2">
              <FolderGit2 className="w-5 h-5" />
              <span className="font-semibold">저장소 복제</span>
            </div>
            <span className="text-xs text-muted-foreground">
              git clone으로 저장소를 로컬에 복사
            </span>
          </Button>

          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <div className="flex items-center gap-2 mb-2">
              <GitFork className="w-5 h-5" />
              <span className="font-semibold">저장소 포크</span>
            </div>
            <span className="text-xs text-muted-foreground">
              다른 저장소를 내 계정으로 복사
            </span>
          </Button>

          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-5 h-5" />
              <span className="font-semibold">GitHub 열기</span>
            </div>
            <span className="text-xs text-muted-foreground">
              웹 브라우저에서 GitHub 열기
            </span>
          </Button>

          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5" />
              <span className="font-semibold">동기화</span>
            </div>
            <span className="text-xs text-muted-foreground">
              로컬과 원격 저장소 동기화
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
