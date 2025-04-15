import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as faceapi from "face-api.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/verifyfaceTeacher.css";

const VerifyfaceTeacher = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { classId } = useParams();

  const [message, setMessage] = useState("🔍 หันหน้าตรง แล้วกด 'ยืนยันใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const stopCamera = () => {
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("❌ กล้องไม่พร้อม:", error);
      setMessage("❌ โปรดอนุญาตให้ใช้กล้อง");
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
      setMessage("📷 กล้องพร้อมแล้ว! หันหน้าตรง แล้วกดปุ่ม");
      await startCamera();
    } catch (error) {
      console.error("❌ โหลดโมเดลล้มเหลว:", error);
      setMessage("❌ โหลดโมเดลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    loadModels();
    return () => stopCamera();
  }, [loadModels]);

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


  const scanFace = async () => {
    if (!videoRef.current || !videoReady) {
      return setMessage("📷 กล้องยังไม่พร้อม");
    }

    setLoading(true);
    setMessage("🔎 กำลังตรวจสอบใบหน้า...");

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections.length) {
        setMessage("❌ ไม่พบใบหน้า ลองใหม่อีกครั้ง");
        setLoading(false);
        return;
      }

      const descriptorArray = Array.from(detections[0].descriptor);
      const token = sessionStorage.getItem("token");

      const { latitude, longitude } = await getGPSLocation();

      const verifyRes = await fetch("http://localhost:5000/auth/verify-teacher-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ faceDescriptor: descriptorArray, classId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.message || "❌ ใบหน้าไม่ตรงกับอาจารย์");

      const student = JSON.parse(sessionStorage.getItem("studentDescriptor"));
      if (!student) throw new Error("❌ ไม่พบข้อมูลนักศึกษาที่สแกนไว้");

      const checkinRes = await fetch("http://localhost:5000/api/attendance/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: student.studentId,
          fullName: student.fullName,
          latitude,
          longitude,
          sessionId: student.sessionId,
          method: "face-teacher",
        }),
      });

      const checkinData = await checkinRes.json();
      if (!checkinRes.ok) throw new Error(checkinData.message || "❌ เช็คชื่อไม่สำเร็จ");

      alert(`✅ เช็คชื่อสำเร็จ! ขอบคุณ ${student.fullName}`);
      stopCamera();
      sessionStorage.removeItem("studentDescriptor");
      navigate("/student-dashboard");
    } catch (err) {
      console.error("❌ ยืนยันใบหน้าไม่สำเร็จ:", err);
      setMessage(err.message || "❌ ตรวจสอบใบหน้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <h2>👨‍🏫 ยืนยันใบหน้าอาจารย์</h2>
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
        <button className="btn btn-primary" onClick={scanFace} disabled={loading}>
          {loading ? "กำลังตรวจสอบ..." : "✅ ยืนยันใบหน้า"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            stopCamera();
            navigate(-1);
          }}
        >
          🔙 กลับ
        </button>
      </div>
    </div>
  );
};

export default VerifyfaceTeacher;
