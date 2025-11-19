// src/pages/candidate/Dashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalJobs: 0, myApplications: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resJobs = await api.get("/jobs");
        const resApps = await api.get("/applications/mine");
        setStats({ totalJobs: resJobs.data.length, myApplications: resApps.data.length });
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome, {user?.name}</h1>
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Available Jobs</h3>
          <p className="text-3xl font-semibold">{stats.totalJobs}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Your Applications</h3>
          <p className="text-3xl font-semibold">{stats.myApplications}</p>
        </div>
      </div>
    </div>
  );
}
