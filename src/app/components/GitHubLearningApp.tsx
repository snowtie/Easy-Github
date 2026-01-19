import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LearningSection } from "@/app/components/LearningSection";
import { CommandPractice } from "@/app/components/CommandPractice";
import { RepositoryManager } from "@/app/components/RepositoryManager";
import { WorkflowVisualizer } from "@/app/components/WorkflowVisualizer";
import { BookOpen, Terminal, FolderGit2, GitBranch } from "lucide-react";

export function GitHubLearningApp() {
  const [activeTab, setActiveTab] = useState("learn");

  useEffect(() => {
    const loadProgress = async () => {
      if (!window.easyGithub) return;

      try {
        const progress = await window.easyGithub.store.getLearningProgress();
        if (progress?.lastActiveTab) {
          setActiveTab(progress.lastActiveTab);
        }
      } catch {
        // 로드 실패는 기본 탭으로 유지
      }
    };

    loadProgress();
  }, []);

  useEffect(() => {
    if (!window.easyGithub) return;

    // 학습 앱 사용 시간을 분 단위로 누적한다.
    const interval = setInterval(async () => {
      try {
        const progress = await window.easyGithub.store.getLearningProgress();
        const minutes = Number(progress?.totalLearningMinutes ?? 0) + 1;
        await window.easyGithub.store.updateLearningProgress({ totalLearningMinutes: minutes });
      } catch {
        // 시간 기록 실패는 UI 동작에 영향을 주지 않음
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const handleTabChange = async (value: string) => {
    setActiveTab(value);
    if (!window.easyGithub) return;

    await window.easyGithub.store.updateLearningProgress({ lastActiveTab: value });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <GitBranch className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">GitHub 학습 센터</h1>
              <p className="text-white/80 text-sm">누구나 쉽게 배우는 Git & GitHub</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="learn" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              기초 학습
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              명령어 연습
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              워크플로우
            </TabsTrigger>
            <TabsTrigger value="repos" className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4" />
              저장소 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="learn">
            <LearningSection />
          </TabsContent>

          <TabsContent value="commands">
            <CommandPractice />
          </TabsContent>

          <TabsContent value="workflow">
            <WorkflowVisualizer />
          </TabsContent>

          <TabsContent value="repos">
            <RepositoryManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
