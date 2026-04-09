from __future__ import annotations

import unittest

from resume_screening.engine.ranking_engine import AtsRankingEngine, JobInput


class AtsEngineV2Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = AtsRankingEngine()

    def test_data_roles_rank_above_dev_for_data_resume(self) -> None:
        resume = """
        Data analyst with 3 years of experience in SQL, pandas, numpy, Tableau,
        KPI dashboards, reporting and analytics projects.
        """
        jobs = [
            JobInput(
                title="Data Analyst",
                description="Required SQL, Tableau, dashboarding, KPI reporting, 2 years experience.",
            ),
            JobInput(
                title="Data Scientist",
                description="Required Python, machine learning, model evaluation, statistics, 2 years experience.",
            ),
            JobInput(
                title="Frontend Engineer",
                description="Required React, TypeScript, Next.js and UI engineering experience.",
            ),
        ]
        ranked = self.engine.rank_many(resume, jobs)
        self.assertEqual(ranked[0].job_title, "Data Analyst")
        self.assertGreater(ranked[0].overall_score, ranked[-1].overall_score)

    def test_no_skill_edge_case_hard_penalty(self) -> None:
        resume = "Business operations intern with communication skills only."
        job = JobInput(
            title="Backend Engineer",
            description="Required Python, FastAPI, PostgreSQL, Docker.",
        )
        scored = self.engine.score_one(resume, job)
        self.assertEqual(scored.skill_score, 0.0)
        self.assertLess(scored.overall_score, 50.0)

    def test_fresher_vs_experienced(self) -> None:
        job = JobInput(
            title="Data Scientist",
            description="Required Python, machine learning, SQL, 4 years of experience.",
        )
        fresher_resume = "Final year student with ML projects, Python and SQL."
        experienced_resume = "Data scientist with 6 years of experience, ML in production, Python and SQL."
        fresher = self.engine.score_one(fresher_resume, job)
        experienced = self.engine.score_one(experienced_resume, job)
        self.assertLess(fresher.experience_score, experienced.experience_score)
        self.assertLess(fresher.overall_score, experienced.overall_score)

    def test_ml_engineer_without_production_not_overranked(self) -> None:
        resume = "ML engineer with projects in notebooks, no deployment, no production system work."
        job = JobInput(
            title="ML Engineer",
            description="Required machine learning, model serving, production monitoring, Python, 3 years.",
        )
        scored = self.engine.score_one(resume, job)
        self.assertLess(scored.experience_score, 90.0)
        self.assertLessEqual(scored.overall_score, 95.0)

    def test_non_tech_marketing_vs_finance_domain(self) -> None:
        resume = """
        Marketing specialist with campaign management, SEO, growth analytics and content strategy experience.
        Managed performance campaigns and analytics reporting.
        """
        jobs = [
            JobInput(
                title="Marketing Specialist",
                description="Required SEO, campaign execution, analytics and content strategy.",
            ),
            JobInput(
                title="Finance Analyst",
                description="Required accounting, budgeting, financial forecasting and Excel reporting.",
            ),
        ]
        ranked = self.engine.rank_many(resume, jobs)
        self.assertEqual(ranked[0].job_title, "Marketing Specialist")
        self.assertGreater(ranked[0].domain_score, ranked[1].domain_score)

    def test_hr_role_support(self) -> None:
        resume = "HR recruiter with recruitment, onboarding, interview coordination and talent sourcing."
        job = JobInput(
            title="HR Manager",
            description="Required recruitment, onboarding, talent management, interviewing and stakeholder communication.",
        )
        scored = self.engine.score_one(resume, job)
        self.assertGreaterEqual(scored.role_specific_score, 60.0)
        self.assertTrue(len(scored.strengths) > 0)

    def test_missing_two_critical_skills_strict_filter(self) -> None:
        resume = "Python developer with only basic scripts."
        job = JobInput(
            title="Data Analyst",
            description="Required SQL, Tableau, dashboarding, KPI reporting, stakeholder management.",
        )
        scored = self.engine.score_one(resume, job)
        # strict filter should suppress final score
        self.assertLess(scored.overall_score, 70.0)


if __name__ == "__main__":
    unittest.main()

