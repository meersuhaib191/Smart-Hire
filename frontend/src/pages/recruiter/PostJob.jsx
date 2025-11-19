// src/pages/recruiter/PostJob.jsx
import React, { useState } from "react";
import api from "../../api/axios";
import { useNavigate } from "react-router-dom";

export default function PostJob() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    salary: "",
    experience: "",
  });
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/jobs/post", form);
      alert("Job posted");
      navigate("/recruiter/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Post a Job</h1>

      <form className="max-w-2xl bg-white p-6 rounded shadow" onSubmit={submit}>
        <input name="title" onChange={handle} placeholder="Job title" className="w-full border p-2 mb-3" />
        <textarea name="description" onChange={handle} placeholder="Job description" className="w-full border p-2 mb-3" />
        <input name="location" onChange={handle} placeholder="Location" className="w-full border p-2 mb-3" />
        <input name="salary" onChange={handle} placeholder="Salary" className="w-full border p-2 mb-3" />
        <input name="experience" onChange={handle} placeholder="Experience (years)" className="w-full border p-2 mb-3" />

        <button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? "Posting..." : "Post Job"}
        </button>
      </form>
    </div>
  );
}
