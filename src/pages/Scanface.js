import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as faceapi from "face-api.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import API from "../services/api";
import "../styles/scanface.css";

const Scanface = () => {
  const videoRef = useRef(null); // อ้างอิงกล้องวิดีโอ
  const navigate = useNavigate();
  const { classId } = useParams();   // รับ classId จาก URL

  const [session, setSession] = useState(null);   // session ที่เปิดอยู่
  const [message, setMessage] = useState("โปรดหันหน้าตรง แล้วกด 'เริ่มสแกนใบหน้า'");
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false); // กล้องโหลดเสร็จหรือยัง

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((err) => console.warn("play() interrupted", err));
        };
      }
    } catch {
      setMessage("❌ โปรดอนุญาตให้เว็บไซต์ใช้กล้องของคุณ");
    }
  };

  const loadModels = useCallback(async () => {
    try {
      setMessage("กำลังโหลดโมเดล...");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"), // ตรวจจับใบหน้า (bounding box)
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"), // ตรวจจุด landmark (ตา, จมูก, ปาก ฯลฯ)
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"), // แปลงใบหน้าเป็นเวกเตอร์ descriptor
      ]);
      setMessage("กล้องพร้อมแล้ว! กดปุ่มเพื่อเริ่มสแกน");
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

      console.log("[Client Now]:", new Date().toISOString());
      console.log("[Session Time]:", res.data?.openAt, res.data?.closeAt);
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

  // Haversine Formula
  // ใช้คำนวณระยะทาง (เมตร) ระหว่าง 2 พิกัด (lat, lon) บนพื้นผิวโลก
  // คำนวณจากรัศมีโลก (R) = 6,371,000 เมตร
  // ผลลัพธ์คือระยะทางระหว่างตำแหน่งของนักศึกษาและอาจารย์
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // รัศมีของโลก (เมตร)
    const toRad = (v) => (v * Math.PI) / 180; // แปลงองศาเป็นเรเดียน
    const dLat = toRad(lat2 - lat1); //ความต่างละติจูด (เรเดียน)
    const dLon = toRad(lon2 - lon1); //ความต่างลองจิจูด (เรเดียน)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); //ระยะทางเป็นเมตร
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      ); //ซึ่งใช้ API จาก OpenStreetMap (Nominatim)
      const data = await res.json();
      return data.display_name || "ตำแหน่งที่ไม่รู้จัก";
    } catch {
      return "ตำแหน่งที่ไม่รู้จัก";
    }
  };

  const handleNormalCheckin = async (payload, token) => {
    try {
      console.log("ส่งเช็คชื่อ payload:", payload);
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
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })) // ใช้โมเดล SSD-MobileNet และตั้งค่าความมั่นใจ
        .withFaceLandmarks() // ตรวจหาจุดสำคัญบนใบหน้า (ตา จมูก ปาก คาง ฯลฯ)
        .withFaceDescriptors(); // สร้างข้อมูลเวกเตอร์ 128 ค่า เพื่อใช้เปรียบเทียบตัวตนของใบหน้านั้น

      if (!detections.length) {
        setMessage("❌ ไม่พบใบหน้า กรุณาลองใหม่");
        setLoading(false);
        return;
      }

      const descriptorArray = Array.from(detections[0].descriptor);
      const token = sessionStorage.getItem("token");
      const { latitude, longitude } = await getGPSLocation(); //ดึงพิกัด

      //เปรียบเทียบกับพิกัดของอาจารย์
      if (session?.location?.latitude && session?.location?.longitude) {
        console.log("- พิกัดอาจารย์:", session.location.latitude, session.location.longitude);
        console.log("- พิกัดนักศึกษา:", latitude, longitude);
        const distance = calculateDistance(
          session.location.latitude,
          session.location.longitude,
          latitude,
          longitude
        );
        console.log("คำนวณระยะห่าง:", distance.toFixed(2), "เมตร");

        if (distance > 100) {
          const place = await reverseGeocode(latitude, longitude); //แปลงพิกัด GPS เป็นสถานที่
          setMessage(
            `❌ คุณอยู่นอกพื้นที่เช็คชื่อ (ห่าง ${Math.round(distance)} เมตร)\n` +
              `* พิกัดของคุณ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n` +
              `- สถานที่: ${place}` +
              (session.location.name ? `\n- จุดหมายเช็คชื่อ: ${session.location.name}` : "")
          );
          setLoading(false);
          return;
        }
      }

      const findRes = await fetch(
        "https://backendfaceattendance-production.up.railway.app/auth/upload-face",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ faceDescriptor: descriptorArray }),
        }
      );

      //{studentId, fullName, latitude, longitude, sessionId, faceDescriptor}

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
      <h2>สแกนใบหน้า</h2>
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
