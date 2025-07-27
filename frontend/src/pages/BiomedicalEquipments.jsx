// frontend/src/pages/BiomedicalEquipments.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import MaintenanceLogs from './MaintenanceLogs';
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function BiomedicalEquipments() {
  const [equipments, setEquipments] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('equipment');
  const [edaImageBase64, setEdaImageBase64] = useState('');
  const [profile, setProfile] = useState({});
  const [filters, setFilters] = useState({ type: '', location: '', health: '' });
  const [healthMap, setHealthMap] = useState({});
  const [scheduledMap, setScheduledMap] = useState({});
  const [scheduleForm, setScheduleForm] = useState({ show: false, id: '', maintenance_type: '', technician_id: '', date: '', issue_description: '' });
  const [pendingReviews, setPendingReviews] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [issueDescription, setIssueDescription] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({});
  const [serviceRating, setServiceRating] = useState('');
  const [completionStatus, setCompletionStatus] = useState('');
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Helper function to check if user has biomedical permissions
  const isBiomedicalRole = (role) => {
    const normalizedRole = role?.toLowerCase().trim(); // Add trim() to handle whitespace
    console.log("Checking role:", normalizedRole); // Debug log
    return normalizedRole === 'admin' || 
          normalizedRole === 'biomedical' || 
          normalizedRole === 'biomedicalengineer' ||
          normalizedRole === 'biomedical engineer'; // Add space version
  };

  // Move showAlert function to component level so it's accessible everywhere
  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: '' });
    }, 4000); // Auto-hide after 4 seconds
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debug logging for profile
  useEffect(() => {
    console.log("Current user profile:", profile);
    console.log("User role:", profile.role);
    console.log("Is biomedical role?", isBiomedicalRole(profile.role));
  }, [profile]);

  // Fetch pending reviews when profile is loaded
  useEffect(() => {
    if (isBiomedicalRole(profile.role)) {
      fetchPendingReviews();
    }
  }, [profile.role]);

  
  const fetchData = async () => {
    try {
      // Fetch profile first to determine permissions
      const resProfile = await api.get('/users/me', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setProfile(resProfile.data || {});

      // Fetch equipments - Remove trailing slash
      const resEquip = await api.get('/equipments', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setEquipments(resEquip.data.equipments || []);

      // Fetch users (needed for technician dropdown in scheduling) - Remove trailing slash
      // Updated user permission check
      if (isBiomedicalRole(resProfile.data.role) || resProfile.data.role === 'manager') {
        try {
          const resUsers = await api.get('/users', { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          setUsers(resUsers.data.users || []);
        } catch (userErr) {
          console.warn("Cannot fetch users - insufficient permissions:", userErr);
          setUsers([]);
        }
      }

      // Fetch EDA image - Remove trailing slash
      try {
        const resEDA = await api.get('/eda/overall-eda-image', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setEdaImageBase64(resEDA.data.image_base64 || '');
      } catch (edaErr) {
        console.warn("Cannot fetch EDA image:", edaErr);
      }

      // Run predictions - but don't let this affect other data
      try {
        await api.post('/predict', {}, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
      } catch (predErr) {
        console.warn("Prediction failed:", predErr);
      }
      
      // Fetch priority data for each equipment - with error handling
      const equipmentsList = resEquip.data.equipments || [];
      await Promise.allSettled(equipmentsList.map(async ([id]) => {
        try {
          await api.get(`/maintenance-log/priority/${id}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
        } catch (err) {
          console.warn(`Failed to fetch priority for equipment ${id}:`, err);
        }
      }));

      // Fetch health badges and scheduled map
      await fetchHealthBadges(equipmentsList);
      await fetchScheduledMap(equipmentsList);
      
    } catch (error) {
      console.error("Error in fetchData:", error);
      showAlert("Failed to load some data. Please check your permissions.", 'warning');
    }
  };

  const fetchHealthBadges = async (equipmentsList) => {
    const map = {};
    await Promise.all(equipmentsList.map(async ([id]) => {
      try {
        const res = await api.get(`/maintenance-log/priority/${id}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        const { predicted_to_fail, maintenance_needs } = res.data;
        const isRisk = predicted_to_fail || Object.values(maintenance_needs).includes('High');
        map[id] = isRisk ? {
          label: 'High Risk',
          msg: `${predicted_to_fail ? 'Predicted to Fail' : ''}${predicted_to_fail && maintenance_needs ? ', ' : ''}${Object.entries(maintenance_needs).filter(([_, v]) => v === 'High').map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ')} maintenance`
        } : { label: 'Healthy', msg: '' };
      } catch {
        map[id] = { label: 'Unknown', msg: '' };
      }
    }));
    setHealthMap(map);
  };

  const fetchScheduledMap = async (equipmentsList) => {
    const map = {};
    await Promise.all(equipmentsList.map(async ([id]) => {
      try {
        const res = await api.get(`/maintenance-log/by-equipment/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Make sure to check for 'Scheduled' status properly
        map[id] = res.data.logs?.some(log => log.status === 'Scheduled') || false;
      } catch {
        map[id] = false;
      }
    }));
    setScheduledMap(map);
  };

    const fetchPendingReviews = async () => {
    try {
      console.log("fetchPendingReviews - User role:", profile.role);
      console.log("fetchPendingReviews - Is biomedical?", isBiomedicalRole(profile.role));
      
      if (isBiomedicalRole(profile.role)) {
        console.log("Fetching pending reviews...");
        const res = await api.get("/maintenance-log/pending-reviews", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Pending reviews response:", res.data);
        setPendingReviews(res.data.reviews || []);
      } else {
        console.log("User doesn't have biomedical role, skipping reviews");
        setPendingReviews([]);
      }
    } catch (err) {
      console.error("Error fetching pending reviews:", err);
      console.error("Error response:", err?.response?.data);
      setPendingReviews([]);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleSchedule = async () => {
    if (!issueDescription) {
      showAlert("Please fill all fields before submitting.");
      return;
    }

    try {
      const res = await api.put(
          `/maintenance-log/schedule/${scheduleForm.id}`,
        {
          maintenance_type: "Preventive",
          // technician_id: null, // null if not auto-assigned
          date: selectedDate.toISOString().split("T")[0],
          issue_description: issueDescription,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert(res.data.message || "Maintenance scheduled successfully.");
      setScheduleForm({ show: false, id: '', maintenance_type: '', technician_id: '', date: '', issue_description: '' });
      setIssueDescription("");

      // Re-fetch all updated data after scheduling
      await fetchData();

    } catch (err) {
      console.error("Scheduling error:", err);
      console.error("Error response:", err?.response?.data);
      
      if (err?.response?.status === 403) {
        showAlert("Permission denied. Please check your role permissions.", 'error');
      } else {
        showAlert(err?.response?.data?.detail || "Error scheduling maintenance", 'error');
      }
    }
  };


  const getBadge = (id) => {
    const info = healthMap[id];
    if (!info) return <span className="text-xs px-2 py-1 rounded bg-gray-400 text-white">Loading...</span>;

    return (
      <div>
        <span className={`text-xs px-2 py-1 rounded ${info.label === 'High Risk' ? 'bg-red-600' : 'bg-green-600'} text-white`}>
          {info.label}
        </span>
        {info.msg && <p className="text-xs mt-1 text-red-600">{info.msg}</p>}
      </div>
    );
  };

  
  const handleReviewMaintenance = async (maintenanceId) => {
    if (!serviceRating || !completionStatus) {
      showAlert("Please fill all required fields.", 'warning');
      return;
    }

    try {
      let finalStatus;
      if (completionStatus === 'Approved') {
        finalStatus = 'Completed';
      } else if (completionStatus === 'Requires Follow-up' || completionStatus === 'Rejected') {
        finalStatus = 'Scheduled'; // Return to technician queue
      }
      
      const res = await api.put(`/maintenance-log/review-completion/${maintenanceId}`, {
        service_rating: parseInt(serviceRating),
        completion_status: completionStatus,
        status: finalStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Success message
      const statusMessage = completionStatus === 'Approved' 
        ? "Maintenance approved and marked as completed."
        : "Maintenance requires additional work. Returned to technician queue.";

      showAlert(statusMessage, completionStatus === 'Approved' ? 'success' : 'warning');
      
      // Reset modal
      setShowReviewModal(false);
      setServiceRating('');
      setCompletionStatus('');
      setReviewData({});
      
      // Force refresh all data
      await Promise.all([
        fetchData(),
        fetchPendingReviews()
      ]);
      
    } catch (err) {
      console.error("Error reviewing maintenance:", err);
      showAlert(err?.response?.data?.detail || "Failed to complete review.", 'error');
    }
  };


  const filteredEquipments = equipments.filter(([id, type, mfg, loc]) => {
    const matchesType = !filters.type || type === filters.type;
    const matchesLocation = !filters.location || loc === filters.location;
    const matchesHealth = !filters.health || (healthMap[id]?.label === filters.health);
    return matchesType && matchesLocation && matchesHealth;
  });


  return (
  <div className="flex">
    <div className="w-64 bg-gray-100 p-4 min-h-screen shadow-md hidden sm:block">
      <div className="text-lg font-bold mb-4">👋 Welcome, {profile.name}</div>
      <ul className="text-sm space-y-1 text-gray-700">
        <li><b>Role:</b> {profile.role}</li>
        <li><b>Dept:</b> {profile.department}</li>
        <li><b>Exp:</b> {profile.experience_years} yrs</li>
        <li><b>ID:</b> {profile.personnel_id}</li>
      </ul>
      <button onClick={logout} className="mt-6 w-full bg-red-600 text-white py-1 rounded hover:bg-red-700">Logout</button>
    </div>

    <div className="flex-1 p-6">
      {/* Alert Component */}
        {alert.show && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
            alert.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
            alert.type === 'warning' ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' :
            alert.type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
            'bg-blue-100 border border-blue-400 text-blue-700'
          }`}>
            <div className="flex justify-between items-start">
              <div className="flex">
                <div className="flex-shrink-0">
                  {alert.type === 'success' && <span className="text-green-400">✓</span>}
                  {alert.type === 'warning' && <span className="text-yellow-400">⚠</span>}
                  {alert.type === 'error' && <span className="text-red-400">✗</span>}
                  {alert.type === 'info' && <span className="text-blue-400">ℹ</span>}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => setAlert({ show: false, message: '', type: '' })}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}
      {edaImageBase64 && (
        <div className="mb-6">
          <img src={`data:image/png;base64,${edaImageBase64}`} alt="EDA" className="rounded-xl shadow w-full" />
        </div>
      )}

      {/* Enhanced Pending Reviews Alert - Updated permission check */}
      {isBiomedicalRole(profile.role) && pendingReviews.length > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
          <div className="flex justify-between items-center">
            <div>
              <b>{pendingReviews.length}</b> maintenance task(s) completed and awaiting review.
            </div>
            <button 
              onClick={() => setTab('logs')}
              className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
            >
              Review Tasks
            </button>
          </div>
          
          {/* Show individual pending reviews */}
          <div className="mt-3 space-y-2">
            {pendingReviews.slice(0, 3).map((review) => (
              <div key={review.maintenance_id} className="bg-white p-3 rounded shadow-sm border">
                <div className="flex justify-between items-center">
                  <div className="text-sm">
                    <p><strong>Equipment:</strong> {review.equipment_id}</p>
                    <p><strong>Technician:</strong> {review.technician_id}</p>
                    <p><strong>Date:</strong> {review.date}</p>
                  </div>
                  <button
                    onClick={() => {
                      setReviewData(review);
                      setShowReviewModal(true);
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Review Now
                  </button>
                </div>
              </div>
            ))}
            
            {pendingReviews.length > 3 && (
              <p className="text-sm text-gray-600 mt-2">
                ...and {pendingReviews.length - 3} more. Click "Review Tasks" to see all.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Only show Equipment Overview and Maintenance Logs tabs - NO Users tab */}
      <div className="flex space-x-4 mb-4">
        {['equipment', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-semibold rounded ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {t === 'equipment' ? 'Equipment Status Overview' : 'Maintenance Logs'}
          </button>
        ))}
      </div>

      {tab === 'equipment' && (
        <>
          {/* Equipment List Header - NO Add Equipment Button */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Equipment List</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {['type', 'location'].map(field => (
              <select key={field} className="p-2 border" value={filters[field]} onChange={e => setFilters({ ...filters, [field]: e.target.value })}>
                <option value="">All {field}</option>
                {[...new Set(equipments.map(eq => eq[field === 'type' ? 1 : 3]))].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ))}
            <select className="p-2 border" value={filters.health} onChange={e => setFilters({ ...filters, health: e.target.value })}>
              <option value="">All Health Status</option>
              <option value="High Risk">High Risk</option>
              <option value="Healthy">Healthy</option>
            </select>
          </div>

          <ul className="space-y-4">
            {filteredEquipments.sort((a, b) => a[0].localeCompare(b[0])).map(([id, type, mfg, loc, crit, date]) => (
              <li key={id} className="bg-white p-4 shadow rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <p><b>{id}</b> — {type} - {mfg}</p>
                    <p className="text-sm text-gray-600">{loc} | Installed: {date}</p>
                    {getBadge(id)}
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => navigate(`/equipment/${id}`)} className="bg-gray-200 px-3 py-1 rounded">Details</button>
                    
                    {/* Schedule/Already Scheduled Logic - NO Delete Button */}
                    {scheduledMap[id] ? (
                      <span className="text-xs px-3 py-2 bg-green-100 text-green-700 font-medium rounded">
                        Already Scheduled
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedEquipmentId(selectedEquipmentId === id ? null : id);
                          setSelectedDate(new Date());
                          setIssueDescription('');
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        Schedule
                      </button>
                    )}
                  </div>
                </div>

                {selectedEquipmentId === id && (
                  <div className="mt-4 border-t pt-4">
                    <Calendar
                      onChange={setSelectedDate}
                      value={selectedDate}
                    />
                    <textarea
                      placeholder="Issue description"
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      rows={3}
                      className="border p-2 mt-2 w-full"
                    />
                    
                    <button
                      className="mt-3 bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
                      onClick={async () => {
                        if (!selectedDate || !issueDescription) {
                          showAlert("Please select a date and provide an issue description.");
                          return;
                        }

                        try {
                          // Use the same API pattern as AdminEquipments.jsx (consistent with your api instance)
                          const res = await api.put(
                            `/maintenance-log/schedule/${id}`,
                            {
                              maintenance_type: "Preventive",
                              date: selectedDate.toISOString().split("T")[0],
                              issue_description: issueDescription,
                            },
                            {
                              headers: {
                                Authorization: `Bearer ${token}`,
                              },
                            }
                          );

                          showAlert(res.data.message || "Maintenance scheduled successfully.");
                          setSelectedEquipmentId(null);
                          setIssueDescription('');
                          
                          // Update scheduledMap immediately + refresh data
                          setScheduledMap(prev => ({ ...prev, [id]: true }));
                          await fetchData();
                          
                        } catch (err) {
                          console.error("Scheduling error:", err);
                          console.error("Error response:", err?.response?.data);
                          
                          // More detailed error handling
                          if (err?.response?.status === 403) {
                            showAlert("Permission denied. Please check your role permissions.", 'error');
                          } else {
                            showAlert(err?.response?.data?.detail || "Failed to schedule maintenance.", 'error');
                          }
                        }
                      }}
                    >
                      Confirm Schedule
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'logs' && (
        <div><h2 className="text-xl font-bold mb-2">Maintenance Logs</h2><MaintenanceLogs /></div>
      )}

      {/* Post-Maintenance Review Modal - Updated permission check */}
      {isBiomedicalRole(profile.role) && showReviewModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Post-Maintenance Review - {reviewData.equipment_id}
            </h2>
            
            {/* Show completed maintenance details */}
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h3 className="font-semibold mb-2">Maintenance Details:</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>Equipment ID:</strong> {reviewData.equipment_id}</p>
                <p><strong>Date:</strong> {reviewData.date}</p>
                <p><strong>Technician ID:</strong> {reviewData.technician_id}</p>
                <p><strong>Maintenance ID:</strong> {reviewData.maintenance_id}</p>
                {reviewData.downtime_hours && (
                  <p><strong>Downtime:</strong> {reviewData.downtime_hours} hours</p>
                )}
                {reviewData.cost_inr && (
                  <p><strong>Cost:</strong> ₹{reviewData.cost_inr}</p>
                )}
                {reviewData.parts_replaced && (
                  <p><strong>Parts Replaced:</strong> {reviewData.parts_replaced}</p>
                )}
                {reviewData.vendor && (
                  <p><strong>Vendor:</strong> {reviewData.vendor}</p>
                )}
                {reviewData.response_time_hours && (
                  <p><strong>Response Time:</strong> {reviewData.response_time_hours} hours</p>
                )}
              </div>
            </div>

            {/* Admin Review Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Rating (1-5 stars)
                </label>
                <select
                  value={serviceRating}
                  onChange={(e) => setServiceRating(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2"
                >
                  <option value="">Select Rating</option>
                  <option value="1">⭐ (1 - Poor)</option>
                  <option value="2">⭐⭐ (2 - Fair)</option>
                  <option value="3">⭐⭐⭐ (3 - Good)</option>
                  <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                  <option value="5">⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Completion Status
                </label>
                <select
                  value={completionStatus}
                  onChange={(e) => setCompletionStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2"
                >
                  <option value="">Select Status</option>
                  <option value="Approved">Approved - Work Satisfactory</option>
                  <option value="Requires Follow-up">Requires Follow-up - Additional Work Needed</option>
                  <option value="Rejected">Rejected - Work Unsatisfactory</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setServiceRating('');
                  setCompletionStatus('');
                  setReviewData({});
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewMaintenance(reviewData.maintenance_id)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Complete Review
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Optional modal-based scheduler remains for backup */}
      {scheduleForm.show && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-md w-full space-y-3">
            <h2 className="text-lg font-bold">Schedule Maintenance for {scheduleForm.id}</h2>
            <select value={scheduleForm.maintenance_type} onChange={e => setScheduleForm({ ...scheduleForm, maintenance_type: e.target.value })} className="border p-2 w-full">
              <option value="">Select Maintenance Type</option>
              <option value="Preventive">Preventive</option>
              <option value="Corrective">Corrective</option>
              <option value="Calibration">Calibration</option>
              <option value="Inspection">Inspection</option>
            </select>
            <select value={scheduleForm.technician_id} onChange={e => setScheduleForm({ ...scheduleForm, technician_id: e.target.value })} className="border p-2 w-full">
              <option value="">Select Technician</option>
              {users.filter(user => user[2] === 'technician').map(user => (
                <option key={user[0]} value={user[0]}>{user[1]}</option>
              ))}
            </select>
            <input type="date" value={scheduleForm.date} onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })} className="border p-2 w-full" />
            <textarea placeholder="Issue Description" value={scheduleForm.issue_description} onChange={e => setScheduleForm({ ...scheduleForm, issue_description: e.target.value })} className="border p-2 w-full" rows={2} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSchedule} className="bg-green-600 text-white px-4 py-1 rounded">Schedule</button>
              <button onClick={() => setScheduleForm({ show: false, id: '', maintenance_type: '', technician_id: '', date: '', issue_description: '' })} className="bg-gray-300 px-4 py-1 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}