import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import API from "../services/api";
import "../styles/scanface.css";

const Scanface = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { classId } = useParams();

  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("โปรดหันหน้าตรง แล้วกด 'เริ่มสแกนใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
  };

  const startCamera = async () => {
    try {
      // ✅ ใช้กล้องหน้า + ปิดเสียง
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        // เคลียร์ของเก่า (กัน race)
        const old = videoRef.current.srcObject;
        if (old) old.getTracks().forEach((t) => t.stop());

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => setVideoReady(true)).catch((err) => {
            console.warn("play() interrupted", err);
          });
        };
      }
    } catch {
      setMessage("❌ โปรดอนุญาตให้เว็บไซต์ใช้กล้องของคุณ");
      setVideoReady(false);
    }
  };

  const fetchSession = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await API.get(`/checkin-sessions/class/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSession(res.data);
    } catch {
      setMessage("❌ ขณะนี้ยังไม่มี session เปิดอยู่ กรุณารออาจารย์");
    }
  }, [classId]);

  useEffect(() => {
    startCamera();
    fetchSession();
    return () => stopCamera();
  }, [fetchSession]);

  const getGPSLocation = () =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => reject(new Error("❌ เข้าถึง GPS ไม่สำเร็จ")),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await res.json();
      return data.display_name || "ตำแหน่งที่ไม่รู้จัก";
    } catch {
      return "ตำแหนงที่ไม่รู้จัก";
    }
  };

  const handleNormalCheckin = async (payload, token) => {
    try {
      await API.post("/attendance/checkin", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(`✅ เช็คชื่อสำเร็จ! ขอบคุณ ${payload.fullName}`);
      stopCamera();
      navigate("/student-dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "❌ เช็คชื่อไม่สำเร็จ";
      alert(msg);
    }
  };

  const redirectToTeacherScan = (payload) => {
    alert("สแกนใบหน้าอาจารย์เพื่อยืนยันตัวตนก่อนเช็คชื่อ");
    sessionStorage.setItem("studentDescriptor", JSON.stringify(payload));
    stopCamera();
    navigate(`/verifyface-teacher/${classId}`, { replace: true });
  };

  const scanFace = async () => {
    if (!videoReady) return setMessage("รอกล้องโหลดให้เสร็จก่อน...");
    if (!session) return setMessage("❌ ไม่พบ session ที่เชื่อมกับห้องนี้");

    setLoading(true);
    setMessage("กำลังตรวจจับใบหน้า...");

    try {
      // 1) ถ่ายภาพจากวิดีโอ (วิดีโอเป็น mirror → แก้ทิศก่อนส่ง)
      const canvas = document.createElement("canvas");
      const v = videoRef.current;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");

      // 🔁 กลับด้านให้เป็นภาพปกติก่อน
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

      const imageBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg")
      );

      // 2) เรียก Face API (เส้นที่ 1): verify-one
      const sid =
        sessionStorage.getItem("studentId") ||
        localStorage.getItem("studentId") ||
        "";
      const sname =
        sessionStorage.getItem("fullName") ||
        localStorage.getItem("fullName") ||
        "";

      if (!sid.trim()) {
        setMessage("❌ ไม่พบรหัสนักศึกษา (studentId) ใน session — โปรดล็อกอินใหม่");
        setLoading(false);
        return;
      }
      if (!sname.trim()) {
        setMessage("❌ ไม่พบชื่อผู้ใช้ (fullName) — โปรดล็อกอินใหม่");
        setLoading(false);
        return;
      }

      const modelForm = new FormData();
      modelForm.append("fullname", sname);
      modelForm.append("studentID", sid);
      modelForm.append("image", imageBlob);

      const verifyRes = await fetch(`http://localhost:5000/api/scan-face`, {
        method: "POST",
        body: modelForm,
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.ok || !verifyData.match) {
        setMessage(verifyData.message || "❌ ใบหน้าไม่ถูกต้อง กรุณาลองใหม่");
        setLoading(false);
        return;
      }

      // 3) ตรวจ GPS (ถ้าตั้งค่า)
      const gps = await getGPSLocation();
      const distance = calculateDistance(
        session?.location?.latitude || 0,
        session?.location?.longitude || 0,
        gps.latitude,
        gps.longitude
      );

      if (session?.location?.radiusInMeters && distance > session.location.radiusInMeters) {
        const place = await reverseGeocode(gps.latitude, gps.longitude);
        setMessage(
          `❌ คุณอยู่นอกพื้นที่เช็คชื่อ (ห่าง ${Math.round(distance)} เมตร)` +
            `\n- พิกัดของคุณ: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` +
            `\n- สถานที่: ${place}` +
            (session.location.name ? `\n- จุดหมายเช็คชื่อ: ${session.location.name}` : "")
        );
        setLoading(false);
        return;
      }

      // 4) เตรียม payload และเรียก Backend (เส้นที่ 2) เพื่อบันทึกเช็คชื่อ
      const payload = {
        studentId: sid,
        fullName: sname,
        latitude: gps.latitude,
        longitude: gps.longitude,
        sessionId: session._id,
        locationName: session?.location?.name || null,
        matchRef: {
          distance: verifyData.distance,
          threshold: verifyData.threshold,
        },
      };

      if (session.withTeacherFace) {
        return redirectToTeacherScan(payload);
      }

      const token = sessionStorage.getItem("token");
      await handleNormalCheckin(payload, token);
    } catch (error) {
      setMessage(error.message || "❌ เกิดข้อผิดพลาดในการเช็คชื่อ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <h2>สแกนใบหน้า</h2>
      <p>{message}</p>

      <div className="d-flex justify-content-center my-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width="400"
          height="300"
          onLoadedData={() => setVideoReady(true)}
          className="rounded shadow"
          style={{ transform: "scaleX(-1)" }}  // แสดงแบบกระจก
        />
      </div>

      <div className="d-flex justify-content-center gap-2">
        <button className="btn btn-success" onClick={scanFace} disabled={loading || !videoReady}>
          {loading ? "กำลังตรวจสอบ..." : "✅ เริ่มสแกนใบหน้า"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            stopCamera();
            navigate(-1);
          }}
        >
          กลับ
        </button>
      </div>
    </div>
  );
};

export default Scanface;
