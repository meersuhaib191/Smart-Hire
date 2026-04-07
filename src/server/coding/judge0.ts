type Judge0Result = {
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
};

const normalize = (value: string) => value.replace(/\r\n/g, "\n").trim();

const languageToJudge0Id = (language: string): number => {
  switch (language.toLowerCase()) {
    case "javascript":
    case "js":
      return 63; // Node.js
    case "typescript":
    case "ts":
      return 74; // TypeScript
    case "python":
    case "py":
      return 71; // Python 3
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
};

export async function executeWithJudge0(params: {
  sourceCode: string;
  language: string;
  stdin?: string;
}): Promise<Judge0Result> {
  const apiUrl = process.env.JUDGE0_API_URL;
  const apiKey = process.env.JUDGE0_API_KEY;
  if (!apiUrl) {
    throw new Error("Missing JUDGE0_API_URL.");
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Auth-Token": apiKey } : {}),
    },
    body: JSON.stringify({
      language_id: languageToJudge0Id(params.language),
      source_code: params.sourceCode,
      stdin: params.stdin || "",
    }),
  });

  if (!response.ok) {
    throw new Error(`Judge0 request failed: ${response.status}`);
  }

  return (await response.json()) as Judge0Result;
}

export async function runAgainstTestCases(input: {
  sourceCode: string;
  language: string;
  testCases: Array<{ input: string; expected_output: string; is_hidden: boolean }>;
}) {
  const executions = await Promise.all(
    input.testCases.map(async (tc) => {
      const result = await executeWithJudge0({
        sourceCode: input.sourceCode,
        language: input.language,
        stdin: tc.input,
      });
      const output = normalize(result.stdout || "");
      const expected = normalize(tc.expected_output || "");
      const passed = output === expected;
      return {
        ...result,
        input: tc.input,
        expectedOutput: tc.expected_output,
        actualOutput: result.stdout || "",
        passed,
        isHidden: tc.is_hidden,
      };
    })
  );

  const passedCount = executions.filter((e) => e.passed).length;
  const totalCount = executions.length;
  const score = totalCount ? (passedCount / totalCount) * 100 : 0;

  return {
    executions,
    passedCount,
    totalCount,
    score,
  };
}
