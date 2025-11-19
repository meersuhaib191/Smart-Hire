// src/pages/candidate/Apply.jsx
import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Apply() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [resume, setResume] = useState(null);
  const [cover, setCover] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch job info when component loads
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/jobs/${jobId}`);
        setJob(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, [jobId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resume) return alert("Please upload your resume");

    const formData = new FormData();
    formData.append("job_id", jobId);
    formData.append("candidate_id", user.id);  // IMPORTANT
    formData.append("resume", resume);
    formData.append("cover_letter", cover);

    setLoading(true);
    try {
      await api.post("/applications/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Application submitted successfully!");
      navigate("/candidate/applications");
    } catch (err) {
      console.error(err);
      alert("Failed to apply. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Apply to Job</h1>

      <div className="max-w-2xl bg-white p-6 rounded shadow">
        {/* Job Info */}
        <h2 className="text-xl font-semibold">
          {job?.title || "Loading..."}
        </h2>

        <p className="text-gray-500 text-sm mb-4">
          {job?.company || ""}
        </p>

        {/* Apply Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Resume Upload */}
          <label className="flex flex-col text-sm font-medium">
            Resume (PDF / DOC / DOCX)
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files[0])}
              required
              className="mt-2 border p-2"
            />
          </label>

          {/* Cover Letter */}
          <label className="flex flex-col text-sm font-medium">
            Cover Letter
            <textarea
              className="border p-2 mt-2 h-32"
              value={cover}
              placeholder="Write a short cover letter..."
              onChange={(e) => setCover(e.target.value)}
            />
          </label>

          <button
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {loading ? "Applying..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
