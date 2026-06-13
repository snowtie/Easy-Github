import type { LucideIcon } from "lucide-react";
import { BookOpen } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AppBrand } from "@/app/components/layout/AppBrand";

export interface WorkspaceNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface AppNavigationProps {
  activeTab: string;
  navItems: WorkspaceNavItem[];
  themeLabel: string;
  ThemeIcon: LucideIcon;
  themeMounted: boolean;
  onSelectTab: (value: string) => void;
  onOpenGuide: () => void;
  onToggleTheme: () => void;
}

export function AppNavigation({
  activeTab,
  navItems,
  themeLabel,
  ThemeIcon,
  themeMounted,
  onSelectTab,
  onOpenGuide,
  onToggleTheme
}: AppNavigationProps) {
  return (
    <aside className="border-b border-[#d8dee4] bg-white/95 dark:border-[#30363d] dark:bg-[#15181e] lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="border-b border-[#d8dee4] px-5 py-4 dark:border-[#30363d] lg:py-5">
          <AppBrand />
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:flex-1 lg:space-y-1 lg:overflow-visible lg:py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onSelectTab(item.value)}
                className={`flex min-w-[128px] items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors lg:w-full ${
                  selected
                    ? "bg-[#0969da] text-white shadow-sm"
                    : "text-[#57606a] hover:bg-[#f0f3f6] hover:text-[#1f2328] dark:text-[#8b949e] dark:hover:bg-[#21262d] dark:hover:text-[#f0f3f6]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className={`hidden truncate text-[11px] lg:block ${selected ? "text-white/75" : "text-muted-foreground"}`}>
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex gap-2 border-t border-[#d8dee4] p-3 dark:border-[#30363d] lg:block">
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenGuide}
            className="w-full justify-start gap-2 text-sm lg:mb-1"
          >
            <BookOpen className="h-4 w-4" />
            시작 가이드
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleTheme}
            disabled={!themeMounted}
            className="w-full justify-start gap-2 text-sm"
            title="테마 변경 (시스템/라이트/다크)"
          >
            <ThemeIcon className="h-4 w-4" />
            {themeLabel}
          </Button>
        </div>
      </div>
    </aside>
  );
}
