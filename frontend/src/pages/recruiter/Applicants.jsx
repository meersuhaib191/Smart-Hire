// src/pages/recruiter/Applicants.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { useParams } from "react-router-dom";

export default function Applicants() {
  const { jobId } = useParams();
  const [applicants, setApplicants] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/applications/job/${jobId}`);
        setApplicants(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, [jobId]);

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/applications/status/${id}`, { status });
      setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Applicants</h1>

      <div className="grid gap-4">
        {applicants.map((a) => (
          <div key={a.id} className="p-4 bg-white rounded shadow flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{a.candidate_name}</h3>
              <p className="text-sm text-gray-500">{a.candidate_email}</p>
              <p className="text-sm mt-1">{a.cover_letter}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <a href={a.resume_url} target="_blank" rel="noreferrer" className="text-blue-600">Resume</a>
              <div className="flex gap-2">
                <button onClick={() => changeStatus(a.id, "accepted")} className="px-3 py-1 bg-green-500 text-white rounded">Accept</button>
                <button onClick={() => changeStatus(a.id, "rejected")} className="px-3 py-1 bg-red-500 text-white rounded">Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
