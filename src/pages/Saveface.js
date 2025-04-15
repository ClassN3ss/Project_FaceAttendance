import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as faceapi from "face-api.js";
import { useAuth } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/saveface.css";

const Saveface = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [message, setMessage] = useState("📷 หันหน้าตรง แล้วกด 'บันทึกใบหน้า'");
  const [loading, setLoading] = useState(false);

  const stopCameraInstant = () => {
    const video = videoRef.current;
    const stream = video?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.pause();
      video.srcObject = null;
      video.removeAttribute("srcObject");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((err) => {
            console.warn("🎥 play() error:", err);
          });
        };
      }
    } catch {
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
      setMessage("📷 พร้อมแล้ว! หันหน้าตรง แล้วกดปุ่ม");
      await startCamera();
    } catch {
      setMessage("❌ โหลดโมเดลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "student") return navigate("/");
    if (user.faceScanned) return navigate("/student-dashboard");
    loadModels();
    return () => stopCameraInstant();
  }, [user, navigate, loadModels]);

  const captureFace = async () => {
    setLoading(true);
    setMessage("🔎 กำลังตรวจจับใบหน้า...");

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

    if (!token) {
      stopCameraInstant();
      alert("⚠️ กรุณาเข้าสู่ระบบใหม่");
      sessionStorage.clear();
      return navigate("/login");
    }

    try {
      const res = await fetch("http://localhost:5000/auth/upload-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ faceDescriptor: descriptorArray }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ บันทึกใบหน้าไม่สำเร็จ");

      stopCameraInstant();
      alert("✅ บันทึกใบหน้าสำเร็จ!");
      user.faceScanned = true;
      login(user, token);
      navigate("/student-dashboard");
    } catch (err) {
      setMessage("❌ บันทึกใบหน้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-cente">
      <h2>📸 บันทึกใบหน้า</h2>
      <p>{message}</p>

      <div className="d-flex justify-content-center my-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width="400"
          height="300"
          className="rounded shadow"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      <div className="d-flex justify-content-center gap-2">
        <button className="btn btn-success" onClick={captureFace} disabled={loading}>
          {loading && <span className="spinner-border spinner-border-sm" role="status" />}
          {loading ? "กำลังบันทึก..." : "📥 บันทึกใบหน้า"}
        </button>
      </div>
    </div>
  );
};

export default Saveface;
