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
  const selectedClass = classList.find(c => c._id === selectedSectionId);
  const courseCode = selectedClass?.courseCode || "000000";
  const courseName = selectedClass?.courseName?.replace(/\s+/g, "") || "ไม่ทราบชื่อวิชา";
  const section = selectedClass?.section || "1";

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
    const workbook = XLSX.utils.book_new();
  
    // เตรียม header
    const headers = [["ลำดับ", "เลขประจำตัว", "ชื่อ", "คะแนน"]];
    const data = [];
  
    students.forEach((student, i) => {
      const sid = String(student.studentId || student.username || "").trim();
      const name = student.fullName;
      const stat = stats[sid];
      const present = stat?.present || 0;
      data.push([i + 1, sid, name, present]);
    });
  
    const allData = [...headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(allData);
  
    // ตั้งค่าความกว้างคอลัมน์
    worksheet["!cols"] = [
      { wch: 8 },  // ลำดับ
      { wch: 15 }, // รหัส
      { wch: 35 }, // ชื่อ
      { wch: 10 }  // คะแนน
    ];
  
    // สร้าง style
    const border = {
      top: { style: "thick" },
      bottom: { style: "thick" },
      left: { style: "thick" },
      right: { style: "thick" },
    };
  
    const cellStyle = {
      font: { name: "TH Sarabun New", sz: 14 },
      alignment: { vertical: "center", horizontal: "left" },
      border
    };
  
    const headerStyle = {
      font: { name: "TH Sarabun New", sz: 16, bold: true },
      alignment: { vertical: "center", horizontal: "center" },
      border
    };
  
    // ใส่ style ทีละเซลล์
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cell_address]) continue;
        worksheet[cell_address].s = R === 0 ? headerStyle : cellStyle;
      }
    }
  
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายชื่อนักศึกษา");
  
    const filename = `รายชื่อนักศึกษา_${courseCode}_${courseName}_ตอน${section}.xlsx`;
    saveAs(new Blob([XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    })], { type: "application/octet-stream" }), filename);

  };        

  return (
    <div className="container">
      <h2>รายชื่อนักศึกษาในวิชาที่สอน</h2>
  
      <div className="row mb-3 align-items-end">
        <div className="col-md-5">
          <label>เลือกรหัสวิชา</label>
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
          <label>เลือกตอนเรียน</label>
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
  
        <div className="col-md-2 d-flex align-items-end">
          {selectedSectionId && students.length > 0 && (
            <button
              className="btn btn-outline-success w-100"
              onClick={exportToExcel}
            >
              Export Excel
            </button>
          )}
        </div>
      </div>
  
      {selectedSectionId && students.length > 0 && (
        <>
          <h3>รายชื่อนักศึกษา ({students.length} คน)</h3>
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
                      มาเรียนทั้งหมด: {present} ครั้ง
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
