import React, { useEffect, useState } from "react";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/attendanceHistory.css";
import Select from "react-select";

const AttendanceHistory = () => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const token = sessionStorage.getItem("token");
  const user = JSON.parse(sessionStorage.getItem("user"));

  useEffect(() => {
    const fetchHistoryAndEnrolls = async () => {
      try {
        const [historyRes, enrollsRes] = await Promise.all([
          API.get(`/attendance/history/${user.studentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          API.get(`/enrolls/enrolled/${user._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const history = historyRes.data.history || [];
        const enrolls = enrollsRes.data.enrolled || [];

        setHistory(history.sort((a, b) => new Date(b.scan_time) - new Date(a.scan_time)));

        const options = enrolls
          .filter(e => e.courseCode && e.courseName && e.section)
          .map(e => ({
            value: e.classId,
            label: `${e.courseCode} - ${e.courseName} (Sec ${e.section})`,
          }));

        setCourseOptions([{ value: "", label: "-- ทั้งหมด --" }, ...options]);
      } catch (err) {
        console.error("❌ ดึงข้อมูลไม่สำเร็จ", err);
      }
    };

    if (user?.studentId && user?._id) fetchHistoryAndEnrolls();
  }, [user.studentId, user?._id, token]);

  useEffect(() => {
    const filtered = history.filter((h) => {
      const matchCourse = !selectedCourse || h.classId?._id === selectedCourse;

      const formatDate = (d) => {
        const date = new Date(d);
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
      };

      const matchDate = !selectedDate || formatDate(h.scan_time) === selectedDate;

      return matchCourse && matchDate;
    });

    setFilteredHistory(filtered);
    setCurrentPage(1);
  }, [selectedCourse, selectedDate, history]);

  const paginatedData = filteredHistory.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage);

  return (
    <div className="container">
      <h2 className="mb-4">ประวัติการเช็คชื่อ</h2>

      <div className="filter-row">
        <div>
          <label>เลือกวิชา</label>
          <Select
            className="react-select-container"
            classNamePrefix="react-select"
            options={courseOptions}
            value={courseOptions.find(opt => opt.value === selectedCourse)}
            onChange={(opt) => setSelectedCourse(opt?.value || "")}
            isSearchable
            styles={{
              option: (provided, state) => ({
                ...provided,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                padding: "10px 14px",
                borderRadius: "8px",
                color: state.isSelected ? "#ffffff" : "#064e3b",
                backgroundColor: state.isSelected
                  ? "#22c55e"
                  : state.isFocused
                  ? "#bbf7d0"
                  : "transparent",
                fontWeight: state.isSelected ? "bold" : "normal",
                cursor: "pointer",
              }),
              menu: (provided) => ({
                ...provided,
                zIndex: 999,
                borderRadius: "12px",
                padding: "6px",
              }),
              control: (provided, state) => ({
                ...provided,
                backgroundColor: "#f0fdf4",
                border: "1px solid #6ee7b7",
                borderRadius: 8,
                minHeight: 46,
                boxShadow: state.isFocused
                  ? "0 0 0 3px rgba(34, 197, 94, 0.35)"
                  : "none",
              }),
              singleValue: (provided) => ({
                ...provided,
                color: "#064e3b",
                fontWeight: 500,
              }),
            }}
          />
        </div>
        <div>
          <label>เลือกวันที่</label>
          <input
            type="date"
            className="filter-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>วิชา</th>
              <th>วันที่</th>
              <th>เวลา</th>
              <th>สถานะ</th>
              <th>ตำแหน่ง</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((h, idx) => (
              <tr key={idx}>
                <td>
                  {h.classId
                    ? `${h.classId.courseCode} - ${h.classId.courseName} (Sec ${h.classId.section})`
                    : "-"}
                </td>
                <td>{new Date(h.scan_time).toLocaleDateString("th-TH")}</td>
                <td>{new Date(h.scan_time).toLocaleTimeString()}</td>
                <td className={
                  h.status === "Present"
                    ? "status-present"
                    : h.status === "Late"
                      ? "status-late"
                      : "status-absent"
                }>
                  {h.status}
                </td>
                <td>
                  {`${h.location_data.latitude.toFixed(5)}, ${h.location_data.longitude.toFixed(5)}`}
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-muted">
                  ! ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4 mb-5 page-wrapper">
          <button
            className="btn btn-page-nav"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ย้อนกลับ
          </button>

          <span className="page-indicator">
            หน้า {currentPage} / {totalPages}
          </span>

          <button
            className="btn btn-page-nav"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            หน้าถัดไป
          </button>
        </div>
      )}

    </div>
  );
};

export default AttendanceHistory;
