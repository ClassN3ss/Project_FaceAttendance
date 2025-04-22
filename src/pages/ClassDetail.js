import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";
import "../App.css";
import "../styles/classdetail.css";
import { formatThaiDate, formatThaiTime } from "../utils/datetime";

const ClassDetail = () => {
  const { id } = useParams();
  const [classInfo, setClassInfo] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCheckinTimeInputs, setShowCheckinTimeInputs] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { user } = useAuth();
  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const formatDatetimeLocal = (dateStr) => {
    const date = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };  

  const fetchClassDetail = useCallback(async () => {
    try {
      const res = await API.get(`/classes/${id}`);
      setClassInfo(res.data);
    } catch (err) {
      console.error("❌ โหลดข้อมูลห้องล้มเหลว", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await API.get("/enrollments/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = res.data.filter(r => r.classId?._id === id || r.classId === id);
      setRequests(filtered);
    } catch (err) {
      console.error("❌ โหลดคำร้องล้มเหลว", err);
    }
  }, [id, token]);

  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await API.get(`/checkin-sessions/class/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.status === "active") {
        setActiveSession(res.data);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error("❌ ดึง session ล่าสุดไม่สำเร็จ:", err);
      setActiveSession(null);
    }
  }, [id, token]);

  useEffect(() => {
    fetchClassDetail();
    fetchRequests();
    fetchActiveSession();
  }, [fetchClassDetail, fetchRequests, fetchActiveSession]);

  useEffect(() => {
    if (!activeSession?.closeAt) return;
  
    const interval = setInterval(() => {
      const now = new Date();
      const closeTime = new Date(activeSession.closeAt);
  
      if (now >= closeTime) {
        clearInterval(interval);
        setActiveSession(null);
        window.location.reload(); // ✅ รีเฟรชเมื่อหมดเวลา session
      }
    }, 2000);
  
    return () => clearInterval(interval);
  }, [activeSession]);  

  const updateField = (field, value) => {
    if (["openAt", "closeAt"].includes(field)) {
      const utc = new Date(value).toISOString(); // แปลง local → UTC
      setClassInfo((prev) => ({ ...prev, [field]: utc }));
    } else {
      setClassInfo((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleOpenSession = async () => {
    if (!classInfo.openAt || !classInfo.closeAt) {
      return alert("กรุณาระบุเวลาให้ครบก่อน");
    }
  
    if (classInfo.withTeacherFace && !user.faceScanned) {
      setShowFaceModal(true);
      return;
    }
  
    try {
      const check = await API.get(`/checkin-sessions/class/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      const stillOpen = check.data?.status === "active" && new Date(check.data.closeAt) > new Date();
      if (stillOpen) {
        return alert("❌ ยังมี session เปิดอยู่ กรุณาปิดหรือรอหมดเวลาก่อน");
      }
  
      let latitude = classInfo.latitude;
      let longitude = classInfo.longitude;
  
      if (!classInfo.withMapPreview) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }
  
      if (!latitude || !longitude) {
        alert("❌ ไม่สามารถดึงพิกัดได้ กรุณาเปิด GPS แล้วลองใหม่");
        return;
      }
  
      const response = await API.post(
        "/checkin-sessions/open",
        {
          classId: id,
          openAt: classInfo.openAt,
          closeAt: classInfo.closeAt,
          withTeacherFace: classInfo.withTeacherFace || false,
          location: {
            latitude,
            longitude,
            radiusInMeters: classInfo.radius || 50,
            name: classInfo.locationName || "",
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      if (response.data.session) {
        setActiveSession(response.data.session);
      } else {
        await fetchActiveSession(); // fallback
      }
  
      setShowSuccessModal(true);
      fetchClassDetail();
    } catch (err) {
      console.error("❌ เปิด session ล้มเหลว:", err);
      alert("❌ เปิดไม่สำเร็จ หรือไม่ได้เปิดใช้งาน GPS");
    }
  };  

  const handleCloseSession = async () => {
    if (!activeSession?._id) return;
    try {
      await API.put(`/checkin-sessions/cancel/${activeSession._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("✅ ปิด session สำเร็จ");
      setActiveSession(null);
      window.location.reload();
    } catch (err) {
      alert("❌ ปิด session ล้มเหลว");
      console.error(err);
    }
  };

  const handleApprove = async (reqId) => {
    await API.put(`/enrollments/approve/${reqId}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRequests(prev => prev.filter(r => r._id !== reqId));
    window.location.reload();
  };

  const handleReject = async (reqId) => {
    await API.delete(`/enrollments/${reqId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRequests(prev => prev.filter(r => r._id !== reqId));
    window.location.reload();
  };

  if (loading) return <div className="container mt-4">กำลังโหลดข้อมูลห้อง...</div>;
  if (!classInfo) return <div className="container mt-4 text-danger">❌ ไม่พบข้อมูลห้องเรียน</div>;

  return (
    <div className="container">
      <h3>รายละเอียดห้องเรียน</h3>
      <p><strong>รหัสวิชา:</strong> {classInfo.courseCode}</p>
      <p><strong>ชื่อวิชา:</strong> {classInfo.courseName}</p>
      <p><strong>ตอนเรียน:</strong> {classInfo.section}</p>
      <p><strong>อาจารย์:</strong> {classInfo.teacherId?.fullName}</p>

      {activeSession && (
        <>
          <hr />
          <h5>Session ล่าสุดที่กำลังเปิด</h5>
          <table className="table table-bordered">
            <thead>
              <tr><th>วัน</th><th>เวลาเปิด</th><th>เวลาปิด</th><th>ต้องสแกนใบหน้าอาจารย์</th><th>สถานะ</th><th>ยกเลิก</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatThaiDate(activeSession.openAt)}</td>
                <td>{formatThaiTime(activeSession.openAt)}</td>
                <td>{formatThaiTime(activeSession.closeAt)}</td>
                <td>{activeSession.withTeacherFace ? "ใช่" : "ไม่ใช่"}</td>
                <td><span className="badge bg-success">{activeSession.status}</span></td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowConfirmModal(true)}>❌ ปิด session</button>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>! ยืนยันการปิด Session</Modal.Title>
        </Modal.Header>
        <Modal.Body>คุณแน่ใจหรือไม่ว่าต้องการ <strong>ปิด session</strong> นี้?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>ยกเลิก</Button>
          <Button variant="danger" onClick={() => { setShowConfirmModal(false); handleCloseSession(); }}>
             ยืนยัน
          </Button>
        </Modal.Footer>
      </Modal>

      <hr />
      <h5 style={{ cursor: "pointer" }} onClick={() => setShowCheckinTimeInputs(prev => !prev)}>
         เปิดเวลาเช็คชื่อ {showCheckinTimeInputs ? "^" : "*"}
      </h5>

      {showCheckinTimeInputs && (
        <div className="row mb-3 align-items-end">
          <div className="col-md-3">
            <input
              type="datetime-local"
              className="form-control"
              value={classInfo.openAt ? formatDatetimeLocal(classInfo.openAt) : ""}
              onChange={(e) => {
                updateField("openAt", e.target.value);
                e.target.blur();
              }}
            />
          </div>
          <div className="col-md-3">
            <input
              type="datetime-local"
              className="form-control"
              value={classInfo.closeAt ? formatDatetimeLocal(classInfo.closeAt) : ""}
              onChange={(e) => {
                updateField("closeAt", e.target.value);
                e.target.blur();
              }}
            />
          </div>
          <div className="col-md-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input me-2"
                checked={classInfo.withTeacherFace || false}
                onChange={(e) => updateField("withTeacherFace", e.target.checked)}
              /> ใบหน้าอาจารย์
            </div>
            <div className="form-check mt-1">
              <input
                type="checkbox"
                className="form-check-input me-2"
                checked={classInfo.withMapPreview || false}
                onChange={(e) => updateField("withMapPreview", e.target.checked)}
              /> ใช้แผนที่กำหนดตำแหน่ง
            </div>
          </div>
          <div className="col-md-3">
            <button className="btn btn-primary w-100" onClick={handleOpenSession}>เปิด</button>
          </div>

          {classInfo.withMapPreview && (
            <div className="col-12 mt-3">
              <iframe
                width="100%"
                height="250"
                loading="lazy"
                style={{ border: 0 }}
                allowFullScreen
                src={`https://maps.google.com/maps?q=${classInfo.latitude || 13.736717},${classInfo.longitude || 100.523186}&z=16&output=embed`}
                title="map-preview"
              ></iframe>
              <div className="mt-2">
                ชื่อสถานที่
                <input
                  className="form-control mb-2"
                  placeholder="ชื่อสถานที่"
                  type="text"
                  value={classInfo.locationName || ""}
                  onChange={(e) => updateField("locationName", e.target.value)}
                />
                ละติจูด
                <input
                  className="form-control mb-2"
                  placeholder="ละติจูด"
                  type="number"
                  value={classInfo.latitude || ""}
                  onChange={(e) => updateField("latitude", parseFloat(e.target.value))}
                />
                ลองจิจูด
                <input
                  className="form-control mb-2"
                  placeholder="ลองจิจูด"
                  type="number"
                  value={classInfo.longitude || ""}
                  onChange={(e) => updateField("longitude", parseFloat(e.target.value))}
                />
                ระยะที่อนุญาต (เมตร)
                <input
                  className="form-control"
                  placeholder="ระยะอนุญาต (เมตร)"
                  type="number"
                  value={classInfo.radius || 50}
                  onChange={(e) => updateField("radius", parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>✅ เปิด Session สำเร็จ</Modal.Title>
        </Modal.Header>
        <Modal.Body>ระบบเปิด session การเช็คชื่อเรียบร้อยแล้ว</Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>ตกลง</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showFaceModal} onHide={() => setShowFaceModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>! ต้องบันทึกใบหน้า</Modal.Title>
        </Modal.Header>
        <Modal.Body>กรุณาบันทึกใบหน้าอาจารย์ก่อนเปิดห้อง</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFaceModal(false)}>ยกเลิก</Button>
          <Button variant="primary" onClick={() => navigate("/save-face-teacher")}>ไปบันทึกใบหน้า</Button>
        </Modal.Footer>
      </Modal>

      <hr />
      <h5>คำร้องขอเข้าห้องเรียน</h5>
      {requests.length === 0 ? (
        <p className="text-muted">ไม่มีคำร้อง</p>
      ) : (
        <ul className="list-group mb-4">
          {requests.map((r) => (
            <li key={r._id} className="list-group-item d-flex justify-content-between">
              <span>{r.student?.fullName} ({r.student?.studentId})</span>
              <div>
                <button className="btn btn-success btn-sm me-2" onClick={() => handleApprove(r._id)}>✅ อนุมัติ</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleReject(r._id)}>❌ ปฏิเสธ</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <hr />
      <h5>รายชื่อนักเรียน ({classInfo.students?.length || 0} คน)</h5>
      {classInfo.students?.length === 0 ? (
        <p className="text-muted">ยังไม่มีนักเรียนในห้องนี้</p>
      ) : (
        <ul className="list-group">
          {classInfo.students.map((s) => (
            <li key={s._id} className="list-group-item">
              {s.fullName} ({s.studentId || s.username})
            </li>
          ))}
        </ul>
      )}

      <div className="d-flex justify-content-between mt-4">
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate(`/class-historydetail/${id}`, {
            state: { classId: classInfo._id }
          })}
        >
           ดูประวัติการเช็คชื่อทั้งหมด
        </button>
        <button className="btn btn-outline-danger bg-light-red" onClick={() => navigate(-1)}>
           กลับ
        </button>
      </div>
    </div>
  );
};

export default ClassDetail;
