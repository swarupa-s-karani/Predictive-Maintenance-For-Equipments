// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminEquipments from './pages/AdminEquipments';
import BiomedicalEquipments from './pages/BiomedicalEquipments';
import TechnicianEquipments from './pages/TechnicianEquipments';
import EquipmentDetail from './pages/EquipmentDetail';
import BiomedicalLogs from './pages/BiomedicalLogs';
import MaintenanceLogs from './pages/MaintenanceLogs';
//import ScheduleMaintenance from './pages/ScheduleMaintenance'; // make sure this file exists

//<Route path="/schedule/:id" element={<ScheduleMaintenance />} />

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Role-specific routes */}
        <Route path="/admin/equipments" element={<AdminEquipments />} />
        <Route path="/biomedical/equipments" element={<BiomedicalEquipments />} />
        <Route path="/technician/equipments" element={<TechnicianEquipments />} />

        {/* Common details page */}
        <Route path="/equipment/:id" element={<EquipmentDetail />} />
        <Route path="/biomedical/logs" element={<BiomedicalLogs />} />
        <Route path="/equipments/:id" element={<EquipmentDetail />} />
        <Route path="/maintenance-logs" element={<MaintenanceLogs />} />
      </Routes>
    </Router>
  );
}
