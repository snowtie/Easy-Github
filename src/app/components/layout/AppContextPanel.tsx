import { CheckCircle2, Circle, HelpCircle, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface AppContextPanelProps {
  authenticated: boolean;
  authUser: any | null;
  activeProjectName: string;
  activeProjectPath: string;
  activeTab: string;
  activeLabel: string;
  showHelp: boolean;
  tabHelpText: Record<string, string>;
  onToggleHelp: () => void;
}

export function AppContextPanel({
  authenticated,
  authUser,
  activeProjectName,
  activeProjectPath,
  activeTab,
  activeLabel,
  showHelp,
  tabHelpText,
  onToggleHelp
}: AppContextPanelProps) {
  return (
    <aside className="hidden border-l border-[#d8dee4] bg-white/90 dark:border-[#30363d] dark:bg-[#15181e]/90 lg:block">
      <div className="sticky top-0 space-y-5 p-5">
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</div>
          <div className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] p-3 dark:border-[#30363d] dark:bg-[#0f1115]">
            <div className="flex items-center gap-2">
              {authenticated ? (
                <CheckCircle2 className="h-4 w-4 text-[#1a7f37]" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {authenticated ? (authUser?.login ?? "로그인됨") : "로그인 필요"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {authenticated ? "GitHub API 사용 가능" : "PR, Issue 기능에 필요"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</div>
          <div className="space-y-2 rounded-md border border-[#d8dee4] bg-[#f6f8fa] p-3 dark:border-[#30363d] dark:bg-[#0f1115]">
            <div className="truncate text-sm font-medium">{activeProjectName || "선택된 프로젝트 없음"}</div>
            <div className="break-all text-xs leading-relaxed text-muted-foreground">
              {activeProjectPath || "프로젝트 탭에서 로컬 저장소를 추가하거나 선택하세요."}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</div>
            <Button variant="ghost" size="sm" onClick={onToggleHelp} className="h-7 px-2">
              {showHelp ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
            </Button>
          </div>
          <div className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] p-3 text-sm leading-relaxed dark:border-[#30363d] dark:bg-[#0f1115]">
            {showHelp ? tabHelpText[activeTab] : `${activeLabel} 화면에서 필요한 작업을 선택하세요.`}
          </div>
        </section>
      </div>
    </aside>
  );
}
