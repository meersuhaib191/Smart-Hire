from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from resume_screening.scoring import compute_experience_score
from resume_screening.service import ResumeScreeningService
from resume_screening.skills import compute_skill_score


def _write_temp_file(text: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".txt")
    Path(path).write_text(text, encoding="utf-8")
    return path


class RankingEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ResumeScreeningService()

    def test_skill_score_penalizes_missing_critical(self) -> None:
        jd = """
        Required: Python, SQL, Tableau
        Must have: Tableau
        Preferred: Power BI
        """
        resume = "Python developer with strong SQL reporting and analytics."
        result = compute_skill_score(jd, resume)
        self.assertIn("tableau", result.missing_skills)
        self.assertLess(result.score, 85.0)

    def test_experience_score_formula(self) -> None:
        jd = "Minimum 5 years of experience in data analytics required."
        resume = "I have 3 years of experience as a data analyst."
        exp = compute_experience_score(resume, jd)
        self.assertAlmostEqual(exp.score, 60.0, delta=0.5)

    def test_data_analyst_ranks_above_data_scientist_and_other(self) -> None:
        jd_data_analyst = """
        Hiring Data Analyst.
        Required: SQL, dashboarding, KPI reporting, Tableau, Excel.
        Minimum 3 years of experience in analytics and reporting.
        """
        resume_data_analyst = """
        Data Analyst with 4 years of experience.
        Built KPI dashboards, Tableau reports, and SQL-based analytics pipelines.
        Strong Excel and business reporting skills.
        """
        resume_data_scientist = """
        Data Scientist with 4 years of experience.
        Built ML models, prediction systems, and NLP pipelines in Python.
        Limited dashboard and reporting exposure.
        """
        resume_unrelated = """
        Frontend engineer with 5 years of experience in React and Next.js.
        Focused on UI components and design systems.
        """

        jd_path = _write_temp_file(jd_data_analyst)
        r1 = _write_temp_file(resume_data_analyst)
        r2 = _write_temp_file(resume_data_scientist)
        r3 = _write_temp_file(resume_unrelated)
        try:
            analyst = self.service.screen(resume_path=r1, job_description_path=jd_path).overall_score
            scientist = self.service.screen(resume_path=r2, job_description_path=jd_path).overall_score
            unrelated = self.service.screen(resume_path=r3, job_description_path=jd_path).overall_score
        finally:
            for p in (jd_path, r1, r2, r3):
                try:
                    Path(p).unlink(missing_ok=True)
                except Exception:
                    pass

        self.assertGreater(analyst, scientist)
        self.assertGreater(scientist, unrelated)


if __name__ == "__main__":
    unittest.main()

