// src/pages/candidate/Jobs.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import { shortText } from "../../utils/format";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/jobs");
        setJobs(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="p-6">Loading jobs...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Jobs</h1>
      <div className="grid gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="p-4 bg-white rounded shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">{job.title}</h3>
                <p className="text-sm text-gray-500">{job.company || "Company"}</p>
                <p className="mt-2">{shortText(job.description)}</p>
              </div>
              <div className="text-right">
                <Link
                  to={`/candidate/apply/${job.id}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Apply
                </Link>
                <p className="text-sm text-gray-500 mt-2">{job.location || "Remote"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
