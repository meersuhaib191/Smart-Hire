import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });

      login(res.data.user, res.data.token); // save in context + localStorage

      // Redirect user based on role
      if (res.data.user.role === "candidate") navigate("/candidate/dashboard");
      if (res.data.user.role === "recruiter") navigate("/recruiter/dashboard");
      if (res.data.user.role === "admin") navigate("/admin/dashboard");

    } catch (err) {
      setError("Login failed");
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      {error && <p className="text-red-500">{error}</p>}

      <form onSubmit={handleLogin} className="flex flex-col w-64 gap-3">
        <input
          type="email"
          placeholder="Email"
          className="border p-2"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-2"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="bg-blue-600 p-2 text-white">Login</button>
      </form>
    </div>
  );
}
