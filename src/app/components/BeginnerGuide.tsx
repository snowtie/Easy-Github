import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  GitCommit,
  Upload,
  Download,
  ArrowRight,
  Lightbulb,
  Play,
  KeyRound,
  Palette,
  ExternalLink
} from "lucide-react";

interface GuideStep {
  id: number;
  title: string;
  description: string;
  icon: any;
  tips: string[];
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: "토큰으로 로그인하기",
    description: "GitHub 기능(PR/Issue/Repo 목록 등)을 사용하려면 토큰(PAT)으로 로그인해요.",
    icon: KeyRound,
    tips: [
      "앱은 브라우저 OAuth 로그인을 사용하지 않고, 토큰(PAT) 방식만 지원해요",
      "토큰은 renderer가 아니라 main process에서만 암호화 저장돼요",
      "로그인 버튼 옆에 테마(시스템/라이트/다크) 토글도 있어요"
    ]
  },
  {
    id: 2,
    title: "프로젝트 추가 & 선택",
    description: "'프로젝트' 탭에서 저장소를 Clone(다운로드)하고, 상태 버튼을 눌러 작업할 프로젝트를 선택해요.",
    icon: FolderGit2,
    tips: [
      "Clone은 '원격 저장소를 내 PC로 복사'하는 작업이에요",
      "GitHub 저장소의 Code 버튼에서 URL을 복사해서 붙여넣으면 돼요",
      "프로젝트를 선택해야 브랜치/변경사항/커밋 탭이 제대로 동작해요"
    ]
  },
  {
    id: 3,
    title: "변경사항 확인 & 스테이징",
    description: "'변경사항' 탭에서 수정된 파일을 확인하고, 커밋할 파일만 선택(스테이징)해요.",
    icon: GitCommit,
    tips: [
      "파일을 모두 커밋할 필요는 없어요. 필요한 것만 선택하세요",
      "파일 아이콘(문서 버튼)으로 diff를 확인하고 커밋하기를 추천해요",
      "초록색(+), 빨간색(-)이 어떤 변경인지 먼저 눈으로 확인하세요"
    ]
  },
  {
    id: 4,
    title: "커밋 & 동기화(Push/Pull)",
    description: "'커밋' 탭에서 기록을 확인하고, 필요하면 Push/Pull로 원격과 동기화해요.",
    icon: Upload,
    tips: [
      "커밋 메시지는 '무엇을 왜 바꿨는지'가 보이게 구체적으로 적어요",
      "Push 전에는 Pull로 최신 코드를 먼저 가져오는 습관이 좋아요",
      "Push/Pull 에러가 나면 먼저 원격 URL과 브랜치를 확인해보세요"
    ]
  },
  {
    id: 5,
    title: "브랜치 & 협업(PR/Issue)",
    description: "큰 작업은 브랜치로 분리하고, 필요하면 PR/Issue 탭에서 협업 기능을 써요.",
    icon: GitBranch,
    tips: [
      "브랜치는 '안전한 작업 공간'이에요. 실험은 브랜치에서!",
      "PR은 코드 리뷰/병합 흐름이고, Issue는 할 일/버그 추적이에요",
      "앱에서 외부 링크를 열 때는 보안상 GitHub 관련 링크만 열리도록 제한돼요"
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
    // Electron 환경에서는 window.open 대신 main process를 통해 연다.
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

  const handleSkip = () => {
    onClose();
  };

  const handleComplete = () => {
    setCompletedSteps(new Set(guideSteps.map(s => s.id)));
    onClose();
  };

  const step = guideSteps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / guideSteps.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-blue-500">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl">초보자 가이드</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-white hover:bg-white/20"
            >
              나중에 보기
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span>{currentStep + 1} / {guideSteps.length}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-8 pb-6">
          {/* Step Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {guideSteps.map((s, idx) => (
                <div key={s.id} className="flex items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      idx === currentStep 
                        ? "bg-blue-600 text-white scale-110" 
                        : completedSteps.has(s.id)
                        ? "bg-green-500 text-white"
                        : "bg-border text-muted-foreground"
                    }`}
                  >
                    {completedSteps.has(s.id) ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < guideSteps.length - 1 && (
                    <div className="w-8 h-1 bg-border mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="space-y-6">
            {/* Icon and Title */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-blue-100 p-6 rounded-2xl">
                  <Icon className="w-16 h-16 text-blue-600" />
                </div>
              </div>
              <div>
                <Badge className="mb-3 text-sm">
                  Step {step.id}
                </Badge>
                <h3 className="text-2xl font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-lg text-muted-foreground mt-3 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Tips */}
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-3">
                  <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                  <h4 className="font-semibold text-yellow-900">알아두면 좋아요!</h4>
                </div>
                <ul className="space-y-2 ml-8">
                  {step.tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Visual Example */}
            {currentStep === 0 && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-semibold text-center">로그인 순서:</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-sm">1. 토큰 로그인</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                      <Badge variant="outline" className="text-sm">2. 토큰 만들기</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                      <Badge variant="outline" className="text-sm">3. 붙여넣기</Badge>
                    </div>

                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openExternal("https://github.com/settings/tokens")}
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
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
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        토큰 가이드
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      💡 토큰은 GitHub 설정 페이지에서 만들 수 있어요.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 1 && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground font-semibold">예시 (Clone):</p>
                    <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                      $ git clone https://github.com/username/my-project.git
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ↑ 앱에서는 이 과정을 "프로젝트" 탭에서 버튼으로 할 수 있어요
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-semibold text-center">커밋까지 흐름:</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-sm">1. 파일 수정</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                      <Badge variant="outline" className="text-sm">2. 파일 선택(스테이징)</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                      <Badge variant="outline" className="text-sm">3. 커밋 메시지</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground font-semibold">브랜치 이름 예시:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge className="bg-blue-100 text-blue-800">feature/login</Badge>
                      <Badge className="bg-green-100 text-green-800">feature/signup</Badge>
                      <Badge className="bg-red-100 text-red-800">bugfix/error</Badge>
                      <Badge className="bg-purple-100 text-purple-800">hotfix/security</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={currentStep === 0}
            >
              이전
            </Button>
            
            <div className="flex gap-2">
              {currentStep === guideSteps.length - 1 ? (
                <Button onClick={handleComplete} size="lg" className="gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  완료하고 시작하기
                </Button>
              ) : (
                <Button onClick={handleNextStep} size="lg" className="gap-2">
                  다음
                  <ArrowRight className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick Start */}
          <Card className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Play className="w-5 h-5 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-2">바로 시작하고 싶다면?</h4>
                  <p className="text-sm text-blue-100">
                    1) 상단의 "토큰 로그인"으로 로그인하고, 2) '프로젝트' 탭에서 Clone/추가로 시작하세요!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
