// src/components/Navbar.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="p-4 bg-gray-800 text-white flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-bold text-xl">SmartHire</Link>
        <Link to="/" className="text-sm">Home</Link>
        {user?.role === "candidate" && <Link to="/candidate/jobs" className="text-sm">Jobs</Link>}
        {user?.role === "recruiter" && <Link to="/recruiter/post-job" className="text-sm">Post Job</Link>}
        {user?.role === "admin" && <Link to="/admin/users" className="text-sm">Admin</Link>}
      </div>

      <div className="flex items-center gap-4">
        {!user ? (
          <>
            <Link to="/login" className="text-sm">Login</Link>
            <Link to="/register" className="text-sm">Register</Link>
          </>
        ) : (
          <>
            <span className="text-sm">{user.name} ({user.role})</span>
            <button onClick={logout} className="bg-red-500 px-3 py-1 rounded text-white">Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
