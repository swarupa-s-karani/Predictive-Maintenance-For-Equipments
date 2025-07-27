import React, { useState } from 'react';

function LoginModal({ onClose }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);

    // Dummy logic: Replace with actual FastAPI call
    if (value === 'admin') setRole('Admin');
    else if (value === 'biomed') setRole('Biomedical Engineer');
    else if (value === 'tech') setRole('Technician');
    else setRole('');
  };

  const handleSubmit = () => {
    if (!username || !role) return alert("Enter a valid username to fetch role");
    alert(`Logged in as ${role}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-md w-96 relative">
        <button onClick={onClose} className="absolute top-2 right-3 text-gray-500 hover:text-black">✕</button>
        <h2 className="text-2xl font-semibold mb-4 text-center">Login</h2>
        <input
          type="text"
          placeholder="Enter Username"
          className="w-full border px-4 py-2 mb-4 rounded"
          value={username}
          onChange={handleUsernameChange}
        />
        {role && (
          <div className="mb-4 text-green-600 font-medium">
            Detected Role: {role}
          </div>
        )}
        <input
          type="password"
          placeholder="Enter Password"
          className="w-full border px-4 py-2 mb-4 rounded"
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </div>
    </div>
  );
}

export default LoginModal;
