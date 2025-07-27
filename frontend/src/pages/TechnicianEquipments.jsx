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
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const lastScheduledCountRef = useRef(null);

  // Alert function
  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: '' });
    }, 4000); // Auto-hide after 4 seconds
  };

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
        showAlert("New maintenance task has been scheduled!", 'info');
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
        showAlert('Session expired. Please login again.', 'error');
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
        showAlert('Session expired. Please login again.', 'error');
        localStorage.removeItem('token');
        navigate('/');
      }
      return false;
    }
  };

  const handleMarkComplete = async (equipmentId) => {
    const isConnected = await testApiConnection();
    if (!isConnected) {
      showAlert("Cannot connect to server. Please check if the backend is running and try again.", 'error');
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
        showAlert("No maintenance task found for this equipment.", 'warning');
        return;
      }
      
      // Set the maintenance_id for completion
      setCurrentId(maintenanceToComplete.maintenance_id);
      setModalOpen(true);
      
    } catch (err) {
      console.error("Error fetching maintenance details:", err);
      if (err.response?.status === 403) {
        showAlert('Session expired. Please login again.', 'error');
        localStorage.removeItem('token');
        navigate('/');
      } else if (err.request) {
        showAlert("Network error - Cannot connect to server.", 'error');
      } else {
        showAlert("Error loading maintenance details: " + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.downtime_hours || !formData.cost_inr) {
      showAlert("Please fill in all required fields (downtime hours and cost).", 'warning');
      return;
    }

    // Get technician ID - PRIORITIZE personnel_id over username
    const technicianId = profile.personnel_id || profile.id || profile.user_id;
    
    if (!technicianId) {
      console.error('Profile object:', profile);
      console.error('Available profile keys:', Object.keys(profile));
      showAlert("Error: Personnel ID not found in profile. Please contact admin.", 'error');
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
      showAlert('Maintenance marked as completed! Admin will be notified for review.', 'success');
      
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
      console.error("Complete error object:", err);
      
      if (err.response) {
        console.error("Server error details:", err.response.data);
        if (err.response.status === 403) {
          showAlert('Session expired. Please login again.', 'error');
          localStorage.removeItem('token');
          navigate('/');
        } else if (err.response.status === 500) {
          showAlert('Backend Error: There is an issue with the server. Please check the backend logs for more details.', 'error');
        } else {
          const errorMsg = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
          showAlert(`Server Error: ${errorMsg}`, 'error');
        }
      } else if (err.request) {
        showAlert("CORS Error: Your backend server needs to be configured to allow requests from http://localhost:5173.", 'error');
      } else {
        showAlert("Error submitting completion: " + err.message, 'error');
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Modern Sidebar with Consistent Dark Theme */}
      <div className="w-72 bg-gradient-to-br from-slate-800 via-blue-800 to-indigo-900 border-r border-slate-600 min-h-screen shadow-2xl hidden sm:block fixed left-0 top-0 z-40 overflow-y-auto">
        <div className="p-6">
          {/* User Avatar & Welcome */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 via-cyan-400 to-blue-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <span className="text-2xl font-bold text-white">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'T'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Welcome back!</h2>
            <p className="text-sm text-cyan-200 font-medium">{profile.name}</p>
          </div>
          
          {/* User Info Cards */}
          <div className="space-y-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-cyan-200 uppercase tracking-wide mb-1">Role</p>
                  <p className="text-sm font-medium text-white capitalize">{profile.role}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide mb-1">Department</p>
                  <p className="text-sm font-medium text-white">{profile.department}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Experience</p>
                  <p className="text-sm font-medium text-white">{profile.experience_years} years</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-orange-200 uppercase tracking-wide mb-1">Personnel ID</p>
                  <p className="text-sm font-medium text-white">{profile.personnel_id || profile.id || profile.user_id || 'Not Found'}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-4 0v2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {/* Logout Button */}
          <button 
            onClick={logout} 
            className="group relative w-full inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-2xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-300 ease-out"
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-700 to-cyan-700 rounded-2xl blur opacity-0 group-hover:opacity-75 transition duration-300"></span>
            <span className="relative flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Content with White Background */}
      <div className="flex-1 p-8 bg-white min-h-screen ml-72">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Technician Panel - Scheduled Equipments</h1>
          <p className="text-gray-600">Complete scheduled maintenance tasks assigned to you</p>
        </div>

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
                  {alert.type === 'warning' && <span className="text-yellow-500 text-lg">⚠</span>}
                  {alert.type === 'error' && <span className="text-red-500 text-lg">✗</span>}
                  {alert.type === 'info' && <span className="text-blue-500 text-lg">ℹ</span>}
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

        {/* Status Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tasks Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-blue-600 mb-1">{scheduledEquipments.length}</div>
                  <div className="text-sm font-medium text-blue-700">Scheduled Tasks</div>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-yellow-600 mb-1">{filteredEquipments.filter(([id]) => healthMap[id]?.label === 'High Risk').length}</div>
                  <div className="text-sm font-medium text-yellow-700">High Priority</div>
                </div>
                <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.17 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-600 mb-1">{filteredEquipments.filter(([id]) => healthMap[id]?.label === 'Healthy').length}</div>
                  <div className="text-sm font-medium text-green-700">Healthy Status</div>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {['type', 'location'].map(field => (
            <select 
              key={field} 
              className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" 
              value={filters[field]} 
              onChange={e => setFilters({ ...filters, [field]: e.target.value })}
            >
              <option value="">All {field}</option>
              {[...new Set(scheduledEquipments.map(eq => eq[field === 'type' ? 1 : 3]))].map(v => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ))}
          <select 
            className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" 
            value={filters.health} 
            onChange={e => setFilters({ ...filters, health: e.target.value })}
          >
            <option value="">All Health Status</option>
            <option value="High Risk">High Risk</option>
            <option value="Healthy">Healthy</option>
          </select>
        </div>

        {/* Equipment List */}
        {filteredEquipments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-xl text-gray-600 mb-2">No scheduled maintenance tasks</p>
            <p className="text-gray-500">Check back later for new assignments</p>
          </div>
        ) : (
          <div className="space-y-6">
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
                className={`bg-white rounded-2xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow duration-300 ${
                  healthMap[id]?.label === 'High Risk' ? 'border-red-500' : 'border-green-500'
                } border border-gray-100`}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                  <div className="mb-4 md:mb-0 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-xl font-bold text-blue-700">{type}</h2>
                      {healthMap[id]?.label === 'High Risk' && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-lg font-semibold">PRIORITY</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-center">
                        <span className="font-semibold text-gray-800 mr-2">ID:</span>
                        <span>{id}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold text-gray-800 mr-2">Location:</span>
                        <span>{location}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold text-gray-800 mr-2">Manufacturer:</span>
                        <span>{manufacturer}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold text-gray-800 mr-2">Installed:</span>
                        <span>{installation_date}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      {getBadge(id)}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:ml-6">
                    <button 
                      onClick={() => handleDetails(id)} 
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-xl transition-colors font-medium border border-gray-300"
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => handleMarkComplete(id)} 
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl transition-colors font-semibold shadow-lg"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-[90%] max-w-md max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Complete Maintenance - ID: {currentId}
            </h2>
            
            <form onSubmit={handleSubmitCompletion}>
              <div className="space-y-6">
                {/* Required Fields */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Downtime Hours <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.downtime_hours}
                    onChange={(e) => setFormData({ ...formData, downtime_hours: e.target.value })}
                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost (INR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_inr}
                    onChange={(e) => setFormData({ ...formData, cost_inr: e.target.value })}
                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    required
                  />
                </div>

                {/* Optional Fields */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Parts Replaced
                  </label>
                  <input
                    type="text"
                    value={formData.parts_replaced}
                    onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="e.g., Battery, Circuit board"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="Vendor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Response Time (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.response_time_hours}
                    onChange={(e) => setFormData({ ...formData, response_time_hours: e.target.value })}
                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="Time taken to respond"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
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
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-colors font-semibold shadow-lg"
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