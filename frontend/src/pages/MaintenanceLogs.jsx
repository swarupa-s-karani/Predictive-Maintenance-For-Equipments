// frontend/src/pages/MaintenanceLogs.jsx
import { useEffect, useState } from 'react';
import api from '../api';

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState([]);
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/maintenance-log', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const handleConfirm = async (maintenanceId) => {
    if (!window.confirm(`Are you sure you want to mark maintenance log ${maintenanceId} as completed?`)) return;

    try {
      await api.put(`/maintenance-log/confirm/${maintenanceId}`, {}, {
        headers: { Authorization: token }
      });
      alert('Maintenance log marked as completed.');
      fetchLogs(); // refresh table
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to mark as completed.');
    }
  };

  // Helper function to get status display info
  const getStatusDisplay = (log) => {
    // Check if it's completed (either in status or completion_status)
    if (log.status === 'Completed' || log.completion_status === 'Completed') {
      return {
        text: 'Completed',
        className: 'bg-green-200 text-green-800'
      };
    } else if (log.status === 'Scheduled' || log.maintenance_type === 'Scheduled') {
      return {
        text: 'Scheduled',
        className: 'bg-blue-200 text-blue-800'
      };
    } else if (log.status === 'In Progress') {
      return {
        text: 'In Progress',
        className: 'bg-orange-200 text-orange-800'
      };
    } else {
      // Default fallback for any other status
      return {
        text: log.status || log.completion_status || 'Pending',
        className: 'bg-yellow-200 text-yellow-800'
      };
    }
  };

  return (
    <div className="p-8 min-h-screen bg-gradient-to-r from-blue-100 to-indigo-100">

      {logs.length === 0 ? (
        <p className="text-center text-gray-500">No maintenance logs found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow p-4">
          <table className="min-w-full table-auto text-left">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Equipment</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Technician</th>
                <th className="px-4 py-2">Status</th>
                {role === 'biomedical' && <th className="px-4 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => {
                const statusInfo = getStatusDisplay(log);
                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{log.maintenance_id}</td>
                    <td className="px-4 py-2">{log.equipment_id}</td>
                    <td className="px-4 py-2">{log.maintenance_type}</td>
                    <td className="px-4 py-2">{log.date}</td>
                    <td className="px-4 py-2">{log.technician_id}</td>
                    <td className="px-4 py-2">
                      <span className={`${statusInfo.className} px-2 py-1 rounded text-sm`}>
                        {statusInfo.text}
                      </span>
                    </td>
                    {role === 'biomedical' && (
                      <td className="px-4 py-2">
                        {log.status !== 'Completed' && (
                          <button
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                            onClick={() => handleConfirm(log.maintenance_id)}
                          >
                            Mark Completed
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}