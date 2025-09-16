import React, { useEffect, useState } from 'react';
import API from '../services/api';
import StudentListModal from './StudentListModal';
import "../styles/admin.css";

export default function ClassList() {
  const [classes, setClasses] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const fetchClasses = async () => {
    const res = await API.get('/classes');
    setClasses(res.data);
  };

  const handleDelete = async (id) => {
    if (window.confirm('คุณแน่ใจว่าต้องการลบคลาสนี้หรือไม่?')) {
      try {
        await API.delete(`/classes/${id}`);
        fetchClasses(); // refresh
      } catch (err) {
        console.error('❌ Delete error', err);
        alert('❌ ลบไม่สำเร็จ');
      }
    }
  };

  const handleView = (students, classId) => {
    setSelectedStudents(students);
    setSelectedClassId(classId); // ✅ เก็บ classId ไว้เพื่อส่งเข้า modal
    setModalOpen(true);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const startIndex = (page - 1) * rowsPerPage;
  const paginatedData = classes.slice(startIndex, startIndex + rowsPerPage);
  const totalPages = Math.ceil(classes.length / rowsPerPage);

  return (
    <div>
      <h5> รายวิชาทั้งหมด</h5>
      <table className="table table-bordered table-sm">
        <thead>
          <tr>
            <th>ชื่อวิชา</th>
            <th>รหัส</th>
            <th>ตอน</th>
            <th>อาจารย์</th>
            <th>นักศึกษา</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls._id}>
              <td>{cls.courseName}</td>
              <td>{cls.courseCode}</td>
              <td>{cls.section}</td>
              <td>{cls.teacherId?.fullName || 'ไม่พบ'}</td>
              <td>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleView(cls.students, cls._id)} // ✅ ส่ง classId
                >
                   ดูรายชื่อ ({cls.students?.length || 0})
                </button>
              </td>
              <td>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleDelete(cls._id)}
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            หน้าก่อนหน้า
          </button>

          <span className="page-indicator">หน้า {page} / {totalPages}</span>

          <button
            className="btn btn-outline-primary btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            หน้าถัดไป
          </button>
        </div>
      )}

      <StudentListModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        students={selectedStudents}
        classId={selectedClassId} // ✅ ส่ง classId เข้า modal
      />
    </div>
  );
}
