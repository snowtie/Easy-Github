import { GitHubManager } from "@/app/components/GitHubManager";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/app/components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <GitHubManager />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
