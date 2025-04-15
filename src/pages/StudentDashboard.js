import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/studentDashboard.css";

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allClasses, setAllClasses] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (!user.faceScanned) navigate("/save-face");
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [reqRes, approvedEnrollRes, myClassesRes] = await Promise.all([
          API.get(`/enrollments/requests/${user._id}`),
          API.get(`/enrolls/enrolled/${user._id}`),
          API.get(`/classes/student/${user._id}`)
        ]);
        const pending = reqRes.data;
        const enrolled = approvedEnrollRes.data.enrolled || [];
        const allClasses = myClassesRes.data;
        setAllClasses(allClasses);
        setPendingRequests(pending);
        setEnrolledClassIds(
          enrolled
            .filter(e => e.classId)
            .map(e => (e.classId._id || e.classId).toString())
        );
      } catch (err) {
        console.error("❌ โหลดข้อมูลไม่สำเร็จ", err);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchTerm.trim().length > 1) {
        API.get(`/search/classes?q=${searchTerm.trim()}`)
          .then(res => setSearchResults(res.data))
          .catch(() => setSearchResults([]));
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  const handleRequestJoin = async (classId) => {
    try {
      await API.post("/enrollments", { student: user._id, classId });
      alert("✅ ส่งคำร้องแล้ว");
      const [reqRes, searchRes] = await Promise.all([
        API.get(`/enrollments/requests/${user._id}`),
        searchTerm.trim().length > 1
          ? API.get(`/search/classes?q=${searchTerm.trim()}`)
          : Promise.resolve({ data: [] })
      ]);
      setPendingRequests(reqRes.data);
      setSearchResults(searchRes.data);
    } catch (err) {
      alert("❌ ส่งคำร้องไม่สำเร็จ");
      console.error(err);
    }
  };

  const hasRequested = (clsId) =>
    pendingRequests.some((r) => {
      const id = r.classId?._id || r.classId;
      return id === clsId;
    });

  const joinedClasses = allClasses.filter(cls =>
    enrolledClassIds.includes(cls._id.toString())
  );

  const notJoinedClasses = allClasses.filter(cls => {
    const id = cls._id.toString();
    const isEnrolled = enrolledClassIds.includes(id);
    const isInList = cls.students?.some(s => (s._id || s).toString() === user._id);
    return !isEnrolled && isInList;
  });

  const renderClassItem = (cls, showJoinButton = true, showEnterButton = true) => (
    <li key={cls._id} className="list-group-item p-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap">
        <div className="flex-grow-1 me-3">
          <div className="fw-semibold">
            {cls.courseCode} - {cls.courseName} Section {cls.section}
          </div>
          <hr className="my-2" />
          <div className="text-muted">👨‍🏫 {cls.teacherId?.fullName}</div>
        </div>

        {showJoinButton && (
          <div className="action-column">
            {enrolledClassIds.includes(cls._id) ? (
              <>
                {showEnterButton && (
                  <button
                    className="custom-btn-primary btn btn-sm"
                    onClick={() => navigate(`/class/${cls._id}/checkin`)}
                  >
                    🔓 เข้าห้องเรียน
                  </button>
                )}
                <div className="custom-text-success">✅ ได้เข้าร่วมแล้ว</div>
              </>
            ) : hasRequested(cls._id) ? (
              <span className="custom-text-warning">⏳ รออนุมัติ</span>
            ) : (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleRequestJoin(cls._id)}
              >
                ✉️ ขอเข้าร่วม
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );

  return (
    <div className="container dashboard-container">
      <h2 className="welcome-header">🎓 Welcome {user.fullName}</h2>

      <div className="card p-4 shadow mt-3 profile-card">
        <h4>{user.studentId} {user.fullName}</h4>
        <p>Email: {user.email}</p>
      </div>

      <input
        type="text"
        className="custom-input my-4 search-input"
        placeholder="🔍 ค้นหาวิชา / รหัสวิชา / อาจารย์..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {searchResults.length > 0 && (
        <>
          <h4 className="section-title">🌍 ผลลัพธ์การค้นหา ({searchResults.length})</h4>
          <ul className="list-group mb-4 class-list">
            {searchResults.map(cls => renderClassItem(cls, true, false))}
          </ul>
        </>
      )}

      <h4 className="section-title">✅ ห้องเรียนที่คุณเข้าร่วมแล้ว ({joinedClasses.length})</h4>
      <ul className="list-group mb-4 class-list">
        {joinedClasses.length > 0
          ? joinedClasses.map(cls => renderClassItem(cls, true, true))
          : <li className="list-group-item text-muted text-center">ไม่มีห้องที่เข้าร่วม</li>}
      </ul>

      <h4 className="section-title">⏳ ห้องเรียนที่รออนุมัติ / ยังไม่ได้เข้าร่วม</h4>
      <ul className="list-group mb-4 class-list">
        {notJoinedClasses.length > 0
          ? notJoinedClasses.map(cls => renderClassItem(cls, true, true))
          : <li className="list-group-item text-muted text-center">ไม่มีห้องที่ยังไม่ได้เข้าร่วม</li>}
      </ul>
    </div>
  );
};

export default StudentDashboard;
