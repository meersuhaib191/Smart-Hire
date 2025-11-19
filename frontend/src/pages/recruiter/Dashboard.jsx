// src/pages/recruiter/Dashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ posted: 0, applicants: 0 });

  useEffect(() => {
    const fetch = async () => {
      try {
        const resJobs = await api.get("/jobs/recruiter"); // backend route returning recruiter jobs
        let totalApplicants = 0;
        for (const j of resJobs.data) {
          const a = await api.get(`/applications/job/${j.id}`);
          totalApplicants += a.data.length;
        }
        setStats({ posted: resJobs.data.length, applicants: totalApplicants });
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Recruiter Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Jobs you posted</h3>
          <p className="text-3xl font-semibold">{stats.posted}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Total applicants</h3>
          <p className="text-3xl font-semibold">{stats.applicants}</p>
        </div>
      </div>
    </div>
  );
}
