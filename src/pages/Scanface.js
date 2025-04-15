import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as faceapi from "face-api.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import API from "../services/api";
import "../styles/scanface.css";

const Scanface = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { classId } = useParams();

  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("🔍 โปรดหันหน้าตรง แล้วกด 'เริ่มสแกนใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => console.warn("play() interrupted", err));
        };
      }
    } catch {
      setMessage("❌ โปรดอนุญาตให้เว็บไซต์ใช้กล้องของคุณ");
    }
  };

  const loadModels = useCallback(async () => {
    try {
      setMessage("🔄 กำลังโหลดโมเดล...");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setMessage("📷 กล้องพร้อมแล้ว! กดปุ่มเพื่อเริ่มสแกน");
      await startCamera();
    } catch {
      setMessage("❌ โหลดโมเดลไม่สำเร็จ");
    }
  }, []);

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
    loadModels();
    fetchSession();
    return () => stopCamera();
  }, [loadModels, fetchSession]);

  const getGPSLocation = () =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
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
    const toRad = (v) => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // const reverseGeocode = async (lat, lon) => {
  //   try {
  //     const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
  //     const data = await res.json();
  //     return data.display_name || "ตำแหน่งที่ไม่รู้จัก";
  //   } catch {
  //     return "ตำแหน่งที่ไม่รู้จัก";
  //   }
  // };

  const handleNormalCheckin = async (payload, token) => {
    const res = await fetch("http://localhost:5000/api/attendance/checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "❌ เช็คชื่อไม่สำเร็จ");

    alert(`✅ เช็คชื่อสำเร็จ! ขอบคุณ ${payload.fullName}`);
    stopCamera();
    navigate("/student-dashboard");
  };

  const redirectToTeacherScan = (payload) => {
    alert("📣 สแกนใบหน้าอาจารย์เพื่อยืนยันตัวตนก่อนเช็คชื่อ");
    sessionStorage.setItem("studentDescriptor", JSON.stringify(payload));
    stopCamera();
    navigate(`/verifyface-teacher/${classId}`, { replace: true });
  };

  const scanFace = async () => {
    if (!videoReady) return setMessage("📷 รอกล้องโหลดให้เสร็จก่อน...");
    if (!session) return setMessage("❌ ไม่พบ session ที่เชื่อมกับห้องนี้");

    setLoading(true);
    setMessage("🔎 กำลังตรวจจับใบหน้า...");

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections.length) {
        setMessage("❌ ไม่พบใบหน้า กรุณาลองใหม่");
        setLoading(false);
        return;
      }

      const descriptorArray = Array.from(detections[0].descriptor);
      const token = sessionStorage.getItem("token");

      const { latitude, longitude } = await getGPSLocation();

      if (session?.location?.latitude && session?.location?.longitude) {
        console.log("📌 พิกัดอาจารย์:", session.location.latitude, session.location.longitude);
        console.log("📍 พิกัดนักศึกษา:", latitude, longitude);
        const distance = calculateDistance(
          session.location.latitude,
          session.location.longitude,
          latitude,
          longitude
        );
        console.log("📏 คำนวณระยะห่าง:", distance.toFixed(2), "เมตร");
      
        if (distance > 100) {
          // const place = await reverseGeocode(latitude, longitude);
          setMessage(`❌ คุณอยู่นอกพื้นที่เช็คชื่อ (ห่าง ${Math.round(distance)} เมตร)\n 
          + พิกัดของคุณ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} ` 
          + (session.location.name ? `\n📌 จุดหมายเช็คชื่อ: ${session.location.name}` : ""));
          setLoading(false);
          return;
        }
      }                  

      const findRes = await fetch("http://localhost:5000/auth/upload-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ faceDescriptor: descriptorArray }),
      });

      const findData = await findRes.json();
      if (!findRes.ok) throw new Error(findData.message || "❌ ไม่พบใบหน้าในระบบ");

      const payload = {
        studentId: findData.studentId,
        fullName: findData.fullName,
        latitude,
        longitude,
        sessionId: session._id,
        faceDescriptor: descriptorArray,
      };

      if (session.withTeacherFace) return redirectToTeacherScan(payload);
      await handleNormalCheckin(payload, token);
    } catch (error) {
      setMessage(error.message || "❌ เกิดข้อผิดพลาดในการเช็คชื่อ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <h2>📸 สแกนใบหน้า</h2>
      <p>{message}</p>

      <div className="d-flex justify-content-center my-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width="400"
          height="300"
          onLoadedData={() => setVideoReady(true)}
          className="rounded shadow"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      <div className="d-flex justify-content-center gap-2">
        <button className="btn btn-success" onClick={scanFace} disabled={loading}>
          {loading ? "กำลังตรวจสอบ..." : "✅ เริ่มสแกนใบหน้า"}
        </button>
        <button className="btn btn-secondary" onClick={() => {
          stopCamera();
          navigate(-1);
        }}>
          🔙 กลับ
        </button>
      </div>
    </div>
  );
};

export default Scanface;
