export type SeededChallenge = {
  title: string;
  description: string;
  language: string;
  starterCode: string;
  testCases: Array<{ input: string; expected_output: string; is_hidden: boolean }>;
};

export function buildDefaultChallenge(jobTitle: string, skills: string[]): SeededChallenge {
  const skillHint = skills.slice(0, 3).join(", ");
  return {
    title: `${jobTitle}: Two Sum Variant`,
    description:
      `Implement solve(input) in JavaScript. Input format:\n` +
      `n target\n` +
      `a1 a2 ... an\n` +
      `Return indices i j (space separated) where ai+aj=target.\n` +
      `Focus on correctness and efficiency. Related skills: ${skillHint || "algorithms"}.`,
    language: "javascript",
    starterCode:
      `function solve(raw) {\n` +
      `  const lines = raw.trim().split(/\\n/);\n` +
      `  const [n, target] = lines[0].split(/\\s+/).map(Number);\n` +
      `  const nums = lines[1].split(/\\s+/).map(Number);\n` +
      `  // TODO: return \"i j\"\n` +
      `  return \"0 1\";\n` +
      `}\n` +
      `\n` +
      `const fs = require('fs');\n` +
      `const input = fs.readFileSync(0, 'utf8');\n` +
      `process.stdout.write(String(solve(input)).trim());\n`,
    testCases: [
      { input: "4 9\n2 7 11 15\n", expected_output: "0 1", is_hidden: false },
      { input: "5 10\n1 2 3 7 8\n", expected_output: "1 4", is_hidden: true },
      { input: "6 6\n3 3 4 2 1 5\n", expected_output: "0 1", is_hidden: true },
    ],
  };
}
