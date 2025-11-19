// src/pages/admin/Users.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    };
    fetch();
  }, []);

  const changeRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));
    } catch (err) {
      console.error(err);
      alert("Failed to update role");
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("Delete user?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((u) => u.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>

      <div className="grid gap-4">
        {users.map((u) => (
          <div key={u.id} className="p-4 bg-white rounded shadow flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{u.name}</h3>
              <p className="text-sm text-gray-500">{u.email}</p>
            </div>
            <div className="flex gap-2 items-center">
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border p-1">
                <option value="candidate">candidate</option>
                <option value="recruiter">recruiter</option>
                <option value="admin">admin</option>
              </select>
              <button onClick={() => deleteUser(u.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
