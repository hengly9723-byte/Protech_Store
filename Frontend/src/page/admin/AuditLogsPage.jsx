import React, { useEffect, useState, useCallback } from "react";
import { getAuditLogsApi } from "../../services/api";
import { formatDateTime } from "../../utils/format";
import { PageHeader, TableWrap, TableHead, Spinner, EmptyState, Badge, Select, Button } from "../../components/admin/ui";

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (p = 1, entityType, action) => {
    setLoading(true);
    try {
      const res = await getAuditLogsApi({ page: p, entity_type: entityType || undefined, action: action || undefined });
      setLogs(res.data.results || []);
      setNext(res.data.next);
      setPrev(res.data.previous);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, entityType, action);
  }, [load, entityType, action]);

  const diffCell = (label, values) => (
    <div className="mb-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <pre className="text-xs bg-gray-50 rounded-lg p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(values, null, 2)}</pre>
    </div>
  );

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Immutable record of admin and system actions" />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex gap-3 flex-wrap items-center">
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="sm:w-48">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="admin_login">Admin Login</option>
        </Select>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="sm:w-52">
          <option value="">All Entity Types</option>
          <option value="order">Order</option>
          <option value="product">Product</option>
          <option value="user">User</option>
          <option value="coupon">Coupon</option>
          <option value="stock">Stock</option>
          <option value="shipment">Shipment</option>
          <option value="return">Return</option>
          <option value="review">Review</option>
        </Select>
        <p className="text-sm text-gray-500 ml-auto">
          {page > 1 ? `Page ${page} · ` : ""}{logs.length} log(s)
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading audit logs..." />
      ) : (
        <>
          <TableWrap>
            <table className="w-full min-w-[750px] text-left text-sm">
              <TableHead cols={["Date", "Action", "Entity", "Target", "User", "IP"]} />
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center">
                      <EmptyState icon="bi-journal-text" title="No logs found" subtitle="No audit logs match the current filters." />
                    </td>
                  </tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 cursor-pointer" onClick={() => setSelected(l)}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        value={l.action}
                        label={l.action}
                        map={{
                          create: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          update: "bg-sky-50 text-sky-700 border-sky-200",
                          delete: "bg-rose-50 text-rose-700 border-rose-200",
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold whitespace-nowrap">{l.entity_type}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{l.entity_id}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{l.user_email || "System"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">{l.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {(prev || next) && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="secondary" disabled={!prev} onClick={() => load(page - 1, entityType, action)}>
                <i className="bi bi-arrow-left" /> Previous
              </Button>
              <Button variant="secondary" disabled={!next} onClick={() => load(page + 1, entityType, action)}>
                Next <i className="bi bi-arrow-right" />
              </Button>
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900">Log Detail</h3>
              <button className="text-gray-400 hover:text-gray-700" onClick={() => setSelected(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><p className="text-xs text-gray-400 font-bold">Action</p><Badge value={selected.action} label={selected.action} /></div>
              <div><p className="text-xs text-gray-400 font-bold">Entity</p><p className="font-semibold text-gray-800">{selected.entity_type}</p></div>
              <div><p className="text-xs text-gray-400 font-bold">Entity ID</p><p className="font-mono text-xs text-gray-700">{selected.entity_id}</p></div>
              <div><p className="text-xs text-gray-400 font-bold">User</p><p className="text-gray-700">{selected.user_email || "System"}</p></div>
              <div><p className="text-xs text-gray-400 font-bold">IP</p><p className="font-mono text-xs text-gray-700">{selected.ip_address || "—"}</p></div>
              <div><p className="text-xs text-gray-400 font-bold">Time</p><p className="text-gray-700 text-xs">{formatDateTime(selected.created_at)}</p></div>
            </div>
            {selected.old_values && diffCell("Old Values", selected.old_values)}
            {selected.new_values && diffCell("New Values", selected.new_values)}
            {!selected.old_values && !selected.new_values && (
              <p className="text-sm text-gray-400 italic">No payload captured for this event.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;