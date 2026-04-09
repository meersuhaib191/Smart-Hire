from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .service import ResumeScreeningService, ScreeningWeights


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Standalone resume screening runner.")
    parser.add_argument("--resume", required=True, help="Path to resume file (pdf/txt/md/docx).")
    parser.add_argument("--jd", help="Path to job description text file.")
    parser.add_argument("--jd-text", help="Inline job description text.")
    parser.add_argument("--jd-dir", help="Directory containing multiple JD files (.txt/.md).")
    parser.add_argument("--pass-threshold", type=float, default=65.0, help="Threshold for PASS in multi-JD mode.")
    parser.add_argument("--semantic-weight", type=float, default=0.50)
    parser.add_argument("--skill-weight", type=float, default=0.30)
    parser.add_argument("--experience-weight", type=float, default=0.20)
    parser.add_argument("--disable-role-boost", action="store_true")
    return parser


def _iter_jd_files(path: Path) -> list[Path]:
    all_text_files = sorted(
        p for p in path.iterdir()
        if p.is_file() and p.suffix.lower() in {".txt", ".md"}
    )
    tagged = [p for p in all_text_files if p.stem.lower().startswith("jd")]
    return tagged if tagged else all_text_files


def main() -> int:
    args = build_parser().parse_args()

    if not args.jd and not args.jd_text and not args.jd_dir:
        print("Provide one of --jd, --jd-text, or --jd-dir.", file=sys.stderr)
        return 1
    if abs((args.semantic_weight + args.skill_weight + args.experience_weight) - 1.0) > 0.01:
        print("semantic_weight + skill_weight + experience_weight must be ~1.0", file=sys.stderr)
        return 1

    service = ResumeScreeningService()
    weights = ScreeningWeights(
        semantic_weight=args.semantic_weight,
        skill_weight=args.skill_weight,
        experience_weight=args.experience_weight,
    )

    if args.jd_dir:
        jd_dir = Path(args.jd_dir)
        if not jd_dir.exists() or not jd_dir.is_dir():
            print(f"Invalid --jd-dir: {jd_dir}", file=sys.stderr)
            return 1
        jd_files = _iter_jd_files(jd_dir)
        if not jd_files:
            print("No .txt/.md files found in --jd-dir", file=sys.stderr)
            return 1

        rows: list[dict] = []
        for jd_file in jd_files:
            result = service.screen(
                resume_path=args.resume,
                job_description_path=str(jd_file),
                weights=weights,
                use_role_boost=not args.disable_role_boost,
            ).to_dict()
            result["job_file"] = jd_file.name
            result["decision"] = "PASS" if result["overall_score"] >= args.pass_threshold else "REJECT"
            rows.append(result)

        rows.sort(key=lambda x: x["overall_score"], reverse=True)
        print(
            f"{'Rank':<6}{'Job Description':<28}{'Overall':>10}{'Semantic':>10}"
            f"{'Skill':>10}{'Experience':>12}{'Decision':>12}"
        )
        print("-" * 88)
        for i, row in enumerate(rows, start=1):
            print(
                f"{i:<6}"
                f"{row['job_file'][:26]:<28}"
                f"{row['overall_score']:>10.2f}"
                f"{row['semantic_score']:>10.2f}"
                f"{row['skill_score']:>10.2f}"
                f"{row['experience_score']:>12.2f}"
                f"{row['decision']:>12}"
            )
        print("\nJSON:")
        print(json.dumps(rows, indent=2))
        return 0

    result = service.screen(
        resume_path=args.resume,
        job_description_path=args.jd,
        job_description_text=args.jd_text,
        weights=weights,
        use_role_boost=not args.disable_role_boost,
    )
    print(json.dumps(result.to_dict(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

