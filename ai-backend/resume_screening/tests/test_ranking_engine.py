from __future__ import annotations

import tempfile
import unittest
import os
from pathlib import Path

from resume_screening.scoring import compute_experience_score
from resume_screening.service import ResumeScreeningService
from resume_screening.skills import compute_skill_score


def _write_temp_file(text: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".txt")
    os.close(fd)
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
        exp = compute_experience_score(resume, jd, role="data analyst")
        self.assertAlmostEqual(exp.score, 60.0, delta=0.5)

    def test_no_100_when_required_skill_missing(self) -> None:
        jd = "Required: Python, SQL, Tableau. Must have Tableau."
        resume = "8 years experience. Python and SQL expert."
        jd_path = _write_temp_file(jd)
        resume_path = _write_temp_file(resume)
        try:
            result = self.service.screen(resume_path=resume_path, job_description_path=jd_path)
        finally:
            Path(jd_path).unlink(missing_ok=True)
            Path(resume_path).unlink(missing_ok=True)
        self.assertLess(result.skill_score, 100.0)
        self.assertLess(result.overall_score, 100.0)

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

    def test_business_analyst_fresher_penalized(self) -> None:
        jd = """
        Hiring Business Analyst.
        Required: stakeholder management, requirements gathering, SQL.
        Minimum 2 years of experience.
        """
        resume = """
        Final year student. Completed business analysis projects and documentation.
        Basic SQL knowledge from coursework.
        """
        jd_path = _write_temp_file(jd)
        resume_path = _write_temp_file(resume)
        try:
            result = self.service.screen(resume_path=resume_path, job_description_path=jd_path)
        finally:
            Path(jd_path).unlink(missing_ok=True)
            Path(resume_path).unlink(missing_ok=True)
        self.assertLess(result.experience_score, 50.0)
        self.assertLessEqual(result.overall_score, 65.0)

    def test_domain_mismatch_reduces_semantic_and_final(self) -> None:
        jd = """
        Data Analyst role requiring SQL, KPI dashboards, reporting and Tableau.
        Minimum 3 years of experience.
        """
        resume = """
        Backend engineer with 5 years experience in FastAPI, distributed systems,
        Docker, microservices, and API observability.
        """
        jd_path = _write_temp_file(jd)
        resume_path = _write_temp_file(resume)
        try:
            result = self.service.screen(resume_path=resume_path, job_description_path=jd_path)
        finally:
            Path(jd_path).unlink(missing_ok=True)
            Path(resume_path).unlink(missing_ok=True)
        self.assertFalse(result.domain_match)
        self.assertLess(result.overall_score, 60.0)


if __name__ == "__main__":
    unittest.main()

