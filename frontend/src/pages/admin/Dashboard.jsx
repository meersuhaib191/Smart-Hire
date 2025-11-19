// src/pages/admin/Dashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, jobs: 0, applications: 0 });

  useEffect(() => {
    const fetch = async () => {
      try {
        const users = await api.get("/admin/users-count"); // backend should support or use /admin/users
        const jobs = await api.get("/jobs");
        const apps = await api.get("/applications");
        setStats({ users: users.data.count || users.data.length || 0, jobs: jobs.data.length, applications: apps.data.length });
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 max-w-3xl">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Users</h3>
          <p className="text-3xl font-semibold">{stats.users}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Jobs</h3>
          <p className="text-3xl font-semibold">{stats.jobs}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-sm text-gray-500">Applications</h3>
          <p className="text-3xl font-semibold">{stats.applications}</p>
        </div>
      </div>
    </div>
  );
}
