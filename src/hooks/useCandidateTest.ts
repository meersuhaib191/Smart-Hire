"use client";

import { useCallback, useEffect, useState } from "react";

export type McqQuestionClient = {
  id: string;
  question_text: string;
  options: string[];
  skill_tag: string | null;
  difficulty: string | null;
};

export type McqAttemptSummary = {
  score: number;
  total_questions: number;
  correct_answers: number;
  submitted_at: string;
};

export type ReviewAnswer = {
  questionId: string;
  questionText: string;
  options: string[];
  selectedOption: number;
  isCorrect: boolean;
};

export function useCandidateTest(applicationId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [needsStart, setNeedsStart] = useState(false);
  const [questions, setQuestions] = useState<McqQuestionClient[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<McqAttemptSummary | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswer[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [message, setMessage] = useState("");
  const [examSeconds, setExamSeconds] = useState(15 * 60);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [hasExpired, setHasExpired] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [directives, setDirectives] = useState("");

  const loadSession = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/mcq/session?applicationId=${applicationId}`);
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to load MCQ session.");
        return;
      }
      setQuestions(json.questions || []);
      setHasSubmitted(Boolean(json.hasSubmitted));
      setAttempt(json.attempt || null);
      setReviewAnswers(json.reviewAnswers || []);
      setSessionToken(json.sessionToken || "");
      setNeedsStart(Boolean(json.needsStart));
      const serverExamSeconds = Number(json.examSeconds || 15 * 60);
      const serverRemaining = Number(json.remainingSeconds ?? serverExamSeconds);
      setExamSeconds(serverExamSeconds);
      setTimeLeft(serverRemaining);
      setHasExpired(Boolean(json.hasExpired));
      setDeadlineAt(json.deadlineAt || null);
      setDirectives(String(json.directives || ""));
      if (json.hasExpired) {
        setMessage("MCQ exam time window has expired. Please contact HR or support.");
      }
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const startTest = useCallback(async () => {
    if (!applicationId) return;
    setStarting(true);
    setMessage("");
    try {
      const res = await fetch("/api/mcq/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Could not start the MCQ test.");
        return;
      }
      setQuestions(json.questions || []);
      setSessionToken(json.sessionToken || "");
      setNeedsStart(false);
      const serverExamSeconds = Number(json.examSeconds || 15 * 60);
      const serverRemaining = Number(json.remainingSeconds ?? serverExamSeconds);
      setExamSeconds(serverExamSeconds);
      setTimeLeft(serverRemaining);
      setHasExpired(false);
    } finally {
      setStarting(false);
    }
  }, [applicationId]);

  return {
    loading,
    starting,
    needsStart,
    questions,
    hasSubmitted,
    attempt,
    reviewAnswers,
    sessionToken,
    message,
    setMessage,
    examSeconds,
    timeLeft,
    setTimeLeft,
    hasExpired,
    deadlineAt,
    directives,
    loadSession,
    startTest,
    setHasSubmitted,
    setAttempt,
    setReviewAnswers,
  };
}
