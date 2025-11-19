// src/pages/candidate/Apply.jsx
import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { useParams, useNavigate } from "react-router-dom";

export default function Apply() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [resume, setResume] = useState(null);
  const [cover, setCover] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (!resume) return alert("Please upload resume");

    const formData = new FormData();
    formData.append("job_id", jobId);
    formData.append("resume", resume);
    formData.append("cover_letter", cover);

    setLoading(true);
    try {
      const res = await api.post("/applications/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Applied successfully");
      navigate("/candidate/applications");
    } catch (err) {
      console.error(err);
      alert("Apply failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Apply to Job</h1>
      <div className="max-w-2xl bg-white p-6 rounded shadow">
        <h2 className="text-xl">{job?.title || "Loading..."}</h2>
        <p className="text-sm text-gray-500 mb-4">{job?.company}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col">
            Resume (PDF/DOC)
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files[0])}
              className="mt-2"
            />
          </label>

          <label className="flex flex-col">
            Cover Letter
            <textarea
              className="border p-2 mt-2"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
          </label>

          <button disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
            {loading ? "Applying..." : "Apply"}
          </button>
        </form>
      </div>
    </div>
  );
}
