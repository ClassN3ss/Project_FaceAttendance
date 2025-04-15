import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/teacherDashboard.css"; 

function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const token = sessionStorage.getItem("token");

  const fetchClasses = useCallback(async () => {
    const res = await API.get("/classes/teacher", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setClasses(res.data || []);
  }, [token]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return (
    <div className="container">
      <h2>📘 Welcome {user ? user.fullName : "คุณครู"}</h2>

      <div className="mb-4">
        <h4>📚 ห้องเรียนของฉัน</h4>
        <ul className="list-group mb-3">
          {classes.length === 0 ? (
            <li className="list-group-item text-muted">📝 ยังไม่มีห้องเรียน</li>
          ) : (
            classes.map((cls) => (
              <li key={cls._id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>
                  {cls.courseCode} - {cls.courseName} (Sec {cls.section})
                </span>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => window.location.href = `/class-detail/${cls._id}`}
                >
                  🔍 ดูรายละเอียด
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export default TeacherDashboard;
