import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserCheck, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActor } from "../hooks/useActor";

const STORAGE_KEY = "quizpulse_username";

interface NameEntryProps {
  onJoin: (name: string) => void;
}

type JoinError =
  | { __kind__: "wrongRoomCode"; wrongRoomCode: null }
  | { __kind__: "playerBlocked"; playerBlocked: null }
  | { __kind__: "playerKicked"; playerKicked: null }
  | { __kind__: "nameTaken"; nameTaken: null }
  | { __kind__: "invalidName"; invalidName: null };

type Step = "name" | "roomcode" | "auto-joining";

function getJoinErrorMessage(
  err: JoinError,
  suggestedName: string,
): { message: string; blocked: boolean; kicked: boolean; suggestion?: string } {
  if (err.__kind__ === "wrongRoomCode")
    return {
      message: "Incorrect room code. Ask your host.",
      blocked: false,
      kicked: false,
    };
  if (err.__kind__ === "playerBlocked")
    return {
      message: "You have been blocked from this session.",
      blocked: true,
      kicked: false,
    };
  if (err.__kind__ === "playerKicked")
    return {
      message:
        "You were removed from this round. Rejoin when the next round starts.",
      blocked: false,
      kicked: true,
    };
  if (err.__kind__ === "nameTaken") {
    const suggestion = `${suggestedName}#2`;
    return {
      message: `That name is taken. Try ‘${suggestion}’ instead.`,
      blocked: false,
      kicked: false,
      suggestion,
    };
  }
  if (err.__kind__ === "invalidName")
    return {
      message: "Name must be 2–32 characters.",
      blocked: false,
      kicked: false,
    };
  return {
    message: "Failed to join. Please try again.",
    blocked: false,
    kicked: false,
  };
}

// OTP-style 4-digit room code input
function RoomCodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);
  const digits = value.padEnd(4, "").slice(0, 4).split("");

  const handleDigitChange = (index: number, char: string) => {
    const filtered = char.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = filtered;
    const newVal = newDigits.join("").replace(/\s/g, "").slice(0, 4);
    onChange(newVal);
    // Auto-advance
    if (filtered && index < 3) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    onChange(pasted);
    // Focus the next empty slot
    const nextEmpty = Math.min(pasted.length, 3);
    setTimeout(() => inputRefs.current[nextEmpty]?.focus(), 10);
  };

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map((index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          data-ocid={`nameentry.roomcode.digit.${index + 1}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={digits[index] || ""}
          onChange={(e) => handleDigitChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="w-14 h-16 text-center text-2xl font-bold font-mono rounded-xl transition-all"
          style={{
            background: "oklch(0.20 0.022 265)",
            border: digits[index]
              ? "2px solid oklch(0.65 0.22 270 / 0.7)"
              : "2px solid oklch(0.28 0.025 265)",
            color: "oklch(0.95 0.008 265)",
            boxShadow: digits[index]
              ? "0 0 0 3px oklch(0.65 0.22 270 / 0.15)"
              : "none",
            outline: "none",
          }}
          aria-label={`Room code digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default function NameEntry({ onJoin }: NameEntryProps) {
  const { actor, isFetching } = useActor();

  const { urlRoom, urlRef } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      urlRoom: params.get("room") ?? "",
      urlRef: params.get("ref") ?? "",
    };
  }, []);

  const savedName = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  }, []);

  const shouldAutoJoin = savedName.length > 0 && urlRoom.length === 4;

  const [mode, setMode] = useState<"returning" | "new">(
    savedName ? "returning" : "new",
  );
  const [name, setName] = useState(savedName);
  const [step, setStep] = useState<Step>(
    shouldAutoJoin ? "auto-joining" : "name",
  );
  const [pendingName, setPendingName] = useState(
    shouldAutoJoin ? savedName : "",
  );
  const [roomCode, setRoomCode] = useState(urlRoom);
  const [nameError, setNameError] = useState("");
  const [roomCodeError, setRoomCodeError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const autoJoinAttempted = useRef(false);

  useEffect(() => {
    if (!shouldAutoJoin) return;
    if (!actor || isFetching) return;
    if (autoJoinAttempted.current) return;
    autoJoinAttempted.current = true;

    const performAutoJoin = async () => {
      try {
        const result = (await (actor as any).joinSession(
          savedName,
          urlRoom,
          urlRef,
        )) as
          | { __kind__: "ok"; ok: string }
          | { __kind__: "err"; err: JoinError };

        if (result.__kind__ === "ok") {
          onJoin(result.ok);
        } else {
          const { message, blocked, kicked, suggestion } = getJoinErrorMessage(
            result.err,
            savedName,
          );
          setRoomCodeError(message);
          setIsBlocked(blocked);
          setIsKicked(kicked);
          if (suggestion) {
            setPendingName(suggestion);
            setName(suggestion);
            try {
              localStorage.setItem(STORAGE_KEY, suggestion);
            } catch {
              /* ignore */
            }
          } else {
            setPendingName(savedName);
          }
          setStep("roomcode");
        }
      } catch {
        setPendingName(savedName);
        setRoomCodeError("Connection error. Please try again.");
        setStep("roomcode");
      }
    };

    performAutoJoin();
  }, [actor, isFetching, shouldAutoJoin, savedName, urlRoom, urlRef, onJoin]);

  const validateName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Please enter your name.";
    if (trimmed.length < 2) return "Name must be at least 2 characters.";
    if (trimmed.length > 32) return "Name must be 32 characters or fewer.";
    return "";
  };

  const proceedToRoomCode = (nameToUse: string) => {
    const trimmed = nameToUse.trim();
    const err = validateName(trimmed);
    if (err) {
      setNameError(err);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    setPendingName(trimmed);
    setStep("roomcode");
    setRoomCodeError("");
    setIsKicked(false);
  };

  const handleRoomCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    const code = roomCode.trim();
    if (code.length !== 4) {
      setRoomCodeError("Please enter the full 4-digit room code.");
      return;
    }
    setIsJoining(true);
    setRoomCodeError("");
    try {
      const result = (await (actor as any).joinSession(
        pendingName,
        code,
        urlRef,
      )) as
        | { __kind__: "ok"; ok: string }
        | { __kind__: "err"; err: JoinError };

      if (result.__kind__ === "ok") {
        onJoin(result.ok);
      } else {
        const { message, blocked, kicked, suggestion } = getJoinErrorMessage(
          result.err,
          pendingName,
        );
        setRoomCodeError(message);
        setIsBlocked(blocked);
        setIsKicked(kicked);
        if (suggestion) {
          setPendingName(suggestion);
          setName(suggestion);
          try {
            localStorage.setItem(STORAGE_KEY, suggestion);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setRoomCodeError("Connection error. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleClearSaved = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setName("");
    setMode("new");
    setStep("name");
    setNameError("");
    setRoomCodeError("");
  };

  const isActorReady = !!actor && !isFetching;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.65 0.22 270 / 0.08) 0%, oklch(0.11 0.016 265) 70%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
              boxShadow: "0 0 20px oklch(0.65 0.22 270 / 0.4)",
            }}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-foreground tracking-tight">
            QuizPulse
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* Auto-joining spinner */}
          {step === "auto-joining" && (
            <motion.div
              key="auto-joining"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card-lg text-center space-y-4"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.22 270 / 0.15), oklch(0.65 0.25 290 / 0.08))",
                  border: "1px solid oklch(0.65 0.22 270 / 0.3)",
                }}
              >
                <Loader2
                  className="w-7 h-7 animate-spin"
                  style={{ color: "oklch(0.72 0.2 270)" }}
                />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">
                  Joining room {urlRoom}...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Playing as{" "}
                  <span className="font-semibold text-foreground">
                    {savedName}
                  </span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Returning user */}
          {step === "name" && mode === "returning" && savedName && (
            <motion.div
              key="returning"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card-lg"
            >
              <div className="text-center mb-7">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-4"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                    boxShadow: "0 0 20px oklch(0.65 0.22 270 / 0.3)",
                  }}
                >
                  {savedName.slice(0, 2).toUpperCase()}
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-1">
                  Welcome back!
                </h1>
                <p className="text-muted-foreground text-sm">
                  Ready to play,{" "}
                  <span className="font-semibold text-foreground">
                    {savedName}
                  </span>
                  ?
                </p>
                {urlRoom && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: "oklch(0.65 0.22 270)" }}
                  >
                    Invited to room {urlRoom}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  data-ocid="nameentry.submit_button"
                  onClick={() => proceedToRoomCode(savedName)}
                  className="w-full h-12 font-bold uppercase tracking-wider text-sm gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                    color: "white",
                    boxShadow: "0 0 20px oklch(0.65 0.22 270 / 0.3)",
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  Play as {savedName}
                </Button>
                <button
                  data-ocid="nameentry.secondary_button"
                  type="button"
                  onClick={handleClearSaved}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-2"
                >
                  Not {savedName}? Switch account
                </button>
              </div>
            </motion.div>
          )}

          {/* New user name entry */}
          {step === "name" && (mode === "new" || !savedName) && (
            <motion.div
              key="new"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card-lg"
            >
              <div className="text-center mb-7">
                <h1 className="text-2xl font-display font-bold text-foreground mb-2">
                  Join the Quiz
                </h1>
                <p className="text-muted-foreground text-sm">
                  {urlRoom
                    ? `You’ve been invited to room ${urlRoom}`
                    : "Enter your name to participate"}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  proceedToRoomCode(name);
                }}
                className="space-y-5"
                noValidate
              >
                <div className="space-y-2">
                  <label
                    htmlFor="username-input"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Your Name
                  </label>
                  <Input
                    id="username-input"
                    data-ocid="nameentry.input"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    placeholder="e.g. alex_thunder"
                    autoFocus
                    autoComplete="nickname"
                    maxLength={32}
                    className="h-12 text-base"
                  />
                  {nameError && (
                    <p
                      data-ocid="nameentry.error_state"
                      className="text-xs font-medium"
                      style={{ color: "oklch(0.72 0.2 25)" }}
                      role="alert"
                    >
                      {nameError}
                    </p>
                  )}
                </div>

                <Button
                  data-ocid="nameentry.submit_button"
                  type="submit"
                  className="w-full h-12 font-bold uppercase tracking-wider text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                    color: "white",
                    boxShadow: "0 0 16px oklch(0.65 0.22 270 / 0.3)",
                  }}
                >
                  Continue →
                </Button>
              </form>
            </motion.div>
          )}

          {/* Room code entry */}
          {step === "roomcode" && (
            <motion.div
              key="roomcode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card-lg"
            >
              <div className="text-center mb-7">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
                  style={{
                    background: "oklch(0.65 0.22 270 / 0.12)",
                    border: "1px solid oklch(0.65 0.22 270 / 0.3)",
                  }}
                >
                  🔑
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-1">
                  Enter Room Code
                </h1>
                <p className="text-sm text-muted-foreground">
                  Playing as{" "}
                  <span className="font-semibold text-foreground">
                    {pendingName}
                  </span>
                </p>
              </div>

              {!isActorReady ? (
                <div
                  data-ocid="nameentry.loading_state"
                  className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Connecting to server...</span>
                </div>
              ) : (
                <form
                  data-ocid="nameentry.roomcode.panel"
                  onSubmit={handleRoomCodeSubmit}
                  className="space-y-5"
                  noValidate
                >
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                      4-Digit Room Code
                    </p>
                    <RoomCodeInput
                      value={roomCode}
                      onChange={(val) => {
                        setRoomCode(val);
                        if (roomCodeError) setRoomCodeError("");
                        setIsBlocked(false);
                        setIsKicked(false);
                      }}
                      disabled={isJoining}
                    />
                    {roomCodeError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        data-ocid="nameentry.roomcode.error_state"
                        className="text-xs font-medium text-center"
                        style={{
                          color: isKicked
                            ? "oklch(0.78 0.18 80)"
                            : "oklch(0.72 0.2 25)",
                        }}
                        role="alert"
                      >
                        {isBlocked ? "🚫 " : isKicked ? "⏸️ " : "❌ "}
                        {roomCodeError}
                      </motion.p>
                    )}
                  </div>

                  {!isBlocked && (
                    <Button
                      data-ocid="nameentry.roomcode.submit_button"
                      type="submit"
                      disabled={isJoining || roomCode.length !== 4}
                      className="w-full h-12 font-bold uppercase tracking-wider text-sm gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:scale-100"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                        color: "white",
                        boxShadow:
                          roomCode.length === 4
                            ? "0 0 16px oklch(0.65 0.22 270 / 0.3)"
                            : "none",
                      }}
                    >
                      {isJoining ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />{" "}
                          Joining...
                        </>
                      ) : (
                        "Join Room →"
                      )}
                    </Button>
                  )}
                </form>
              )}

              <button
                data-ocid="nameentry.back_button"
                type="button"
                onClick={() => {
                  setStep("name");
                  setRoomCode(urlRoom);
                  setRoomCodeError("");
                  setIsBlocked(false);
                  setIsKicked(false);
                }}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-2"
              >
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground mt-6">
          No account required · First correct answer wins!
        </p>
      </motion.div>
    </div>
  );
}
