import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { Badge } from "@/app/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/app/components/ui/button";

const learningModules = [
  {
    id: "basics",
    title: "Git 기초",
    level: "초급",
    topics: [
      {
        id: "what-is-git",
        title: "Git이란 무엇인가요?",
        content: "Git은 소스 코드의 변경사항을 추적하고 여러 개발자가 협업할 수 있게 해주는 분산 버전 관리 시스템입니다. 프로젝트의 모든 변경 기록을 저장하고, 필요할 때 이전 버전으로 되돌릴 수 있습니다.",
        keyPoints: [
          "분산 버전 관리 시스템",
          "코드 변경사항 추적",
          "협업 도구",
          "이전 버전 복원 가능"
        ]
      },
      {
        id: "github-vs-git",
        title: "GitHub와 Git의 차이",
        content: "Git은 버전 관리 시스템이고, GitHub는 Git 저장소를 호스팅하는 웹 기반 플랫폼입니다. GitHub는 Git의 기능에 더해 협업, 이슈 트래킹, 프로젝트 관리 등의 기능을 제공합니다.",
        keyPoints: [
          "Git: 버전 관리 도구",
          "GitHub: Git 호스팅 서비스",
          "GitHub는 웹 인터페이스 제공",
          "협업 기능 강화"
        ]
      },
      {
        id: "repository",
        title: "저장소(Repository)란?",
        content: "저장소는 프로젝트의 모든 파일과 각 파일의 변경 이력을 포함하는 디렉토리입니다. 로컬 저장소(내 컴퓨터)와 원격 저장소(GitHub)가 있습니다.",
        keyPoints: [
          "프로젝트 파일 저장소",
          "변경 이력 포함",
          "로컬 저장소: 내 컴퓨터",
          "원격 저장소: GitHub 서버"
        ]
      }
    ]
  },
  {
    id: "core-concepts",
    title: "핵심 개념",
    level: "초급",
    topics: [
      {
        id: "commit",
        title: "커밋(Commit)",
        content: "커밋은 변경사항의 스냅샷입니다. 프로젝트의 특정 시점을 저장하는 것으로, 각 커밋은 고유한 ID를 가지며 작성자, 날짜, 메시지를 포함합니다.",
        keyPoints: [
          "변경사항의 스냅샷",
          "고유한 ID 보유",
          "의미있는 메시지 작성 중요",
          "프로젝트 히스토리 구성"
        ]
      },
      {
        id: "branch",
        title: "브랜치(Branch)",
        content: "브랜치는 독립적인 작업 공간입니다. 새로운 기능을 개발하거나 버그를 수정할 때 메인 코드에 영향을 주지 않고 작업할 수 있습니다. 작업이 완료되면 메인 브랜치에 병합합니다.",
        keyPoints: [
          "독립적인 작업 공간",
          "메인 코드 영향 없음",
          "병렬 작업 가능",
          "완료 후 병합(Merge)"
        ]
      },
      {
        id: "merge",
        title: "병합(Merge)",
        content: "병합은 서로 다른 브랜치의 변경사항을 하나로 합치는 것입니다. 예를 들어, 기능 개발이 완료된 브랜치를 메인 브랜치에 병합하여 새 기능을 적용합니다.",
        keyPoints: [
          "브랜치 통합",
          "변경사항 결합",
          "충돌 해결 필요할 수 있음",
          "히스토리 보존"
        ]
      },
      {
        id: "pull-push",
        title: "Pull과 Push",
        content: "Push는 로컬 변경사항을 원격 저장소에 업로드하는 것이고, Pull은 원격 저장소의 변경사항을 로컬로 가져오는 것입니다. 협업 시 필수적인 작업입니다.",
        keyPoints: [
          "Push: 로컬 → 원격",
          "Pull: 원격 → 로컬",
          "협업의 핵심",
          "최신 상태 유지"
        ]
      }
    ]
  },
  {
    id: "collaboration",
    title: "협업 워크플로우",
    level: "중급",
    topics: [
      {
        id: "fork",
        title: "포크(Fork)",
        content: "포크는 다른 사람의 저장소를 자신의 GitHub 계정으로 복사하는 것입니다. 오픈소스 프로젝트에 기여하거나 독립적으로 프로젝트를 수정할 때 사용합니다.",
        keyPoints: [
          "저장소 복사",
          "독립적 수정 가능",
          "오픈소스 기여",
          "원본에 영향 없음"
        ]
      },
      {
        id: "pull-request",
        title: "풀 리퀘스트(Pull Request)",
        content: "풀 리퀘스트는 자신의 변경사항을 원본 저장소에 병합해달라고 요청하는 것입니다. 코드 리뷰와 토론을 거쳐 승인되면 병합됩니다.",
        keyPoints: [
          "병합 요청",
          "코드 리뷰 과정",
          "토론 및 피드백",
          "품질 관리"
        ]
      },
      {
        id: "issues",
        title: "이슈(Issues)",
        content: "이슈는 버그, 기능 요청, 질문 등을 추적하는 도구입니다. 프로젝트 관리와 협업에 유용하며, 레이블과 마일스톤으로 체계적으로 관리할 수 있습니다.",
        keyPoints: [
          "버그 추적",
          "기능 요청",
          "프로젝트 관리",
          "레이블 & 마일스톤"
        ]
      }
    ]
  }
];

const practiceScenarios = [
  {
    id: "first-commit",
    title: "첫 커밋 만들기",
    steps: [
      { id: "edit", label: "파일을 수정한다" },
      { id: "stage", label: "git add로 스테이징한다" },
      { id: "commit", label: "커밋 메시지를 작성하고 커밋한다" }
    ]
  },
  {
    id: "feature-branch",
    title: "브랜치로 기능 만들기",
    steps: [
      { id: "create-branch", label: "새 브랜치를 만든다" },
      { id: "work", label: "브랜치에서 작업한다" },
      { id: "merge", label: "main 브랜치에 병합한다" }
    ]
  }
];

export function LearningSection() {
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [completedPracticeSteps, setCompletedPracticeSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadProgress = async () => {
    if (!window.easyGithub) return;

    setLoading(true);
    try {
      const progress = await window.easyGithub.store.getLearningProgress();
      const savedTopics = Array.isArray(progress?.completedTopics) ? progress.completedTopics : [];
      const savedPractice = Array.isArray(progress?.completedPracticeSteps) ? progress.completedPracticeSteps : [];
      setCompletedTopics(new Set(savedTopics));
      setCompletedPracticeSteps(new Set(savedPractice));
    } catch {
      // 학습 진행도 로드 실패는 치명적이지 않음
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const persistCompletedTopics = async (nextSet: Set<string>) => {
    if (!window.easyGithub) return;

    // 복잡한 상태 변경을 한 번에 저장해 데이터 꼬임을 방지
    await window.easyGithub.store.updateLearningProgress({
      completedTopics: Array.from(nextSet)
    });
  };

  const persistPracticeSteps = async (nextSet: Set<string>) => {
    if (!window.easyGithub) return;

    await window.easyGithub.store.updateLearningProgress({
      completedPracticeSteps: Array.from(nextSet)
    });
  };

  const toggleComplete = async (topicId: string) => {
    setCompletedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      persistCompletedTopics(newSet);
      return newSet;
    });
  };

  const togglePracticeStep = async (scenarioId: string, stepId: string) => {
    const key = `${scenarioId}:${stepId}`;

    setCompletedPracticeSteps((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      persistPracticeSteps(nextSet);
      return nextSet;
    });
  };

  const totalTopics = learningModules.reduce((sum, module) => sum + module.topics.length, 0);
  const completedCount = completedTopics.size;
  const progress = Math.round((completedCount / totalTopics) * 100);

  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>학습 진행도</CardTitle>
          <CardDescription>
            {completedCount} / {totalTopics} 주제 완료
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-3 bg-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Modules */}
      {learningModules.map((module) => (
        <Card key={module.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{module.title}</CardTitle>
              <Badge variant={module.level === "초급" ? "default" : "secondary"}>
                {module.level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {module.topics.map((topic) => {
                const isCompleted = completedTopics.has(topic.id);
                return (
                  <AccordionItem key={topic.id} value={topic.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/70 flex-shrink-0" />
                        )}
                        <span className={isCompleted ? "text-muted-foreground" : ""}>
                          {topic.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-8 space-y-4">
                        <p className="text-muted-foreground leading-relaxed">
                          {topic.content}
                        </p>
                        <div>
                          <p className="font-semibold text-sm text-foreground mb-2">핵심 포인트:</p>
                          <ul className="space-y-1">
                            {topic.keyPoints.map((point, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-blue-500 mt-1">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          variant={isCompleted ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleComplete(topic.id)}
                          className="mt-2"
                          disabled={loading}
                        >
                          {isCompleted ? "완료 취소" : "완료 표시"}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>실습 모드</CardTitle>
          <CardDescription>가벼운 체크리스트로 학습을 정리하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {practiceScenarios.map((scenario) => (
            <div key={scenario.id} className="border rounded-lg p-4 space-y-3">
              <div className="font-semibold text-foreground">{scenario.title}</div>
              <div className="space-y-2">
                {scenario.steps.map((step) => {
                  const key = `${scenario.id}:${step.id}`;
                  const done = completedPracticeSteps.has(key);
                  return (
                    <div key={step.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/70" />
                        )}
                        <span className={done ? "text-muted-foreground" : "text-foreground"}>{step.label}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={done ? "outline" : "default"}
                        onClick={() => togglePracticeStep(scenario.id, step.id)}
                        disabled={loading}
                      >
                        {done ? "취소" : "완료"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
