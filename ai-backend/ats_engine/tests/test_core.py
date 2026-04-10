from __future__ import annotations

import unittest

from ats_engine.evaluation.metrics import evaluate_ranking
from ats_engine.models.schemas import EvaluationItem, ParsedResume
from ats_engine.embedding.embedder import Embedder
from ats_engine.parser.job_parser import parse_job_text
from ats_engine.parser.resume_parser import parse_resume_text
from ats_engine.ranking.ranker import AtsRanker
from ats_engine.scoring.feature_engineering import compute_features
from ats_engine.scoring.scorer import AtsScorer


class AtsCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.embedder = Embedder()
        self.scorer = AtsScorer()
        self.ranker = AtsRanker(self.scorer, self.embedder)

    def test_data_role_scoring(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Data analyst profile.
            SKILLS
            Python, SQL, Tableau, pandas, reporting
            EXPERIENCE
            3 years of experience in analytics.
            """
        )
        job = parse_job_text(
            "Data Analyst. Required: SQL, Tableau, reporting. Preferred: Python. 2 years experience."
        )
        features, matched, missing = compute_features(resume, job, self.embedder)
        scored = self.scorer.score(features, matched, missing)
        self.assertGreater(scored.score, 0.5)
        self.assertIn("sql", scored.matched_skills)
        self.assertTrue(len(scored.missing_skills) <= 2)

    def test_non_tech_role_scoring(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Marketing specialist profile.
            SKILLS
            SEO, campaign, content, google analytics, reporting
            EXPERIENCE
            2 years of experience in campaign management.
            """
        )
        job = parse_job_text(
            "Marketing Specialist role. Required: SEO, campaign, analytics, content. Preferred: growth."
        )
        features, matched, missing = compute_features(resume, job, self.embedder)
        scored = self.scorer.score(features, matched, missing)
        self.assertGreater(scored.features.skill_overlap, 0.5)
        self.assertGreater(scored.score, 0.4)

    def test_edge_case_no_skill_overlap(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Frontend engineer profile.
            SKILLS
            React, TypeScript
            """
        )
        job = parse_job_text("Finance Analyst role. Required accounting, budget, forecasting, financial reporting.")
        features, matched, missing = compute_features(resume, job, self.embedder)
        scored = self.scorer.score(features, matched, missing)
        self.assertEqual(len(matched), 0)
        self.assertEqual(scored.features.skill_overlap, 0.0)
        self.assertGreaterEqual(scored.score, 0.0)

    def test_skill_normalization_for_matching(self) -> None:
        resume = ParsedResume(
            skills=["mysql", "scikit learn"],
            experience_years=2.0,
            projects=[],
            internships=[],
            work_experiences=["Data Engineer at ACME"],
            education=[],
            text="Profile with MySQL and scikit learn experience.",
        )
        job = parse_job_text(
            "Data Scientist role. Required SQL, scikit-learn and 2 years experience."
        )
        features, matched, missing = compute_features(resume, job, self.embedder)
        self.assertEqual(features.skill_overlap, 1.0)
        self.assertIn("sql", matched)
        self.assertIn("scikit-learn", matched)
        self.assertEqual(missing, [])

    def test_skill_overlap_soft_cap_for_long_required_lists(self) -> None:
        resume = ParsedResume(
            skills=[
                "python",
                "sql",
                "pandas",
                "numpy",
                "scikit-learn",
                "machine learning",
                "statistics",
                "feature engineering",
                "model evaluation",
            ],
            experience_years=4.0,
            projects=[],
            internships=[],
            work_experiences=["Data Scientist at ACME"],
            education=[],
            text="Experienced data scientist with end-to-end ML lifecycle work.",
        )
        job = parse_job_text(
            "Data Scientist role. Required skills: Python, SQL, pandas, NumPy, scikit-learn, "
            "machine learning, statistics, feature engineering, model evaluation. 3 years experience."
        )
        features, matched, missing = compute_features(resume, job, self.embedder)
        self.assertEqual(len(missing), 0)
        self.assertEqual(len(matched), 9)
        self.assertAlmostEqual(features.skill_overlap, 0.92, delta=0.001)

    def test_project_context_infers_implicit_skills(self) -> None:
        resume = ParsedResume(
            skills=["python", "sql"],
            experience_years=2.0,
            projects=["Student Performance Prediction"],
            project_descriptions=[
                "Developed regression and classification models using scikit-learn and matplotlib for prediction."
            ],
            internships=[],
            work_experiences=["Data Analyst at ACME"],
            education=[],
            text="Built ML projects with model validation and visual output.",
        )
        job = parse_job_text(
            "Data Scientist role. Required skills: Python, SQL, machine learning, model evaluation, data visualization."
        )
        features, matched, missing = compute_features(resume, job, self.embedder)
        self.assertEqual(features.skill_overlap, 1.0)
        for s in ("machine learning", "model evaluation", "data visualization"):
            self.assertIn(s, matched, msg=f"expected inferred skill {s}")
        self.assertEqual(missing, [])

    def test_rank_is_deterministic(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Backend engineer profile.
            SKILLS
            Python, FastAPI, PostgreSQL, Docker
            EXPERIENCE
            5 years of experience in backend systems.
            """
        )
        jobs = [
            parse_job_text("Backend Engineer required Python FastAPI PostgreSQL Docker"),
            parse_job_text("Data Analyst required SQL Tableau reporting"),
        ]
        ranked_a = self.ranker.rank_jobs(resume, jobs)
        ranked_b = self.ranker.rank_jobs(resume, jobs)
        self.assertEqual([x.rank for x in ranked_a], [x.rank for x in ranked_b])
        self.assertEqual([x.score for x in ranked_a], [x.score for x in ranked_b])

    def test_experience_logic_candidate_zero(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Student profile.
            SKILLS
            SQL, Tableau
            PROJECTS
            Dashboard project - Built KPI dashboard
            """
        )
        job = parse_job_text("Data Analyst role. Required SQL, Tableau and 3 years experience.")
        features, _, _ = compute_features(resume, job, self.embedder)
        self.assertAlmostEqual(features.experience_score, 0.3, delta=0.01)

    def test_confidence_is_exposed(self) -> None:
        resume = parse_resume_text(
            """
            SUMMARY
            Backend engineer profile.
            SKILLS
            Python, FastAPI, PostgreSQL, Docker
            EXPERIENCE
            5 years of experience in backend systems.
            """
        )
        job = parse_job_text("Backend Engineer role. Required Python, FastAPI, PostgreSQL, Docker, 3 years experience.")
        features, matched, missing = compute_features(resume, job, self.embedder)
        scored = self.scorer.score(features, matched, missing)
        self.assertGreaterEqual(scored.confidence, 0.0)
        self.assertLessEqual(scored.confidence, 1.0)
        self.assertGreaterEqual(scored.consistency_score, 0.0)
        self.assertLessEqual(scored.consistency_score, 1.0)

    def test_evaluation_metrics(self) -> None:
        samples = [
            EvaluationItem(
                resume_text="""
                SUMMARY
                Data analyst profile.
                SKILLS
                SQL, Tableau, reporting
                EXPERIENCE
                3 years of experience in analytics.
                """,
                jobs=[
                    "Data Analyst role. Required SQL, Tableau, reporting, 2 years experience.",
                    "Frontend Engineer role. Required React and TypeScript.",
                ],
                true_role="data analyst",
            )
        ]
        metrics = evaluate_ranking(samples, self.ranker)
        self.assertGreaterEqual(metrics.top1_accuracy, 0.0)
        self.assertLessEqual(metrics.top1_accuracy, 1.0)

    def test_strict_experience_only_from_experience_section(self) -> None:
        parsed = parse_resume_text(
            """
            SUMMARY
            Student with 4-year degree and several projects.
            SKILLS
            Python, SQL
            PROJECTS
            Sales Analytics Dashboard - Built using SQL and Python
            EDUCATION
            Bachelor of Technology from ABC University
            """
        )
        self.assertEqual(parsed.experience_years, 0.0)

    def test_projects_only_from_projects_section(self) -> None:
        parsed = parse_resume_text(
            """
            SUMMARY
            Built many tools.
            SKILLS
            Python, SQL
            PROJECTS
            Fraud Detection System - Deployed model
            Customer Segmentation - Analytics pipeline
            EXPERIENCE
            Data Analyst at ACME Corp
            """
        )
        self.assertIn("Fraud Detection System", parsed.projects)
        self.assertIn("Customer Segmentation", parsed.projects)

    def test_project_titles_filter_out_descriptions(self) -> None:
        parsed = parse_resume_text(
            """
            PROJECTS
            Hostel Ease - Web Application
            Developed a responsive web platform for hostel allocation.
            Library Management System: Full stack project
            Built a dynamic PHP application with MySQL.
            """
        )
        self.assertIn("Hostel Ease", parsed.projects)
        self.assertIn("Library Management System", parsed.projects)
        self.assertIn("Developed a responsive web platform for hostel allocation.", parsed.project_descriptions)
        self.assertNotIn("Developed a responsive web platform for hostel allocation.", parsed.projects)
        self.assertNotIn("Built a dynamic PHP application with MySQL.", parsed.projects)


if __name__ == "__main__":
    unittest.main()

