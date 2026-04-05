import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  Copy,
  Loader2,
  Send,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QuizStatus } from "../backend";
import { useActor } from "../hooks/useActor";
import {
  useAdminExtrasPoll,
  useQuizPoll,
  useScoreboardPoll,
} from "../hooks/useQuizPoll";
import { useSoundEffects } from "../hooks/useSoundEffects";
import Leaderboard from "./Leaderboard";
import LiveFeed from "./LiveFeed";
import NameEntry from "./NameEntry";
import StatusBadge from "./StatusBadge";
import TimerRing from "./TimerRing";
import WinnerOverlay from "./WinnerOverlay";

interface PlayerWallet {
  totalEarned: bigint;
  pendingBalance: bigint;
  totalWithdrawn: bigint;
}

type WithdrawalError =
  | { __kind__: "insufficientBalance"; insufficientBalance: null }
  | { __kind__: "pendingRequestExists"; pendingRequestExists: null }
  | { __kind__: "cooldownActive"; cooldownActive: null }
  | { __kind__: "invalidUpiId"; invalidUpiId: null };

type SubmitStatus = "idle" | "checking" | "correct" | "almost" | "wrong";
type WithdrawStep = "idle" | "form" | "submitting" | "success";

function computeRemaining(startTime: bigint, timerSeconds: bigint): number {
  if (startTime === 0n) return Number(timerSeconds);
  const elapsed = (Date.now() * 1_000_000 - Number(startTime)) / 1_000_000_000;
  return Math.max(0, Number(timerSeconds) - elapsed);
}

function getWithdrawalErrorMessage(
  err: WithdrawalError,
  minWithdrawal: number,
): string {
  if (err.__kind__ === "insufficientBalance")
    return `Balance too low. Minimum withdrawal is ₹${minWithdrawal}.`;
  if (err.__kind__ === "pendingRequestExists")
    return "You already have a pending withdrawal request.";
  if (err.__kind__ === "cooldownActive")
    return "You can only request once every 24 hours.";
  if (err.__kind__ === "invalidUpiId")
    return "Please enter a valid UPI ID (e.g. name@upi).";
  return "Withdrawal request failed. Please try again.";
}

// ─── Wallet Card ────────────────────────────────────────────────────────────
function WalletCard({
  wallet,
  minWithdrawal,
  username,
  actor,
}: {
  wallet: PlayerWallet;
  minWithdrawal: number;
  username: string;
  actor: any;
}) {
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("idle");
  const [upiId, setUpiId] = useState("");
  const [withdrawError, setWithdrawError] = useState("");

  const pendingBalance = Number(wallet.pendingBalance);
  const totalEarned = Number(wallet.totalEarned);
  const totalWithdrawn = Number(wallet.totalWithdrawn);
  const canWithdraw = pendingBalance >= minWithdrawal;

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !upiId.trim()) return;
    setWithdrawStep("submitting");
    setWithdrawError("");
    try {
      const result = await (actor as any).requestWithdrawal(
        username,
        upiId.trim(),
      );
      if (result.__kind__ === "ok") {
        setWithdrawStep("success");
        setUpiId("");
      } else {
        setWithdrawError(
          getWithdrawalErrorMessage(
            result.err as WithdrawalError,
            minWithdrawal,
          ),
        );
        setWithdrawStep("form");
      }
    } catch {
      setWithdrawError("Request failed. Please try again.");
      setWithdrawStep("form");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-border"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.65 0.18 145 / 0.07) 0%, transparent 100%)",
        }}
      >
        <Wallet
          className="w-3.5 h-3.5"
          style={{ color: "oklch(0.65 0.18 145)" }}
        />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          Wallet
        </h3>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {[
          {
            label: "Earned",
            value: `₹${totalEarned}`,
            color: "oklch(0.65 0.18 145)",
          },
          {
            label: "Pending",
            value: `₹${pendingBalance}`,
            color: "oklch(0.65 0.22 270)",
          },
          {
            label: "Paid",
            value: `₹${totalWithdrawn}`,
            color: "oklch(0.55 0.02 265)",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-sm font-bold tabular-nums" style={{ color }}>
              {value}
            </p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2">
        <AnimatePresence mode="wait">
          {withdrawStep === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              data-ocid="wallet.success_state"
              className="rounded-lg p-3 text-center"
              style={{
                background: "oklch(0.65 0.18 145 / 0.1)",
                border: "1px solid oklch(0.65 0.18 145 / 0.3)",
              }}
            >
              <p className="text-xs font-bold text-success">
                ✓ Withdrawal request submitted!
              </p>
              <button
                type="button"
                onClick={() => setWithdrawStep("idle")}
                className="text-[10px] text-muted-foreground mt-1 hover:text-foreground transition-colors"
              >
                New request
              </button>
            </motion.div>
          )}

          {withdrawStep === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                data-ocid="wallet.open_modal_button"
                size="sm"
                onClick={() => setWithdrawStep("form")}
                disabled={!canWithdraw}
                className="w-full h-8 text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={
                  canWithdraw
                    ? { background: "oklch(0.65 0.18 145)", color: "white" }
                    : undefined
                }
                title={
                  !canWithdraw
                    ? `Min. withdrawal: ₹${minWithdrawal}`
                    : undefined
                }
              >
                Request Withdrawal
              </Button>
              {!canWithdraw && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Min. ₹{minWithdrawal} (have ₹{pendingBalance})
                </p>
              )}
            </motion.div>
          )}

          {(withdrawStep === "form" || withdrawStep === "submitting") && (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              data-ocid="wallet.dialog"
              onSubmit={handleRequestWithdrawal}
              className="space-y-2"
              noValidate
            >
              <div className="space-y-1">
                <label
                  htmlFor="upi-id"
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  UPI ID
                </label>
                <Input
                  id="upi-id"
                  data-ocid="wallet.input"
                  type="text"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value);
                    if (withdrawError) setWithdrawError("");
                  }}
                  placeholder="yourname@upi"
                  disabled={withdrawStep === "submitting"}
                  className="h-9 text-sm"
                  autoComplete="off"
                />
              </div>

              {withdrawError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-ocid="wallet.error_state"
                  className="flex items-start gap-1.5 rounded-lg p-2"
                  style={{
                    background: "oklch(0.62 0.22 25 / 0.1)",
                    border: "1px solid oklch(0.62 0.22 25 / 0.3)",
                  }}
                >
                  <AlertCircle
                    className="w-3 h-3 shrink-0 mt-0.5"
                    style={{ color: "oklch(0.72 0.2 25)" }}
                  />
                  <p
                    className="text-[11px]"
                    style={{ color: "oklch(0.72 0.2 25)" }}
                  >
                    {withdrawError}
                  </p>
                </motion.div>
              )}

              <div className="flex gap-2">
                <Button
                  data-ocid="wallet.submit_button"
                  type="submit"
                  size="sm"
                  disabled={!upiId.trim() || withdrawStep === "submitting"}
                  className="flex-1 h-8 text-xs font-bold"
                  style={{ background: "oklch(0.65 0.18 145)", color: "white" }}
                >
                  {withdrawStep === "submitting" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
                <Button
                  data-ocid="wallet.cancel_button"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWithdrawStep("idle");
                    setUpiId("");
                    setWithdrawError("");
                  }}
                  disabled={withdrawStep === "submitting"}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Coin Card ────────────────────────────────────────────────────────────
function CoinCard({
  coinBalance,
  coinEntryFee,
  username,
  actor,
  onCoinsUpdated,
}: {
  coinBalance: number;
  coinEntryFee: number;
  username: string;
  actor: any;
  onCoinsUpdated: (newBalance: number) => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [lastClaimTime, setLastClaimTime] = useState<number | null>(() => {
    const stored = localStorage.getItem(`freeCoins_claim_${username}`);
    return stored ? Number(stored) : null;
  });
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const COOLDOWN_MS = 30 * 60 * 1000;

  useEffect(() => {
    if (!lastClaimTime) return;
    const update = () => {
      const elapsed = Date.now() - lastClaimTime;
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);
      setCooldownRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastClaimTime]);

  const isInsufficient = coinEntryFee > 0 && coinBalance < coinEntryFee;
  const isCooldownActive = cooldownRemaining > 0;
  const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);

  const handleClaimFreeCoins = async () => {
    if (!actor || isClaiming || isCooldownActive) return;
    setIsClaiming(true);
    try {
      const result = await actor.claimFreeCoins(username);
      if (result.__kind__ === "ok") {
        onCoinsUpdated(Number(result.ok));
        const now = Date.now();
        setLastClaimTime(now);
        localStorage.setItem(`freeCoins_claim_${username}`, String(now));
        toast.success("+10 coins added! 🪙");
      } else {
        const now = Date.now() - (COOLDOWN_MS - 60000);
        setLastClaimTime(now);
        localStorage.setItem(`freeCoins_claim_${username}`, String(now));
        toast.error("Coins on cooldown. Try in 30 minutes.");
      }
    } catch {
      toast.error("Failed to claim free coins.");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div
      className="rounded-xl border bg-card shadow-card overflow-hidden"
      style={{
        borderColor: isInsufficient
          ? "oklch(0.75 0.18 80 / 0.35)"
          : "oklch(0.22 0.025 265)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{
          borderColor: isInsufficient
            ? "oklch(0.75 0.18 80 / 0.2)"
            : "oklch(0.22 0.025 265)",
          background: isInsufficient
            ? "oklch(0.75 0.18 80 / 0.05)"
            : "transparent",
        }}
      >
        <Coins
          className="w-3.5 h-3.5"
          style={{ color: "oklch(0.78 0.18 80)" }}
        />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          Coins
        </h3>
        {coinEntryFee > 0 && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: "oklch(0.75 0.18 80 / 0.1)",
              color: "oklch(0.78 0.18 80)",
            }}
          >
            {coinEntryFee}/round
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Balance */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Balance</span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{
              color: isInsufficient
                ? "oklch(0.78 0.18 50)"
                : "oklch(0.78 0.18 80)",
            }}
          >
            🪙 {coinBalance}
          </span>
        </div>

        {/* Insufficient warning */}
        {isInsufficient && (
          <div
            data-ocid="coins.error_state"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              background: "oklch(0.75 0.18 80 / 0.1)",
              border: "1px solid oklch(0.75 0.18 80 / 0.3)",
              color: "oklch(0.78 0.18 80)",
            }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Not enough coins
          </div>
        )}

        {/* Free coins button */}
        <Button
          data-ocid="coins.primary_button"
          size="sm"
          onClick={handleClaimFreeCoins}
          disabled={isClaiming || isCooldownActive}
          className="w-full h-8 text-xs font-bold gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={
            !isCooldownActive
              ? {
                  background: "oklch(0.75 0.18 80 / 0.15)",
                  color: "oklch(0.78 0.18 80)",
                  border: "1px solid oklch(0.75 0.18 80 / 0.3)",
                }
              : undefined
          }
        >
          {isClaiming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Coins className="w-3.5 h-3.5" />
          )}
          {isClaiming
            ? "Claiming..."
            : isCooldownActive
              ? `Cooldown: ${cooldownMinutes}m`
              : "Get Free Coins (+10)"}
        </Button>
      </div>
    </div>
  );
}

// ─── Share Card ───────────────────────────────────────────────────────────
function ShareCard({
  username,
  roomCode,
  activePlayers,
}: {
  username: string;
  roomCode: string;
  activePlayers: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/?room=${roomCode}&ref=${encodeURIComponent(username)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Users
          className="w-3.5 h-3.5"
          style={{ color: "oklch(0.65 0.22 270)" }}
        />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          Room
        </span>
        {activePlayers > 0 && (
          <span
            className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
            style={{
              background: "oklch(0.65 0.22 270 / 0.1)",
              color: "oklch(0.72 0.15 270)",
            }}
          >
            👥 {activePlayers}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        <Button
          data-ocid="share.primary_button"
          size="sm"
          onClick={handleCopyLink}
          disabled={!roomCode}
          className="w-full h-8 text-xs font-bold gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={
            copied
              ? { background: "oklch(0.65 0.18 145)", color: "white" }
              : {
                  background: "oklch(0.65 0.22 270 / 0.12)",
                  color: "oklch(0.72 0.15 270)",
                  border: "1px solid oklch(0.65 0.22 270 / 0.25)",
                }
          }
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy Invite Link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────
export default function UserView() {
  const { actor } = useActor();
  const { state, error } = useQuizPoll();
  const { scoreboard } = useScoreboardPoll();
  const { extras } = useAdminExtrasPoll();
  const { playCorrect, playWrong, soundEnabled, toggleSound } =
    useSoundEffects();

  const [username, setUsername] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [cooldownMsg, setCooldownMsg] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [winnerLocked, setWinnerLocked] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(
    null,
  );
  const [referralCounts, setReferralCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [wallet, setWallet] = useState<PlayerWallet | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(100);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [coinEntryFee, setCoinEntryFee] = useState<number>(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walletPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coinPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const referralPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatus = useRef<QuizStatus | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);
  const lastWinnerNotifiedRef = useRef<string>("");

  const activePlayers = Number(extras?.activePlayers ?? 0);
  const roomCode = extras?.roomCode ?? "";
  const totalSeconds = state ? Number(state.timerSeconds) : 30;
  const myStreak = Number(
    scoreboard?.scoreboard?.find(
      (e) => e.username.toLowerCase() === (username ?? "").toLowerCase(),
    )?.streak ?? 0n,
  );

  const isInsufficientCoins = coinEntryFee > 0 && coinBalance < coinEntryFee;
  const isInputDisabled =
    !state ||
    state.status !== QuizStatus.live ||
    winnerLocked ||
    isSubmitting ||
    isInsufficientCoins;

  // ─── Data fetching ──────────────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    if (!actor || !username) return;
    try {
      const w = (await (actor as any).getWallet(username)) as PlayerWallet;
      setWallet(w);
    } catch {
      /* silently fail */
    }
  }, [actor, username]);

  const fetchMinWithdrawal = useCallback(async () => {
    if (!actor) return;
    try {
      const val = (await (actor as any).getMinWithdrawal()) as bigint;
      setMinWithdrawal(Number(val));
    } catch {
      /* default 100 */
    }
  }, [actor]);

  const fetchCoinBalance = useCallback(async () => {
    if (!actor || !username) return;
    try {
      const bal = await actor.getCoinBalance(username);
      setCoinBalance(Number(bal));
    } catch {
      /* silently fail */
    }
  }, [actor, username]);

  const fetchCoinSettings = useCallback(async () => {
    if (!actor) return;
    try {
      const settings = await actor.getCoinSettings();
      setCoinEntryFee(Number(settings.entryFee));
    } catch {
      /* silently fail */
    }
  }, [actor]);

  useEffect(() => {
    if (!actor || !username) return;
    Promise.all([fetchWallet(), fetchMinWithdrawal()]);
    walletPollRef.current = setInterval(fetchWallet, 5000);
    return () => {
      if (walletPollRef.current) clearInterval(walletPollRef.current);
    };
  }, [actor, username, fetchWallet, fetchMinWithdrawal]);

  useEffect(() => {
    if (!actor || !username) return;
    Promise.all([fetchCoinSettings(), fetchCoinBalance()]);
    coinPollRef.current = setInterval(fetchCoinBalance, 3000);
    return () => {
      if (coinPollRef.current) clearInterval(coinPollRef.current);
    };
  }, [actor, username, fetchCoinBalance, fetchCoinSettings]);

  useEffect(() => {
    if (!actor || !username) return;
    const fetchReferrals = async () => {
      try {
        const data = (await (actor as any).getReferralCounts()) as Array<{
          inviter: string;
          count: bigint;
        }>;
        setReferralCounts(
          new Map(data.map((r) => [r.inviter, Number(r.count)])),
        );
      } catch {
        /* silently fail */
      }
    };
    fetchReferrals();
    referralPollRef.current = setInterval(fetchReferrals, 5000);
    return () => {
      if (referralPollRef.current) clearInterval(referralPollRef.current);
    };
  }, [actor, username]);

  // "You invited a winner!" notification
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracking winner change
  useEffect(() => {
    if (!state?.winner || !username || !actor) return;
    const winner = state.winner;
    if (lastWinnerNotifiedRef.current === winner) return;
    lastWinnerNotifiedRef.current = winner;
    if (winner.toLowerCase() === username.toLowerCase()) return;

    (async () => {
      try {
        const inviter = (await (actor as any).getInviterForPlayer(
          winner,
        )) as string;
        if (inviter && inviter.toLowerCase() === username.toLowerCase()) {
          toast.custom(
            () => (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border"
                style={{
                  background: "oklch(0.20 0.04 280)",
                  borderColor: "oklch(0.65 0.22 270 / 0.4)",
                  color: "oklch(0.95 0.01 265)",
                  minWidth: "260px",
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>👀</span>
                <div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: "oklch(0.82 0.18 270)" }}
                  >
                    You invited a winner!
                  </p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {winner} just won — nice recruiting!
                  </p>
                </div>
              </div>
            ),
            { duration: 5000, position: "bottom-center" },
          );
        }
      } catch {
        /* silently fail */
      }
    })();
  }, [state?.winner]);

  // Sound effects
  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on status transitions
  useEffect(() => {
    if (submitStatus === "correct") playCorrect();
    else if (submitStatus === "wrong" || submitStatus === "almost") playWrong();
  }, [submitStatus]);

  // Round transition reset
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only react to status changes
  useEffect(() => {
    if (!state) return;
    const wasFinished = prevStatus.current === QuizStatus.finished;
    const isNowActive =
      state.status === QuizStatus.waiting || state.status === QuizStatus.live;
    if (wasFinished && isNowActive) {
      setHasSubmitted(false);
      setAnswer("");
      setSubmitError("");
      setCooldownMsg("");
      setSubmitStatus("idle");
      setWinnerLocked(false);
      setNextRoundCountdown(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    if (
      state.status === QuizStatus.live &&
      prevStatus.current !== QuizStatus.live
    ) {
      setTimeout(() => answerInputRef.current?.focus(), 300);
    }
    prevStatus.current = state.status;
  }, [state?.status]);

  // Winner overlay + next round countdown
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracking specific winner/status fields
  useEffect(() => {
    if (state?.winner) {
      setWinnerLocked(true);
      fetchWallet();
    }
    if (state?.status === QuizStatus.finished && state.winner) {
      setShowWinner(true);
      setNextRoundCountdown(5);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setNextRoundCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [state?.status, state?.winner]);

  // Client-side timer
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracking specific state fields for timer
  useEffect(() => {
    if (!state || state.status !== QuizStatus.live) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (state?.status === QuizStatus.waiting) setRemaining(0);
      return;
    }
    const updateRemaining = () =>
      setRemaining(computeRemaining(state.startTime, state.timerSeconds));
    updateRemaining();
    timerRef.current = setInterval(updateRemaining, 100);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state?.status, state?.startTime, state?.timerSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !username || !answer.trim() || isInputDisabled) return;
    const trimmedAnswer = answer.trim();
    setIsSubmitting(true);
    setSubmitStatus("checking");
    setSubmitError("");
    setCooldownMsg("");

    try {
      const result = await actor.submitAnswer(username, trimmedAnswer);
      if (result.__kind__ === "ok") {
        const newState = result.ok;
        const mySubmission = [...newState.submissions]
          .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
          .find((s) => s.username.toLowerCase() === username.toLowerCase());

        if (mySubmission) {
          const status = mySubmission.answerStatus;
          if (status === "correct") {
            setSubmitStatus("correct");
            setHasSubmitted(true);
            setAnswer("");
          } else if (status === "almost") {
            setSubmitStatus("almost");
            setHasSubmitted(true);
            setAnswer("");
          } else {
            setSubmitStatus("wrong");
            setAnswer("");
          }
        } else {
          setSubmitStatus("correct");
          setHasSubmitted(true);
          setAnswer("");
        }

        // Auto-clear feedback
        if (mySubmission?.answerStatus !== "correct") {
          setTimeout(
            () =>
              setSubmitStatus((prev) => (prev !== "correct" ? "idle" : prev)),
            2500,
          );
        }
      } else {
        const err = result.err;
        if (err.__kind__ === "answerLimitExceeded") {
          setCooldownMsg("Slow down! Max 10 answers per round.");
          setSubmitStatus("idle");
        } else if (err.__kind__ === "quizAlreadyHasWinner") {
          setWinnerLocked(true);
          setSubmitStatus("idle");
        } else if (err.__kind__ === "quizNotLive") {
          setSubmitError("Quiz is not active.");
          setSubmitStatus("idle");
        } else if (err.__kind__ === "insufficientCoins") {
          setSubmitError("Not enough coins to play.");
          setSubmitStatus("idle");
        } else if (err.__kind__ === "answerNotAccepted") {
          setCooldownMsg("Slow down!");
          setSubmitStatus("idle");
        } else {
          setSubmitStatus("wrong");
          setTimeout(() => setSubmitStatus("idle"), 2500);
        }
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitStatus("idle");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not yet joined
  if (!username) {
    return <NameEntry onJoin={(name) => setUsername(name)} />;
  }

  const isLivePage =
    state &&
    (state.status === QuizStatus.live || state.status === QuizStatus.finished);
  const isMobileSticky = isLivePage;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Winner overlay */}
      {showWinner && state?.winner && (
        <WinnerOverlay
          winner={state.winner}
          onDismiss={() => setShowWinner(false)}
        />
      )}

      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-border"
        style={{
          background: "oklch(0.13 0.016 265 / 0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2 overflow-hidden">
          {/* Logo */}
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
            <span className="font-display font-bold text-foreground text-base tracking-tight hidden sm:block">
              QuizPulse
            </span>
          </div>

          <div className="flex-1 min-w-0" />

          {/* Compact status row */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap-none">
            {/* Player name */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{ background: "oklch(0.65 0.22 270 / 0.1)" }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                }}
              >
                {username.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-foreground hidden sm:block max-w-[80px] truncate">
                {username}
              </span>
            </div>

            {/* Coins — only if fee active */}
            {coinEntryFee > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold tabular-nums"
                style={{
                  background:
                    coinBalance < coinEntryFee
                      ? "oklch(0.75 0.18 80 / 0.15)"
                      : "oklch(0.75 0.18 80 / 0.1)",
                  color:
                    coinBalance < coinEntryFee
                      ? "oklch(0.78 0.18 50)"
                      : "oklch(0.78 0.18 80)",
                }}
              >
                🪙 {coinBalance}
              </span>
            )}

            {/* Wallet pending — only if earned something */}
            {wallet && Number(wallet.pendingBalance) > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold tabular-nums hidden sm:flex"
                style={{
                  background: "oklch(0.65 0.18 145 / 0.1)",
                  color: "oklch(0.72 0.18 145)",
                }}
              >
                ₹{Number(wallet.pendingBalance)}
              </span>
            )}

            {/* Players */}
            {activePlayers > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium hidden sm:flex"
                style={{
                  background: "oklch(0.65 0.22 270 / 0.08)",
                  color: "oklch(0.65 0.15 270)",
                }}
              >
                <Users className="w-3 h-3" />
                {activePlayers}
              </span>
            )}

            <StatusBadge
              status={state?.status ?? null}
              winner={state?.winner}
            />

            {/* Sound toggle */}
            <button
              data-ocid="nav.sound_toggle"
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? "Mute" : "Enable sound"}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              style={{
                background: soundEnabled
                  ? "oklch(0.65 0.22 270 / 0.12)"
                  : "transparent",
              }}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>

            <Link
              to="/admin"
              data-ocid="nav.admin_link"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="Admin Panel"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Admin</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <main
        className={`flex-1 max-w-6xl mx-auto w-full px-4 py-6${
          isMobileSticky ? " pb-mobile-safe lg:pb-6" : ""
        }`}
      >
        {/* Connection error */}
        {error && (
          <div
            data-ocid="quiz.error_state"
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

        {/* ── Waiting state ── */}
        {(!state || state.status === QuizStatus.waiting) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.22 270 / 0.15), oklch(0.65 0.25 290 / 0.08))",
                  border: "1px solid oklch(0.65 0.22 270 / 0.25)",
                }}
              >
                <Zap
                  className="w-8 h-8"
                  style={{ color: "oklch(0.72 0.2 270)" }}
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-display font-bold text-foreground">
                  Get Ready!
                </h1>
                <p className="text-muted-foreground max-w-sm">
                  A question will appear when the quiz starts. Stay sharp —
                  first correct answer wins!
                </p>
              </div>
              {activePlayers > 0 && (
                <div
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full"
                  style={{
                    background: "oklch(0.65 0.22 270 / 0.08)",
                    color: "oklch(0.72 0.15 270)",
                    border: "1px solid oklch(0.65 0.22 270 / 0.2)",
                  }}
                >
                  <Users className="w-4 h-4" />
                  {activePlayers} player{activePlayers !== 1 ? "s" : ""} in this
                  room
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
                Waiting for admin to start...
              </div>
            </div>

            <aside className="lg:col-span-1 flex flex-col gap-3">
              <ShareCard
                username={username}
                roomCode={roomCode}
                activePlayers={activePlayers}
              />
              <Leaderboard
                scoreboard={scoreboard}
                currentWinner={state?.winner}
                myUsername={username}
                referralCounts={referralCounts}
              />
              {wallet !== null && (
                <WalletCard
                  wallet={wallet}
                  minWithdrawal={minWithdrawal}
                  username={username}
                  actor={actor}
                />
              )}
              {coinEntryFee > 0 && (
                <CoinCard
                  coinBalance={coinBalance}
                  coinEntryFee={coinEntryFee}
                  username={username}
                  actor={actor}
                  onCoinsUpdated={setCoinBalance}
                />
              )}
            </aside>
          </motion.div>
        )}

        {/* ── Live / Finished ── */}
        {state &&
          (state.status === QuizStatus.live ||
            state.status === QuizStatus.finished) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 flex flex-col gap-5">
                {/* Question card */}
                <motion.div
                  key={state.question}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
                >
                  {/* Gradient accent */}
                  <div
                    className="h-1 w-full"
                    style={{
                      background:
                        "linear-gradient(90deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                    }}
                  />
                  <div className="p-6 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Current Question
                    </p>
                    <h1
                      className="font-display font-bold leading-tight text-foreground"
                      style={{ fontSize: "clamp(1.3rem, 4vw, 2.2rem)" }}
                    >
                      {state.question}
                    </h1>

                    {/* Timer */}
                    {state.status === QuizStatus.live && (
                      <div className="flex flex-col items-center gap-1 mt-6">
                        <TimerRing remaining={remaining} total={totalSeconds} />
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Winner/finished banner */}
                {state.status === QuizStatus.finished && state.winner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border text-center p-5 space-y-3"
                    style={{
                      background: "oklch(0.65 0.18 145 / 0.08)",
                      borderColor: "oklch(0.65 0.18 145 / 0.3)",
                      boxShadow: "0 0 20px oklch(0.65 0.18 145 / 0.1)",
                    }}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-widest text-success">
                      🏆 Winner
                    </p>
                    <p className="text-2xl font-display font-bold text-foreground">
                      {state.winner}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      First correct answer!
                    </p>

                    {/* Next round countdown */}
                    <AnimatePresence mode="wait">
                      {nextRoundCountdown !== null && (
                        <motion.div
                          key="countdown"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                          style={{
                            background: "oklch(0.65 0.22 270 / 0.08)",
                            border: "1px solid oklch(0.65 0.22 270 / 0.25)",
                            color: "oklch(0.72 0.15 270)",
                          }}
                        >
                          {nextRoundCountdown > 0 ? (
                            <>
                              <motion.span
                                key={nextRoundCountdown}
                                initial={{ scale: 1.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="font-bold tabular-nums"
                                style={{ color: "oklch(0.82 0.18 85)" }}
                              >
                                {nextRoundCountdown}
                              </motion.span>
                              <span>Next round starting...</span>
                            </>
                          ) : (
                            <>
                              <span
                                className="w-1.5 h-1.5 rounded-full animate-pulse"
                                style={{ background: "oklch(0.65 0.22 270)" }}
                              />
                              <span>Waiting for admin...</span>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {state.status === QuizStatus.finished && !state.winner && (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <p className="text-muted-foreground text-sm">
                      Time&apos;s up! No correct answers this round.
                    </p>
                  </div>
                )}

                {/* ── Answer input (desktop) ── */}
                <div className="hidden lg:block">
                  <AnswerArea
                    answer={answer}
                    setAnswer={setAnswer}
                    handleSubmit={handleSubmit}
                    isInputDisabled={isInputDisabled}
                    isSubmitting={isSubmitting}
                    winnerLocked={winnerLocked}
                    hasSubmitted={hasSubmitted}
                    isInsufficientCoins={isInsufficientCoins}
                    submitStatus={submitStatus}
                    cooldownMsg={cooldownMsg}
                    submitError={submitError}
                    myStreak={myStreak}
                    state={state}
                    answerInputRef={answerInputRef}
                    username={username}
                    actor={actor}
                    onCoinsUpdated={setCoinBalance}
                    coinEntryFee={coinEntryFee}
                    coinBalance={coinBalance}
                  />
                </div>

                {/* Live feed (desktop only in left col) */}
                <div className="hidden lg:block">
                  <LiveFeed
                    submissions={state.submissions}
                    winnerName={
                      state.status === QuizStatus.finished
                        ? state.winner
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* Right sidebar */}
              <aside className="lg:col-span-1 flex flex-col gap-3">
                <ShareCard
                  username={username}
                  roomCode={roomCode}
                  activePlayers={activePlayers}
                />
                <Leaderboard
                  scoreboard={scoreboard}
                  currentWinner={state?.winner}
                  myUsername={username}
                  referralCounts={referralCounts}
                />
                {/* Mobile: live feed in sidebar */}
                <div className="lg:hidden">
                  <LiveFeed
                    submissions={state.submissions}
                    winnerName={
                      state.status === QuizStatus.finished
                        ? state.winner
                        : undefined
                    }
                  />
                </div>
                {wallet !== null && (
                  <WalletCard
                    wallet={wallet}
                    minWithdrawal={minWithdrawal}
                    username={username}
                    actor={actor}
                  />
                )}
                {coinEntryFee > 0 && (
                  <CoinCard
                    coinBalance={coinBalance}
                    coinEntryFee={coinEntryFee}
                    username={username}
                    actor={actor}
                    onCoinsUpdated={setCoinBalance}
                  />
                )}
              </aside>
            </div>
          )}
      </main>

      {/* ── Sticky mobile answer bar ── */}
      {isMobileSticky && (
        <div className="sticky-answer-bar lg:hidden">
          <AnswerArea
            answer={answer}
            setAnswer={setAnswer}
            handleSubmit={handleSubmit}
            isInputDisabled={isInputDisabled}
            isSubmitting={isSubmitting}
            winnerLocked={winnerLocked}
            hasSubmitted={hasSubmitted}
            isInsufficientCoins={isInsufficientCoins}
            submitStatus={submitStatus}
            cooldownMsg={cooldownMsg}
            submitError={submitError}
            myStreak={myStreak}
            state={state}
            answerInputRef={answerInputRef}
            username={username}
            actor={actor}
            onCoinsUpdated={setCoinBalance}
            coinEntryFee={coinEntryFee}
            coinBalance={coinBalance}
            compact
          />
        </div>
      )}

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

// ─── Answer Area Component ─────────────────────────────────────────────────
interface AnswerAreaProps {
  answer: string;
  setAnswer: (v: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isInputDisabled: boolean;
  isSubmitting: boolean;
  winnerLocked: boolean;
  hasSubmitted: boolean;
  isInsufficientCoins: boolean;
  submitStatus: SubmitStatus;
  cooldownMsg: string;
  submitError: string;
  myStreak: number;
  state: any;
  answerInputRef: React.RefObject<HTMLInputElement | null>;
  username: string;
  actor: any;
  onCoinsUpdated: (n: number) => void;
  coinEntryFee: number;
  coinBalance: number;
  compact?: boolean;
}

function AnswerArea({
  answer,
  setAnswer,
  handleSubmit,
  isInputDisabled,
  isSubmitting,
  winnerLocked,
  hasSubmitted,
  isInsufficientCoins,
  submitStatus,
  cooldownMsg,
  submitError,
  myStreak,
  answerInputRef,
  compact,
}: AnswerAreaProps) {
  let placeholder = "Type your answer...";
  if (winnerLocked) placeholder = "🔒 Round over";
  else if (hasSubmitted) placeholder = "Answer submitted ✓";
  else if (isInsufficientCoins) placeholder = "Not enough coins";
  else if (isInputDisabled) placeholder = "Quiz not active";

  const inputBorderColor =
    submitStatus === "correct"
      ? "oklch(0.65 0.18 145 / 0.6)"
      : submitStatus === "almost"
        ? "oklch(0.75 0.18 80 / 0.5)"
        : submitStatus === "wrong"
          ? "oklch(0.62 0.22 25 / 0.5)"
          : "oklch(0.22 0.025 265)";

  return (
    <div className={compact ? "" : "w-full space-y-2"} data-ocid="quiz.panel">
      <form
        onSubmit={handleSubmit}
        noValidate
        className={`flex gap-0 rounded-xl overflow-hidden border input-focus-glow transition-all${
          submitStatus === "correct"
            ? " animate-bounce-in"
            : submitStatus === "wrong"
              ? " animate-shake"
              : ""
        }`}
        style={{
          borderColor: inputBorderColor,
          background: "oklch(0.155 0.018 265)",
          boxShadow:
            submitStatus === "correct"
              ? "0 0 12px oklch(0.65 0.18 145 / 0.3)"
              : submitStatus === "wrong"
                ? "0 0 8px oklch(0.62 0.22 25 / 0.2)"
                : undefined,
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <Input
          ref={answerInputRef}
          data-ocid="quiz.input"
          type="text"
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
          }}
          placeholder={placeholder}
          disabled={isInputDisabled}
          className="flex-1 h-12 text-sm bg-transparent border-0 focus-visible:ring-0 px-4 placeholder:text-muted-foreground"
          autoComplete="off"
        />
        <motion.div whileTap={{ scale: 0.95 }} className="contents">
          <Button
            data-ocid="quiz.submit_button"
            type="submit"
            disabled={isInputDisabled || !answer.trim()}
            className="h-12 px-5 rounded-none font-bold text-xs uppercase tracking-wider gap-1.5 transition-all"
            style={{
              background: isInputDisabled
                ? undefined
                : "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
              color: "white",
              boxShadow: !isInputDisabled
                ? "0 0 12px oklch(0.65 0.22 270 / 0.25)"
                : undefined,
            }}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isSubmitting ? "..." : "Send"}
            </span>
          </Button>
        </motion.div>
      </form>

      {/* Feedback banners */}
      {!compact && (
        <AnimatePresence mode="wait">
          {submitStatus === "checking" && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-1"
            >
              <div
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                style={{
                  borderColor: "oklch(0.65 0.22 270)",
                  borderTopColor: "transparent",
                }}
              />
              <span className="text-xs text-muted-foreground">Checking...</span>
            </motion.div>
          )}

          {submitStatus === "correct" && (
            <motion.div
              key="correct"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              data-ocid="quiz.success_state"
              className="rounded-lg p-2.5 text-center"
              style={{
                background: "oklch(0.65 0.18 145 / 0.12)",
                border: "1px solid oklch(0.65 0.18 145 / 0.35)",
              }}
            >
              <p className="text-xs font-bold text-success">
                ✓ Correct! First to answer wins!
              </p>
            </motion.div>
          )}

          {submitStatus === "almost" && (
            <motion.div
              key="almost"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg p-2.5 text-center"
              style={{
                background: "oklch(0.75 0.18 80 / 0.1)",
                border: "1px solid oklch(0.75 0.18 80 / 0.3)",
              }}
            >
              <p
                className="text-xs font-bold"
                style={{ color: "oklch(0.78 0.18 80)" }}
              >
                💛 So close! Keep going!
              </p>
            </motion.div>
          )}

          {submitStatus === "wrong" && !cooldownMsg && !submitError && (
            <motion.div
              key="wrong"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              data-ocid="quiz.error_state"
              className="rounded-lg p-2.5 text-center"
              style={{
                background: "oklch(0.62 0.22 25 / 0.1)",
                border: "1px solid oklch(0.62 0.22 25 / 0.3)",
              }}
            >
              <p
                className="text-xs font-bold"
                style={{ color: "oklch(0.72 0.2 25)" }}
              >
                {myStreak >= 3
                  ? "🔥 You're on fire! Stay sharp!"
                  : "✗ Try again!"}
              </p>
            </motion.div>
          )}

          {cooldownMsg && (
            <motion.p
              key="cooldown"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
              className="text-xs font-medium text-center"
              style={{ color: "oklch(0.78 0.18 80)" }}
            >
              ⏱ {cooldownMsg}
            </motion.p>
          )}

          {submitError && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              data-ocid="quiz.error_state"
              className="text-xs font-medium text-center"
              style={{ color: "oklch(0.72 0.2 25)" }}
            >
              {submitError}
            </motion.p>
          )}

          {isInsufficientCoins && !winnerLocked && (
            <motion.div
              key="no-coins"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 rounded-lg p-2.5"
              style={{
                background: "oklch(0.75 0.18 80 / 0.1)",
                border: "1px solid oklch(0.75 0.18 80 / 0.25)",
              }}
            >
              <AlertCircle
                className="w-3.5 h-3.5"
                style={{ color: "oklch(0.78 0.18 80)" }}
              />
              <p
                className="text-xs font-medium"
                style={{ color: "oklch(0.78 0.18 80)" }}
              >
                Not enough coins to play
              </p>
            </motion.div>
          )}

          {winnerLocked && submitStatus === "idle" && !hasSubmitted && (
            <motion.div
              key="winner-locked"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg p-2.5 text-center"
              style={{
                background: "oklch(0.75 0.18 80 / 0.1)",
                border: "1px solid oklch(0.75 0.18 80 / 0.3)",
              }}
            >
              <p
                className="text-xs font-bold"
                style={{ color: "oklch(0.78 0.18 80)" }}
              >
                🏆 Winner found! Wait for next round
              </p>
            </motion.div>
          )}

          {hasSubmitted && submitStatus === "idle" && (
            <motion.p
              key="submitted"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-ocid="quiz.success_state"
              aria-live="polite"
              className="text-xs font-medium text-center text-success"
            >
              ✓ Answer submitted! Waiting for results...
            </motion.p>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
