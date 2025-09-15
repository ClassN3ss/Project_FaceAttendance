import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/savefaceTeacher.css";

const SavefaceTeacher = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [message, setMessage] = useState("หันหน้าตรง แล้วกด 'บันทึกใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [camReady, setCamReady] = useState(false);

  // เงื่อนไขสิทธิ์เข้าเพจ
  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "teacher") return navigate("/");
    if (user.faceScanned) return navigate("/teacher-dashboard");
  }, [user, navigate]);

  // ปิดกล้องสะอาด
  const stopCamera = () => {
    const v = videoRef.current;
    const s = v?.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
    if (v) {
      v.pause?.();
      v.srcObject = null;
    }
    setCamReady(false);
  };

  // play เมื่อพร้อม ลด play() interrupted
  const playWhenReady = (videoEl) =>
    new Promise((resolve) => {
      if (!videoEl) return resolve();
      const onCanPlay = () => {
        videoEl.removeEventListener("canplay", onCanPlay);
        videoEl.play().then(() => setCamReady(true)).catch(() => {});
        resolve();
      };
      videoEl.addEventListener("canplay", onCanPlay, { once: true });
    });

  // เปิดกล้องหน้า + ปิดเสียง (mirror แค่ตอนแสดงผล)
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      const v = videoRef.current;
      if (v) {
        // กัน race: เคลียร์ stream เก่า
        const old = v.srcObject;
        if (old) old.getTracks().forEach((t) => t.stop());
        v.srcObject = stream;
        await playWhenReady(v);
      }
      setMessage("กล้องพร้อมแล้ว");
    } catch (err) {
      console.error("เปิดกล้องไม่สำเร็จ:", err);
      setMessage("❌ โปรดอนุญาตให้ใช้กล้อง");
      setCamReady(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "teacher" && !user.faceScanned) startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // จับภาพจาก <video> เป็น Blob (JPEG) — แก้ทิศจาก mirror ให้เป็นปกติ
  const captureFrameBlob = () =>
    new Promise((resolve, reject) => {
      const v = videoRef.current;
      if (!v || !camReady) return reject(new Error("กล้องยังไม่พร้อม"));

      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      // วิดีโอแสดงแบบกระจก → กลับด้านให้รูปปกติ
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0, w, h);

      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("แปลงภาพไม่สำเร็จ"))),
          "image/jpeg",
          0.9
        );
      } else {
        // fallback บางเบราว์เซอร์
        try {
          const dataURL = canvas.toDataURL("image/jpeg", 0.9);
          const byteString = atob(dataURL.split(",")[1]);
          const mime = dataURL.split(",")[0].split(":")[1].split(";")[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          resolve(new Blob([ab], { type: mime }));
        } catch {
          reject(new Error("แปลงภาพไม่สำเร็จ"));
        }
      }
    });

  const captureFace = async () => {
    setLoading(true);
    setMessage("กำลังบันทึกใบหน้า...");

    const token = sessionStorage.getItem("token");
    if (!token) {
      stopCamera();
      alert("กรุณาเข้าสู่ระบบอีกครั้ง");
      sessionStorage.clear();
      navigate("/login");
      return;
    }

    try {
      const blob = await captureFrameBlob();

      const fullname =
        user?.fullName ||
        user?.fullname ||
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        user?.username ||
        "Unknown_Teacher";

      const safeName = fullname.replace(/\s+/g, "_");
      const form = new FormData();
      form.append("image", blob, `${safeName}.jpg`);
      form.append("fullname", fullname);

      const res = await API.post("https://be-attendance-60811ebd3374.herokuapp.com/auth/save-teacher-face", form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res?.data?.ok) throw new Error(res?.data?.message || "บันทึกใบหน้าไม่สำเร็จ");

      stopCamera();
      alert("✅ บันทึกใบหน้าสำเร็จ");
      const updatedUser = { ...user, faceScanned: true };
      login(updatedUser, token);
      navigate("/teacher-dashboard", { replace: true });
    } catch (err) {
      console.error("อัปโหลดใบหน้าไม่สำเร็จ:", err);
      setMessage(`❌ ${err.message || "บันทึกใบหน้าไม่สำเร็จ"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <h2>บันทึกใบหน้า (อาจารย์)</h2>
      <p>{message}</p>

      <div className="d-flex justify-content-center my-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width="400"
          height="300"
          className="rounded shadow"
          style={{ transform: "scaleX(-1)" }} // mirror ให้คุ้นมือ
        />
      </div>

      <div className="d-flex justify-content-center gap-2">
        <button className="btn btn-success" onClick={captureFace} disabled={loading || !camReady}>
          {loading ? "กำลังบันทึก..." : "บันทึกใบหน้า"}
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

export default SavefaceTeacher;
