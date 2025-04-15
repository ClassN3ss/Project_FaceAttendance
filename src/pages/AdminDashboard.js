import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/admin.css";

import ClassCreateModal from '../components/ClassCreateModal';
import ClassList from '../components/ClassList';
import RequestTable from '../components/RequestTable';
import FaceScanHistory from '../components/FaceScanHistory';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reload, setReload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleCreated = () => {
    setReload(prev => !prev);
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      const fetchSearch = async () => {
        try {
          if (searchTerm.length > 1) {
            const res = await API.get(`/search/users?q=${searchTerm}`);
            setSearchResults(res.data);
          } else {
            setSearchResults([]);
          }
        } catch (err) {
          console.error('❌ Error fetching search:', err.message);
          setSearchResults([]);
        }
      };
      fetchSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  return (
    <div className="container">
      <h4>👑 Admin Dashboard</h4>

      <ClassCreateModal onCreated={handleCreated} />

      <input
        type="text"
        className="form-control my-3"
        placeholder="🔍 ค้นหาชื่อ, วิชา, อาจารย์..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />

      {searchResults.length > 0 && (
        <ul className="list-group mb-3">
          {searchResults.map((user, idx) => (
            <li key={idx} className="list-group-item">
              {user.username} - {user.fullName} ({user.role})
            </li>
          ))}
        </ul>
      )}

      <ClassList key={reload} />
      <RequestTable />
      <FaceScanHistory />
    </div>
  );
}
