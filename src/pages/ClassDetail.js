import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import { Modal, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/classdetail.css";

const ClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = sessionStorage.getItem("token");

  const [classInfo, setClassInfo] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showCheckinTimeInputs, setShowCheckinTimeInputs] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);

  const fetchClassDetail = useCallback(async () => {
    try {
      const res = await API.get(`/classes/${id}`);
      setClassInfo(res.data);
    } catch {}
  }, [id]);

  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await API.get(`/checkin-sessions/class/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveSession(res.status === 204 ? null : res.data);
    } catch {
      setActiveSession(null);
    }
  }, [id, token]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await API.get("/enrollments/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = res.data.filter(r => r.classId?._id === id || r.classId === id);
      setRequests(filtered);
    } catch {}
  }, [id, token]);

  useEffect(() => {
    fetchClassDetail();
    fetchActiveSession();
    fetchRequests();
  }, [fetchClassDetail, fetchActiveSession, fetchRequests]);

  const updateField = (field, value) =>
    setClassInfo(prev => ({ ...prev, [field]: value }));

  const handleOpenSession = async () => {
    if (!classInfo.openAt || !classInfo.closeAt) return alert("⏰ กรุณาระบุเวลา");

    if (classInfo.withTeacherFace && !user.faceScanned) {
      setShowFaceModal(true);
      return;
    }

    try {
      let { latitude, longitude } = classInfo;

      if (!classInfo.withMapPreview) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000,
          })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      await API.post("/checkin-sessions/open", {
        classId: id,
        openAt: classInfo.openAt,
        closeAt: classInfo.closeAt,
        withTeacherFace: classInfo.withTeacherFace || false,
        withMapPreview: classInfo.withMapPreview || false,
        location: {
          latitude,
          longitude,
          radiusInMeters: classInfo.radius || 100,
          name: classInfo.locationName || "",
        },
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShowSuccessModal(true);
    } catch (err) {
      alert("❌ ไม่สามารถเปิด session ได้");
    }
  };

  const handleCloseSession = async () => {
    try {
      await API.put(`/checkin-sessions/cancel/${activeSession._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveSession(null);
      alert("✅ ปิด session สำเร็จ");
    } catch {
      alert("❌ ปิด session ไม่สำเร็จ");
    }
  };

  return (
    <div className="container">
      <h3>📘 รายละเอียดห้องเรียน</h3>
      <p><strong>รหัสวิชา:</strong> {classInfo?.courseCode}</p>
      <p><strong>ชื่อวิชา:</strong> {classInfo?.courseName}</p>
      <p><strong>ตอนเรียน:</strong> {classInfo?.section}</p>
      <p><strong>อาจารย์:</strong> {classInfo?.teacherId?.fullName}</p>

      {activeSession ? (
        <>
          <hr />
          <h5>🕐 Session ที่กำลังเปิด</h5>
          <table className="table table-bordered">
            <thead>
              <tr><th>วัน</th><th>เปิด</th><th>ปิด</th><th>ใบหน้า</th><th>สถานะ</th><th>ยกเลิก</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{new Date(activeSession.openAt).toLocaleDateString()}</td>
                <td>{new Date(activeSession.openAt).toLocaleTimeString()}</td>
                <td>{new Date(activeSession.closeAt).toLocaleTimeString()}</td>
                <td>{activeSession.withTeacherFace ? "ใช่" : "ไม่ใช่"}</td>
                <td><span className="badge bg-success">{activeSession.status}</span></td>
                <td><button className="btn btn-danger btn-sm" onClick={() => setShowConfirmModal(true)}>ปิด</button></td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>
          <hr />
          <h5 className="text-muted">❌ ไม่มี session ที่เปิดอยู่</h5>
        </>
      )}

      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Body>คุณแน่ใจหรือไม่ว่าจะปิด session นี้?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>ยกเลิก</Button>
          <Button variant="danger" onClick={() => { setShowConfirmModal(false); handleCloseSession(); }}>ยืนยัน</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Body>✅ เปิด session สำเร็จ กรุณารีเฟรชหน้า</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowSuccessModal(false)}>ตกลง</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showFaceModal} onHide={() => setShowFaceModal(false)} centered>
        <Modal.Body>⚠️ ต้องบันทึกใบหน้าอาจารย์ก่อนเปิดห้อง</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => navigate("/save-face-teacher")}>ไปบันทึก</Button>
        </Modal.Footer>
      </Modal>

      <hr />
      <h5 onClick={() => setShowCheckinTimeInputs(x => !x)} style={{ cursor: "pointer" }}>
        📅 ตั้งเวลาเช็คชื่อ {showCheckinTimeInputs ? "⬆️" : "⬇️"}
      </h5>

      {showCheckinTimeInputs && (
        <div className="row mb-3 align-items-end">
          <div className="col-md-3">
            <input type="datetime-local" className="form-control" value={classInfo.openAt || ""} onChange={e => updateField("openAt", e.target.value)} />
          </div>
          <div className="col-md-3">
            <input type="datetime-local" className="form-control" value={classInfo.closeAt || ""} onChange={e => updateField("closeAt", e.target.value)} />
          </div>
          <div className="col-md-3">
            <input type="checkbox" className="form-check-input me-2" checked={classInfo.withTeacherFace || false} onChange={e => updateField("withTeacherFace", e.target.checked)} /> ใบหน้า
            <br />
            <input type="checkbox" className="form-check-input me-2 mt-2" checked={classInfo.withMapPreview || false} onChange={e => updateField("withMapPreview", e.target.checked)} /> ใช้แผนที่
          </div>
          <div className="col-md-3">
            <button className="btn btn-primary w-100" onClick={handleOpenSession}>✅ เปิด</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetail;
