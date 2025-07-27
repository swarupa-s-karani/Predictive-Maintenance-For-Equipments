// src/pages/TechnicianEquipments.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function TechnicianEquipments() {
  const [equipments, setEquipments] = useState([]);
  const [profile, setProfile] = useState({});
  const [healthMap, setHealthMap] = useState({});
  const [filters, setFilters] = useState({ type: '', location: '', health: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [scheduledEquipments, setScheduledEquipments] = useState([]);
  const [formData, setFormData] = useState({
    downtime_hours: '',
    cost_inr: '',
    parts_replaced: '',
    vendor: '',
    response_time_hours: ''
  });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const lastScheduledCountRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Initialize with current count first
    const initializeScheduledCount = async () => {
      try {
        const res = await api.get('/maintenance-log/new-scheduled', {
          headers: { Authorization: `Bearer ${token}` }
        });
        lastScheduledCountRef.current = res.data.new_scheduled.length;
        console.log('Initial scheduled count:', lastScheduledCountRef.current);
      } catch (err) {
        console.error("Error initializing scheduled count:", err);
        lastScheduledCountRef.current = 0;
      }
    };

    initializeScheduledCount();

    // Set up polling after initialization
    const interval = setInterval(() => {
      checkForNewScheduledLogs();
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchScheduledEquipments = async () => {
      if (equipments.length > 0) {
        const scheduled = await getScheduledEquipments();
        setScheduledEquipments(scheduled);
      }
    };
    
    fetchScheduledEquipments();
  }, [equipments]);

  const checkForNewScheduledLogs = async () => {
    try {
      const res = await api.get('/maintenance-log/new-scheduled', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const currentCount = res.data.new_scheduled.length;
      
      // Only alert if count increased and we have a previous count
      if (lastScheduledCountRef.current !== null && currentCount > lastScheduledCountRef.current) {
        alert("New maintenance task has been scheduled!");
        // Refresh the equipment list
        await fetchData();
      }
      
      lastScheduledCountRef.current = currentCount;
    } catch (err) {
      console.error("Error checking new scheduled logs:", err);
    }
  };

  const fetchData = async () => {
    try {
      const resEquip = await api.get('/equipments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEquipments(resEquip.data.equipments || []);

      const resProfile = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Complete user profile data:', resProfile.data);
      console.log('Available keys in profile:', Object.keys(resProfile.data || {}));
      setProfile(resProfile.data || {});

      await api.post('/predict', {}, { headers: { Authorization: `Bearer ${token}` } });

      await fetchHealthBadges(resEquip.data.equipments);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 403) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        navigate('/');
      }
    }
  };

  const fetchHealthBadges = async (equipmentsList) => {
    const map = {};
    await Promise.all(equipmentsList.map(async ([id]) => {
      try {
        const res = await api.get(`/maintenance-log/priority/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { predicted_to_fail, maintenance_needs } = res.data;
        const isRisk = predicted_to_fail || Object.values(maintenance_needs).includes('High');
        map[id] = isRisk
          ? {
              label: 'High Risk',
              msg: `${predicted_to_fail ? 'Predicted to Fail' : ''}${predicted_to_fail && maintenance_needs ? ', ' : ''}${Object.entries(maintenance_needs).filter(([_, v]) => v === 'High').map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ')} maintenance`
            }
          : { label: 'Healthy', msg: '' };
      } catch {
        map[id] = { label: 'Unknown', msg: '' };
      }
    }));
    setHealthMap(map);
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

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleDetails = (id) => {
    navigate(`/equipment/${id}`);
  };

  // Test API connection before making requests
  const testApiConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      console.log('API connection test successful:', response.data);
      return true;
    } catch (err) {
      console.error('API connection test failed:', err);
      if (err.response?.status === 403) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        navigate('/');
      }
      return false;
    }
  };

  const handleMarkComplete = async (equipmentId) => {
    const isConnected = await testApiConnection();
    if (!isConnected) {
      alert("Cannot connect to server. Please check if the backend is running and try again.");
      return;
    }

    try {
      console.log('Looking for maintenance to complete for equipment:', equipmentId);
      
      const res = await api.get(`/maintenance-log/by-equipment/${equipmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      
      console.log('Maintenance logs for equipment:', res.data);
      
      // Find scheduled maintenance OR pending review maintenance that needs to be redone
      const maintenanceToComplete = res.data.logs?.find(log => 
        (log.status === 'Scheduled' && log.equipment_id === equipmentId) ||
        (log.status === 'Completed' && log.completion_status === 'Pending' && log.equipment_id === equipmentId)
      );
      
      console.log('Found maintenance to complete:', maintenanceToComplete);
      
      if (!maintenanceToComplete) {
        alert("No maintenance task found for this equipment.");
        return;
      }
      
      // Set the maintenance_id for completion
      setCurrentId(maintenanceToComplete.maintenance_id);
      setModalOpen(true);
      
    } catch (err) {
      console.error("Error fetching maintenance details:", err);
      if (err.response?.status === 403) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        navigate('/');
      } else if (err.request) {
        alert("Network error - Cannot connect to server.");
      } else {
        alert("Error loading maintenance details: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.downtime_hours || !formData.cost_inr) {
      alert("Please fill in all required fields (downtime hours and cost).");
      return;
    }

    // Get technician ID - PRIORITIZE personnel_id over username
    const technicianId = profile.personnel_id || profile.id || profile.user_id;
    
    if (!technicianId) {
      console.error('Profile object:', profile);
      console.error('Available profile keys:', Object.keys(profile));
      alert("Error: Personnel ID not found in profile. Please contact admin.");
      return;
    }

    // Debug log to verify we're using personnel_id
    console.log('Using technician ID (should be personnel_id):', technicianId);
    console.log('Profile personnel_id:', profile.personnel_id);
    console.log('Profile username:', profile.username);

    try {
      console.log('Current ID for completion:', currentId);
      console.log('Profile data:', profile);
      console.log('Using technician ID:', technicianId);
      
      // Match the exact CompletionSchema from FastAPI
      const completionData = {
        downtime_hours: parseFloat(formData.downtime_hours),
        cost_inr: parseFloat(formData.cost_inr),
        remarks: `Parts: ${formData.parts_replaced || 'None'} | Vendor: ${formData.vendor || 'N/A'} | Response Time: ${formData.response_time_hours || 'N/A'} hours`,
        technician_id: technicianId // This should now be personnel_id, not username
      };

      console.log('Sending completion data:', completionData);

      const response = await api.put(`/maintenance-log/mark-complete/${currentId}`, completionData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      console.log('Success response:', response.data);
      alert('Maintenance marked as completed! Admin will be notified for review.');
      
      // Reset form and close modal
      setModalOpen(false);
      setFormData({
        downtime_hours: '',
        cost_inr: '',
        parts_replaced: '',
        vendor: '',
        response_time_hours: ''
      });
      setCurrentId('');
      
      // Refresh data to update the equipment list
      await fetchData();
      
    } catch (err) {
      // ... rest of error handling remains the same
      console.error("Complete error object:", err);
      
      if (err.response) {
        console.error("Server error details:", err.response.data);
        if (err.response.status === 403) {
          alert('Session expired. Please login again.');
          localStorage.removeItem('token');
          navigate('/');
        } else if (err.response.status === 500) {
          alert('Backend Error: There is an issue with the server. Please check the backend logs for more details.');
        } else {
          const errorMsg = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
          alert(`Server Error: ${errorMsg}`);
        }
      } else if (err.request) {
        alert("CORS Error: Your backend server needs to be configured to allow requests from http://localhost:5173.");
      } else {
        alert("Error submitting completion: " + err.message);
      }
    }
  };

  // Filter to show only equipments with scheduled maintenance
  const getScheduledEquipments = async () => {
    try {
      const scheduledEquipments = [];
      
      for (const [id] of equipments) {
        try {
          const res = await api.get(`/maintenance-log/by-equipment/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Check if there are any scheduled maintenance tasks for this equipment
          // This now includes both new scheduled tasks AND rejected/follow-up tasks
          const hasScheduled = res.data.logs?.some(log => 
            log.status === 'Scheduled' || 
            (log.status === 'Completed' && log.completion_status === 'Pending')
          );
          
          if (hasScheduled) {
            const equipment = equipments.find(eq => eq[0] === id);
            if (equipment) {
              scheduledEquipments.push(equipment);
            }
          }
        } catch (err) {
          console.warn(`Failed to check scheduled maintenance for ${id}:`, err);
        }
      }
      
      return scheduledEquipments;
    } catch (err) {
      console.error("Error fetching scheduled equipments:", err);
      return [];
    }
  };

  const filteredEquipments = scheduledEquipments.filter(([id, type, mfg, loc]) => {
    const matchesType = !filters.type || type === filters.type;
    const matchesLocation = !filters.location || loc === filters.location;
    const matchesHealth = !filters.health || (healthMap[id]?.label === filters.health);
    return matchesType && matchesLocation && matchesHealth;
  });

  return (
    <div className="flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4 min-h-screen shadow-md hidden sm:block">
        <div className="text-lg font-bold mb-4">Technician: {profile.name}</div>
        <ul className="text-sm space-y-1 text-gray-700">
          <li><b>Role:</b> {profile.role}</li>
          <li><b>Dept:</b> {profile.department}</li>
          <li><b>Exp:</b> {profile.experience_years} yrs</li>
          <li><b>ID:</b> {profile.personnel_id || profile.id || profile.user_id || 'Not Found'}</li>
        </ul>
        <button onClick={logout} className="mt-6 w-full bg-red-600 text-white py-1 rounded hover:bg-red-700">Logout</button>
      </div>

      {/* Main */}
      <div className="flex-1 p-8 bg-gradient-to-r from-yellow-100 to-green-100">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Technician Panel - Scheduled Equipments</h1>

        {/* Status Summary */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Tasks Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">{scheduledEquipments.length}</div>
              <div className="text-sm text-gray-600">Scheduled Tasks</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-2xl font-bold text-yellow-600">{filteredEquipments.filter(([id]) => healthMap[id]?.label === 'High Risk').length}</div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-2xl font-bold text-green-600">{filteredEquipments.filter(([id]) => healthMap[id]?.label === 'Healthy').length}</div>
              <div className="text-sm text-gray-600">Healthy Status</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {['type', 'location'].map(field => (
            <select key={field} className="p-2 border rounded" value={filters[field]} onChange={e => setFilters({ ...filters, [field]: e.target.value })}>
              <option value="">All {field}</option>
              {[...new Set(scheduledEquipments.map(eq => eq[field === 'type' ? 1 : 3]))].map(v => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ))}
          <select className="p-2 border rounded" value={filters.health} onChange={e => setFilters({ ...filters, health: e.target.value })}>
            <option value="">All Health Status</option>
            <option value="High Risk">High Risk</option>
            <option value="Healthy">Healthy</option>
          </select>
        </div>

        {/* Equipment List */}
        {filteredEquipments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-xl text-gray-600 mb-2">No scheduled maintenance tasks</p>
            <p className="text-gray-500">Check back later for new assignments</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            {[...filteredEquipments].sort((a, b) => {
              // Sort by priority: High Risk first, then by ID
              const aRisk = healthMap[a[0]]?.label === 'High Risk';
              const bRisk = healthMap[b[0]]?.label === 'High Risk';
              if (aRisk && !bRisk) return -1;
              if (!aRisk && bRisk) return 1;
              return a[0].localeCompare(b[0]);
            }).map(([id, type, manufacturer, location, , installation_date]) => (
              <div
                key={id}
                className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                  healthMap[id]?.label === 'High Risk' ? 'border-red-500' : 'border-green-500'
                }`}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                  <div className="mb-4 md:mb-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-bold text-blue-700">{type}</h2>
                      {healthMap[id]?.label === 'High Risk' && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">PRIORITY</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <p><strong>ID:</strong> {id}</p>
                      <p><strong>Location:</strong> {location}</p>
                      <p><strong>Manufacturer:</strong> {manufacturer}</p>
                      <p><strong>Installed:</strong> {installation_date}</p>
                    </div>
                    <div className="mt-3">
                      {getBadge(id)}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:ml-6">
                    <button 
                      onClick={() => handleDetails(id)} 
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded transition-colors"
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => handleMarkComplete(id)} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors font-semibold"
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[90%] max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Complete Maintenance - ID: {currentId}
            </h2>
            
            <form onSubmit={handleSubmitCompletion}>
              <div className="space-y-4">
                {/* Required Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Downtime Hours <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.downtime_hours}
                    onChange={(e) => setFormData({ ...formData, downtime_hours: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost (INR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_inr}
                    onChange={(e) => setFormData({ ...formData, cost_inr: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Optional Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parts Replaced
                  </label>
                  <input
                    type="text"
                    value={formData.parts_replaced}
                    onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Battery, Circuit board"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Vendor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Response Time (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.response_time_hours}
                    onChange={(e) => setFormData({ ...formData, response_time_hours: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Time taken to respond"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setFormData({
                      downtime_hours: '',
                      cost_inr: '',
                      parts_replaced: '',
                      vendor: '',
                      response_time_hours: ''
                    });
                    setCurrentId('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold"
                >
                  Submit Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}