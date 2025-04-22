import React, { useEffect, useState } from 'react';
import API from '../services/api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/summary.css";

const Summary = () => {
  const [classList, setClassList] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({});
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    const fetchMyClasses = async () => {
      try {
        const res = await API.get("/classes/teacher", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClassList(res.data || []);
      } catch (err) {
        console.error("❌ โหลดรายวิชาของอาจารย์ล้มเหลว:", err);
      }
    };
    fetchMyClasses();
  }, [token]);

  const courseOptions = Array.from(
    new Set(classList.map((c) => c.courseCode))
  ).map((code) => ({
    code,
    label: `${code} - ${classList.find((c) => c.courseCode === code)?.courseName || ""}`,
  }));

  const sectionOptions = classList
    .filter((c) => c.courseCode === selectedCourse)
    .map((c) => ({
      id: c._id,
      label: `ตอน ${c.section}`,
    }));

  useEffect(() => {
    if (!selectedSectionId) return;

    const fetchStudents = async () => {
      try {
        const res = await API.get(`/classes/${selectedSectionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStudents(res.data?.students || []);
      } catch (err) {
        console.error("❌ โหลดรายชื่อนักศึกษาไม่สำเร็จ:", err);
        setStudents([]);
      }
    };

    fetchStudents();
  }, [selectedSectionId, token]);

  useEffect(() => {
    if (!selectedSectionId || students.length === 0) return;

    const fetchStats = async () => {
      try {
        const res = await API.get(`/attendance/class/${selectedSectionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data || {});
      } catch (err) {
        console.error("❌ โหลดข้อมูลเช็คชื่อไม่สำเร็จ:", err);
        setStats({});
      }
    };

    fetchStats();
  }, [students, selectedSectionId, token]);

  const exportToExcel = () => {
    const data = students.map((s, idx) => {
      const sid = String(s.studentId || s.username || "").trim();
      const stat = stats[sid];
      const present = stat?.present || 0;
      return {
        ลำดับ: idx + 1,
        เลขประจำตัวนักศึกษา: sid,
        ชื่อ: s.fullName,
        คะแนน: present
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: ["ลำดับ", "เลขประจำตัวนักศึกษา", "ชื่อ", "คะแนน"]
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายชื่อนักศึกษา");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const fileName = `รายชื่อนักศึกษา_${selectedCourse}_ตอน${selectedSectionId}.xlsx`;
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), fileName);
  };

  return (
    <div className="container">
      <h2>📚 รายชื่อนักศึกษาในวิชาที่สอน</h2>

      <div className="row mb-3 align-items-end">
        <div className="col-md-5">
          <label>📘 เลือกรหัสวิชา</label>
          <select
            className="form-select"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedSectionId("");
              setStudents([]);
              setStats({});
            }}
          >
            <option value="">-- เลือกวิชา --</option>
            {courseOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-5">
          <label>🧾 เลือกตอนเรียน</label>
          <select
            className="form-select"
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={!selectedCourse}
          >
            <option value="">-- เลือกตอน --</option>
            {sectionOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-2 text-end">
          {selectedSectionId && students.length > 0 && (
            <button
              className="btn btn-outline-success w-100 mt-4"
              onClick={exportToExcel}
            >
              📤 Export Excel
            </button>
          )}
        </div>
      </div>

      {selectedSectionId && students.length > 0 && (
        <>
          <h3>📋 รายชื่อนักศึกษา ({students.length} คน)</h3>
          <ul className="list-group mt-3">
            {students.map((s, idx) => {
              const sid = String(s.studentId || s.username || "").trim();
              const stat = stats[sid];
              const present = stat?.present || 0;

              return (
                <li key={idx} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{sid}</strong> - {s.fullName}
                    </div>
                    <span className="badge bg-primary fs-6">
                      ✅ มาเรียนทั้งหมด: {present} ครั้ง
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default Summary;
