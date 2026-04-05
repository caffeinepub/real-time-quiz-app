import { useEffect, useRef, useState } from "react";
import type {
  QuizStateAdmin,
  QuizStatePublic,
  ScoreboardData,
} from "../backend";
import { useActor } from "./useActor";

const POLL_INTERVAL = 500;
const SCOREBOARD_POLL_INTERVAL = 1000;

export interface PlayerReferral {
  username: string;
  referredBy: string;
}

// Extended types for new backend API (not yet reflected in generated backend.ts)
export interface AdminExtras {
  roomCode: string;
  kickedPlayers: string[];
  blockedPlayers: string[];
  activePlayers: bigint;
  suspiciousUsers: string[];
  roundLog: RoundLogEntry[];
  playerReferrals: PlayerReferral[];
}

export interface RoundLogEntry {
  roundNumber: bigint;
  question: string;
  winner?: string;
  timeTaken?: bigint;
  totalSubmissions: bigint;
}

export function useQuizPoll() {
  const { actor, isFetching } = useActor();
  const [state, setState] = useState<QuizStatePublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!actor || isFetching) return;

    activeRef.current = true;

    const poll = async () => {
      try {
        const data = await actor.getQuizState();
        if (activeRef.current) {
          setState((prev) => {
            if (!prev) return data;
            // Only update if something meaningful changed to avoid re-renders
            const sameStatus = prev.status === data.status;
            const sameWinner = prev.winner === data.winner;
            const sameSubmissions =
              prev.submissions.length === data.submissions.length;
            const sameQuestion = prev.question === data.question;
            if (sameStatus && sameWinner && sameSubmissions && sameQuestion)
              return prev;
            return data;
          });
          setError(null);
        }
      } catch (e) {
        if (activeRef.current) {
          setError(e instanceof Error ? e.message : "Connection error");
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [actor, isFetching]);

  return { state, error };
}

export function useAdminPoll() {
  const { actor, isFetching } = useActor();
  const [state, setState] = useState<QuizStateAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!actor || isFetching) return;

    activeRef.current = true;

    const poll = async () => {
      try {
        const data = await actor.getAdminState();
        if (activeRef.current) {
          setState((prev) => {
            if (!prev) return data;
            // Only update if something meaningful changed
            const sameStatus = prev.status === data.status;
            const sameWinner = prev.winner === data.winner;
            const sameSubmissions =
              prev.submissions.length === data.submissions.length;
            const sameQuestion = prev.question === data.question;
            if (sameStatus && sameWinner && sameSubmissions && sameQuestion)
              return prev;
            return data;
          });
          setError(null);
        }
      } catch (e) {
        if (activeRef.current) {
          setError(e instanceof Error ? e.message : "Connection error");
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [actor, isFetching]);

  return { state, error };
}

export function useScoreboardPoll() {
  const { actor, isFetching } = useActor();
  const [scoreboard, setScoreboard] = useState<ScoreboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!actor || isFetching) return;

    activeRef.current = true;

    const poll = async () => {
      try {
        const data = await actor.getScoreboard();
        if (activeRef.current) {
          setScoreboard(data);
          setError(null);
        }
      } catch (e) {
        if (activeRef.current) {
          setError(e instanceof Error ? e.message : "Scoreboard error");
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, SCOREBOARD_POLL_INTERVAL);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [actor, isFetching]);

  return { scoreboard, error };
}

export function useAdminExtrasPoll() {
  const { actor, isFetching } = useActor();
  const [extras, setExtras] = useState<AdminExtras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!actor || isFetching) return;

    activeRef.current = true;

    const poll = async () => {
      try {
        // Cast to any for new methods not yet in generated backend.ts
        const data = (await (actor as any).getAdminExtras()) as AdminExtras;
        if (activeRef.current) {
          setExtras(data);
          setError(null);
        }
      } catch (e) {
        if (activeRef.current) {
          setError(e instanceof Error ? e.message : "Extras error");
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, SCOREBOARD_POLL_INTERVAL);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [actor, isFetching]);

  return { extras, error };
}
