"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";
import { MCQTest } from "@/components/MCQTest";
import { useCandidateTest } from "@/hooks/useCandidateTest";

export default function McqPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const storageKey = useMemo(() => `mcq-answers:${id || "unknown"}`, [id]);
  const tabId = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);
  const lockKey = useMemo(() => `mcq-lock:${id || "unknown"}`, [id]);

  const {
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
    startTest,
    setHasSubmitted,
    setAttempt,
    setReviewAnswers,
  } = useCandidateTest(id);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityStrikes, setSecurityStrikes] = useState(0);
  const [blockedByOtherTab, setBlockedByOtherTab] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const examActive = !loading && !hasSubmitted && !hasExpired && questions.length > 0 && !needsStart;

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [questions]);

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
  }, [hasSubmitted, loading, questions.length, setTimeLeft]);

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

  useEffect(() => {
    if (!examActive || blockedByOtherTab) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        setSecurityStrikes((prev) => prev + 1);
        setSecurityMessage("Tab switch detected. Keep this assessment tab active.");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["c", "v", "x", "a", "p"].includes(key)) {
        event.preventDefault();
        setSecurityMessage("Copy/paste and print shortcuts are disabled during the MCQ round.");
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setSecurityMessage("Right-click is disabled during the MCQ round.");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [blockedByOtherTab, examActive]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const secs = (timeLeft % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [timeLeft]);

  const submit = useCallback(
    async (auto = false) => {
      if (!id || hasSubmitted || submitting || blockedByOtherTab) return;
      if (!sessionToken) {
        setMessage("MCQ session is invalid or expired. Please reload.");
        return;
      }

      const payloadAnswers = questions
        .filter((q) => Number.isInteger(answers[q.id]))
        .map((q) => ({ questionId: q.id, selectedOption: answers[q.id] }));

      if (!payloadAnswers.length && !auto) {
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
    },
    [
      answers,
      blockedByOtherTab,
      hasSubmitted,
      id,
      questions,
      sessionToken,
      setAttempt,
      setHasSubmitted,
      setMessage,
      setReviewAnswers,
      submitting,
    ]
  );

  useEffect(() => {
    if (!loading && !hasSubmitted && !hasExpired && questions.length > 0 && timeLeft === 0) {
      void submit(true);
    }
  }, [hasExpired, hasSubmitted, loading, questions.length, submit, timeLeft]);

  useEffect(() => {
    if (!examActive || hasSubmitted) return;
    if (securityStrikes >= 3) {
      setSecurityMessage("Multiple tab-switch events detected. Auto-submitting your current answers.");
      void submit(true);
    }
  }, [examActive, hasSubmitted, securityStrikes, submit]);

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
        {examActive ? (
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
          ) : needsStart ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                When you start, we generate a unique 10-question test from the job requirements and your experience level. You
                can only take this test once for this application.
              </p>
              {message ? <p className="text-sm text-red-600">{message}</p> : null}
              <Button onClick={() => void startTest()} disabled={starting}>
                {starting ? "Starting..." : "Start MCQ Test"}
              </Button>
            </div>
          ) : questions.length === 0 ? (
            <EmptyState
              title={message && /quota|AI provider|MCQ service|rate-limit|Groq/i.test(message) ? "Assessment temporarily unavailable" : "No MCQ questions available yet"}
              description={message || "This assessment could not be loaded. Try again or contact support."}
            />
          ) : (
            <MCQTest
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              onQuestionIndexChange={setCurrentQuestionIndex}
              answers={answers}
              onAnswerChange={(qid, idx) => setAnswers((prev) => ({ ...prev, [qid]: idx }))}
              onSubmit={() => void submit(false)}
              submitting={submitting}
              message={message}
              securityMessage={securityMessage}
              securityStrikes={securityStrikes}
              examSeconds={examSeconds}
              deadlineAt={deadlineAt}
              directives={directives}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
