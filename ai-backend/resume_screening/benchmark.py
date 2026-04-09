from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from .service import ResumeScreeningService, ScreeningWeights

SUPPORTED_SUFFIXES = {".pdf", ".txt", ".md", ".docx"}


def _iter_resume_files(resume_dir: Path, exclude_names: set[str]) -> Iterable[Path]:
    for path in sorted(resume_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES:
            if path.name in exclude_names:
                continue
            if path.stem.lower().startswith("jd"):
                continue
            yield path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Benchmark multiple resumes against one JD.")
    parser.add_argument("--resume-dir", required=True, help="Directory containing resume files.")
    parser.add_argument("--jd", help="Path to job description file.")
    parser.add_argument("--jd-text", help="Inline job description text.")
    parser.add_argument("--pass-threshold", type=float, default=65.0, help="PASS threshold for overall score.")
    parser.add_argument("--semantic-weight", type=float, default=0.50)
    parser.add_argument("--skill-weight", type=float, default=0.30)
    parser.add_argument("--experience-weight", type=float, default=0.20)
    parser.add_argument("--disable-role-boost", action="store_true")
    parser.add_argument("--json-out", help="Optional output file path for full JSON results.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    resume_dir = Path(args.resume_dir)
    if not resume_dir.exists() or not resume_dir.is_dir():
        raise SystemExit(f"Invalid --resume-dir: {resume_dir}")
    if not args.jd and not args.jd_text:
        raise SystemExit("Provide either --jd or --jd-text.")
    if abs((args.semantic_weight + args.skill_weight + args.experience_weight) - 1.0) > 0.01:
        raise SystemExit("semantic_weight + skill_weight + experience_weight must be ~1.0")

    weights = ScreeningWeights(
        semantic_weight=args.semantic_weight,
        skill_weight=args.skill_weight,
        experience_weight=args.experience_weight,
    )
    service = ResumeScreeningService()

    exclude_names: set[str] = set()
    if args.jd:
        exclude_names.add(Path(args.jd).name)

    results: list[dict] = []
    for resume_path in _iter_resume_files(resume_dir, exclude_names):
        result = service.screen(
            resume_path=str(resume_path),
            job_description_path=args.jd,
            job_description_text=args.jd_text,
            weights=weights,
            use_role_boost=not args.disable_role_boost,
        ).to_dict()
        result["resume_file"] = resume_path.name
        result["decision"] = "PASS" if result["overall_score"] >= args.pass_threshold else "REJECT"
        results.append(result)

    if not results:
        raise SystemExit(f"No supported resume files found in {resume_dir}")

    results.sort(key=lambda x: x["overall_score"], reverse=True)

    print(f"\nATS Benchmark Results (threshold={args.pass_threshold})")
    print("-" * 108)
    print(
        f"{'Rank':<6}{'Resume':<30}{'Overall':>10}{'Semantic':>10}"
        f"{'Skill':>10}{'Exp':>10}{'Boost':>9}{'Decision':>12}"
    )
    print("-" * 108)
    for idx, row in enumerate(results, start=1):
        print(
            f"{idx:<6}"
            f"{row['resume_file'][:28]:<30}"
            f"{row['overall_score']:>10.2f}"
            f"{row['semantic_score']:>10.2f}"
            f"{row['skill_score']:>10.2f}"
            f"{row['experience_score']:>10.2f}"
            f"{row['role_boost']:>9.2f}"
            f"{row['decision']:>12}"
        )

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"\nSaved JSON benchmark output to: {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

