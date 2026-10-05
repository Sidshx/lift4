import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DayPage from "@/pages/day";
import ProgressPage from "@/pages/progress";
import { Shell } from "@/components/shell";

function AppRouter() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={DayPage} />
        <Route path="/day/:n" component={DayPage} />
        <Route path="/progress" component={ProgressPage} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
