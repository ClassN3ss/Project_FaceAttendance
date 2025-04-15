import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/checkinpage.css";

const CheckInPage = () => {
  const { id: classId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await API.get(`/checkin-sessions/class/${classId}`);
        setSession(res.data);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [classId]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("user"));
        const token = sessionStorage.getItem("token");
        const res = await API.get(`/attendance/history/${user.studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const filtered = res.data.history.filter(
          (rec) => rec.classId?._id === classId
        );
        setHistory(filtered);
      } catch (err) {
        console.error("❌ โหลดประวัติไม่สำเร็จ:", err);
      }
    };
    fetchHistory();
  }, [classId]);

  useEffect(() => {
    const handlePop = () => {
      if (!location.state?.fromScanFace) {
        navigate("/student-dashboard", { replace: true });
      }
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [navigate, location]);

  useEffect(() => {
    if (!session?.closeAt) return;
    const interval = setInterval(() => {
      const now = new Date();
      const close = new Date(session.closeAt);
      if (now >= close) {
        window.location.reload();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await API.get(`/checkin-sessions/class/${classId}`);
        if (res.data?.status === "active") {
          if (!session || res.data._id !== session._id) {
            setSession(res.data);
            window.location.reload();
          }
        } else setSession(null);
      } catch {
        setSession(null);
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [classId, session]);

  const goToScanFace = () => {
    navigate(`/scan-face/${classId}`, { state: { fromScanFace: true } });
  };

  const paginatedData = history.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const totalPages = Math.ceil(history.length / rowsPerPage);

  if (loading) return <div className="container mt-4">⏳ กำลังโหลด session...</div>;

  return (
    <div className="container checkin-container">
      <h3>🧑‍🏫 เช็คชื่อเข้าเรียน</h3>

      {!session ? (
        <div className="alert alert-warning">
          ⏳ ขณะนี้ยังไม่มี session เปิดอยู่ กรุณารออาจารย์
        </div>
      ) : (
        <div className="text-center mt-4">
          <p>
            🗓️ วันที่: {new Date(session.openAt).toLocaleDateString()} <br />
            🕐 เปิด: {new Date(session.openAt).toLocaleTimeString()} - ปิด:{" "}
            {new Date(session.closeAt).toLocaleTimeString()}
          </p>
          <button className="btn btn-primary btn-lg" onClick={goToScanFace}>
            📸 ไปสแกนใบหน้าเพื่อลงชื่อ
          </button>
        </div>
      )}

      <h4 className="mt-5">📜 ประวัติการเช็คชื่อวิชานี้</h4>
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เวลา</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.length > 0 ? (
            paginatedData.map((rec, idx) => (
              <tr
                key={idx}
                className={`table-${
                  rec.status === "Present"
                    ? "success"
                    : rec.status === "Late"
                    ? "warning"
                    : "danger"
                }`}
              >
                <td>{new Date(rec.scan_time).toLocaleDateString()}</td>
                <td>{new Date(rec.scan_time).toLocaleTimeString()}</td>
                <td>
                  <span
                    className={`badge bg-${
                      rec.status === "Present"
                        ? "success"
                        : rec.status === "Late"
                        ? "warning"
                        : "danger"
                    }`}
                  >
                    {rec.status}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="text-center text-muted">
                ❗ ยังไม่มีประวัติในวิชานี้
              </td>
            </tr>
          )}
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
      <div className="d-flex justify-content-end mt-4 mb-5">
        <button className="btn btn-sm btn-success" onClick={() => navigate("/student-dashboard")}>
          🔙 กลับ
        </button>
      </div>
    </div>
  );
};

export default CheckInPage;
