import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  GitBranch,
  KeyRound,
  MousePointerClick,
  Upload
} from "lucide-react";

interface GuideStep {
  id: number;
  title: string;
  plainTitle: string;
  description: string;
  icon: any;
  action: string;
  terms: { label: string; meaning: string }[];
  checks: string[];
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: "로그인 준비",
    plainTitle: "GitHub 기능을 쓰기 위해 먼저 로그인해요",
    description: "PR, Issue, 저장소 목록 같은 GitHub 기능은 로그인 후 사용할 수 있습니다.",
    icon: KeyRound,
    action: "상단의 로그인 버튼을 누르고 사이트 로그인 또는 토큰 로그인을 선택하세요.",
    terms: [
      { label: "사이트 로그인", meaning: "GitHub 페이지에서 승인하는 방식" },
      { label: "토큰 로그인", meaning: "GitHub에서 만든 비밀번호 같은 키를 붙여넣는 방식" }
    ],
    checks: [
      "사이트 로그인이 꺼져 있으면 토큰 로그인으로 진행하면 됩니다.",
      "비공개 저장소를 다룰 경우 토큰에는 repo 권한이 필요합니다.",
      "로그인은 나중에 해도 되지만 PR, Issue 기능은 제한됩니다."
    ]
  },
  {
    id: 2,
    title: "프로젝트 가져오기",
    plainTitle: "GitHub 코드를 내 PC에 내려받아요",
    description: "프로젝트 탭에서 GitHub 저장소 주소와 저장할 폴더를 넣으면 앱이 다운로드합니다.",
    icon: Download,
    action: "프로젝트 탭의 프로젝트 추가하기를 누르고 GitHub URL을 붙여넣으세요.",
    terms: [
      { label: "Clone", meaning: "GitHub 코드를 내 PC 폴더로 복사하는 작업" },
      { label: "저장소 URL", meaning: "GitHub의 Code 버튼에서 복사하는 주소" }
    ],
    checks: [
      "처음이면 빈 폴더를 선택하는 것이 가장 안전합니다.",
      "이미 파일이 있는 폴더는 유지 모드를 사용할 수 있습니다.",
      "다운로드가 끝나면 프로젝트 카드가 목록에 생깁니다."
    ]
  },
  {
    id: 3,
    title: "작업할 프로젝트 선택",
    plainTitle: "지금 작업할 프로젝트를 선택해요",
    description: "앱은 선택된 프로젝트를 기준으로 변경사항, 브랜치, TODO를 보여줍니다.",
    icon: MousePointerClick,
    action: "프로젝트 카드의 상태 버튼을 누르거나 카드를 클릭해 활성 프로젝트로 만드세요.",
    terms: [
      { label: "활성 프로젝트", meaning: "지금 앱이 기준으로 삼는 로컬 저장소" },
      { label: "브랜치", meaning: "작업을 나누는 별도 흐름" }
    ],
    checks: [
      "오른쪽 패널의 Project 영역에 프로젝트 이름이 보이면 선택된 상태입니다.",
      "프로젝트를 선택해야 변경사항, 커밋, 브랜치 탭이 정확히 동작합니다.",
      "다른 프로젝트를 누르면 언제든 기준을 바꿀 수 있습니다."
    ]
  },
  {
    id: 4,
    title: "변경 저장하기",
    plainTitle: "바꾼 파일을 저장 기록으로 남겨요",
    description: "변경사항 탭에서 파일을 확인하고, 커밋 메시지를 써서 기록으로 남깁니다.",
    icon: FileCheck2,
    action: "변경사항 탭에서 파일 내용을 확인한 뒤 커밋할 파일만 선택하세요.",
    terms: [
      { label: "Stage", meaning: "이번 저장 기록에 포함할 파일 선택" },
      { label: "Commit", meaning: "선택한 변경을 저장 기록으로 남기는 작업" }
    ],
    checks: [
      "모든 파일을 한 번에 커밋하지 않아도 됩니다.",
      "커밋 메시지는 무엇을 바꿨는지 한 문장으로 적으면 충분합니다.",
      "실수했다면 커밋 전에는 선택을 해제할 수 있습니다."
    ]
  },
  {
    id: 5,
    title: "GitHub와 동기화",
    plainTitle: "내 PC와 GitHub 상태를 맞춰요",
    description: "Pull로 GitHub의 최신 변경을 가져오고, Push로 내 커밋을 GitHub에 올립니다.",
    icon: Upload,
    action: "프로젝트 카드 또는 변경사항 흐름에서 Pull 후 Push 순서로 진행하세요.",
    terms: [
      { label: "Pull", meaning: "GitHub의 최신 내용을 내 PC로 가져오기" },
      { label: "Push", meaning: "내 저장 기록을 GitHub에 업로드하기" }
    ],
    checks: [
      "여러 사람이 같이 작업하면 Push 전에 Pull을 먼저 하는 습관이 좋습니다.",
      "업로드 대기가 0이면 GitHub에 올릴 새 커밋이 없는 상태입니다.",
      "충돌이 나면 같은 파일을 여러 사람이 바꾼 상황일 수 있습니다."
    ]
  },
  {
    id: 6,
    title: "협업 기능 사용",
    plainTitle: "PR과 Issue로 협업을 이어가요",
    description: "작업이 커지면 브랜치로 나누고, PR과 Issue로 리뷰와 할 일을 관리합니다.",
    icon: GitBranch,
    action: "리뷰 탭에서 PR을 확인하고, 이슈 탭에서 할 일과 버그를 관리하세요.",
    terms: [
      { label: "PR", meaning: "내 작업을 합치기 전에 리뷰받는 요청" },
      { label: "Issue", meaning: "할 일, 버그, 질문을 남기는 게시글" }
    ],
    checks: [
      "혼자 쓰는 경우에도 Issue는 TODO 기록처럼 사용할 수 있습니다.",
      "큰 기능은 별도 브랜치에서 작업하면 되돌리기 쉽습니다.",
      "처음에는 프로젝트, 변경사항, 커밋, 업로드 흐름만 익혀도 충분합니다."
    ]
  }
];

interface BeginnerGuideProps {
  onClose: () => void;
}

export function BeginnerGuide({ onClose }: BeginnerGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const openExternal = (url: string) => {
    if (window.easyGithub) {
      window.easyGithub.app.openExternal(url);
      return;
    }

    window.open(url, "_blank");
  };

  const handleNextStep = () => {
    setCompletedSteps(new Set(completedSteps).add(guideSteps[currentStep].id));
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setCompletedSteps(new Set(guideSteps.map((step) => step.id)));
    onClose();
  };

  const step = guideSteps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / guideSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-md border-[#d8dee4] shadow-2xl dark:border-[#30363d]">
        <CardHeader className="bg-white dark:bg-[#15181e]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-[#ddf4ff] p-2 text-[#0969da] dark:bg-[#0d263a] dark:text-[#58a6ff]">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">처음 시작 가이드</CardTitle>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Git 용어보다 먼저, 앱에서 눌러야 할 순서대로 안내합니다.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              나중에 보기
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span>{currentStep + 1} / {guideSteps.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#d8dee4] dark:bg-[#30363d]">
              <div
                className="h-full bg-[#0969da] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-6 pb-6 pt-6">
          <div className="grid gap-2 md:grid-cols-6">
            {guideSteps.map((guideStep, index) => {
              const isCurrent = index === currentStep;
              const isDone = completedSteps.has(guideStep.id);
              return (
                <button
                  key={guideStep.id}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isCurrent
                      ? "bg-[#0969da] text-white"
                      : isDone
                      ? "bg-[#dafbe1] text-[#1a7f37] dark:bg-[#12261a] dark:text-[#7ee787]"
                      : "bg-[#f6f8fa] text-muted-foreground hover:bg-[#eef6ff] dark:bg-[#15181e] dark:hover:bg-[#0d263a]"
                  }`}
                >
                  <span className="block text-xs opacity-80">Step {guideStep.id}</span>
                  <span className="block truncate font-semibold">{guideStep.title}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="rounded-md bg-[#ddf4ff] p-4 text-[#0969da] dark:bg-[#0d263a] dark:text-[#58a6ff]">
                  <Icon className="h-9 w-9" />
                </div>
                <div>
                  <Badge className="mb-3">Step {step.id}</Badge>
                  <h3 className="text-2xl font-bold tracking-tight">{step.plainTitle}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>

              <div className="rounded-md bg-[#eef6ff] p-4 dark:bg-[#0d263a]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0969da] dark:text-[#58a6ff]">
                  지금 할 일
                </p>
                <p className="mt-2 text-base font-semibold">{step.action}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {step.terms.map((term) => (
                  <div key={term.label} className="rounded-md bg-[#f6f8fa] p-4 dark:bg-[#15181e]">
                    <p className="text-sm font-semibold">{term.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{term.meaning}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-md bg-[#f6f8fa] p-4 dark:bg-[#15181e]">
              <p className="text-sm font-semibold">헷갈리면 이것만 확인</p>
              <ul className="mt-4 space-y-3">
                {step.checks.map((check) => (
                  <li key={check} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1a7f37]" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>

              {currentStep === 0 ? (
                <div className="mt-5 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openExternal("https://github.com/settings/tokens")}
                    className="justify-start gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    토큰 만들기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openExternal(
                        "https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
                      )
                    }
                    className="justify-start gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    GitHub 토큰 가이드
                  </Button>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="rounded-md bg-[#fff8c5] p-4 text-[#7d4e00] dark:bg-[#2d260f] dark:text-[#f0d98c]">
            <p className="font-semibold">처음에는 이 순서만 기억하세요</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">로그인</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">프로젝트 추가</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">프로젝트 선택</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">커밋</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">Push</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handlePrevStep} disabled={currentStep === 0}>
              이전
            </Button>

            {currentStep === guideSteps.length - 1 ? (
              <Button onClick={handleComplete} size="lg" className="gap-2">
                <CheckCircle2 className="h-5 w-5" />
                완료하고 시작하기
              </Button>
            ) : (
              <Button onClick={handleNextStep} size="lg" className="gap-2">
                다음
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
