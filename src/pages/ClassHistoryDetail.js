import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/classhistoryDetail.css"; // ใส่ CSS แยกไว้

const ClassHistoryDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const classId = location.state?.classId;

  const [attendances, setAttendances] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const token = sessionStorage.getItem("token");
        const res = await API.get(`/attendance/class-row/${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = Array.isArray(res.data) ? res.data : [];
        setAttendances(data);
        setFiltered(data);
      } catch (err) {
        console.error("❌ โหลดข้อมูลล้มเหลว:", err);
        setAttendances([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    if (classId) fetchAttendance();
  }, [classId]);

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    setCurrentPage(1);

    if (!val) return setFiltered(attendances);

    const filteredByDate = attendances.filter((rec) => {
      const scanDate = new Date(rec.scan_time);
      const yyyy = scanDate.getFullYear();
      const mm = String(scanDate.getMonth() + 1).padStart(2, "0");
      const dd = String(scanDate.getDate()).padStart(2, "0");
      const scanDateStr = `${yyyy}-${mm}-${dd}`;
      return scanDateStr === val;
    });

    setFiltered(filteredByDate);
  };

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="container">
      <h3>📜 รายชื่อการเช็คชื่อ</h3>

      <div className="row mb-3">
        <div className="col-md-4">
          <label>📅 เลือกวันที่</label>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {loading ? (
        <p>⏳ กำลังโหลด...</p>
      ) : Array.isArray(filtered) && filtered.length === 0 ? (
        <p className="text-muted">❗ ยังไม่มีการเช็คชื่อ</p>
      ) : (
        <>
          <table className="table table-bordered mt-3">
            <thead className="table-light">
              <tr>
                <th>ชื่อ</th>
                <th>รหัส</th>
                <th>วันที่</th>
                <th>เวลา</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((rec, idx) => {
                const statusClass =
                  rec.status === "Present"
                    ? "success"
                    : rec.status === "Late"
                    ? "warning"
                    : "danger";

                return (
                  <tr key={idx} className={`table-${statusClass}`}>
                    <td>{rec.fullName}</td>
                    <td>{rec.studentId}</td>
                    <td>{new Date(rec.scan_time).toLocaleDateString("th-TH")}</td>
                    <td>{new Date(rec.scan_time).toLocaleTimeString()}</td>
                    <td>
                      <span className={`badge bg-${statusClass}`}>{rec.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-4 mb-5 page-wrapper">
              <button
                className="btn btn-page-nav"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ⬅️ ย้อนกลับ
              </button>

              <span className="page-indicator">
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                className="btn btn-page-nav"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                หน้าถัดไป ➡️
              </button>
            </div>
          )}
        </>
      )}

      <div className="d-flex justify-content-end mt-4">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          🔙 กลับ
        </button>
      </div>
    </div>
  );
};

export default ClassHistoryDetail;
