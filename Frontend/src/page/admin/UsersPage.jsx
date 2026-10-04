import React, { useEffect, useState, useCallback } from "react";
import { getAdminUsersApi, updateAdminUserApi, getAdminRolesApi } from "../../services/api";
import { formatDateTime } from "../../utils/format";
import {
  PageHeader,
  Badge,
  TableWrap,
  TableHead,
  Spinner,
  EmptyState,
  Button,
  Input,
  Select,
  Checkbox,
  Modal,
} from "../../components/admin/ui";
import UserAvatar from "../../components/UserAvatar";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, roleRes] = await Promise.all([getAdminUsersApi(), getAdminRolesApi()]);
      setUsers(userRes.data);
      setRoles(roleRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const open = (u) =>
    setModal({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role || "user",
      role_ids: (u.roles || []).map((r) => r.id),
      is_staff: Boolean(u.is_staff),
      is_superuser: Boolean(u.is_superuser),
      is_active: Boolean(u.is_active),
      is_email_verified: Boolean(u.is_email_verified),
    });

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminUserApi(modal.id, {
        role: modal.role,
        role_ids: modal.role_ids,
        is_staff: modal.is_staff,
        is_superuser: modal.is_superuser,
        is_active: modal.is_active,
        is_email_verified: modal.is_email_verified,
      });
      setModal(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || Object.values(err.response?.data || {}).flat().join(", ") || "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleId = (list, id) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div>
      <PageHeader title="Users" subtitle="View customers and manage their roles & access" />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6">
        <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <Spinner label="Loading users..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[900px] text-left text-sm">
            <TableHead cols={["User", "Role", "Staff", "Super", "Status", "Joined", "Actions"]} />
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center">
                    <EmptyState icon="bi-people" title="No users found" />
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={u.avatar_url}
                        name={u.full_name}
                        email={u.email}
                        size="w-9 h-9"
                      />
                      <div>
                        <p className="font-bold text-gray-900">{u.full_name || "—"}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                          u.role === "admin" || u.is_superuser
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : u.role === "staff" || u.is_staff
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        {u.role || "user"}
                      </span>
                      {(u.roles || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.is_staff ? (
                      <i className="bi bi-check-circle-fill text-emerald-500 text-base" />
                    ) : (
                      <i className="bi bi-dash text-gray-300 text-lg" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.is_superuser ? (
                      <i className="bi bi-shield-fill-check text-indigo-500 text-base" />
                    ) : (
                      <i className="bi bi-dash text-gray-300 text-lg" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      value={u.is_active ? "active" : "suspended"}
                      label={u.is_active ? "Active" : "Suspended"}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDateTime(u.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button variant="ghost" onClick={() => open(u)}>
                      <i className="bi bi-sliders2" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={`Manage Roles & Access — ${modal?.email || ""}`}>
        {modal && (
          <div className="space-y-4">
            <Select
              label="Primary Role"
              value={modal.role}
              onChange={(e) => setModal({ ...modal, role: e.target.value })}
            >
              <option value="user">User (Customer)</option>
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
              <option value="moderator">Moderator</option>
            </Select>

            {roles.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Role Groups</p>
                <div className="space-y-1.5">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800 capitalize">{r.name}</p>
                        {r.description && <p className="text-xs text-gray-400">{r.description}</p>}
                      </div>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-sky-600 rounded"
                        checked={modal.role_ids.includes(r.id)}
                        onChange={() => setModal({ ...modal, role_ids: toggleId(modal.role_ids, r.id) })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                System Access & Permissions
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Checkbox
                  label="Staff Access"
                  checked={modal.is_staff}
                  onChange={(e) => setModal({ ...modal, is_staff: e.target.checked })}
                />
                <Checkbox
                  label="Superuser"
                  checked={modal.is_superuser}
                  onChange={(e) => setModal({ ...modal, is_superuser: e.target.checked })}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Account Status
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Checkbox
                  label="Account Active"
                  checked={modal.is_active}
                  onChange={(e) => setModal({ ...modal, is_active: e.target.checked })}
                />
                <Checkbox
                  label="Email Verified"
                  checked={modal.is_email_verified}
                  onChange={(e) => setModal({ ...modal, is_email_verified: e.target.checked })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;