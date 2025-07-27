// frontend/src/pages/MaintenanceLogs.jsx
import { useEffect, useState } from 'react';
import api from '../api';

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState([]);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: '' });
    }, 4000);
  };

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
      showAlert('Failed to fetch maintenance logs', 'error');
    }
  };

  const handleConfirm = async (maintenanceId) => {
    try {
      await api.put(`/maintenance-log/confirm/${maintenanceId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('Maintenance log marked as completed successfully', 'success');
      fetchLogs(); // refresh table
    } catch (err) {
      console.error('Failed to update status:', err);
      showAlert('Failed to mark as completed', 'error');
    }
  };

  // Helper function to get status display info
  const getStatusDisplay = (log) => {
    if (log.status === 'Completed' || log.completion_status === 'Completed') {
      return {
        text: 'Completed',
        className: 'bg-green-100 text-green-800 border border-green-200'
      };
    } else if (log.status === 'Scheduled' || log.maintenance_type === 'Scheduled') {
      return {
        text: 'Scheduled',
        className: 'bg-blue-100 text-blue-800 border border-blue-200'
      };
    } else if (log.status === 'In Progress') {
      return {
        text: 'In Progress',
        className: 'bg-orange-100 text-orange-800 border border-orange-200'
      };
    } else {
      return {
        text: log.status || log.completion_status || 'Pending',
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      };
    }
  };

  const getMaintenanceTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'preventive':
        return 'text-blue-600';
      case 'corrective':
        return 'text-red-600';
      case 'calibration':
        return 'text-purple-600';
      case 'inspection':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Component */}
      {alert.show && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl max-w-md border-l-4 backdrop-blur-sm ${
          alert.type === 'success' ? 'bg-green-50/95 border-green-500 text-green-800' :
          alert.type === 'warning' ? 'bg-yellow-50/95 border-yellow-500 text-yellow-800' :
          alert.type === 'error' ? 'bg-red-50/95 border-red-500 text-red-800' :
          'bg-blue-50/95 border-blue-500 text-blue-800'
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex">
              <div className="flex-shrink-0 mr-3">
                {alert.type === 'success' && <span className="text-green-500 text-lg">✓</span>}
                {alert.type === 'warning' && <span className="text-yellow-500 text-lg">!</span>}
                {alert.type === 'error' && <span className="text-red-500 text-lg">✗</span>}
                {alert.type === 'info' && <span className="text-blue-500 text-lg">i</span>}
              </div>
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
            <button
              onClick={() => setAlert({ show: false, message: '', type: '' })}
              className="ml-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Maintenance Logs Found</h3>
          <p className="text-gray-500">There are no maintenance records to display at this time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
            <div className={`grid ${role === 'biomedical' ? 'grid-cols-7' : 'grid-cols-6'} gap-6 text-sm font-semibold text-gray-700 uppercase tracking-wider`}>
              <div className="text-center">Maintenance ID</div>
              <div className="text-center">Equipment</div>
              <div className="text-center">Type</div>
              <div className="text-center">Date</div>
              <div className="text-center">Technician</div>
              <div className="text-center">Status</div>
              {role === 'biomedical' && <div className="text-center">Actions</div>}
            </div>
          </div>

          {/* Table Body - Clean List */}
          <div className="divide-y divide-gray-100">
            {logs.map((log, index) => {
              const statusInfo = getStatusDisplay(log);
              return (
                <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                  <div className={`grid ${role === 'biomedical' ? 'grid-cols-7' : 'grid-cols-6'} gap-6 items-center`}>
                    {/* Maintenance ID */}
                    <div className="font-semibold text-gray-800 text-center">
                      {log.maintenance_id}
                    </div>

                    {/* Equipment */}
                    <div className="font-medium text-gray-700 text-center">
                      {log.equipment_id}
                    </div>

                    {/* Type */}
                    <div className={`font-medium capitalize text-center ${getMaintenanceTypeColor(log.maintenance_type)}`}>
                      {log.maintenance_type}
                    </div>

                    {/* Date */}
                    <div className="text-gray-700 text-center">
                      {log.date}
                    </div>

                    {/* Technician */}
                    <div className="text-gray-700 text-center">
                      {log.technician_id}
                    </div>

                    {/* Status */}
                    <div className="text-center">
                      <span className={`${statusInfo.className} px-3 py-1 rounded-full text-xs font-medium`}>
                        {statusInfo.text}
                      </span>
                    </div>
                    
                    {/* Actions */}
                    {role === 'biomedical' && (
                      <div className="text-center">
                        {log.status !== 'Completed' ? (
                          <button
                            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-green-700 hover:to-emerald-700 transition-colors duration-200"
                            onClick={() => handleConfirm(log.maintenance_id)}
                          >
                            Mark Complete
                          </button>
                        ) : (
                          <span className="text-green-600 font-medium text-xs">Completed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}