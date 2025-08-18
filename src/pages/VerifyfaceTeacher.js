import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/verifyfaceTeacher.css";

const VerifyfaceTeacher = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { classId } = useParams();

  const [message, setMessage] = useState("หันหน้าตรง แล้วกด 'ยืนยันใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const stopCamera = () => {
    const v = videoRef.current;
    const s = v?.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
    if (v) {
      v.pause?.();
      v.srcObject = null;
    }
    setVideoReady(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      const v = videoRef.current;
      if (v) {
        const old = v.srcObject;
        if (old) old.getTracks().forEach((t) => t.stop());
        v.srcObject = stream;
        v.onloadedmetadata = () => {
          v.play().then(() => setVideoReady(true)).catch(() => {});
        };
      }
      setMessage("กล้องพร้อมแล้ว");
    } catch (error) {
      console.error("❌ กล้องไม่พร้อม:", error);
      setMessage("❌ โปรดอนุญาตให้ใช้กล้อง");
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const captureBlob = () =>
    new Promise((resolve, reject) => {
      const v = videoRef.current;
      if (!v || !videoReady) return reject(new Error("กล้องยังไม่พร้อม"));

      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      // วิดีโอแสดงแบบกระจก → กลับด้านก่อนส่ง
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0, w, h);

      if (canvas.toBlob) {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงภาพไม่สำเร็จ"))), "image/jpeg", 0.9);
      } else {
        const dataURL = canvas.toDataURL("image/jpeg", 0.9);
        const byteString = atob(dataURL.split(",")[1]);
        const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        resolve(new Blob([ab], { type: mimeString }));
      }
    });

  const scanFace = async () => {
    if (!videoReady) return setMessage("รอกล้องโหลดให้เสร็จก่อน...");

    setLoading(true);
    setMessage("กำลังตรวจสอบใบหน้า...");

    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        alert("กรุณาเข้าสู่ระบบใหม่");
        return navigate("/login");
      }

      // 1) จับภาพอาจารย์
      const imageBlob = await captureBlob();

      // เตรียมชื่ออาจารย์ (ใช้ค่าที่ session เปิดไว้ หรือชื่อคนสอนจาก sessionStorage/URL ตามที่คุณเก็บ)
      // ในที่นี้สมมติว่าเก็บชื่ออาจารย์ไว้ที่ sessionStorage.teacherName จากหน้าเปิด session
      const teacherName =
        sessionStorage.getItem("teacherName") ||
        sessionStorage.getItem("teacherFullName") ||
        "Unknown_Teacher";

      // 2) API เส้นที่ 1: ส่งรูปอาจารย์ + fullname + classId ไป Backend เพื่อตรวจ
      const form = new FormData();
      form.append("image", imageBlob, "teacher.jpg");
      form.append("fullname", teacherName);
      form.append("classId", classId);

      const verify = await API.post("/face/verify-teacher-face", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vr = verify.data;

      if (!vr?.ok || !vr?.match) {
        setMessage("❌ ใบหน้าอาจารย์ไม่ถูกต้อง กรุณาลองใหม่");
        return;
      }

      // 3) API เส้นที่ 2: บันทึกเช็คชื่อ (ใช้ payload นักศึกษาจากหน้า Scanface ที่เก็บไว้ใน sessionStorage)
      const student = JSON.parse(sessionStorage.getItem("studentDescriptor") || "null");
      if (!student) {
        setMessage("❌ ไม่พบข้อมูลนักศึกษาที่สแกนไว้");
        return;
      }

      // (ออปชัน) หากต้องการ GPS อีกครั้ง ใส่ได้เหมือนหน้า Scanface
      const payload = {
        studentId: student.studentId,
        fullName: student.fullName,
        latitude: student.latitude || null,
        longitude: student.longitude || null,
        sessionId: student.sessionId,
        locationName: student.locationName || null,
        method: "face-teacher", // ทำให้รู้ว่าเช็คชื่อผ่านวิธียืนยันอาจารย์
        // เก็บผล match ไว้ audit
        matchRef: { distance: vr.distance, threshold: vr.threshold },
      };

      await API.post("/attendance/checkin", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert(`✅ เช็คชื่อสำเร็จ! ขอบคุณ ${student.fullName}`);
      stopCamera();
      sessionStorage.removeItem("studentDescriptor");
      navigate("/student-dashboard");
    } catch (err) {
      console.error("❌ ยืนยันใบหน้าไม่สำเร็จ:", err);
      setMessage(err?.response?.data?.message || err.message || "❌ ตรวจสอบใบหน้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <h2>ยืนยันใบหน้าอาจารย์</h2>
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
          style={{ transform: "scaleX(-1)" }} // mirror เหมือน Scanface
        />
      </div>

      <div className="d-flex justify-content-center gap-2">
        <button className="btn btn-primary" onClick={scanFace} disabled={loading || !videoReady}>
          {loading ? "กำลังตรวจสอบ..." : "✅ ยืนยันใบหน้า"}
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

export default VerifyfaceTeacher;
