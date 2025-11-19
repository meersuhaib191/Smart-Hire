// src/pages/candidate/MyApplications.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function MyApplications() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/applications/mine");
        setApplications(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Applications</h1>

      <div className="grid gap-4">
        {applications.map((a) => (
          <div key={a.id} className="p-4 bg-white rounded shadow flex justify-between">
            <div>
              <h3 className="font-semibold">{a.job_title}</h3>
              <p className="text-sm text-gray-500">{a.company}</p>
              <p className="text-sm mt-2">Applied on: {new Date(a.created_at).toLocaleString()}</p>
            </div>

            <div className="text-right">
              <p className={`px-3 py-1 rounded ${a.status === "accepted" ? "bg-green-100" : a.status === "rejected" ? "bg-red-100" : "bg-yellow-100"}`}>
                {a.status}
              </p>
              <a href={a.resume_url} target="_blank" rel="noreferrer" className="block mt-2 text-blue-600">
                View resume
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
