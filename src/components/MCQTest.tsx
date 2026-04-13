"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { McqQuestionClient } from "@/hooks/useCandidateTest";

type MCQTestProps = {
  questions: McqQuestionClient[];
  currentQuestionIndex: number;
  onQuestionIndexChange: (index: number) => void;
  answers: Record<string, number>;
  onAnswerChange: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  message: string | null;
  securityMessage: string | null;
  securityStrikes: number;
  examSeconds: number;
  deadlineAt: string | null;
  directives: string;
};

export function MCQTest({
  questions,
  currentQuestionIndex,
  onQuestionIndexChange,
  answers,
  onAnswerChange,
  onSubmit,
  submitting,
  message,
  securityMessage,
  securityStrikes,
  examSeconds,
  deadlineAt,
  directives,
}: MCQTestProps) {
  const currentQuestion = questions[currentQuestionIndex] || null;

  return (
    <>
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Answer all questions and submit once. Timer: {Math.floor(examSeconds / 60)} min. Your pipeline stage updates automatically.
      </p>
      {deadlineAt || directives ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          {deadlineAt ? (
            <p className="text-xs font-medium text-amber-800">HR deadline: {new Date(deadlineAt).toLocaleString()}</p>
          ) : null}
          {directives ? <p className="mt-1 text-xs text-amber-700">{directives}</p> : null}
        </div>
      ) : null}
      {currentQuestion ? (
        <div className="rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              Q{currentQuestionIndex + 1} / {questions.length}. {currentQuestion.question_text}
            </p>
            {currentQuestion.skill_tag ? <Badge variant="outline">{currentQuestion.skill_tag}</Badge> : null}
          </div>
          <div className="space-y-2">
            {currentQuestion.options.map((option, idx) => (
              <label
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name={`q-${currentQuestion.id}`}
                  checked={answers[currentQuestion.id] === idx}
                  onChange={() => onAnswerChange(currentQuestion.id, idx)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onQuestionIndexChange(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                onClick={() => onQuestionIndexChange(Math.min(questions.length - 1, currentQuestionIndex + 1))}
              >
                Next
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit MCQ"}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
      {securityMessage ? <p className="text-sm text-amber-700">{securityMessage}</p> : null}
      <p className="text-xs text-slate-500">Security checks active. Tab switches recorded: {securityStrikes}/3.</p>
    </>
  );
}
