import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ScoreboardEntry {
    streak: bigint;
    username: string;
    wins: bigint;
}
export interface AutoRoundResult {
    state: QuizStatePublic;
    questionId: bigint;
    category: string;
}
export interface AutoModeSettings {
    rewardAmount: bigint;
    timerSeconds: bigint;
    enabled: boolean;
}
export interface RoundLogEntry {
    question: string;
    winner?: string;
    totalSubmissions: bigint;
    timeTaken?: bigint;
    roundNumber: bigint;
}
export interface ScoreboardData {
    scoreboard: Array<ScoreboardEntry>;
    winHistory: Array<WinEntry>;
}
export interface CoinSettings {
    entryFee: bigint;
    winBonus: bigint;
}
export interface QuizStateAdmin {
    startTime: bigint;
    status: QuizStatus;
    question: string;
    mode: AnswerMode;
    winner?: string;
    timerSeconds: bigint;
    submissions: Array<Submission>;
    totalActivePlayers: bigint;
    correctAnswers: Array<string>;
    suspiciousUsers: Array<string>;
}
export interface AdminExtras {
    kickedPlayers: Array<string>;
    activePlayers: bigint;
    playerReferrals: Array<PlayerReferral>;
    blockedPlayers: Array<string>;
    suspiciousUsers: Array<string>;
    roomCode: string;
    roundLog: Array<RoundLogEntry>;
}
export type QuizError = {
    __kind__: "answerNotAccepted";
    answerNotAccepted: string;
} | {
    __kind__: "quizAlreadyHasWinner";
    quizAlreadyHasWinner: null;
} | {
    __kind__: "quizNotLive";
    quizNotLive: null;
} | {
    __kind__: "insufficientCoins";
    insufficientCoins: null;
} | {
    __kind__: "answerLimitExceeded";
    answerLimitExceeded: null;
};
export interface ReferralCount {
    inviter: string;
    count: bigint;
}
export interface WinEntry {
    username: string;
    timeTaken: bigint;
}
export interface PlayerWallet {
    totalEarned: bigint;
    totalWithdrawn: bigint;
    pendingBalance: bigint;
}
export interface PlayerReferral {
    username: string;
    referredBy: string;
}
export type FreeCoinsResult = {
    __kind__: "ok";
    ok: bigint;
} | {
    __kind__: "err";
    err: Variant_cooldownActive;
};
export interface QuizStatePublic {
    startTime: bigint;
    status: QuizStatus;
    question: string;
    winner?: string;
    timerSeconds: bigint;
    submissions: Array<Submission>;
}
export interface WithdrawalRequest {
    id: bigint;
    status: WithdrawalStatus;
    username: string;
    upiId: string;
    amount: bigint;
    requestedAt: bigint;
}
export interface Submission {
    answerStatus: AnswerStatus;
    username: string;
    answer: string;
    timestamp: bigint;
}
export enum AnswerMode {
    strict = "strict",
    smart = "smart"
}
export enum AnswerStatus {
    almost = "almost",
    correct = "correct",
    wrong = "wrong"
}
export enum JoinError {
    nameTaken = "nameTaken",
    playerKicked = "playerKicked",
    invalidName = "invalidName",
    playerBlocked = "playerBlocked",
    wrongRoomCode = "wrongRoomCode"
}
export enum QuizStatus {
    live = "live",
    finished = "finished",
    waiting = "waiting"
}
export enum Variant_cooldownActive {
    cooldownActive = "cooldownActive"
}
export enum WithdrawalError {
    insufficientBalance = "insufficientBalance",
    invalidUpiId = "invalidUpiId",
    pendingRequestExists = "pendingRequestExists",
    cooldownActive = "cooldownActive"
}
export enum WithdrawalStatus {
    pending = "pending",
    paid = "paid"
}
export interface backendInterface {
    blockPlayer(username: string): Promise<void>;
    claimFreeCoins(username: string): Promise<FreeCoinsResult>;
    endRound(): Promise<void>;
    generateRoomCode(): Promise<string>;
    getAdminExtras(): Promise<AdminExtras>;
    getAdminState(): Promise<QuizStateAdmin>;
    getAutoModeSettings(): Promise<AutoModeSettings>;
    getCoinBalance(username: string): Promise<bigint>;
    getCoinSettings(): Promise<CoinSettings>;
    getInviterForPlayer(username: string): Promise<string>;
    getMinWithdrawal(): Promise<bigint>;
    getQuizState(): Promise<QuizStatePublic>;
    getReferralCounts(): Promise<Array<ReferralCount>>;
    getRoundLog(): Promise<Array<RoundLogEntry>>;
    getScoreboard(): Promise<ScoreboardData>;
    getWallet(username: string): Promise<PlayerWallet>;
    getWithdrawalRequests(): Promise<Array<WithdrawalRequest>>;
    joinSession(username: string, code: string, referredBy: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: JoinError;
    }>;
    kickPlayer(username: string): Promise<void>;
    markWithdrawalPaid(requestId: bigint): Promise<void>;
    requestWithdrawal(username: string, upiId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: WithdrawalError;
    }>;
    resetAll(): Promise<void>;
    resetQuiz(): Promise<void>;
    setAutoMode(enabled: boolean, rewardAmount: bigint, timerSeconds: bigint): Promise<void>;
    setCoinEntryFee(fee: bigint): Promise<void>;
    setCoinWinBonus(bonus: bigint): Promise<void>;
    setMinWithdrawal(amount: bigint): Promise<void>;
    startNewRound(question: string, correctAnswers: string, timerSeconds: bigint, mode: AnswerMode, rewardAmount: bigint): Promise<{
        __kind__: "ok";
        ok: QuizStatePublic;
    }>;
    startQuiz(question: string, correctAnswers: string, timerSeconds: bigint, mode: AnswerMode, rewardAmount: bigint): Promise<{
        __kind__: "ok";
        ok: QuizStatePublic;
    }>;
    submitAnswer(username: string, answer: string): Promise<{
        __kind__: "ok";
        ok: QuizStatePublic;
    } | {
        __kind__: "err";
        err: QuizError;
    }>;
    triggerAutoRound(): Promise<{
        __kind__: "ok";
        ok: AutoRoundResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    unblockPlayer(username: string): Promise<void>;
}
