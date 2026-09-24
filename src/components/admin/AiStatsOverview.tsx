import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import type { AiRiskResult } from "@/lib/ai-risk-service";

interface AiStatsOverviewProps {
  totalAppointments: number;
  riskMap: Record<string, AiRiskResult>;
  sentNotificationsCount: number;
  onNotifyAllHighRisk?: () => void;
  isNotifyingAll?: boolean;
}

export const AiStatsOverview: React.FC<AiStatsOverviewProps> = ({
  totalAppointments,
  riskMap,
  sentNotificationsCount,
  onNotifyAllHighRisk,
  isNotifyingAll = false,
}) => {
  const riskList = Object.values(riskMap);
  const highRiskCount = riskList.filter((r) => r.risk_level === "High").length;
  const moderateRiskCount = riskList.filter((r) => r.risk_level === "Moderate").length;

  const avgRisk =
    riskList.length > 0
      ? Math.round(riskList.reduce((acc, curr) => acc + curr.risk_percentage, 0) / riskList.length)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">AI No-Show & Abandonment Intelligence</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Machine Learning Isolation Forest analyzes waiting window, timing, and demographic factors in real-time.
          </p>
        </div>

        {highRiskCount > 0 && onNotifyAllHighRisk && (
          <Button
            size="sm"
            onClick={onNotifyAllHighRisk}
            disabled={isNotifyingAll}
            className="gap-2 bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md hover:opacity-95 transition-all"
          >
            <BellRing className="size-4 animate-bounce" />
            <span>
              {isNotifyingAll
                ? "Dispatched..."
                : `Notify All ${highRiskCount} High-Risk Patients`}
            </span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Bookings</span>
              <Users className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalAppointments}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarCheck2 className="size-3 text-primary" /> Active in database
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span className="text-xs font-medium">High Abandonment Risk</span>
              <AlertTriangle className="size-4" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{highRiskCount}</p>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
              {moderateRiskCount} moderate risk cases
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Avg. Risk Index</span>
              <TrendingDown className="size-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{avgRisk}%</p>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-1">
              <div
                className={`h-full ${
                  avgRisk > 50 ? "bg-rose-500" : avgRisk > 30 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${avgRisk}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Alerts Dispatched</span>
              <BellRing className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{sentNotificationsCount}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              Proactive retention active
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
