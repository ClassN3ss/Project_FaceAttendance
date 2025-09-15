import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/saveface.css";

const directions = [
  { key: "front", message: "หันหน้าตรง" },
  { key: "left", message: "เอียงหน้าซ้ายเล็กน้อย" },
  { key: "right", message: "เอียงหน้าขวาเล็กน้อย" },
  { key: "up", message: "เงยหน้าเล็กน้อย" },
  { key: "down", message: "ก้มหน้าเล้กน้อย" },
];

const Saveface = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState({});
  const [message, setMessage] = useState("กำลังโหลดกล้อง...");
  const [loading, setLoading] = useState(false);

  // CHANGED: helper ปิดกล้องให้สะอาด ลด AbortError ตอน unmount
  const stopCameraInstant = (videoEl) => {
    const v = videoEl || videoRef.current;
    const stream = v?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (v) {
      v.pause?.();
      v.srcObject = null;
    }
  };

  // CHANGED: play เมื่อพร้อม ลด "play() request was interrupted"
  const playWhenReady = (videoEl) =>
    new Promise((resolve) => {
      if (!videoEl) return resolve();
      if (!videoEl.paused && !videoEl.ended) return resolve();
      const onCanPlay = () => {
        videoEl.removeEventListener("canplay", onCanPlay);
        videoEl.play().catch(() => {}); // เงียบ AbortError
        resolve();
      };
      videoEl.addEventListener("canplay", onCanPlay, { once: true });
    });

  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "student") return navigate("/");
    if (user.faceScanned) return navigate("/student-dashboard");

    const initCamera = async () => {
      try {
        // CHANGED: ขอแบบกล้องหน้า + audio=false
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        const videoEl = videoRef.current;
        if (videoEl) {
          // CHANGED: กัน race โดยเคลียร์ของเก่าก่อน
          stopCameraInstant(videoEl);
          videoEl.srcObject = stream;
          await playWhenReady(videoEl); // รอจนพร้อมแล้วค่อย play
          setMessage(directions[0].message);
        }
      } catch (err) {
        console.error("❌ Camera access denied:", err);
        setMessage("❌ โปรดอนุญาตให้ใช้กล้อง");
      }
    };

    initCamera();

    // CHANGED: จับอ้างอิง element ไว้ใช้ใน cleanup (แก้ warning ESLint)
    const videoEl = videoRef.current;
    return () => {
      stopCameraInstant(videoEl);
    };
  }, [user, navigate]);

  const captureImage = () => {
    const videoEl = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");

    const directionKey = directions[currentStep].key;
    console.log(`📸 Captured ${directionKey} image`);
    setCapturedImages((prev) => ({ ...prev, [directionKey]: dataUrl }));

    if (currentStep < directions.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setMessage(directions[currentStep + 1].message);
    } else {
      handleSubmit({ ...capturedImages, [directionKey]: dataUrl });
    }
  };

  const handleSubmit = async (images) => {
    setLoading(true);
    setMessage("⏳ กำลังส่งข้อมูล...");

    const formData = new FormData();
    formData.append("fullname", user.fullname || user.fullName); // รองรับสองแบบ
    formData.append("studentID", user.studentID || user.studentId);

    Object.entries(images).forEach(([key, base64]) => {
      const blob = dataURLtoBlob(base64);
      formData.append(key, blob, `${key}.jpg`);
    });

    console.log("🚀 handleSubmit() called with images keys:", Object.keys(images));

    try {
      const res = await fetch(`https://be-attendance-ce925d697388.herokuapp.com/auth/save-face-model`, {
        method: "POST",
        body: formData,
      });
      console.log("📤 Request sent to BE:", formData);
      const data = await res.json();
      console.log("📥 Response from BE:", data);

      if (data.status === "verified") {
        alert("✅ บันทึกใบหน้าสำเร็จ");
        const updatedUser = {
          ...user,
          faceScanned: true,
          fullName: data.user?.fullName ?? user.fullName ?? user.fullname,
          studentId: data.user?.studentId ?? user.studentId ?? user.studentID,
        };
        login(updatedUser, sessionStorage.getItem("token"));
        navigate("/student-dashboard");
      } else if (data.status === "not_verified") {
        alert("❌ ไม่สามารถยืนยันใบหน้าได้ กรุณาทำใหม่");
        setCapturedImages({});
        setCurrentStep(0);
        setMessage(directions[0].message);
      } else {
        alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
      }
    } catch (err) {
      console.error(err);
      alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  return (
    <div className="container text-center">
      <h2>บันทึกใบหน้า</h2>
      <p>{message}</p>
      <video ref={videoRef} width="400" height="300" autoPlay playsInline muted className="rounded shadow" />
      <br />
      <button onClick={captureImage} disabled={loading} className="btn btn-primary mt-3">
        {loading ? "กำลังส่ง..." : "ถ่ายภาพ"}
      </button>
    </div>
  );
};

export default Saveface;
