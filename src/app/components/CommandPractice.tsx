import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Terminal, Copy, CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";

const commandCategories = [
  {
    name: "기본 설정",
    commands: [
      {
        command: "git config --global user.name \"Your Name\"",
        description: "사용자 이름 설정",
        explanation: "Git 커밋에 표시될 이름을 설정합니다."
      },
      {
        command: "git config --global user.email \"your.email@example.com\"",
        description: "이메일 주소 설정",
        explanation: "Git 커밋에 표시될 이메일 주소를 설정합니다."
      },
      {
        command: "git config --list",
        description: "현재 설정 확인",
        explanation: "설정된 모든 Git 구성을 확인합니다."
      }
    ]
  },
  {
    name: "저장소 생성",
    commands: [
      {
        command: "git init",
        description: "새 저장소 초기화",
        explanation: "현재 디렉토리를 새로운 Git 저장소로 초기화합니다."
      },
      {
        command: "git clone <repository-url>",
        description: "원격 저장소 복제",
        explanation: "원격 저장소를 로컬로 복사합니다.",
        example: "git clone https://github.com/user/repo.git"
      }
    ]
  },
  {
    name: "변경사항 관리",
    commands: [
      {
        command: "git status",
        description: "현재 상태 확인",
        explanation: "작업 디렉토리와 스테이징 영역의 상태를 확인합니다."
      },
      {
        command: "git add <file>",
        description: "파일을 스테이징 영역에 추가",
        explanation: "변경된 파일을 다음 커밋에 포함시키기 위해 준비합니다.",
        example: "git add index.html"
      },
      {
        command: "git add .",
        description: "모든 변경사항 추가",
        explanation: "현재 디렉토리의 모든 변경사항을 스테이징 영역에 추가합니다."
      },
      {
        command: "git commit -m \"commit message\"",
        description: "변경사항 커밋",
        explanation: "스테이징된 변경사항을 저장소에 기록합니다.",
        example: "git commit -m \"Fix login bug\""
      },
      {
        command: "git diff",
        description: "변경사항 비교",
        explanation: "작업 디렉토리와 스테이징 영역의 차이를 보여줍니다."
      }
    ]
  },
  {
    name: "브랜치 작업",
    commands: [
      {
        command: "git branch",
        description: "브랜치 목록 보기",
        explanation: "로컬 저장소의 모든 브랜치를 나열합니다."
      },
      {
        command: "git branch <branch-name>",
        description: "새 브랜치 생성",
        explanation: "새로운 브랜치를 만듭니다.",
        example: "git branch feature-login"
      },
      {
        command: "git checkout <branch-name>",
        description: "브랜치 전환",
        explanation: "다른 브랜치로 이동합니다.",
        example: "git checkout main"
      },
      {
        command: "git checkout -b <branch-name>",
        description: "브랜치 생성 및 전환",
        explanation: "새 브랜치를 만들고 동시에 그 브랜치로 이동합니다.",
        example: "git checkout -b feature-signup"
      },
      {
        command: "git merge <branch-name>",
        description: "브랜치 병합",
        explanation: "지정한 브랜치를 현재 브랜치에 병합합니다.",
        example: "git merge feature-login"
      },
      {
        command: "git branch -d <branch-name>",
        description: "브랜치 삭제",
        explanation: "병합된 브랜치를 삭제합니다.",
        example: "git branch -d feature-login"
      }
    ]
  },
  {
    name: "원격 저장소",
    commands: [
      {
        command: "git remote add origin <url>",
        description: "원격 저장소 추가",
        explanation: "로컬 저장소를 원격 저장소와 연결합니다.",
        example: "git remote add origin https://github.com/user/repo.git"
      },
      {
        command: "git push origin <branch-name>",
        description: "원격 저장소에 푸시",
        explanation: "로컬 변경사항을 원격 저장소에 업로드합니다.",
        example: "git push origin main"
      },
      {
        command: "git push -u origin <branch-name>",
        description: "푸시 및 추적 설정",
        explanation: "처음 푸시할 때 사용하며, 업스트림 브랜치를 설정합니다.",
        example: "git push -u origin main"
      },
      {
        command: "git pull",
        description: "원격 변경사항 가져오기",
        explanation: "원격 저장소의 변경사항을 가져와 로컬과 병합합니다."
      },
      {
        command: "git fetch",
        description: "원격 변경사항 확인",
        explanation: "원격 저장소의 변경사항을 가져오지만 병합하지는 않습니다."
      }
    ]
  },
  {
    name: "이력 확인",
    commands: [
      {
        command: "git log",
        description: "커밋 이력 보기",
        explanation: "저장소의 커밋 기록을 시간순으로 보여줍니다."
      },
      {
        command: "git log --oneline",
        description: "간략한 이력 보기",
        explanation: "각 커밋을 한 줄로 요약해서 보여줍니다."
      },
      {
        command: "git log --graph",
        description: "그래프로 이력 보기",
        explanation: "브랜치와 병합을 그래프 형태로 시각화합니다."
      }
    ]
  },
  {
    name: "되돌리기",
    commands: [
      {
        command: "git reset <file>",
        description: "스테이징 취소",
        explanation: "스테이징 영역에서 파일을 제거합니다 (변경사항은 유지).",
        example: "git reset index.html"
      },
      {
        command: "git checkout -- <file>",
        description: "변경사항 취소",
        explanation: "작업 디렉토리의 변경사항을 마지막 커밋 상태로 되돌립니다.",
        example: "git checkout -- index.html"
      },
      {
        command: "git revert <commit-hash>",
        description: "커밋 되돌리기",
        explanation: "특정 커밋의 변경사항을 취소하는 새 커밋을 만듭니다.",
        example: "git revert abc123"
      }
    ]
  }
];

export function CommandPractice() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [practicedCommands, setPracticedCommands] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadProgress = async () => {
    if (!window.easyGithub) return;

    setLoading(true);
    try {
      const progress = await window.easyGithub.store.getLearningProgress();
      const saved = Array.isArray(progress?.practicedCommands) ? progress.practicedCommands : [];
      setPracticedCommands(new Set(saved));
    } catch {
      // 로드 실패는 UI 동작에 큰 영향을 주지 않음
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const persistPracticedCommands = async (nextSet: Set<string>) => {
    if (!window.easyGithub) return;

    await window.easyGithub.store.updateLearningProgress({
      practicedCommands: Array.from(nextSet)
    });
  };

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    toast.success("명령어가 복사되었습니다!");
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const markAsPracticed = (command: string) => {
    setPracticedCommands((prev) => {
      const nextSet = new Set(prev).add(command);
      persistPracticedCommands(nextSet);
      return nextSet;
    });
    toast.success("연습 완료로 표시되었습니다!");
  };

  const totalCommands = commandCategories.reduce((sum, cat) => sum + cat.commands.length, 0);
  const practicedCount = practicedCommands.size;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>연습 진행도</CardTitle>
          <CardDescription>
            {practicedCount} / {totalCommands} 명령어 연습 완료
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-3 bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{ width: `${(practicedCount / totalCommands) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Command Categories */}
      {commandCategories.map((category, catIndex) => (
        <Card key={catIndex}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              {category.name}
            </CardTitle>
            <CardDescription>
              {category.commands.length}개의 명령어
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.commands.map((cmd, cmdIndex) => {
              const isPracticed = practicedCommands.has(cmd.command);
              const isCopied = copiedCommand === cmd.command;
              
              return (
                <div 
                  key={cmdIndex}
                  className={`p-4 border rounded-lg space-y-3 transition-all ${
                    isPracticed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {cmd.description}
                        </Badge>
                        {isPracticed && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                        $ {cmd.command}
                      </div>
                      <p className="text-sm text-muted-foreground">{cmd.explanation}</p>
                      {cmd.example && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">예시:</span>
                          <code className="ml-2 bg-muted px-2 py-1 rounded">
                            {cmd.example}
                          </code>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(cmd.command)}
                        className="whitespace-nowrap"
                        disabled={loading}
                      >
                        {isCopied ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      {!isPracticed && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => markAsPracticed(cmd.command)}
                          className="whitespace-nowrap"
                          disabled={loading}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
