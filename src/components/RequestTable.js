import React, { useEffect, useState } from "react";
import API from "../services/api"; // ✅ ใช้ API helper
import "../styles/admin.css";

export default function RequestTable() {
  const [requests, setRequests] = useState([]);

  const fetchRequests = async () => {
    try {
      const res = await API.get("/enrollments/messages");
      setRequests(res.data);
    } catch (err) {
      console.error("❌ โหลด log ไม่สำเร็จ:", err);
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await API.put(`/enrollments/approve/${id}`, { status });
      fetchRequests();
    } catch (err) {
      console.error("❌ ดำเนินการไม่สำเร็จ:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      await API.delete(`/enrollments/${id}`);
      fetchRequests();
    } catch (err) {
      console.error("❌ ปฏิเสธไม่สำเร็จ:", err);
    }
  };  

  useEffect(() => { fetchRequests(); }, []);

  return (
    <div>
      <h5>📥 คำร้องขอเข้าเรียน</h5>
      <table className="table table-bordered table-sm">
        <thead>
          <tr><th>ชื่อ</th><th>วิชา</th><th>ตอน</th><th>จัดการ</th></tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req._id}>
              <td>{req.student?.fullName}</td>
              <td>{req.course?.courseName}</td>
              <td>{req.course?.section}</td>
              <td>
                <button onClick={() => handleApprove(req._id, 'approved')} className="btn btn-success btn-sm">✅</button>
                <button onClick={() => handleReject(req._id, 'rejected')} className="btn btn-danger btn-sm ms-1">❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
