// src/pages/BiomedicalLogs.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function BiomedicalLogs() {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get("/maintenance-log", {
          headers: { Authorization: token },
        });
        setLogs(res.data.logs);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    };

    fetchLogs();
  }, []);

  const confirmCompletion = async (id) => {
    try {
      const res = await api.put(`/maintenance-log/confirm/${id}`, null, {
        headers: { Authorization: token },
      });
      setMessage(res.data.message);
      // Update UI
      setLogs((prev) =>
        prev.map((log) =>
          log.maintenance_id === id
            ? { ...log, status: "Completed", completion_status: "Confirmed" }
            : log
        )
      );
    } catch (err) {
      console.error("Confirmation failed:", err);
      setMessage("Failed to confirm status.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🛠️ Maintenance Logs</h2>
      {message && <p className="mb-2 text-green-600">{message}</p>}
      <table className="min-w-full table-auto border border-gray-300 bg-white shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Equipment</th>
            <th className="border px-4 py-2">Status</th>
            <th className="border px-4 py-2">Completion</th>
            <th className="border px-4 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.maintenance_id}>
              <td className="border px-4 py-2">{log.maintenance_id}</td>
              <td className="border px-4 py-2">{log.equipment_id}</td>
              <td className="border px-4 py-2">{log.status}</td>
              <td className="border px-4 py-2">{log.completion_status}</td>
              <td className="border px-4 py-2">
                {log.status !== "Completed" && (
                  <button
                    onClick={() => confirmCompletion(log.maintenance_id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
