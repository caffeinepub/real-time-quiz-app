import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Copy,
  History,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  Square,
  StopCircle,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnswerMode, AnswerStatus, QuizStatus } from "../backend";
import { useActor } from "../hooks/useActor";
import {
  type AdminExtras,
  type RoundLogEntry,
  useAdminExtrasPoll,
  useAdminPoll,
} from "../hooks/useQuizPoll";
import { StatusBadgeSmall } from "./StatusBadge";
import StatusBadge from "./StatusBadge";
import TimerRing from "./TimerRing";

const QUESTION_BANK_SIZE = 54;

interface WithdrawalStatusT {
  __kind__: "pending" | "paid";
}

interface WithdrawalRequest {
  id: bigint;
  username: string;
  amount: bigint;
  upiId: string;
  requestedAt: bigint;
  status: WithdrawalStatusT;
}

function computeRemaining(startTime: bigint, timerSeconds: bigint): number {
  if (startTime === 0n) return Number(timerSeconds);
  const elapsed = (Date.now() * 1_000_000 - Number(startTime)) / 1_000_000_000;
  return Math.max(0, Number(timerSeconds) - elapsed);
}

function formatRequestTime(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryEmoji(category: string): string {
  const l = category.toLowerCase();
  if (l.includes("football") || l.includes("sport")) return "⚽";
  if (l.includes("gaming") || l.includes("game")) return "🎮";
  if (l.includes("movie") || l.includes("film")) return "🎬";
  if (l.includes("general") || l.includes("knowledge")) return "💡";
  return "🧠";
}

function ModeToggle({
  value,
  onChange,
}: {
  value: AnswerMode;
  onChange: (m: AnswerMode) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {([AnswerMode.smart, AnswerMode.strict] as AnswerMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          data-ocid={`admin.mode.${mode}.toggle`}
          onClick={() => onChange(mode)}
          className="flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all"
          style={
            value === mode
              ? {
                  background:
                    mode === AnswerMode.smart
                      ? "oklch(0.65 0.18 145)"
                      : "oklch(0.65 0.22 270)",
                  color: "white",
                }
              : {
                  background: "transparent",
                  color: "oklch(0.50 0.02 265)",
                }
          }
          aria-pressed={value === mode}
        >
          {mode === AnswerMode.smart ? "Smart" : "Strict"}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-widest"
      style={{ color: "oklch(0.68 0.04 265)" }}
    >
      {children}
    </p>
  );
}

function CardSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 shadow-card space-y-4 ${className}`}
    >
      {children}
    </div>
  );
}

interface ExtendedAdminState {
  totalActivePlayers: bigint;
  suspiciousUsers: string[];
}

export default function AdminPanel() {
  const { actor } = useActor();
  const { state: rawState, error } = useAdminPoll();

  const { extras } = useAdminExtrasPoll();

  const state = rawState as (typeof rawState & ExtendedAdminState) | null;

  // Round form
  const [question, setQuestion] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [matchMode, setMatchMode] = useState<AnswerMode>(AnswerMode.smart);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Withdrawals
  const [withdrawalRequests, setWithdrawalRequests] = useState<
    WithdrawalRequest[]
  >([]);
  const [isFetchingWithdrawals, setIsFetchingWithdrawals] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<bigint | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [minWithdrawalInput, setMinWithdrawalInput] = useState("100");
  const [isSavingMinWithdrawal, setIsSavingMinWithdrawal] = useState(false);

  // Coins
  const [coinEntryFeeInput, setCoinEntryFeeInput] = useState("0");
  const [coinWinBonusInput, setCoinWinBonusInput] = useState("20");
  const [isSavingCoinFee, setIsSavingCoinFee] = useState(false);
  const [isSavingCoinBonus, setIsSavingCoinBonus] = useState(false);
  const [giveCoinTarget, setGiveCoinTarget] = useState("");
  const [giveCoinAmount, setGiveCoinAmount] = useState("");
  const [isGivingCoins, setIsGivingCoins] = useState(false);

  // Auto mode
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [autoModeReward, setAutoModeReward] = useState(50);
  const [autoModeTimerSeconds, setAutoModeTimerSeconds] = useState(20);
  const [isSavingAutoMode, setIsSavingAutoMode] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [autoCategory, setAutoCategory] = useState<string | null>(null);
  const [isTriggeringAutoRound, setIsTriggeringAutoRound] = useState(false);
  const lastAutoTriggeredStatusRef = useRef<string>("init");
  const autoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data loading ───
  const fetchWithdrawalRequests = useCallback(async () => {
    if (!actor) return;
    setIsFetchingWithdrawals(true);
    try {
      const data = (await (
        actor as any
      ).getWithdrawalRequests()) as WithdrawalRequest[];
      setWithdrawalRequests(data);
    } catch {
      /* silently fail */
    } finally {
      setIsFetchingWithdrawals(false);
    }
  }, [actor]);

  const fetchMinWithdrawal = useCallback(async () => {
    if (!actor) return;
    try {
      const val = Number((await (actor as any).getMinWithdrawal()) as bigint);
      setMinWithdrawal(val);
      setMinWithdrawalInput(String(val));
    } catch {
      /* silently fail */
    }
  }, [actor]);

  const fetchAutoModeSettings = useCallback(async () => {
    if (!actor) return;
    try {
      const s = await (actor as any).getAutoModeSettings();
      setAutoModeEnabled(s.enabled);
      setAutoModeReward(Number(s.rewardAmount));
      setAutoModeTimerSeconds(Number(s.timerSeconds));
    } catch {
      /* silently fail */
    }
  }, [actor]);

  const fetchCoinSettings = useCallback(async () => {
    if (!actor) return;
    try {
      const s = await actor.getCoinSettings();
      setCoinEntryFeeInput(String(Number(s.entryFee)));
      setCoinWinBonusInput(String(Number(s.winBonus)));
    } catch {
      /* silently fail */
    }
  }, [actor]);

  useEffect(() => {
    if (!actor) return;
    fetchWithdrawalRequests();
    fetchMinWithdrawal();
    fetchAutoModeSettings();
    fetchCoinSettings();
  }, [
    actor,
    fetchWithdrawalRequests,
    fetchMinWithdrawal,
    fetchAutoModeSettings,
    fetchCoinSettings,
  ]);

  // Client-side timer
  // biome-ignore lint/correctness/useExhaustiveDependencies: tracking specific state fields
  useEffect(() => {
    if (!state || state.status !== QuizStatus.live) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const update = () =>
      setRemaining(computeRemaining(state.startTime, state.timerSeconds));
    update();
    timerRef.current = setInterval(update, 100);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state?.status, state?.startTime, state?.timerSeconds]);

  // Auto mode countdown + trigger
  // biome-ignore lint/correctness/useExhaustiveDependencies: tracking specific state for auto-trigger
  useEffect(() => {
    if (!autoModeEnabled || !state) return;
    const isOver =
      state.status === QuizStatus.finished ||
      state.status === QuizStatus.waiting;
    const roundKey = `${state.status}-${state.startTime.toString()}-${state.question.slice(0, 20)}`;

    if (!isOver) {
      if (autoCountdownRef.current) {
        clearInterval(autoCountdownRef.current);
        autoCountdownRef.current = null;
      }
      setAutoCountdown(null);
      return;
    }
    if (lastAutoTriggeredStatusRef.current === roundKey) return;
    if (autoCountdownRef.current !== null) return;

    lastAutoTriggeredStatusRef.current = roundKey;
    let count = 5;
    setAutoCountdown(count);
    autoCountdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(autoCountdownRef.current!);
        autoCountdownRef.current = null;
        setAutoCountdown(null);
        triggerAutoRound();
      } else {
        setAutoCountdown(count);
      }
    }, 1000);
    return () => {
      if (autoCountdownRef.current) {
        clearInterval(autoCountdownRef.current);
        autoCountdownRef.current = null;
      }
    };
  }, [autoModeEnabled, state?.status, state?.startTime, state?.question]);

  const triggerAutoRound = async () => {
    if (!actor) return;
    setIsTriggeringAutoRound(true);
    try {
      const result = await actor.triggerAutoRound();
      if (result.__kind__ === "ok") {
        const category = result.ok.category;
        setAutoCategory(category);
        toast.success(
          `${getCategoryEmoji(category)} Auto round started — ${category}`,
        );
        setTimeout(() => setAutoCategory(null), 8000);
      } else {
        toast.error(`Auto mode error: ${result.err}`);
        handleDisableAutoMode();
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to trigger auto round",
      );
      handleDisableAutoMode();
    } finally {
      setIsTriggeringAutoRound(false);
    }
  };

  const stopAutoCountdown = () => {
    if (autoCountdownRef.current) {
      clearInterval(autoCountdownRef.current);
      autoCountdownRef.current = null;
    }
    setAutoCountdown(null);
    lastAutoTriggeredStatusRef.current = "stopped";
  };

  const handleEnableAutoMode = async () => {
    if (!actor) return;
    setIsSavingAutoMode(true);
    try {
      await actor.setAutoMode(
        true,
        BigInt(autoModeReward),
        BigInt(autoModeTimerSeconds),
      );
      setAutoModeEnabled(true);
      lastAutoTriggeredStatusRef.current = "enabled";
      toast.success("Auto Mode enabled!");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to enable auto mode",
      );
    } finally {
      setIsSavingAutoMode(false);
    }
  };

  const handleDisableAutoMode = async () => {
    stopAutoCountdown();
    setAutoModeEnabled(false);
    if (!actor) return;
    setIsSavingAutoMode(true);
    try {
      await actor.setAutoMode(
        false,
        BigInt(autoModeReward),
        BigInt(autoModeTimerSeconds),
      );
      toast.success("Auto Mode disabled.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to disable auto mode",
      );
    } finally {
      setIsSavingAutoMode(false);
    }
  };

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !question.trim() || !correctAnswer.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    stopAutoCountdown();
    setIsStartingRound(true);
    try {
      await (actor as any).startNewRound(
        question.trim(),
        correctAnswer.trim(),
        BigInt(timerSeconds),
        matchMode,
        BigInt(rewardAmount),
      );
      toast.success("Round started!");
      setQuestion("");
      setCorrectAnswer("");
      setRewardAmount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start round");
    } finally {
      setIsStartingRound(false);
    }
  };

  const handleEndRound = async () => {
    if (!actor) return;
    setIsEndingRound(true);
    try {
      await (actor as any).endRound();
      toast.success("Round ended.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end round");
    } finally {
      setIsEndingRound(false);
    }
  };

  const handleResetAll = async () => {
    if (!actor) return;
    stopAutoCountdown();
    setIsResetting(true);
    try {
      await actor.resetAll();
      toast.success("Full reset complete.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setIsResetting(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!actor) return;
    setIsRegeneratingCode(true);
    try {
      const newCode = await (actor as any).generateRoomCode();
      toast.success(`New room code: ${newCode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate code");
    } finally {
      setIsRegeneratingCode(false);
    }
  };

  const handleKickPlayer = async (name: string) => {
    if (!actor) return;
    try {
      await (actor as any).kickPlayer(name);
      toast.success(`Kicked ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to kick");
    }
  };

  const handleBlockPlayer = async (name: string) => {
    if (!actor) return;
    try {
      await (actor as any).blockPlayer(name);
      toast.success(`Blocked ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to block");
    }
  };

  const handleUnblockPlayer = async (name: string) => {
    if (!actor) return;
    try {
      await (actor as any).unblockPlayer(name);
      toast.success(`Unblocked ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock");
    }
  };

  const handleMarkAsPaid = async (requestId: bigint) => {
    if (!actor) return;
    setMarkingPaidId(requestId);
    try {
      await (actor as any).markWithdrawalPaid(requestId);
      toast.success("Marked as paid!");
      fetchWithdrawalRequests();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark as paid");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleSaveMinWithdrawal = async () => {
    if (!actor) return;
    const val = Number(minWithdrawalInput);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Invalid amount.");
      return;
    }
    setIsSavingMinWithdrawal(true);
    try {
      await (actor as any).setMinWithdrawal(BigInt(val));
      setMinWithdrawal(val);
      toast.success(`Min withdrawal set to ₹${val}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsSavingMinWithdrawal(false);
    }
  };

  const handleSaveCoinEntryFee = async () => {
    if (!actor) return;
    const val = Number(coinEntryFeeInput);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Invalid amount.");
      return;
    }
    setIsSavingCoinFee(true);
    try {
      await actor.setCoinEntryFee(BigInt(val));
      toast.success(`Entry fee set to ${val} coins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsSavingCoinFee(false);
    }
  };

  const handleSaveCoinWinBonus = async () => {
    if (!actor) return;
    const val = Number(coinWinBonusInput);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Invalid amount.");
      return;
    }
    setIsSavingCoinBonus(true);
    try {
      await actor.setCoinWinBonus(BigInt(val));
      toast.success(`Win bonus set to ${val} coins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsSavingCoinBonus(false);
    }
  };

  const handleGiveFreeCoins = async () => {
    if (!actor || !giveCoinTarget.trim() || !giveCoinAmount) return;
    const amount = Number(giveCoinAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount.");
      return;
    }
    setIsGivingCoins(true);
    try {
      await (actor as any).giveFreeCoins(giveCoinTarget.trim(), BigInt(amount));
      toast.success(`Gave ${amount} coins to ${giveCoinTarget}`);
      setGiveCoinTarget("");
      setGiveCoinAmount("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to give coins");
    } finally {
      setIsGivingCoins(false);
    }
  };

  // Computed
  const sortedSubmissions = state
    ? [...state.submissions].sort(
        (a, b) => Number(a.timestamp) - Number(b.timestamp),
      )
    : [];
  const totalSeconds = state ? Number(state.timerSeconds) : timerSeconds;
  const suspiciousSet = new Set<string>((state as any)?.suspiciousUsers ?? []);
  const roundLog: RoundLogEntry[] = extras?.roundLog ?? [];
  const blockedPlayers: string[] = extras?.blockedPlayers ?? [];
  const playerReferrals: Array<{ username: string; referredBy: string }> =
    extras?.playerReferrals ?? [];
  const inviterCounts = new Map<string, number>();
  for (const r of playerReferrals) {
    if (r.referredBy && r.referredBy !== "Direct") {
      inviterCounts.set(
        r.referredBy,
        (inviterCounts.get(r.referredBy) ?? 0) + 1,
      );
    }
  }
  const topInviters = Array.from(inviterCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const pendingRequests = withdrawalRequests.filter(
    (r) => r.status.__kind__ === "pending",
  );
  const activePlayers = Number(
    state?.totalActivePlayers ?? extras?.activePlayers ?? 0,
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header
        className="sticky top-0 z-30 border-b border-border"
        style={{
          background: "oklch(0.13 0.016 265 / 0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
              }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground text-base tracking-tight">
              QuizPulse
            </span>
            <Badge
              className="text-[10px] font-bold ml-1"
              style={{
                background: "oklch(0.65 0.22 270 / 0.15)",
                color: "oklch(0.72 0.18 270)",
                border: "1px solid oklch(0.65 0.22 270 / 0.3)",
              }}
            >
              Admin
            </Badge>
          </div>

          <div className="flex-1" />

          {autoModeEnabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
              style={{
                background: "oklch(0.65 0.18 145 / 0.15)",
                color: "oklch(0.72 0.18 145)",
                border: "1px solid oklch(0.65 0.18 145 / 0.35)",
              }}
            >
              <Bot className="w-3.5 h-3.5" />
              Auto ON
            </motion.div>
          )}

          <StatusBadge status={state?.status ?? null} winner={state?.winner} />

          <Link
            to="/"
            data-ocid="admin.nav.link"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            User View
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {error && (
          <div
            data-ocid="admin.error_state"
            className="mb-4 p-3 rounded-xl border text-sm"
            style={{
              background: "oklch(0.62 0.22 25 / 0.1)",
              borderColor: "oklch(0.62 0.22 25 / 0.3)",
              color: "oklch(0.72 0.18 25)",
            }}
            role="alert"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Auto countdown banner (shown above tabs) */}
        <AnimatePresence>
          {autoCountdown !== null && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div
                data-ocid="admin.automode.loading_state"
                className="rounded-xl border px-5 py-3 flex items-center justify-between gap-4"
                style={{
                  background: "oklch(0.65 0.18 145 / 0.08)",
                  borderColor: "oklch(0.65 0.18 145 / 0.35)",
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    key={autoCountdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg"
                    style={{
                      background: "oklch(0.65 0.18 145 / 0.2)",
                      color: "oklch(0.72 0.18 145)",
                      border: "2px solid oklch(0.65 0.18 145 / 0.4)",
                    }}
                  >
                    {autoCountdown}
                  </motion.div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "oklch(0.72 0.18 145)" }}
                    >
                      Next round in {autoCountdown}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Picking from question bank
                    </p>
                  </div>
                </div>
                <Button
                  data-ocid="admin.automode.stop.secondary_button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisableAutoMode}
                  disabled={isSavingAutoMode}
                  className="shrink-0 h-8 font-bold text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABS */}
        <Tabs defaultValue="room" className="space-y-4">
          <TabsList
            className="w-full grid grid-cols-6 h-10"
            style={{
              background: "oklch(0.155 0.018 265)",
              border: "1px solid oklch(0.22 0.025 265)",
            }}
          >
            {(
              [
                { value: "room", label: "Room" },
                { value: "players", label: "Players" },
                { value: "coins", label: "Coins" },
                { value: "withdrawals", label: "Payouts" },
                { value: "auto", label: "Auto" },
                { value: "logs", label: "Logs" },
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs font-bold uppercase tracking-wider data-[state=active]:text-foreground"
                data-ocid={`admin.${tab.value}.tab`}
              >
                {tab.label}
                {tab.value === "withdrawals" && pendingRequests.length > 0 && (
                  <span
                    className="ml-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                    style={{
                      background: "oklch(0.62 0.22 25)",
                      color: "white",
                    }}
                  >
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══ TAB: ROOM ══════════════════════════════════════════════════ */}
          <TabsContent value="room" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Left: Room code + actions */}
              <div className="lg:col-span-2 space-y-4">
                <CardSection>
                  <div className="flex items-center gap-2">
                    <Shield
                      className="w-3.5 h-3.5"
                      style={{ color: "oklch(0.65 0.22 270)" }}
                    />
                    <SectionLabel>Room Code</SectionLabel>
                  </div>

                  <div
                    className="rounded-xl p-5 text-center"
                    style={{
                      background: "oklch(0.65 0.22 270 / 0.07)",
                      border: "1px solid oklch(0.65 0.22 270 / 0.25)",
                    }}
                    data-ocid="admin.roomcode.panel"
                  >
                    {extras?.roomCode ? (
                      <div className="space-y-2">
                        <span
                          className="font-mono text-5xl font-black tracking-[0.3em] select-all"
                          style={{
                            color: "oklch(0.82 0.2 270)",
                            textShadow: "0 0 24px oklch(0.65 0.22 270 / 0.5)",
                          }}
                        >
                          {extras.roomCode}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Share with players to join
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-mono text-2xl tracking-[0.3em]">
                          ----
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      data-ocid="admin.roomcode.secondary_button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateCode}
                      disabled={isRegeneratingCode || !actor}
                      className="flex-1 gap-1.5 text-xs font-bold uppercase tracking-wider"
                    >
                      {isRegeneratingCode ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Regenerate
                    </Button>
                    <Button
                      data-ocid="admin.roomcode.copy.button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!extras?.roomCode) return;
                        try {
                          await navigator.clipboard.writeText(extras.roomCode);
                        } catch {
                          const el = document.createElement("input");
                          el.value = extras.roomCode;
                          document.body.appendChild(el);
                          el.select();
                          document.execCommand("copy");
                          document.body.removeChild(el);
                        }
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className="gap-1.5 text-xs font-bold"
                    >
                      {codeCopied ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </CardSection>

                {/* Current round status */}
                {state && state.status !== QuizStatus.waiting && (
                  <CardSection>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>Active Round</SectionLabel>
                      <StatusBadge
                        status={state.status}
                        winner={state.winner}
                      />
                    </div>

                    <p className="text-sm font-semibold text-foreground line-clamp-2">
                      {state.question}
                    </p>

                    {state.status === QuizStatus.live && (
                      <div className="flex items-center gap-4">
                        <TimerRing
                          remaining={remaining}
                          total={totalSeconds}
                          size={80}
                        />
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {activePlayers}
                            </span>{" "}
                            active
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {state.submissions.length}
                            </span>{" "}
                            answers
                          </p>
                        </div>
                      </div>
                    )}

                    {state.winner && (
                      <div
                        className="rounded-lg p-3 text-sm font-bold text-center"
                        style={{
                          background: "oklch(0.65 0.18 145 / 0.1)",
                          color: "oklch(0.72 0.18 145)",
                          border: "1px solid oklch(0.65 0.18 145 / 0.25)",
                        }}
                      >
                        🏆 Winner: {state.winner}
                      </div>
                    )}

                    {state.status === QuizStatus.live && (
                      <Button
                        data-ocid="admin.room.end_button"
                        variant="outline"
                        size="sm"
                        onClick={handleEndRound}
                        disabled={isEndingRound || !actor}
                        className="w-full gap-1.5 text-xs font-bold border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        {isEndingRound ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        End Round Early
                      </Button>
                    )}
                  </CardSection>
                )}

                {/* Reset All */}
                <CardSection>
                  <SectionLabel>Danger Zone</SectionLabel>
                  <Button
                    data-ocid="admin.room.delete_button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetAll}
                    disabled={isResetting || !actor}
                    className="w-full gap-1.5 text-xs font-bold border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    {isResetting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Reset All (clears everything)
                  </Button>
                </CardSection>
              </div>

              {/* Right: New round form */}
              <div className="lg:col-span-3">
                <CardSection>
                  <div className="flex items-center gap-2">
                    <Play
                      className="w-3.5 h-3.5"
                      style={{ color: "oklch(0.65 0.18 145)" }}
                    />
                    <SectionLabel>
                      {state && state.status === QuizStatus.live
                        ? "Start New Round"
                        : "Create Round"}
                    </SectionLabel>
                  </div>

                  <form
                    onSubmit={handleStartRound}
                    className="space-y-4"
                    noValidate
                  >
                    <div className="space-y-2">
                      <Label
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "oklch(0.68 0.04 265)" }}
                      >
                        Question
                      </Label>
                      <Input
                        data-ocid="admin.room.question.input"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What is the capital of France?"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "oklch(0.68 0.04 265)" }}
                      >
                        Answers (comma-separated)
                      </Label>
                      <Input
                        data-ocid="admin.room.answer.input"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                        placeholder="Paris, paris, the city of light"
                        className="h-10"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "oklch(0.68 0.04 265)" }}
                        >
                          Timer: {timerSeconds}s
                        </Label>
                        <Slider
                          data-ocid="admin.room.timer.input"
                          min={10}
                          max={60}
                          step={5}
                          value={[timerSeconds]}
                          onValueChange={([v]) => setTimerSeconds(v)}
                          className="mt-3"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>10s</span>
                          <span>60s</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "oklch(0.68 0.04 265)" }}
                        >
                          Reward (₹)
                        </Label>
                        <Input
                          data-ocid="admin.room.reward.input"
                          type="number"
                          min={0}
                          value={rewardAmount}
                          onChange={(e) =>
                            setRewardAmount(Math.max(0, Number(e.target.value)))
                          }
                          className="h-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "oklch(0.68 0.04 265)" }}
                      >
                        Answer Mode
                      </Label>
                      <ModeToggle value={matchMode} onChange={setMatchMode} />
                      <p className="text-[11px] text-muted-foreground">
                        {matchMode === AnswerMode.smart
                          ? "Smart: Typo tolerance, partial matches"
                          : "Strict: Exact match only"}
                      </p>
                    </div>

                    <Button
                      data-ocid="admin.room.submit_button"
                      type="submit"
                      disabled={
                        isStartingRound ||
                        !actor ||
                        !question.trim() ||
                        !correctAnswer.trim()
                      }
                      className="w-full h-11 font-bold uppercase tracking-wider text-sm gap-2 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                        color: "white",
                        boxShadow: "0 0 16px oklch(0.65 0.22 270 / 0.25)",
                      }}
                    >
                      {isStartingRound ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />{" "}
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" /> Start Round
                        </>
                      )}
                    </Button>
                  </form>
                </CardSection>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: PLAYERS ════════════════════════════════════════════ */}
          <TabsContent value="players" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <CardSection>
                  <div className="flex items-center gap-2">
                    <Users
                      className="w-3.5 h-3.5"
                      style={{ color: "oklch(0.65 0.22 270)" }}
                    />
                    <SectionLabel>Active Players</SectionLabel>
                    <span
                      className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
                      style={{
                        background: "oklch(0.65 0.22 270 / 0.12)",
                        color: "oklch(0.72 0.15 270)",
                      }}
                    >
                      {activePlayers}
                    </span>
                  </div>

                  {sortedSubmissions.length === 0 ? (
                    <div
                      data-ocid="admin.players.empty_state"
                      className="flex flex-col items-center py-10 gap-2 text-muted-foreground"
                    >
                      <Users className="w-8 h-8 opacity-20" />
                      <p className="text-sm">No players yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] uppercase tracking-wider">
                              Player
                            </TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">
                              Answer
                            </TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">
                              Status
                            </TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedSubmissions.map((sub, i) => {
                            const isSuspicious = suspiciousSet.has(
                              sub.username,
                            );
                            return (
                              <TableRow
                                key={`${sub.username}-${sub.timestamp.toString()}`}
                                data-ocid={`admin.players.item.${i + 1}`}
                                style={
                                  isSuspicious
                                    ? {
                                        background:
                                          "oklch(0.75 0.18 80 / 0.05)",
                                      }
                                    : undefined
                                }
                              >
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">
                                      {sub.username}
                                    </span>
                                    {isSuspicious && (
                                      <AlertTriangle
                                        className="w-3 h-3"
                                        style={{ color: "oklch(0.75 0.18 80)" }}
                                        aria-label="Suspicious activity"
                                      />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2">
                                  <span className="text-xs font-mono">
                                    {sub.answer}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2">
                                  <StatusBadgeSmall status={sub.answerStatus} />
                                </TableCell>
                                <TableCell className="py-2">
                                  <div className="flex gap-1">
                                    <Button
                                      data-ocid={`admin.players.kick.button.${i + 1}`}
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleKickPlayer(sub.username)
                                      }
                                      className="h-6 px-2 text-[10px] font-bold"
                                    >
                                      Kick
                                    </Button>
                                    <Button
                                      data-ocid={`admin.players.block.button.${i + 1}`}
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleBlockPlayer(sub.username)
                                      }
                                      className="h-6 px-2 text-[10px] font-bold border-destructive/40 text-destructive"
                                    >
                                      Block
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardSection>

                {/* Blocked players */}
                {blockedPlayers.length > 0 && (
                  <CardSection className="mt-4">
                    <div className="flex items-center gap-2">
                      <Ban
                        className="w-3.5 h-3.5"
                        style={{ color: "oklch(0.62 0.22 25)" }}
                      />
                      <SectionLabel>Blocked Players</SectionLabel>
                    </div>
                    <ul className="space-y-1.5">
                      {blockedPlayers.map((name, i) => (
                        <li
                          key={name}
                          data-ocid={`admin.blocked.item.${i + 1}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{
                            background: "oklch(0.62 0.22 25 / 0.07)",
                            border: "1px solid oklch(0.62 0.22 25 / 0.2)",
                          }}
                        >
                          <span className="text-xs font-medium">{name}</span>
                          <Button
                            data-ocid={`admin.blocked.unblock.button.${i + 1}`}
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblockPlayer(name)}
                            className="h-6 px-2 text-[10px] font-bold"
                          >
                            Unblock
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                )}
              </div>

              {/* Referral info */}
              <div>
                {topInviters.length > 0 && (
                  <CardSection>
                    <SectionLabel>Top Inviters</SectionLabel>
                    <ul className="space-y-1.5">
                      {topInviters.map(([name, count], i) => (
                        <li
                          key={name}
                          data-ocid={`admin.inviters.item.${i + 1}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{ background: "oklch(0.65 0.22 270 / 0.05)" }}
                        >
                          <span className="text-xs font-medium">{name}</span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: "oklch(0.72 0.15 270)" }}
                          >
                            {count} invite{count !== 1 ? "s" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                )}

                {playerReferrals.length > 0 && (
                  <CardSection className="mt-4">
                    <SectionLabel>Referral Source</SectionLabel>
                    <ScrollArea className="max-h-[200px]">
                      <ul className="space-y-1">
                        {playerReferrals.map((r) => (
                          <li
                            key={r.username}
                            className="flex items-center justify-between py-1"
                          >
                            <span className="text-xs text-foreground">
                              {r.username}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              via {r.referredBy || "Direct"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardSection>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: COINS ═══════════════════════════════════════════════ */}
          <TabsContent value="coins" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSection>
                <div className="flex items-center gap-2">
                  <Coins
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(0.78 0.18 80)" }}
                  />
                  <SectionLabel>Entry Fee</SectionLabel>
                </div>
                <p className="text-xs text-muted-foreground">
                  Coins required per round. 0 = free to play.
                </p>
                <div className="flex gap-2">
                  <Input
                    data-ocid="admin.coins.fee.input"
                    type="number"
                    min={0}
                    value={coinEntryFeeInput}
                    onChange={(e) => setCoinEntryFeeInput(e.target.value)}
                    className="h-10 flex-1"
                    placeholder="0"
                  />
                  <Button
                    data-ocid="admin.coins.fee.save_button"
                    size="sm"
                    onClick={handleSaveCoinEntryFee}
                    disabled={isSavingCoinFee || !actor}
                    className="h-10 px-4 font-bold text-xs"
                    style={{
                      background: "oklch(0.78 0.18 80)",
                      color: "oklch(0.12 0.01 80)",
                    }}
                  >
                    {isSavingCoinFee ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </CardSection>

              <CardSection>
                <div className="flex items-center gap-2">
                  <Coins
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(0.78 0.18 80)" }}
                  />
                  <SectionLabel>Win Bonus</SectionLabel>
                </div>
                <p className="text-xs text-muted-foreground">
                  Extra coins awarded to the winner.
                </p>
                <div className="flex gap-2">
                  <Input
                    data-ocid="admin.coins.bonus.input"
                    type="number"
                    min={0}
                    value={coinWinBonusInput}
                    onChange={(e) => setCoinWinBonusInput(e.target.value)}
                    className="h-10 flex-1"
                    placeholder="20"
                  />
                  <Button
                    data-ocid="admin.coins.bonus.save_button"
                    size="sm"
                    onClick={handleSaveCoinWinBonus}
                    disabled={isSavingCoinBonus || !actor}
                    className="h-10 px-4 font-bold text-xs"
                    style={{
                      background: "oklch(0.78 0.18 80)",
                      color: "oklch(0.12 0.01 80)",
                    }}
                  >
                    {isSavingCoinBonus ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </CardSection>

              <CardSection className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Coins
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(0.78 0.18 80)" }}
                  />
                  <SectionLabel>Give Coins to Player</SectionLabel>
                </div>
                <div className="flex gap-2">
                  <Input
                    data-ocid="admin.coins.give.player.input"
                    value={giveCoinTarget}
                    onChange={(e) => setGiveCoinTarget(e.target.value)}
                    placeholder="Player name"
                    className="h-10 flex-1"
                  />
                  <Input
                    data-ocid="admin.coins.give.amount.input"
                    type="number"
                    min={1}
                    value={giveCoinAmount}
                    onChange={(e) => setGiveCoinAmount(e.target.value)}
                    placeholder="Amount"
                    className="h-10 w-28"
                  />
                  <Button
                    data-ocid="admin.coins.give.submit_button"
                    size="sm"
                    onClick={handleGiveFreeCoins}
                    disabled={
                      isGivingCoins ||
                      !actor ||
                      !giveCoinTarget.trim() ||
                      !giveCoinAmount
                    }
                    className="h-10 px-4 font-bold text-xs"
                    style={{
                      background: "oklch(0.65 0.22 270)",
                      color: "white",
                    }}
                  >
                    {isGivingCoins ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Give"
                    )}
                  </Button>
                </div>
              </CardSection>
            </div>
          </TabsContent>

          {/* ═══ TAB: WITHDRAWALS ═════════════════════════════════════════ */}
          <TabsContent value="withdrawals" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <CardSection>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet
                        className="w-3.5 h-3.5"
                        style={{ color: "oklch(0.65 0.18 145)" }}
                      />
                      <SectionLabel>Pending Requests</SectionLabel>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchWithdrawalRequests}
                      disabled={isFetchingWithdrawals}
                      className="h-7 text-xs gap-1"
                    >
                      {isFetchingWithdrawals ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Refresh
                    </Button>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div
                      data-ocid="admin.withdrawals.empty_state"
                      className="flex flex-col items-center py-10 gap-2 text-muted-foreground"
                    >
                      <Wallet className="w-8 h-8 opacity-20" />
                      <p className="text-sm">No pending requests</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {pendingRequests.map((req, i) => (
                        <motion.li
                          key={req.id.toString()}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          data-ocid={`admin.withdrawals.item.${i + 1}`}
                          className="rounded-xl p-4 space-y-3"
                          style={{
                            background: "oklch(0.65 0.18 145 / 0.05)",
                            border: "1px solid oklch(0.65 0.18 145 / 0.2)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">
                                {req.username}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatRequestTime(req.requestedAt)}
                              </p>
                            </div>
                            <span
                              className="text-lg font-black tabular-nums"
                              style={{ color: "oklch(0.72 0.18 145)" }}
                            >
                              ₹{Number(req.amount)}
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                            style={{ background: "oklch(0.19 0.018 265)" }}
                          >
                            <span className="text-muted-foreground">UPI:</span>
                            <span className="font-mono font-semibold">
                              {req.upiId}
                            </span>
                          </div>
                          <Button
                            data-ocid={`admin.withdrawals.confirm.button.${i + 1}`}
                            size="sm"
                            onClick={() => handleMarkAsPaid(req.id)}
                            disabled={markingPaidId === req.id || !actor}
                            className="w-full h-8 font-bold text-xs gap-1.5"
                            style={{
                              background: "oklch(0.65 0.18 145)",
                              color: "white",
                            }}
                          >
                            {markingPaidId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Mark as Paid
                          </Button>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </CardSection>
              </div>

              <div>
                <CardSection>
                  <div className="flex items-center gap-2">
                    <Wallet
                      className="w-3.5 h-3.5"
                      style={{ color: "oklch(0.65 0.18 145)" }}
                    />
                    <SectionLabel>Settings</SectionLabel>
                  </div>
                  <div className="space-y-1">
                    <Label
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "oklch(0.68 0.04 265)" }}
                    >
                      Min Withdrawal (₹)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        data-ocid="admin.withdrawals.min.input"
                        type="number"
                        min={0}
                        value={minWithdrawalInput}
                        onChange={(e) => setMinWithdrawalInput(e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        data-ocid="admin.withdrawals.min.save_button"
                        size="sm"
                        onClick={handleSaveMinWithdrawal}
                        disabled={isSavingMinWithdrawal || !actor}
                        className="h-10 px-3 font-bold text-xs"
                        style={{
                          background: "oklch(0.65 0.18 145)",
                          color: "white",
                        }}
                      >
                        {isSavingMinWithdrawal ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Current: ₹{minWithdrawal}
                    </p>
                  </div>
                </CardSection>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: AUTO MODE ═══════════════════════════════════════════ */}
          <TabsContent value="auto" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSection>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot
                      className="w-3.5 h-3.5"
                      style={{ color: "oklch(0.65 0.18 145)" }}
                    />
                    <SectionLabel>Auto Mode</SectionLabel>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      data-ocid="admin.automode.toggle"
                      checked={autoModeEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) handleEnableAutoMode();
                        else handleDisableAutoMode();
                      }}
                      disabled={isSavingAutoMode || !actor}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: autoModeEnabled
                          ? "oklch(0.72 0.18 145)"
                          : "oklch(0.45 0.02 265)",
                      }}
                    >
                      {autoModeEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {autoModeEnabled
                    ? "System auto-starts rounds using the question bank."
                    : "Enable to run continuous rounds automatically."}
                </p>

                <div
                  className="rounded-lg px-3 py-2 text-xs text-center"
                  style={{
                    background: "oklch(0.65 0.22 270 / 0.07)",
                    border: "1px solid oklch(0.65 0.22 270 / 0.2)",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ color: "oklch(0.72 0.15 270)" }}
                  >
                    {QUESTION_BANK_SIZE} questions
                  </span>
                  <span className="text-muted-foreground ml-1">
                    in bank (GK, Football, Gaming, Movies)
                  </span>
                </div>

                {autoCategory && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{
                      background: "oklch(0.65 0.22 270 / 0.12)",
                      color: "oklch(0.72 0.15 270)",
                      border: "1px solid oklch(0.65 0.22 270 / 0.3)",
                    }}
                  >
                    {getCategoryEmoji(autoCategory)} {autoCategory}
                  </motion.div>
                )}

                <Button
                  data-ocid="admin.automode.trigger.primary_button"
                  size="sm"
                  onClick={triggerAutoRound}
                  disabled={isTriggeringAutoRound || !actor}
                  variant="outline"
                  className="w-full gap-1.5 text-xs font-bold"
                >
                  {isTriggeringAutoRound ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Trigger Next Round Now
                </Button>
              </CardSection>

              <CardSection>
                <SectionLabel>Auto Round Settings</SectionLabel>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "oklch(0.68 0.04 265)" }}
                    >
                      Default Reward (₹)
                    </Label>
                    <Input
                      data-ocid="admin.automode.reward.input"
                      type="number"
                      min={0}
                      value={autoModeReward}
                      onChange={(e) =>
                        setAutoModeReward(Math.max(0, Number(e.target.value)))
                      }
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "oklch(0.68 0.04 265)" }}
                    >
                      Round Timer: {autoModeTimerSeconds}s
                    </Label>
                    <Slider
                      data-ocid="admin.automode.timer.input"
                      min={15}
                      max={30}
                      step={5}
                      value={[autoModeTimerSeconds]}
                      onValueChange={([v]) => setAutoModeTimerSeconds(v)}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>15s</span>
                      <span>30s</span>
                    </div>
                  </div>

                  <Button
                    data-ocid="admin.automode.save_button"
                    size="sm"
                    onClick={
                      autoModeEnabled
                        ? handleDisableAutoMode
                        : handleEnableAutoMode
                    }
                    disabled={isSavingAutoMode || !actor}
                    className="w-full h-10 font-bold text-xs gap-2"
                    style={{
                      background: autoModeEnabled
                        ? "oklch(0.62 0.22 25)"
                        : "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                      color: "white",
                    }}
                  >
                    {isSavingAutoMode ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : autoModeEnabled ? (
                      <StopCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                    {autoModeEnabled ? "Disable Auto Mode" : "Enable Auto Mode"}
                  </Button>
                </div>
              </CardSection>
            </div>
          </TabsContent>

          {/* ═══ TAB: LOGS ═════════════════════════════════════════════════ */}
          <TabsContent value="logs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Round log */}
              <CardSection>
                <div className="flex items-center gap-2">
                  <History
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(0.65 0.22 270)" }}
                  />
                  <SectionLabel>Round History</SectionLabel>
                </div>
                {roundLog.length === 0 ? (
                  <div
                    data-ocid="admin.logs.empty_state"
                    className="flex flex-col items-center py-8 gap-2 text-muted-foreground"
                  >
                    <History className="w-7 h-7 opacity-20" />
                    <p className="text-xs">No rounds logged yet</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            #
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Winner
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Time
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Answers
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roundLog.slice(0, 10).map((entry, i) => (
                          <TableRow
                            key={entry.roundNumber.toString()}
                            data-ocid={`admin.logs.item.${i + 1}`}
                          >
                            <TableCell className="py-2 font-mono text-xs">
                              #{Number(entry.roundNumber)}
                            </TableCell>
                            <TableCell className="py-2">
                              {entry.winner ? (
                                <span className="text-xs font-medium text-success">
                                  {entry.winner}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  No winner
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {entry.timeTaken ? (
                                <span className="text-xs font-mono tabular-nums">
                                  {(
                                    Number(entry.timeTaken) / 1_000_000_000
                                  ).toFixed(1)}
                                  s
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="text-xs tabular-nums">
                                {Number(entry.totalSubmissions)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardSection>

              {/* Current round submissions */}
              <CardSection>
                <div className="flex items-center gap-2">
                  <Trophy
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(0.82 0.18 85)" }}
                  />
                  <SectionLabel>Current Round Submissions</SectionLabel>
                </div>
                {sortedSubmissions.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                    <Trophy className="w-7 h-7 opacity-20" />
                    <p className="text-xs">No submissions yet</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Player
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Answer
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSubmissions.map((sub, i) => (
                          <TableRow
                            key={`${sub.username}-${sub.timestamp.toString()}`}
                            data-ocid={`admin.logs.submission.${i + 1}`}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium">
                                  {sub.username}
                                </span>
                                {suspiciousSet.has(sub.username) && (
                                  <AlertTriangle
                                    className="w-3 h-3"
                                    style={{ color: "oklch(0.75 0.18 80)" }}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="text-xs font-mono">
                                {sub.answer}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              <StatusBadgeSmall status={sub.answerStatus} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                {state?.correctAnswers && state.correctAnswers.length > 0 && (
                  <div
                    className="mt-3 rounded-lg p-3"
                    style={{ background: "oklch(0.65 0.22 270 / 0.07)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Correct Answers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {state.correctAnswers.map((ans) => (
                        <span
                          key={ans}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold"
                          style={{
                            background: "oklch(0.65 0.18 145 / 0.12)",
                            color: "oklch(0.72 0.18 145)",
                          }}
                        >
                          {ans}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardSection>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-border py-4 px-4 text-center"
        style={{ background: "oklch(0.13 0.016 265)" }}
      >
        <p className="text-[11px] text-muted-foreground">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Built with ❤️ using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
