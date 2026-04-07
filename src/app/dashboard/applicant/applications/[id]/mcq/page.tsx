"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";

type Question = {
  id: string;
  question_text: string;
  options: string[];
  skill_tag: string | null;
  difficulty: string | null;
};

type AttemptResult = {
  score: number;
  total_questions: number;
  correct_answers: number;
  submitted_at: string;
};

type ReviewAnswer = {
  questionId: string;
  questionText: string;
  options: string[];
  selectedOption: number;
  isCorrect: boolean;
};

export default function McqPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const storageKey = useMemo(() => `mcq-answers:${id || "unknown"}`, [id]);
  const tabId = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);
  const lockKey = useMemo(() => `mcq-lock:${id || "unknown"}`, [id]);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswer[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [examSeconds, setExamSeconds] = useState(15 * 60);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [hasExpired, setHasExpired] = useState(false);
  const [blockedByOtherTab, setBlockedByOtherTab] = useState(false);

  const examActive = !loading && !hasSubmitted && !hasExpired && questions.length > 0;

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/mcq/session?applicationId=${id}`);
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
        const serverExamSeconds = Number(json.examSeconds || 15 * 60);
        const serverRemaining = Number(json.remainingSeconds ?? serverExamSeconds);
        setExamSeconds(serverExamSeconds);
        setTimeLeft(serverRemaining);
        setHasExpired(Boolean(json.hasExpired));
        if (json.hasExpired) {
          setMessage("MCQ exam time window has expired. Please contact HR or support.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (loading || hasSubmitted || questions.length === 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasSubmitted, loading, questions.length]);

  useEffect(() => {
    if (!examActive) return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const allowedIds = new Set(questions.map((q) => q.id));
      const restored: Record<string, number> = {};
      for (const [qid, selected] of Object.entries(parsed || {})) {
        if (allowedIds.has(qid) && Number.isInteger(selected)) {
          restored[qid] = selected;
        }
      }
      if (Object.keys(restored).length) {
        setAnswers(restored);
      }
    } catch {
      // ignore malformed local storage
    }
  }, [examActive, questions, storageKey]);

  useEffect(() => {
    if (!examActive) return;
    window.localStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, examActive, storageKey]);

  useEffect(() => {
    if (!hasSubmitted) return;
    window.localStorage.removeItem(storageKey);
  }, [hasSubmitted, storageKey]);

  useEffect(() => {
    if (!examActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [examActive]);

  useEffect(() => {
    if (!examActive) {
      setBlockedByOtherTab(false);
      return;
    }

    const LOCK_STALE_MS = 15000;
    const HEARTBEAT_MS = 5000;

    const readLock = () => {
      const raw = window.localStorage.getItem(lockKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as { tabId: string; ts: number };
      } catch {
        return null;
      }
    };

    const writeLock = () => {
      window.localStorage.setItem(lockKey, JSON.stringify({ tabId, ts: Date.now() }));
    };

    const releaseLock = () => {
      const current = readLock();
      if (current?.tabId === tabId) {
        window.localStorage.removeItem(lockKey);
      }
    };

    const acquireOrBlock = () => {
      const current = readLock();
      const now = Date.now();
      const isStale = !current || now - Number(current.ts || 0) > LOCK_STALE_MS;
      const isOwnedByMe = current?.tabId === tabId;

      if (isStale || isOwnedByMe) {
        writeLock();
        setBlockedByOtherTab(false);
      } else {
        setBlockedByOtherTab(true);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== lockKey) return;
      acquireOrBlock();
    };

    const onBeforeUnload = () => {
      releaseLock();
    };

    acquireOrBlock();
    const heartbeat = window.setInterval(() => {
      acquireOrBlock();
    }, HEARTBEAT_MS);

    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onBeforeUnload);
      releaseLock();
    };
  }, [examActive, lockKey, tabId]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const secs = (timeLeft % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [timeLeft]);

  const submit = useCallback(async (auto = false) => {
    if (!id || hasSubmitted || submitting || blockedByOtherTab) return;
    if (!sessionToken) {
      setMessage("MCQ session is invalid or expired. Please reload.");
      return;
    }

    const payloadAnswers = questions
      .filter((q) => Number.isInteger(answers[q.id]))
      .map((q) => ({ questionId: q.id, selectedOption: answers[q.id] }));

    if (!payloadAnswers.length) {
      setMessage("Please answer at least one question before submitting.");
      return;
    }
    if (!auto && payloadAnswers.length !== questions.length) {
      setMessage("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/mcq/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id, answers: payloadAnswers, sessionToken }),
      });
      const json = await res.json();
      if (res.ok || res.status === 409) {
        setHasSubmitted(true);
        if (json.result) {
          setAttempt({
            score: json.result.score,
            total_questions: json.result.totalQuestions,
            correct_answers: json.result.correctAnswers,
            submitted_at: new Date().toISOString(),
          });
        }
        if (json.reviewAnswers) {
          setReviewAnswers(json.reviewAnswers);
        }
        return;
      }
      setMessage(json.error || "Failed to submit MCQ answers.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, blockedByOtherTab, hasSubmitted, id, questions, sessionToken, submitting]);

  useEffect(() => {
    if (!loading && !hasSubmitted && !hasExpired && questions.length > 0 && timeLeft === 0) {
      submit(true);
    }
  }, [hasExpired, hasSubmitted, loading, questions.length, submit, timeLeft]);

  const goBackToApplication = () => {
    if (examActive) {
      const confirmed = window.confirm(
        "Your MCQ is still active. Leaving now may cause you to lose progress before submission. Continue?"
      );
      if (!confirmed) return;
    }
    router.push(`/dashboard/applicant/applications/${id}`);
  };

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={goBackToApplication} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to Application
        </button>
        {!hasSubmitted ? (
          <Badge variant={timeLeft <= 60 ? "error" : "secondary"}>Time Left: {formattedTime}</Badge>
        ) : null}
      </div>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle>MCQ Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSubmitted && attempt ? (
            <div className="space-y-2">
              <p className="text-sm">Your attempt is already submitted.</p>
              <p className="text-sm">
                Score: <span className="font-semibold">{Number(attempt.score).toFixed(2)}%</span> (
                {attempt.correct_answers}/{attempt.total_questions})
              </p>
              {reviewAnswers.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {reviewAnswers.map((item, idx) => (
                    <div key={item.questionId} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-medium">
                        Q{idx + 1}. {item.questionText}
                      </p>
                      <p className={`text-sm mt-1 ${item.isCorrect ? "text-green-600" : "text-red-600"}`}>
                        Your answer: {item.options[item.selectedOption] ?? "Option not found"} {item.isCorrect ? "✓" : "✗"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button variant="outline" onClick={goBackToApplication}>
                  Back to Pipeline
                </Button>
              </div>
            </div>
          ) : blockedByOtherTab ? (
            <EmptyState
              title="Assessment is active in another tab"
              description="Return to that tab to continue, or close it and wait a few seconds."
            />
          ) : hasExpired ? (
            <EmptyState
              title="Session expired before submission"
              description="Please contact HR to reopen this stage."
            />
          ) : questions.length === 0 ? (
            <EmptyState
              title="No MCQ questions available yet"
              description="This assessment has not been generated for the selected job."
            />
          ) : (
            <>
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Answer all questions and submit once. Timer: {Math.floor(examSeconds / 60)} min. Your pipeline stage updates automatically.
              </p>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        Q{i + 1}. {q.question_text}
                      </p>
                      {q.skill_tag ? <Badge variant="outline">{q.skill_tag}</Badge> : null}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((option, idx) => (
                        <label key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === idx}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {message ? <p className="text-sm text-red-600">{message}</p> : null}
              <div className="flex justify-end">
                <Button onClick={() => submit(false)} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit MCQ"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
