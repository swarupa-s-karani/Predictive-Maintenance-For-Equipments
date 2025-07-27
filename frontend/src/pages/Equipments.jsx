// frontend/src/pages/Equipments.jsx
import { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Equipments() {
  const [equipments, setEquipments] = useState([]);
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await api.get('/equipments', {
          headers: { Authorization: token },
        });
        setEquipments(res.data.equipments || []);
      } catch (err) {
        console.error('Error fetching equipment:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 min-h-screen bg-gradient-to-r from-indigo-100 to-purple-100">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">⚙️ Equipment Status Overview</h1>

      {equipments.length === 0 ? (
        <p className="text-center text-gray-500">No equipment data available.</p>
      ) : (
        <div className="space-y-4">
          {equipments.map((eq) => {
            const [id, type, manufacturer, location, criticality, installation_date] = eq;

            return (
              <div
                key={id}
                className="bg-white rounded-lg shadow p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:shadow-md transition"
              >
                <div>
                  <h2 className="text-lg font-bold">{type}</h2>
                  <p className="text-sm text-gray-600">ID: {id} | {location}</p>
                  <p className="text-sm text-gray-600">Manufacturer: {manufacturer}</p>
                  <p className="text-sm text-gray-600">Installed on: {installation_date}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 sm:mt-0">
                  <span
                    className={`min-w-[90px] text-center px-3 py-1 rounded-full text-white text-sm font-semibold
                      ${criticality?.toLowerCase() === "critical" ? "bg-red-500" :
                        criticality?.toLowerCase() === "high" ? "bg-orange-500" :
                        criticality?.toLowerCase() === "medium" ? "bg-yellow-400 text-black" :
                        "bg-green-500"}`}
                  >
                    {criticality?.toUpperCase() || "UNKNOWN"}
                  </span>

                  {(role === 'admin' || role === 'biomedical') && (
                    <button className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600">
                      Schedule
                    </button>
                  )}

                  {role === 'admin' && (
                    <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                      Delete
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/equipments/${id}`)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
