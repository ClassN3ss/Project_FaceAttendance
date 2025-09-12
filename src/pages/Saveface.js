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
  { key: "down", message: "ก้มหน้าเล็กน้อย" },
];

// helper: ตรวจว่ามือถือหรือไม่
const isMobile = () => /Android|iPhone|iPad/i.test(navigator.userAgent);

const Saveface = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState("กำลังโหลดกล้อง...");
  const [loading, setLoading] = useState(false);

  const stopCameraInstant = (videoEl) => {
    const v = videoEl || videoRef.current;
    const stream = v?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (v) {
      v.pause?.();
      v.srcObject = null;
    }
  };

  const playWhenReady = (videoEl) =>
    new Promise((resolve) => {
      if (!videoEl) return resolve();
      if (!videoEl.paused && !videoEl.ended) return resolve();
      const onCanPlay = () => {
        videoEl.removeEventListener("canplay", onCanPlay);
        videoEl.play().catch(() => {});
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        const videoEl = videoRef.current;
        if (videoEl) {
          stopCameraInstant(videoEl);
          videoEl.srcObject = stream;
          await playWhenReady(videoEl);
          setMessage(directions[0].message);
        }
      } catch (err) {
        console.error("❌ Camera access denied:", err);
        setMessage("❌ โปรดอนุญาตให้ใช้กล้อง");
      }
    };

    initCamera();
    const videoEl = videoRef.current;
    return () => {
      stopCameraInstant(videoEl);
    };
  }, [user, navigate]);

  const captureImage = () => {
    const canvas = document.createElement("canvas");

    if (isMobile()) {
      canvas.width = 320;
      canvas.height = 240;
    } else {
      canvas.width = 400;
      canvas.height = 300;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const directionKey = directions[currentStep].key;

    if (isMobile()) {
      canvas.toBlob(
        (blob) => {
          sendSingleImage(directionKey, blob);
        },
        "image/jpeg",
        0.7
      );
    } else {
      const dataUrl = canvas.toDataURL("image/jpeg");
      const blob = dataURLtoBlob(dataUrl);
      sendSingleImage(directionKey, blob);
    }
  };

  const sendSingleImage = async (key, blob) => {
    setLoading(true);
    setMessage(`⏳ กำลังส่งภาพ ${key}...`);

    const formData = new FormData();
    formData.append("fullname", user.fullname || user.fullName);
    formData.append("studentID", user.studentID || user.studentId);
    formData.append("direction", key); // บอกว่าเป็นภาพทิศไหน
    formData.append("image", blob, `${key}.jpg`);

    try {
      const res = await fetch(`https://be-attendance-abb3a12f3db3.herokuapp.com/auth/save-face-part`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "ok") {
        if (currentStep < directions.length - 1) {
          setCurrentStep((prev) => prev + 1);
          setMessage(directions[currentStep + 1].message);
        } else {
          setMessage("✅ ส่งรูปครบทุกมุมแล้ว กำลังตรวจสอบ...");
          // Trigger ให้ BE ตรวจสอบรวม
          await fetch(`https://be-attendance-abb3a12f3db3.herokuapp.com/auth/verify-face-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentID: user.studentID }),
          });
          alert("✅ บันทึกใบหน้าสำเร็จ");
          const updatedUser = {
            ...user,
            faceScanned: true,
          };
          login(updatedUser, sessionStorage.getItem("token"));
          navigate("/student-dashboard");
        }
      } else {
        alert("❌ ส่งรูปไม่สำเร็จ กรุณาลองใหม่");
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
