// src/components/JobCard.jsx
import React from "react";

export default function JobCard({ job, onApply }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <h3 className="text-xl font-semibold">{job.title}</h3>
        <p className="text-sm text-gray-600 mt-1">{job.location || "Remote"}</p>
        <p className="mt-3 text-gray-700 line-clamp-3">{job.description}</p>
      </div>

      <div className="flex flex-col justify-between items-end">
        <div className="text-right">
          {job.salary && <div className="text-sm text-gray-500">Salary: {job.salary}</div>}
          <div className="text-xs text-gray-400 mt-1">Posted by: {job.posted_by_name || "N/A"}</div>
        </div>

        <div className="mt-3">
          <button
            onClick={() => onApply && onApply(job)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
