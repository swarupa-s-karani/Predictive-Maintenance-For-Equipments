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

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-md rounded-md">
      <h1 className="text-2xl font-bold mb-2 text-indigo-800">Equipment Detail - {equipmentId}</h1>
      <p className="mb-4 text-gray-600"><strong>Role:</strong> {userRole}</p>
      <p className="mb-4 text-gray-600"><strong>Role Check Result:</strong> {isBiomedicalRole(userRole) ? "✓ Authorized" : "✗ Not Authorized"}</p>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Basic Info:</h2>
        <p><strong>Type:</strong> {type}</p>
        <p><strong>Manufacturer:</strong> {manufacturer}</p>
        <p><strong>Location:</strong> {location}</p>
        <p><strong>Installation Date:</strong> {installation_date}</p>
      </div>

      {plot && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Trend Graph:</h2>
          <img src={plot} alt="Trend Graph" className="w-full border rounded shadow" />
        </div>
      )}

      {metrics && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Technical Metrics:</h2>
          <ul className="list-disc list-inside text-gray-800">
            <li><strong>Avg Usage Hours:</strong> {metrics?.usage_hours || 0} hrs</li>
            <li><strong>Avg CPU Temp:</strong> {metrics?.avg_cpu_temp || 0} °C</li>
            <li><strong>Total Errors:</strong> {metrics?.error_count || 0}</li>
            <li><strong>Risk Score:</strong> {metrics?.risk_score || 0}</li>
            <li><strong>Criticality:</strong> {metrics?.maintenance_needs?.corrective || "Medium"}</li>
          </ul>
        </div>
      )}

      {priority && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Maintenance Risk Prediction:</h2>
          <ul className="list-none space-y-2 text-gray-800">
            <li className="flex items-center gap-2">
              <strong>Predicted to Fail:</strong>
              <span className={`px-2 py-1 rounded text-sm font-medium ${priority.predicted_to_fail ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {priority.predicted_to_fail ? "Yes" : "No"}
              </span>
            </li>
            <li>
              <strong>Preventive:</strong>{" "}
              <span className={`px-2 py-0.5 text-sm border rounded ${getTagClass(priority?.maintenance_needs?.preventive)}`}>
                {priority?.maintenance_needs?.preventive || "N/A"}
              </span>
            </li>
            <li>
              <strong>Corrective:</strong>{" "}
              <span className={`px-2 py-0.5 text-sm border rounded ${getTagClass(priority?.maintenance_needs?.corrective)}`}>
                {priority?.maintenance_needs?.corrective || "N/A"}
              </span>
            </li>
            <li>
              <strong>Replacement:</strong>{" "}
              <span className={`px-2 py-0.5 text-sm border rounded ${getTagClass(priority?.maintenance_needs?.replacement)}`}>
                {priority?.maintenance_needs?.replacement || "N/A"}
              </span>
            </li>
          </ul>
        </div>
      )}

      {llmData?.explanation && (
        <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">LLM Explanation:</h2>
          <p className="whitespace-pre-line text-gray-800 text-sm">{llmData.explanation}</p>
        </div>
      )}

      {isBiomedicalRole(userRole) && (
        <div className="mb-6">
          {scheduledMap[equipmentId] ? (
            <span className="text-xs px-3 py-2 bg-green-100 text-green-700 font-medium rounded">
              Already Scheduled
            </span>
          ) : (
            <>
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Schedule Maintenance
              </button>
              {calendarOpen && (
                <div className="mt-4 space-y-3 border p-4 rounded bg-gray-50">
                  <Calendar onChange={setSelectedDate} value={selectedDate} />
                  <textarea
                    rows="2"
                    placeholder="Issue Description"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSchedule}
                      className="mt-3 bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
                    >
                      Confirm Schedule
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Maintenance Logs:</h2>
        {logs.length === 0 ? (
          <p>No logs found for this equipment.</p>
        ) : (
          <ul className="list-disc list-inside text-gray-700">
            {logs.map((log) => (
              <li key={log.maintenance_id}>
                <strong>{log.date}</strong>: {log.maintenance_type} – {log.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-right mt-4">
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm"
        >
          Download Report
        </button>
      </div>
    </div>
  );
}