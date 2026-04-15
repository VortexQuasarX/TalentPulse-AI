"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  super_admin: { label: "Super Admin", bg: "bg-red-100", text: "text-red-700" },
  accounts: { label: "Accounts", bg: "bg-purple-100", text: "text-purple-700" },
  admin: { label: "HR", bg: "bg-blue-100", text: "text-blue-700" },
  candidate: { label: "Candidate", bg: "bg-green-100", text: "text-green-700" },
  employee: { label: "Employee", bg: "bg-teal-100", text: "text-teal-700" },
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchUsers = () => {
    api.get("/auth/users").then(setUsers).catch(() => []).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    try {
      await api.post("/auth/create-user", { name, email, password, role });
      setMsg(`${role} account created for ${email}`);
      setName(""); setEmail(""); setPassword("");
      setShowCreate(false);
      fetchUsers();
    } catch (err: any) { setMsg(err.message); }
    finally { setCreating(false); }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!confirm(`Change this user's role to ${newRole}?`)) return;
    try {
      await api.put(`/auth/users/${userId}/role?role=${newRole}`);
      fetchUsers();
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (!confirm(`Delete ${userName}? This cannot be undone.`)) return;
    try {
      await api.del(`/auth/users/${userId}`);
      fetchUsers();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500">Create and manage staff accounts (HR, Accounts)</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
          {showCreate ? "Cancel" : "+ Create Staff Account"}
        </button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">{msg}</div>}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-base font-semibold mb-4">Create New Account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
                <option value="admin">HR Admin</option>
                <option value="accounts">Accounts</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={creating}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {creating ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Created</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></td></tr>
            ) : users.map(u => {
              const rc = ROLE_CONFIG[u.role] || { label: u.role, bg: "bg-gray-100", text: "text-gray-600" };
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-5 py-3 text-gray-400">{u.id}</td>
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rc.bg} ${rc.text}`}>{rc.label}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <select defaultValue="" onChange={e => { if (e.target.value) handleChangeRole(u.id, e.target.value); e.target.value = ""; }}
                        className="text-xs border rounded px-2 py-1 text-gray-500">
                        <option value="" disabled>Change role</option>
                        <option value="candidate">Candidate</option>
                        <option value="admin">HR Admin</option>
                        <option value="accounts">Accounts</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="employee">Employee</option>
                      </select>
                      <button onClick={() => handleDelete(u.id, u.name)}
                        className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
