// src/components/ApplicationCard.jsx
import React from "react";

export default function ApplicationCard({ app, onChangeStatus }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-md flex justify-between items-start gap-4">
      <div>
        <h4 className="font-semibold">{app.candidate_name || app.candidate_email}</h4>
        <p className="text-sm text-gray-600">Job: {app.job_title}</p>
        <p className="mt-2 text-gray-700">{app.cover_letter}</p>
      </div>

      <div className="flex flex-col items-end gap-3">
        <a
          href={`http://localhost:5000/uploads/${app.resume_url}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 underline"
        >
          View Resume
        </a>

        <select
          value={app.status}
          onChange={(e) => onChangeStatus(app.id, e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="applied">Applied</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="rejected">Rejected</option>
          <option value="hired">Hired</option>
        </select>
      </div>
    </div>
  );
}
