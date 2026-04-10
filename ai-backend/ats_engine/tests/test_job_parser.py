from __future__ import annotations

import unittest

from ats_engine.parser.job_parser import parse_job_text


class JobParserNormalizationTests(unittest.TestCase):
    def test_only_preferred_section_becomes_required(self) -> None:
        jd = """
        Preferred Skills:
        Python
        SQL
        Tableau
        """
        job = parse_job_text(jd)
        self.assertEqual(sorted(job.required_skills), ["python", "sql", "tableau"])
        self.assertEqual(job.preferred_skills, [])

    def test_only_generic_skills_section_becomes_required(self) -> None:
        jd = """
        Technical Skills
        React, TypeScript, JavaScript
        """
        job = parse_job_text(jd)
        self.assertIn("react", job.required_skills)
        self.assertIn("typescript", job.required_skills)
        self.assertEqual(job.preferred_skills, [])

    def test_skills_and_qualifications_header(self) -> None:
        jd = """
        Skills & Qualifications
        Python, SQL, pandas
        """
        job = parse_job_text(jd)
        self.assertIn("python", job.required_skills)
        self.assertIn("sql", job.required_skills)

    def test_required_and_preferred_stay_separate(self) -> None:
        jd = """
        Required Skills:
        Python
        SQL

        Preferred Skills:
        Tableau
        """
        job = parse_job_text(jd)
        self.assertIn("python", job.required_skills)
        self.assertIn("sql", job.required_skills)
        self.assertIn("tableau", job.preferred_skills)
        self.assertNotIn("tableau", job.required_skills)

    def test_prose_only_no_headers_fills_required(self) -> None:
        jd = (
            "Data Scientist: We need Python, SQL, pandas, NumPy, and scikit-learn "
            "for machine learning. Required skills include deep learning experience."
        )
        job = parse_job_text(jd)
        self.assertNotEqual(job.required_skills, [])
        for s in ("python", "sql", "pandas", "numpy", "scikit-learn", "machine learning"):
            self.assertIn(s, job.required_skills, msg=f"missing {s}")
        self.assertEqual(job.preferred_skills, [])

    def test_short_required_label(self) -> None:
        jd = """
        Required:
        FastAPI, PostgreSQL

        Preferred:
        Docker
        """
        job = parse_job_text(jd)
        self.assertIn("fastapi", job.required_skills)
        self.assertIn("postgresql", job.required_skills)
        self.assertIn("docker", job.preferred_skills)

    def test_no_duplicate_across_lists(self) -> None:
        jd = """
        Required Skills:
        Python

        Preferred Skills:
        Python
        SQL
        """
        job = parse_job_text(jd)
        self.assertIn("python", job.required_skills)
        self.assertIn("sql", job.preferred_skills)
        self.assertNotIn("python", job.preferred_skills)

    def test_plus_sentence_does_not_empty_required(self) -> None:
        jd = (
            "Data Scientist role requiring Python, SQL, pandas, NumPy, scikit-learn, and machine learning. "
            "Tableau is a plus."
        )
        job = parse_job_text(jd)
        for s in ("python", "sql", "pandas", "numpy", "scikit-learn", "machine learning"):
            self.assertIn(s, job.required_skills, msg=f"missing required {s}")
        self.assertIn("tableau", job.preferred_skills)
        self.assertNotIn("tableau", job.required_skills)

    def test_data_scientist_prose_extracts_richer_required_and_plus_preferred(self) -> None:
        jd = (
            "Data Scientist: We are looking for a Data Scientist to analyze large datasets and build predictive models. "
            "The role involves feature engineering and developing machine learning models using Python, SQL, pandas, "
            "NumPy, and scikit-learn. Candidates should have statistics, model evaluation, and data visualization "
            "experience. Familiarity with NLP, time-series analysis, and MLOps is a plus."
        )
        job = parse_job_text(jd)
        for s in (
            "python",
            "sql",
            "pandas",
            "numpy",
            "scikit-learn",
            "machine learning",
            "feature engineering",
            "statistics",
            "model evaluation",
            "data visualization",
        ):
            self.assertIn(s, job.required_skills, msg=f"missing required {s}")
        for s in ("nlp", "time-series analysis", "mlops"):
            self.assertIn(s, job.preferred_skills, msg=f"missing preferred {s}")


if __name__ == "__main__":
    unittest.main()
