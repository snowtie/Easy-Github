import { GitHubManager } from "@/app/components/GitHubManager";
import { Toaster } from "@/app/components/ui/sonner";
import { AppProviders } from "@/app/AppProviders";

export default function App() {
  return (
    <AppProviders>
      <GitHubManager />
      <Toaster position="top-right" richColors />
    </AppProviders>
  );
}
