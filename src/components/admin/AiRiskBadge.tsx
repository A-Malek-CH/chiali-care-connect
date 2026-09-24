import React from "react";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AiRiskResult } from "@/lib/ai-risk-service";

interface AiRiskBadgeProps {
  risk: AiRiskResult;
  onClickSendReminder?: () => void;
}

export const AiRiskBadge: React.FC<AiRiskBadgeProps> = ({ risk, onClickSendReminder }) => {
  const isHigh = risk.risk_level === "High";
  const isModerate = risk.risk_level === "Moderate";

  const badgeColor = isHigh
    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
    : isModerate
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25";

  const Icon = isHigh ? AlertTriangle : isModerate ? Info : CheckCircle2;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 transition-transform active:scale-95 focus:outline-none"
        >
          <Badge
            variant="outline"
            className={`cursor-pointer px-2.5 py-1 text-xs font-medium shadow-xs transition-all ${badgeColor}`}
          >
            <Sparkles className="size-3 animate-pulse text-current" />
            <span>AI Risk: {risk.risk_percentage}% ({risk.risk_level})</span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-xl text-left" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Icon
                className={`size-4 ${
                  isHigh ? "text-rose-500" : isModerate ? "text-amber-500" : "text-emerald-500"
                }`}
              />
              <span className="font-semibold text-sm">AI Abandonment Assessment</span>
            </div>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Score: {risk.anomaly_score}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Risk Probability</span>
              <span className="font-medium text-foreground">{risk.risk_percentage}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isHigh ? "bg-rose-500" : isModerate ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${risk.risk_percentage}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Key Contributing Factors:</p>
            <ul className="space-y-1">
              {risk.factors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-xs text-foreground/90">
                  <span className="text-primary">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md bg-muted/60 p-2.5 text-xs">
            <p className="font-medium text-foreground mb-0.5">Recommended Action:</p>
            <p className="text-muted-foreground">{risk.recommended_action}</p>
          </div>

          {onClickSendReminder && (
            <button
              type="button"
              onClick={onClickSendReminder}
              className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground shadow transition hover:opacity-90 active:scale-[0.98]"
            >
              <Sparkles className="size-3.5" />
              <span>Send AI Notification to Patient</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
