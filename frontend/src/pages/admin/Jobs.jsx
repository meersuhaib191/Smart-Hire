// src/pages/admin/Jobs.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      const res = await api.get("/jobs");
      setJobs(res.data);
    };
    fetch();
  }, []);

  const remove = async (id) => {
    if (!confirm("Delete job?")) return;
    try {
      await api.delete(`/jobs/${id}`);
      setJobs((j) => j.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Jobs</h1>

      <div className="grid gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="p-4 bg-white rounded shadow flex justify-between">
            <div>
              <h3 className="font-semibold">{job.title}</h3>
              <p className="text-sm text-gray-500">{job.company}</p>
            </div>
            <div>
              <button onClick={() => remove(job.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
