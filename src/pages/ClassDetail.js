import React, { useEffect, useState, useCallback, useRef } from "react";
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

  const [selectedReq, setSelectedReq] = useState(() => new Set());
  const [showCheckinTimeInputs, setShowCheckinTimeInputs] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [pickLatLng, setPickLatLng] = useState(null);
  const [searchText, setSearchText] = useState("");

  const [studentPage, setStudentPage] = useState(1);
  const [studentQuery, setStudentQuery] = useState("");

  const [requestPage, setRequestPage] = useState(1);
  const REQUESTS_PER_PAGE = 10;
  const totalRequests = requests.length;
  const totalRequestPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));
  const startReqIdx = (requestPage - 1) * REQUESTS_PER_PAGE;
  const currentRequests = requests.slice(startReqIdx, startReqIdx + REQUESTS_PER_PAGE);

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
      const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const filtered = list.filter(r => r.classId?._id === id || r.classId === id);
      setRequests(filtered);
    } catch (err) {
      console.error("❌ โหลดคำร้องล้มเหลว", err);
      setRequests([]);
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
        window.location.reload();
      }
    }, 2000);
  
    return () => clearInterval(interval);
  }, [activeSession]);
  
  useEffect(() => {
    setStudentPage(1);
  }, [classInfo?.students?.length, studentQuery]);

  const ensureLeafletLoaded = () =>
    new Promise((resolve, reject) => {
      if (window.L) return resolve();
      // inject CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      // inject JS
      const scriptId = "leaflet-js";
      if (document.getElementById(scriptId)) {
        document.getElementById(scriptId).addEventListener("load", () => resolve());
        return;
      }
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });

  const initMapIfNeeded = async () => {
    await ensureLeafletLoaded();
    const L = window.L;

    // เคลียร์อินสแตนซ์เดิมถ้ามี
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }

    const startLat = Number.isFinite(classInfo?.latitude) ? classInfo.latitude : 13.736717;
    const startLng = Number.isFinite(classInfo?.longitude) ? classInfo.longitude : 100.523186;

    const map = L.map("leaflet-map", { center: [startLat, startLng], zoom: 16 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    marker.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng();
      setPickLatLng({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setPickLatLng({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    });

    mapRef.current = map;
    markerRef.current = marker;
    setPickLatLng({ lat: +startLat.toFixed(6), lng: +startLng.toFixed(6) });
  };

  // เปิด modal → สร้างแผนที่
  useEffect(() => {
    if (showMapPicker) initMapIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMapPicker]);

  const geocodeSearch = async () => {
    if (!searchText.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`;
      const resp = await fetch(url, { headers: { "Accept-Language": "th" } });
      const data = await resp.json();
      if (data?.length) {
        const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
        mapRef.current.setView([lat, lng], 17);
        markerRef.current.setLatLng([lat, lng]);
        setPickLatLng({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
      } else {
        alert("ไม่พบสถานที่ที่ค้นหา");
      }
    } catch (e) {
      console.error(e);
      alert("ค้นหาสถานที่ไม่สำเร็จ");
    }
  };

  const flyToLatLng = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current.setView([lat, lng], 17);
    markerRef.current.setLatLng([lat, lng]);
    setPickLatLng({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  };

  const useGPSInModal = () => {
    if (!("geolocation" in navigator)) return alert("อุปกรณ์ไม่รองรับการระบุตำแหน่ง");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = +coords.latitude.toFixed(6);
        const lng = +coords.longitude.toFixed(6);
        flyToLatLng(lat, lng);
      },
      (err) => alert(err?.message || "ดึงพิกัดไม่สำเร็จ"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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
          withMapPreview: !!classInfo.withMapPreview,
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
    try{
        await API.put(`/enrollments/approve/${reqId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(prev => prev.filter(r => r._id !== reqId));
      setSelectedReq((prev) => {
        const n = new Set(prev);
        n.delete(reqId);
        return n;
      });
    } catch (err) {
      console.error(err);
      alert("อนุมัติไม่สำเร็จ");
    }
  };

  const handleReject = async (reqId) => {
    try{
      await API.delete(`/enrollments/${reqId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRequests(prev => prev.filter(r => r._id !== reqId));
    setSelectedReq((prev) => {
      const n = new Set(prev);
      n.delete(reqId);
      return n;
    });
    } catch (err) {
      console.error(err);
      alert("ปฏิเสธไม่สำเร็จ");
    }
  };

  const allSelected = requests.length > 0 && requests.every((r) => selectedReq.has(r._id));
  const toggleOne = (rid) => setSelectedReq((prev) => {
      const n = new Set(prev);
      n.has(rid) ? n.delete(rid) : n.add(rid);
      return n;
  });
  const toggleAll = () => setSelectedReq((prev) => {
      const n = new Set(prev);
      if (allSelected) requests.forEach((r) => n.delete(r._id));
      else requests.forEach((r) => n.add(r._id));
      return n;
  });

  const handleApproveSelected = async () => {
    const ids = requests.filter((r) => selectedReq.has(r._id)).map((r) => r._id);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((rid) =>
          API.put(`/enrollments/approve/${rid}`, {}, { headers: { Authorization: `Bearer ${token}` } })
        )
      );
      setRequests((prev) => prev.filter((r) => !selectedReq.has(r._id)));
      setSelectedReq(new Set());
    } catch (e) {
      console.error(e);
      alert("ยืนยันที่เลือกไม่สำเร็จ");
    }
  };

  const handleRejectSelected = async () => {
    const ids = requests.filter((r) => selectedReq.has(r._id)).map((r) => r._id);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((rid) =>
          API.delete(`/enrollments/${rid}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      setRequests((prev) => prev.filter((r) => !selectedReq.has(r._id)));
      setSelectedReq(new Set());
    } catch (e) {
      console.error(e);
      alert("ปฏิเสธที่เลือกไม่สำเร็จ");
    }
  };

  if (loading) return <div className="container mt-4">กำลังโหลดข้อมูลห้อง...</div>;
  if (!classInfo) return <div className="container mt-4 text-danger">❌ ไม่พบข้อมูลห้องเรียน</div>;

  // Students pagination + search computed values
  const allStudents = classInfo?.students || [];
  const q = studentQuery.trim().toLowerCase();
  const filteredStudents = q
    ? allStudents.filter((s) => {
        const name = (s.fullName || "").toLowerCase();
        const sid = (s.studentId || s.username || "").toLowerCase();
        return name.includes(q) || sid.includes(q);
      })
    : allStudents;

  const totalStudents = filteredStudents.length;
  const STUDENTS_PER_PAGE = 10;
  const totalStudentPages = Math.max(
    1,
    Math.ceil(totalStudents / STUDENTS_PER_PAGE)
  );
  const startIdx = (studentPage - 1) * STUDENTS_PER_PAGE;
  const currentStudents = filteredStudents.slice(
    startIdx,
    startIdx + STUDENTS_PER_PAGE
  );

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
        <Modal.Header closeButton><Modal.Title>! ยืนยันการปิด Session</Modal.Title></Modal.Header>
        <Modal.Body>คุณแน่ใจหรือไม่ว่าต้องการ <strong>ปิด session</strong> นี้?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>ยกเลิก</Button>
          <Button variant="danger" onClick={() => { setShowConfirmModal(false); handleCloseSession(); }}>ยืนยัน</Button>
        </Modal.Footer>
      </Modal>

      <hr />
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h5 className="m-0">เปิดเวลาเช็คชื่อ</h5>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowCheckinTimeInputs(s => !s)} >
            {showCheckinTimeInputs ? 'ซ่อนการตั้งค่า ▲' : 'แสดงการตั้งค่า ▼'}
          </button>
        </div>

        {showCheckinTimeInputs && (
          <div className="mt-3">
            <div className="row g-3 align-items-center">
              {/* เวลาเริ่ม */}
              <div className="col-md-3">
                <label className="form-label fw-bold text-dark">เวลาเริ่ม</label>
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

              {/* เวลาสิ้นสุด */}
              <div className="col-md-3">
                <label className="form-label fw-bold text-dark">เวลาสิ้นสุด</label>
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

              {/* ใบหน้าอาจารย์ */}
              <div className="col-md-3 d-flex justify-content-center">
                <div>
                  <div className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      id="withTeacherFace"
                      checked={classInfo.withTeacherFace || false}
                      onChange={(e) => updateField("withTeacherFace", e.target.checked)}
                    />
                    <label htmlFor="withTeacherFace" className="form-check-label text-dark">
                      ใบหน้าอาจารย์
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      id="withMapPreview"
                      checked={classInfo.withMapPreview || false}
                      onChange={(e) => updateField("withMapPreview", e.target.checked)}
                    />
                    <label htmlFor="withMapPreview" className="form-check-label text-dark">
                      ใช้แผนที่กำหนดตำแหน่ง
                    </label>
                  </div>
                </div>
              </div>

              {/* ปุ่มเปิด */}
              <div className="col-md-3 d-flex justify-content-center align-items-center">
                <button className="btn btn-success w-100" onClick={handleOpenSession}>
                  เปิด
                </button>
              </div>
            </div>

            {classInfo.withMapPreview && (
              <div className="mt-3">
                <div className="position-relative" style={{ height: 250 }}>
                  <iframe
                    width="100%"
                    height="100%"
                    loading="lazy"
                    style={{ border: 0 }}
                    allowFullScreen
                    src={`https://maps.google.com/maps?q=${
                      classInfo.latitude || 13.736717
                    },${classInfo.longitude || 100.523186}&z=16&output=embed`}
                    title="map-preview"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="btn btn-success btn-sm"
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 12,
                      zIndex: 2,
                      borderRadius: 999,
                      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
                      padding: "6px 12px",
                    }}
                  >
                    เปิดแผนที่
                  </button>
                </div>

                <div className="row g-3 mt-2">
                  <div className="col-md-12">
                    <label className="form-label">ชื่อสถานที่</label>
                    <input
                      className="form-control"
                      placeholder="ชื่อสถานที่"
                      type="text"
                      value={classInfo.locationName || ""}
                      onChange={(e) => updateField("locationName", e.target.value)}
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">ละติจูด</label>
                    <input
                      className="form-control"
                      placeholder="ละติจูด"
                      type="number"
                      step="0.000001"
                      value={classInfo.latitude || ""}
                      onChange={(e) =>
                        updateField("latitude", parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">ลองจิจูด</label>
                    <input
                      className="form-control"
                      placeholder="ลองจิจูด"
                      type="number"
                      step="0.000001"
                      value={classInfo.longitude || ""}
                      onChange={(e) =>
                        updateField("longitude", parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">ระยะที่อนุญาต (เมตร)</label>
                    <input
                      className="form-control"
                      placeholder="ระยะอนุญาต (เมตร)"
                      type="number"
                      value={classInfo.radius || 50}
                      onChange={(e) =>
                        updateField("radius", parseInt(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal เลือกตำแหน่งบนแผนที่ (Leaflet) */}
      <Modal show={showMapPicker} onHide={() => setShowMapPicker(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>เลือกตำแหน่งบนแผนที่</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex gap-2 mb-2">
            <input
              className="form-control"
              placeholder="ค้นหาสถานที่ หรือพิมพ์ 13.7367,100.5232"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const m = searchText.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
                  if (m) {
                    const lat = parseFloat(m[1]); const lng = parseFloat(m[3]);
                    flyToLatLng(lat, lng);
                  } else {
                    geocodeSearch();
                  }
                }
              }}
            />
            <Button variant="primary" onClick={() => {
              const m = searchText.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
              if (m) {
                const lat = parseFloat(m[1]); const lng = parseFloat(m[3]);
                flyToLatLng(lat, lng);
              } else {
                geocodeSearch();
              }
            }}>ค้นหา</Button>
            <Button variant="secondary" onClick={useGPSInModal}>ใช้พิกัดปัจจุบัน</Button>
          </div>

          <div id="leaflet-map" style={{ width: "100%", height: 420, borderRadius: 8, overflow: "hidden" }} />
          <div className="mt-2">พิกัดที่เลือก: <strong>{pickLatLng ? `${pickLatLng.lat}, ${pickLatLng.lng}` : "-"}</strong></div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMapPicker(false)}>ปิด</Button>
          <Button
            variant="success"
            onClick={() => {
              if (!pickLatLng) return;
              updateField("latitude", pickLatLng.lat);
              updateField("longitude", pickLatLng.lng);
              setShowMapPicker(false);
            }}
          >
            ใช้ตำแหน่งนี้
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>✅ เปิด Session สำเร็จ</Modal.Title></Modal.Header>
        <Modal.Body>ระบบเปิด session การเช็คชื่อเรียบร้อยแล้ว</Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>ตกลง</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showFaceModal} onHide={() => setShowFaceModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>! ต้องบันทึกใบหน้า</Modal.Title></Modal.Header>
        <Modal.Body>กรุณาบันทึกใบหน้าอาจารย์ก่อนเปิดห้อง</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFaceModal(false)}>ยกเลิก</Button>
          <Button variant="primary" onClick={() => navigate("/save-face-teacher")}>ไปบันทึกใบหน้า</Button>
        </Modal.Footer>
      </Modal>

      <hr />
      <div className="d-flex justify-content-between align-items-center mb-2">
        {requests.length === 0 ? (
          <h5 className="m-0 text-center w-100">คำร้องขอเข้าห้องเรียน</h5>
        ) : (
          <h5 className="m-0 text-start">คำร้องขอเข้าห้องเรียน</h5>
        )}
        {requests.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            <div className="form-check me-2">
              <input
                type="checkbox"
                className="form-check-input"
                checked={allSelected}
                onChange={toggleAll}
              />
              <label className="form-check-label">เลือกทั้งหมด</label>
            </div>
            <button
              className={`btn btn-sm ${[...selectedReq].length === 0 ? "btn-outline-success" : "btn-success"}`}
              onClick={handleApproveSelected}
              disabled={[...selectedReq].length === 0}
            >
              ยืนยันที่เลือก
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={handleRejectSelected}
              disabled={[...selectedReq].length === 0}
            >
              ปฏิเสธที่เลือก
            </button>
          </div>
        )}
      </div>
      {requests.length === 0 ? (
        <p className="text-muted">ไม่มีคำร้อง</p>
      ) : (
        <div>
          <ul className="list-group mb-4">
            {currentRequests.map((r) => (
              <li key={r._id} className="list-group-item d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selectedReq.has(r._id)}
                    onChange={() => toggleOne(r._id)}
                  />
                  <span>{r.student?.fullName} ({r.student?.studentId})</span>
                </div>
                <div>
                  <button className="btn btn-success btn-sm me-2" onClick={() => handleApprove(r._id)}>✅ อนุมัติ</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReject(r._id)}>❌ ปฏิเสธ</button>
                </div>
              </li>
            ))}
          </ul>

          {totalRequestPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-2 mt-2">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
                disabled={requestPage === 1}
              >
                หน้าก่อนหน้า
              </button>
              <span className="page-indicator">หน้า {requestPage} / {totalRequestPages}</span>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setRequestPage((p) => Math.min(totalRequestPages, p + 1))}
                disabled={requestPage === totalRequestPages}
              >
                หน้าถัดไป
              </button>
            </div>
          )}
        </div>
      )}

      <hr />
      <h5>รายชื่อนักเรียน ({totalStudents} คน)</h5>

      {/* Search box */}
      <div className="row g-2 align-items-center mb-2">
        <div className="col-md-6 col-lg-4 ms-auto">
          <input
            type="text"
            className="form-control"
            placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
          />
        </div>
      </div>

      {totalStudents === 0 ? (
        <p className="text-muted">ไม่พบนักเรียนที่ตรงกับคำค้น</p>
      ) : (
        <>
          <ul className="list-group">
            {currentStudents.map((s) => (
              <li key={s._id} className="list-group-item">
                {s.fullName} ({s.studentId || s.username})
              </li>
            ))}
          </ul>

          <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
              disabled={studentPage === 1}
            >
              หน้าก่อนหน้า
            </button>
            <span className="page-indicator">
              หน้า {studentPage} / {totalStudentPages}
            </span>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
              disabled={studentPage === totalStudentPages}
            >
              หน้าถัดไป
            </button>
          </div>
        </>
      )}

      <div className="d-flex justify-content-between mt-4">
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate(`/class-historydetail/${id}`, { state: { classId: classInfo._id } })}
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
