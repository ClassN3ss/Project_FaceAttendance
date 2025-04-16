import React, { useEffect, useState } from 'react';
import API from '../services/api';
import "../styles/admin.css";

export default function FaceScanHistory() {
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    API.get('/attendance/history-student')
      .then(res => {
        const sorted = [...res.data].sort((a, b) => {
          const aDate = new Date(`${a.date}T${a.time}`);
          const bDate = new Date(`${b.date}T${b.time}`);
          return bDate - aDate; // เรียงใหม่: ล่าสุด → เก่าสุด
        });
        setHistory(sorted);
      })
      .catch(err => console.error("❌ โหลด log ไม่สำเร็จ:", err));
  }, []);

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const currentPageItems = history.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <h5>📊 ประวัติการสแกนใบหน้า</h5>
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th>นักศึกษา</th>
            <th>วันเวลา</th>
            <th>GPS</th>
            <th>วิชา</th>
          </tr>
        </thead>
        <tbody>
          {currentPageItems.map((h, idx) => (
            <tr key={idx}>
              <td>{h.userId?.fullName || '-'}</td>
              <td>{new Date(`${h.date}T${h.time}Z`).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
              </td>
              <td>{h.location?.lat}, {h.location?.lng}</td>
              <td>{h.classId?.courseName || '-'}</td>
            </tr>
          ))}
          {currentPageItems.length === 0 && (
            <tr>
              <td colSpan="4" className="text-center text-muted">ไม่มีประวัติ</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <button
          className="btn btn-sm btn-outline-primary"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          ⬅️ ย้อนกลับ
        </button>

        <span className="page-indicator">
          หน้า {page} / {totalPages}
        </span>

        <button
          className="btn btn-sm btn-outline-primary"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          หน้าถัดไป ➡️
        </button>
      </div>
    </div>
  );
}
