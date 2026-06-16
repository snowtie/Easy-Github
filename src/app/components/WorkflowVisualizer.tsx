import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { ArrowRight, GitBranch, GitCommit, GitMerge, GitPullRequest, Upload, Download } from "lucide-react";

const workflows = [
  {
    id: "basic",
    title: "기본 워크플로우",
    description: "개인 프로젝트의 기본적인 Git 작업 흐름",
    steps: [
      { icon: GitCommit, label: "작업 디렉토리", desc: "파일 수정" },
      { icon: ArrowRight, label: "→", desc: "git add" },
      { icon: GitCommit, label: "스테이징 영역", desc: "커밋 준비" },
      { icon: ArrowRight, label: "→", desc: "git commit" },
      { icon: GitCommit, label: "로컬 저장소", desc: "변경사항 저장" },
      { icon: ArrowRight, label: "→", desc: "git push (업로드)" },
      { icon: Upload, label: "원격 저장소", desc: "GitHub에 업로드" }
    ]
  },
  {
    id: "branch",
    title: "브랜치 워크플로우",
    description: "새 기능 개발 시 브랜치를 사용하는 흐름",
    steps: [
      { icon: GitBranch, label: "main 브랜치", desc: "안정적인 코드" },
      { icon: ArrowRight, label: "→", desc: "git checkout -b feature" },
      { icon: GitBranch, label: "feature 브랜치", desc: "새 기능 개발" },
      { icon: ArrowRight, label: "→", desc: "개발 & 커밋" },
      { icon: GitCommit, label: "커밋들", desc: "작업 내용 저장" },
      { icon: ArrowRight, label: "→", desc: "git checkout main" },
      { icon: GitMerge, label: "병합", desc: "git merge feature" },
      { icon: GitBranch, label: "main 브랜치", desc: "기능 통합 완료" }
    ]
  },
  {
    id: "collaboration",
    title: "협업 워크플로우",
    description: "팀 프로젝트에서 Pull Request를 사용한 협업",
    steps: [
      { icon: Download, label: "Fork", desc: "저장소 복사" },
      { icon: ArrowRight, label: "→", desc: "git clone" },
      { icon: GitBranch, label: "로컬 작업", desc: "브랜치 생성 & 수정" },
      { icon: ArrowRight, label: "→", desc: "git push (업로드)" },
      { icon: Upload, label: "내 원격 저장소", desc: "변경사항 업로드" },
      { icon: ArrowRight, label: "→", desc: "Create PR" },
      { icon: GitPullRequest, label: "Pull Request", desc: "코드 리뷰 요청" },
      { icon: ArrowRight, label: "→", desc: "Review & Merge" },
      { icon: GitMerge, label: "원본 저장소", desc: "변경사항 병합" }
    ]
  }
];

export function WorkflowVisualizer() {
  const [selectedWorkflow, setSelectedWorkflow] = useState("basic");

  const currentWorkflow = workflows.find(w => w.id === selectedWorkflow) || workflows[0];

  return (
    <div className="space-y-5">
      {/* Workflow Selector */}
      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader className="pb-4">
          <CardTitle>Git 워크플로우 시각화</CardTitle>
          <CardDescription>
            다양한 Git 작업 흐름을 시각적으로 이해하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
            <TabsList className="grid w-full grid-cols-3">
              {workflows.map(workflow => (
                <TabsTrigger key={workflow.id} value={workflow.id}>
                  {workflow.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Workflow Visualization */}
      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader className="pb-4">
          <CardTitle>{currentWorkflow.title}</CardTitle>
          <CardDescription>{currentWorkflow.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-4 p-3 md:p-6">
            {currentWorkflow.steps.map((step, index) => {
              const Icon = step.icon;
              const isArrow = step.label === "→";
              
              return (
                <div key={index} className="flex flex-col items-center">
                  {isArrow ? (
                    <div className="flex flex-col items-center">
                      <ArrowRight className="w-8 h-8 text-muted-foreground/70" />
                      <span className="text-xs text-muted-foreground mt-2 font-mono">
                        {step.desc}
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-w-[140px] flex-col items-center gap-2 rounded-md border border-[#d8dee4] bg-white p-4 shadow-sm dark:border-[#30363d] dark:bg-[#15181e]">
                      <Icon className="w-8 h-8 text-[#0969da]" />
                      <div className="text-center">
                        <div className="font-semibold text-sm text-foreground">
                          {step.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {step.desc}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Additional Workflow Examples */}
      <Card className="rounded-md border-[#d8dee4] shadow-sm dark:border-[#30363d]">
        <CardHeader className="pb-4">
          <CardTitle>실전 시나리오</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario 1 */}
          <div className="space-y-2 border-l-2 border-[#0969da] pl-4">
            <h3 className="font-semibold text-foreground">시나리오 1: 새 기능 개발하기</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">1</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git checkout -b feature-login</code> - 새 브랜치 생성</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">2</span>
                <span>로그인 기능 개발 (코드 작성)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">3</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git add .</code> - 변경사항 스테이징</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">4</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git commit -m "Add login feature"</code> - 커밋</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">5</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git push -u origin feature-login</code> - 원격에 업로드</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">6</span>
                <span>GitHub에서 Pull Request 생성</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">7</span>
                <span>코드 리뷰 후 병합</span>
              </li>
            </ol>
          </div>

          {/* Scenario 2 */}
          <div className="space-y-2 border-l-2 border-[#1a7f37] pl-4">
            <h3 className="font-semibold text-foreground">시나리오 2: 팀원의 변경사항 가져오기</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">1</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git checkout main</code> - main 브랜치로 이동</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">2</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git pull origin main</code> - 최신 변경사항 로컬로 합치기</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">3</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git checkout feature-login</code> - 작업 브랜치로 복귀</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">4</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git merge main</code> - main의 변경사항 병합</span>
              </li>
            </ol>
          </div>

          {/* Scenario 3 */}
          <div className="space-y-2 border-l-2 border-[#8250df] pl-4">
            <h3 className="font-semibold text-foreground">시나리오 3: 충돌 해결하기</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">1</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git merge feature-branch</code> - 병합 시도 (충돌 발생)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">2</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git status</code> - 충돌 파일 확인</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">3</span>
                <span>충돌 파일 열어서 수동으로 수정 (마커 제거)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">4</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git add .</code> - 해결된 파일 스테이징</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono bg-muted px-2 py-1 rounded min-w-[30px] text-center">5</span>
                <span><code className="rounded bg-[#f6f8fa] px-2 py-1 text-xs dark:bg-[#15181e]">git commit -m "Resolve merge conflict"</code> - 병합 완료</span>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
