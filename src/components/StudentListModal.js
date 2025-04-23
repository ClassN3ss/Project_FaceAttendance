import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import API from '../services/api';
import "../styles/admin.css";

export default function StudentListModal({ show, onClose, students = [], classId }) {
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (!show || !classId || students.length === 0) return;
  
    const fetchStats = async () => {
      try {
        const res = await API.get(`/attendance/class/${classId}`);
        const summary = res.data;
  
        const normalizedStats = {};
        for (const key in summary) {
          const normalizedKey = key.trim().replace(/-/g, "");
          normalizedStats[normalizedKey] = summary[key];
        }
  
        setStats(normalizedStats);
      } catch (err) {
        console.error('❌ ดึงข้อมูลเช็คชื่อไม่สำเร็จ:', err);
        setStats({});
      }
    };
  
    fetchStats();
  }, [show, students, classId]);
  

  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title> รายชื่อนักศึกษา ({students.length} คน)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ul className="list-group">
          {students.map((s, idx) => {
            const sid = String(s.studentId || s.username || "").trim().replace(/-/g, "");
            const stat = stats[sid];

            return (
              <li key={idx} className="list-group-item">
                <div><strong>{s.studentId || s.username}</strong> - {s.fullName}</div>
                {stat ? (
                  <div className="mt-1 small text-muted-list">
                     มาเรียน: {stat.present} ครั้ง&nbsp;&nbsp;
                  </div>
                ) : (
                  <div className="mt-1 small text-muted-list">
                     มาเรียน: 0 ครั้ง&nbsp;&nbsp;
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Modal.Body>
    </Modal>
  );
}
