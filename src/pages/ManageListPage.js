import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Table, Spinner, Alert, Modal } from 'react-bootstrap';
import API from '../services/api';
import EditUserModal from '../components/EditUserModal';
import "../styles/admin.css";

const PAGE_SIZE = 10;

function ClassListModal({ show, onHide, classes }) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>รายชื่อคลาส</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {classes.length === 0 ? <p className="text-muted">ไม่มีคลาส</p> : (
          <ul className="mb-0">
            {classes.map((name, idx) => <li key={idx}>{name}</li>)}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default function ManageListPage() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [pageAdmin, setPageAdmin] = useState(1);
  const [pageTeacher, setPageTeacher] = useState(1);
  const [pageStudent, setPageStudent] = useState(1);

  const [studentQuery, setStudentQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [classModal, setClassModal] = useState({ show: false, list: [] });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/users');
      const allUsers = Array.isArray(res.data) ? res.data : res.data?.items || [];

      const st = allUsers.filter(u => u.role === 'student');
      const tc = allUsers.filter(u => u.role === 'teacher');
      const ad = allUsers.filter(u => u.role === 'admin');

      setStudents(st);
      setTeachers(tc);
      setAdmins(ad);

      // clamp current pages to available pages
      const clamp = (len, p) => Math.min(Math.max(1, p), Math.max(1, Math.ceil(len / PAGE_SIZE)));
      setPageAdmin(p => clamp(ad.length, p));
      setPageTeacher(p => clamp(tc.length, p));
      setPageStudent(p => clamp(st.length, p));
    } catch (err) {
      console.error('❌ โหลดรายชื่อผิดพลาด:', err);
      setError('ไม่สามารถโหลดข้อมูลผู้ใช้จากเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(`คุณต้องการลบ ${user.fullName} ใช่หรือไม่?`);
    if (!confirmed) return;
    try {
      await API.delete(`/users/${user._id}`);
      alert('ลบเรียบร้อย');
      fetchUsers();
    } catch (err) {
      console.error('❌ ลบผู้ใช้ล้มเหลว:', err);
      alert('เกิดข้อผิดพลาดขณะลบผู้ใช้');
    }
  };

  const handleViewClasses = (user) => {
    setClassModal({ show: true, list: user.classNames || [] });
  };

  const slicePage = (arr, page) => {
    const start = (page - 1) * PAGE_SIZE;
    return arr.slice(start, start + PAGE_SIZE);
  };

  // ---------- Students search & pagination ----------
  const studentsFiltered = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(u => {
      const fullName = (u.fullName || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const classCount = String(u.classCount ?? '').toLowerCase();
      return fullName.includes(q) || username.includes(q) || email.includes(q) || classCount.includes(q);
    });
  }, [students, studentQuery]);

  useEffect(() => { setPageStudent(1); }, [studentQuery]);

  const totalStudents = Math.max(1, Math.ceil(studentsFiltered.length / PAGE_SIZE));
  const studentsPage = useMemo(() => slicePage(studentsFiltered, pageStudent), [studentsFiltered, pageStudent]);

  // ---------- Admin/Teacher pagination ----------
  const totalAdmins = Math.max(1, Math.ceil(admins.length / PAGE_SIZE));
  const totalTeachers = Math.max(1, Math.ceil(teachers.length / PAGE_SIZE));
  const adminsPage = useMemo(() => slicePage(admins, pageAdmin), [admins, pageAdmin]);
  const teachersPage = useMemo(() => slicePage(teachers, pageTeacher), [teachers, pageTeacher]);

  const FooterPager = ({ page, total, onPrev, onNext }) => (
    <div className="d-flex justify-content-center align-items-center gap-2">
      <Button variant="outline-primary" size="sm" onClick={onPrev} disabled={page === 1}>
        หน้าก่อนหน้า
      </Button>
      <span className="page-indicator">หน้า {page} / {total}</span>
      <Button variant="outline-primary" size="sm" onClick={onNext} disabled={page === total}>
        หน้าถัดไป
      </Button>
    </div>
  );

  const renderUserTable = (usersPage, allUsersLen, type, page, total, onPrev, onNext, extraHeader = null) => (
    <Card className="mb-4" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card.Header className="text-center">
        <strong>
          {type === 'admin'
            ? 'ผู้ดูแลระบบทั้งหมด'
            : type === 'teacher'
            ? 'อาจารย์ทั้งหมด'
            : 'นักศึกษาทั้งหมด'} ({allUsersLen} คน)
        </strong>
      </Card.Header>
      <Card.Body>
        {extraHeader}
        {allUsersLen === 0 ? (
          <div className="text-muted text-center">ไม่มีข้อมูล</div>
        ) : (
          <>
            <Table striped bordered hover responsive className="mb-3">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>รหัสศึกษา</th>
                  <th>คลาสที่{type === 'teacher' ? 'สอน' : type === 'student' ? 'เรียน' : 'ดูแล'}</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {usersPage.map(user => (
                  <tr key={user._id}>
                    <td>{user.fullName}</td>
                    <td>{user.username}</td>
                    <td>
                      <Button variant="info" size="sm" onClick={() => handleViewClasses(user)}>
                        {user.classCount} คลาส
                      </Button>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <Button variant="warning" size="sm" className="mb-2 w-100" onClick={() => handleEdit(user)}>แก้ไข</Button>
                        <Button variant="danger" size="sm" className="w-100" onClick={() => handleDelete(user)}>ลบ</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <FooterPager page={page} total={total} onPrev={onPrev} onNext={onNext} />
          </>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <h4 className="mb-4 text-center">จัดการรายชื่อ</h4>

      {loading && <div className="d-flex justify-content-center"><Spinner animation="border" variant="primary" /></div>}
      {error && <Alert variant="danger" className="text-center">{error}</Alert>}

      {!loading && !error && (
        <>
          {renderUserTable(
            adminsPage,
            admins.length,
            'admin',
            pageAdmin,
            totalAdmins,
            () => setPageAdmin(p => Math.max(1, p - 1)),
            () => setPageAdmin(p => Math.min(totalAdmins, p + 1))
          )}

          {renderUserTable(
            teachersPage,
            teachers.length,
            'teacher',
            pageTeacher,
            totalTeachers,
            () => setPageTeacher(p => Math.max(1, p - 1)),
            () => setPageTeacher(p => Math.min(totalTeachers, p + 1))
          )}

          {renderUserTable(
            studentsPage,
            studentsFiltered.length,
            'student',
            pageStudent,
            totalStudents,
            () => setPageStudent(p => Math.max(1, p - 1)),
            () => setPageStudent(p => Math.min(totalStudents, p + 1)),
            (
              <div className="mb-3" style={{ maxWidth: 420, margin: '0 auto' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ค้นหานักศึกษา (ชื่อ, รหัส, อีเมล, จำนวนคลาส)"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                />
              </div>
            )
          )}
        </>
      )}

      <EditUserModal
        show={showModal}
        onHide={() => setShowModal(false)}
        user={selectedUser}
        onUpdated={fetchUsers}
      />

      <ClassListModal
        show={classModal.show}
        onHide={() => setClassModal({ show: false, list: [] })}
        classes={classModal.list}
      />
    </div>
  );
}
