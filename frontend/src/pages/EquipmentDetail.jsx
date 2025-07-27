// src/pages/EquipmentDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';

export default function EquipmentDetail() {
  const { id } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [plot, setPlot] = useState("");
  const [metrics, setMetrics] = useState({});
  const [priority, setPriority] = useState({});
  const [llmData, setLlmData] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userRole, setUserRole] = useState("");
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [scheduledMap, setScheduledMap] = useState({});

  const token = localStorage.getItem("token");

  const isBiomedicalRole = (role) => {
    const normalizedRole = role?.toLowerCase().replace(/\s+/g, ''); // Remove all spaces and convert to lowercase
    const biomedicalRoles = ['admin', 'biomedical', 'biomedicalengineer'];
    return biomedicalRoles.includes(normalizedRole);
  };

  useEffect(() => {
    const fetchUpdatedDetails = async () => {
      try {
        const profileRes = await axios.get("http://localhost:8000/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Store the original role (don't convert to lowercase here)
        setUserRole(profileRes.data.role);

        const equipRes = await axios.get(`http://localhost:8000/equipments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEquipment(equipRes.data.equipment);

        const combinedRes = await axios.get(`http://localhost:8000/maintenance-log/combined/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = combinedRes.data;
        setPlot(`data:image/png;base64,${data.image_base64}`);
        setMetrics(data.metrics);
        setPriority({
          predicted_to_fail: data.predicted_to_fail,
          maintenance_needs: data.maintenance_needs,
        });
        setLlmData({ explanation: data.explanation });

        const logRes = await axios.get("http://localhost:8000/maintenance-log", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const filteredLogs = logRes.data.logs.filter((log) => log.equipment_id === id);
        setLogs(filteredLogs);
        
        console.log(filteredLogs)
        const isScheduled = filteredLogs.some(log => log.status === "Scheduled");
        setScheduledMap(prev => ({ ...prev, [id]: isScheduled }));

        const userList = await axios.get("http://localhost:8000/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTechnicians(userList.data.users.filter(user => user[2] === "technician"));

      } catch (err) {
        console.error("Error fetching equipment details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpdatedDetails();
  }, [id]);

  const handleSchedule = async () => {
    if (!issueDescription.trim()) {
      alert("Please provide an issue description before scheduling.");
      return;
    }

    try {
      const res = await axios.put(
        `http://localhost:8000/maintenance-log/schedule/${id}`,
        {
          maintenance_type: "Preventive",
          date: selectedDate.toISOString().split("T")[0],
          issue_description: issueDescription.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(res.data.message || "Maintenance scheduled successfully.");
      setCalendarOpen(false);
      setIssueDescription("");
      setSelectedTechnician("");

      // Re-fetch all updated data after scheduling
      await fetchUpdatedDetails();

    } catch (err) {
      console.error("Error scheduling maintenance:", err);
      
      // More specific error handling
      if (err.response?.status === 403) {
        alert("You don't have permission to schedule maintenance.");
      } else if (err.response?.status === 500) {
        const errorMsg = err.response?.data?.detail || "Server error occurred";
        if (errorMsg.includes("UNIQUE constraint")) {
          alert("There was a conflict generating the maintenance ID. Please try again.");
        } else {
          alert(`Server error: ${errorMsg}`);
        }
      } else if (err.response?.data?.detail) {
        alert(err.response.data.detail);
      } else {
        alert("Failed to schedule maintenance. Please try again.");
      }
    }
  };

  const fetchUpdatedDetails = async () => {
    try {
      const profileRes = await axios.get("http://localhost:8000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Store the original role (don't convert to lowercase here)
      setUserRole(profileRes.data.role);

      const equipRes = await axios.get(`http://localhost:8000/equipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEquipment(equipRes.data.equipment);

      const combinedRes = await axios.get(`http://localhost:8000/maintenance-log/combined/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = combinedRes.data;
      setPlot(`data:image/png;base64,${data.image_base64}`);
      setMetrics(data.metrics);
      setPriority({
        predicted_to_fail: data.predicted_to_fail,
        maintenance_needs: data.maintenance_needs,
      });
      setLlmData({ explanation: data.explanation });

      const logRes = await axios.get("http://localhost:8000/maintenance-log", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filteredLogs = logRes.data.logs.filter((log) => log.equipment_id === id);
      setLogs(filteredLogs);

      const scheduled = {};
      filteredLogs.forEach(log => {
        if (log.status === "Scheduled") {
          scheduled[log.equipment_id] = true;
        }
      });
      setScheduledMap(scheduled);

      const userList = await axios.get("http://localhost:8000/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTechnicians(userList.data.users.filter(user => user[2] === "technician"));
    } catch (err) {
      console.error("Error fetching equipment details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTagClass = (level) => {
    switch ((level || "").toLowerCase()) {
      case "high": return "bg-red-100 text-red-700 border-red-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-green-100 text-green-700 border-green-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  if (loading) return <div className="p-6 text-gray-700 text-xl">Loading equipment data...</div>;

  const [
    equipmentId,
    type,
    manufacturer,
    location,
    _criticality,
    installation_date
  ] = equipment || [];

// Add this helper function to format risk level
const getRiskClass = (level) => {
  switch ((level || "").toLowerCase()) {
    case "high": return "print-risk-high";
    case "medium": return "print-risk-medium";
    case "low": return "print-risk-low";
    default: return "";
  }
};

return (
  <>
    {/* Hidden Print-Only Report */}
    <div className="print-report" style={{ display: 'none' }}>
      {/* Print Header */}
      <div className="print-header">
        <h1>Equipment Maintenance Report</h1>
        <div className="equipment-id">Equipment ID: {equipmentId}</div>
        <div className="generated-info">
          Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Basic Information Section */}
      <div className="print-section">
        <div className="print-section-title">Equipment Information</div>
        <table className="print-table">
          <tbody>
            <tr>
              <th style={{ width: '30%' }}>Equipment ID</th>
              <td>{equipmentId}</td>
            </tr>
            <tr>
              <th>Type</th>
              <td>{type}</td>
            </tr>
            <tr>
              <th>Manufacturer</th>
              <td>{manufacturer}</td>
            </tr>
            <tr>
              <th>Location</th>
              <td>{location}</td>
            </tr>
            <tr>
              <th>Installation Date</th>
              <td>{installation_date}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Technical Metrics Section */}
      {metrics && (
        <div className="print-section">
          <div className="print-section-title">Technical Metrics</div>
          <div className="print-metrics-grid">
            <div className="print-metric-card">
              <div className="print-metric-label">Usage Hours</div>
              <div className="print-metric-value">{(metrics?.usage_hours || 0).toFixed(2)}</div>
              <div className="print-metric-unit">hours</div>
            </div>
            <div className="print-metric-card">
              <div className="print-metric-label">CPU Temperature</div>
              <div className="print-metric-value">{(metrics?.avg_cpu_temp || 0).toFixed(2)}</div>
              <div className="print-metric-unit">°C</div>
            </div>
            <div className="print-metric-card">
              <div className="print-metric-label">Error Count</div>
              <div className="print-metric-value">{metrics?.error_count || 0}</div>
              <div className="print-metric-unit">errors</div>
            </div>
            <div className="print-metric-card">
              <div className="print-metric-label">Risk Score</div>
              <div className="print-metric-value">{metrics?.risk_score || 0}</div>
              <div className="print-metric-unit">score</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Trend Chart */}
      {plot && (
        <div className="print-section">
          <div className="print-section-title">Performance Trend Analysis</div>
          <div className="print-chart">
            <img src={plot} alt="Performance Trend Graph" />
          </div>
        </div>
      )}

      {/* Risk Assessment Section */}
      {priority && (
        <div className="print-section">
          <div className="print-section-title">Risk Assessment</div>
          <table className="print-risk-table">
            <tbody>
              <tr>
                <td style={{ width: '40%', fontWeight: 'bold' }}>Predicted to Fail</td>
                <td className={priority.predicted_to_fail ? 'print-risk-high' : 'print-risk-low'}>
                  {priority.predicted_to_fail ? 'YES' : 'NO'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Preventive Maintenance</td>
                <td className={getRiskClass(priority?.maintenance_needs?.preventive)}>
                  {priority?.maintenance_needs?.preventive || 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Corrective Maintenance</td>
                <td className={getRiskClass(priority?.maintenance_needs?.corrective)}>
                  {priority?.maintenance_needs?.corrective || 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Replacement Need</td>
                <td className={getRiskClass(priority?.maintenance_needs?.replacement)}>
                  {priority?.maintenance_needs?.replacement || 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* AI Analysis Section */}
      {llmData?.explanation && (
        <div className="print-section">
          <div className="print-section-title">AI Analysis & Recommendations</div>
          <div className="print-explanation">
            {llmData.explanation}
          </div>
        </div>
      )}

      {/* Maintenance Logs Section */}
      <div className="print-section">
        <div className="print-section-title">Recent Maintenance Logs</div>
        {logs.length === 0 ? (
          <p>No maintenance logs found for this equipment.</p>
        ) : (
          <table className="print-logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map((log) => (
                <tr key={log.maintenance_id}>
                  <td>{log.date}</td>
                  <td>{log.maintenance_type}</td>
                  <td>{log.status}</td>
                  <td>{log.issue_description || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="print-footer">
        <p>This report was automatically generated by the Equipment Maintenance System</p>
        <p>Report ID: {equipmentId}-{Date.now()}</p>
      </div>
    </div>

    {/* Original UI (unchanged) */}
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Equipment Detail</h1>
              <p className="text-cyan-200 text-lg">{equipmentId}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-300 mb-1">Current User Role</p>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium">
                  {userRole}
                </span>
                {isBiomedicalRole(userRole) ? (
                  <span className="text-green-400 text-sm">✓ Authorized</span>
                ) : (
                  <span className="text-red-400 text-sm">✗ Not Authorized</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Info Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</p>
                    <p className="text-lg font-medium text-gray-800">{type}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-lg font-medium text-gray-800">{location}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Manufacturer</p>
                    <p className="text-lg font-medium text-gray-800">{manufacturer}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Installation Date</p>
                    <p className="text-lg font-medium text-gray-800">{installation_date}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Graph */}
            {plot && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  Performance Trend Analysis
                </h2>
                <div className="bg-gray-50 rounded-xl p-2 overflow-hidden">
                  <img src={plot} alt="Trend Graph" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
              </div>
            )}

            {/* Technical Metrics */}
            {metrics && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  Technical Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Usage Hours</p>
                    <p className="text-2xl font-bold text-blue-800">{(metrics?.usage_hours || 0).toFixed(2)}</p>
                    <p className="text-xs text-blue-600">hours</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">CPU Temp</p>
                    <p className="text-2xl font-bold text-orange-800">{(metrics?.avg_cpu_temp || 0).toFixed(2)}</p>
                    <p className="text-xs text-orange-600">°C</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 p-4 rounded-xl border border-red-200">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Error Count</p>
                    <p className="text-2xl font-bold text-red-800">{metrics?.error_count || 0}</p>
                    <p className="text-xs text-red-600">errors</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Risk Score</p>
                    <p className="text-2xl font-bold text-purple-800">{metrics?.risk_score || 0}</p>
                    <p className="text-xs text-purple-600">score</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-1">Criticality</p>
                    <p className="text-lg font-bold text-yellow-800">{metrics?.maintenance_needs?.corrective || "Medium"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* LLM Explanation */}
            {llmData?.explanation && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  LLM Explanation
                </h2>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">{llmData.explanation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Maintenance Risk Prediction */}
            {priority && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  Risk Assessment
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="font-medium text-gray-700">Predicted to Fail</span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                      priority.predicted_to_fail 
                        ? "bg-red-100 text-red-700 border border-red-300" 
                        : "bg-green-100 text-green-700 border border-green-300"
                    }`}>
                      {priority.predicted_to_fail ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Preventive</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getTagClass(priority?.maintenance_needs?.preventive)}`}>
                        {priority?.maintenance_needs?.preventive || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Corrective</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getTagClass(priority?.maintenance_needs?.corrective)}`}>
                        {priority?.maintenance_needs?.corrective || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Replacement</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getTagClass(priority?.maintenance_needs?.replacement)}`}>
                        {priority?.maintenance_needs?.replacement || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Maintenance */}
            {isBiomedicalRole(userRole) && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  Schedule Maintenance
                </h2>
                
                {scheduledMap[equipmentId] ? (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-semibold text-green-800">Already Scheduled</p>
                    <p className="text-sm text-green-600 mt-1">Maintenance is already planned for this equipment</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!calendarOpen ? (
                      <button
                        onClick={() => setCalendarOpen(true)}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-colors shadow-lg"
                      >
                        Schedule Maintenance
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <Calendar 
                            onChange={setSelectedDate} 
                            value={selectedDate}
                            className="w-full border-none"
                          />
                        </div>
                        <textarea
                          rows="3"
                          placeholder="Describe the maintenance issue..."
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        <div className="flex space-x-3">
                          <button
                            onClick={() => {
                              setCalendarOpen(false);
                              setIssueDescription("");
                            }}
                            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSchedule}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-colors"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Maintenance Logs */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                Recent Logs
              </h2>
              
              {logs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  </div>
                  <p className="text-gray-500">No maintenance logs found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.maintenance_id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-800">{log.date}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                          log.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          log.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                          log.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{log.maintenance_type}</p>
                      {log.issue_description && (
                        <p className="text-xs text-gray-500 mt-1">{log.issue_description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Download Report */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/20">
              <button
                onClick={() => window.print()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-lg flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
}