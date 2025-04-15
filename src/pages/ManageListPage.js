import React, { useEffect, useState } from 'react';
import { Button, Card, Table, Spinner, Alert, Modal } from 'react-bootstrap';
import API from '../services/api';
import EditUserModal from '../components/EditUserModal';
import "../styles/admin.css";

function ClassListModal({ show, onHide, classes }) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>📚 รายชื่อคลาส</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {classes.length === 0 ? <p className="text-muted">ไม่มีคลาส</p> : (
          <ul>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [classModal, setClassModal] = useState({ show: false, list: [] });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/users');
      const allUsers = res.data;

      setStudents(allUsers.filter(u => u.role === 'student'));
      setTeachers(allUsers.filter(u => u.role === 'teacher'));
      setAdmins(allUsers.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error('❌ โหลดรายชื่อผิดพลาด:', err);
      setError('ไม่สามารถโหลดข้อมูลผู้ใช้จากเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(`คุณต้องการลบ ${user.fullName} ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      await API.delete(`/users/${user._id}`);
      alert('🗑️ ลบเรียบร้อย');
      fetchUsers();
    } catch (err) {
      console.error('❌ ลบผู้ใช้ล้มเหลว:', err);
      alert('เกิดข้อผิดพลาดขณะลบผู้ใช้');
    }
  };

  const handleViewClasses = (user) => {
    setClassModal({ show: true, list: user.classNames || [] });
  };

  const renderUserTable = (users, type) => (
    <Card className="mb-4">
      <Card.Header>
        <strong>
          {type === 'admin'
            ? '🛡️ ผู้ดูแลระบบทั้งหมด'
            : type === 'teacher'
            ? '👨‍🏫 อาจารย์ทั้งหมด'
            : '👨‍🎓 นักศึกษาทั้งหมด'} ({users.length} คน)
        </strong>
      </Card.Header>
      <Card.Body>
        {users.length === 0 ? (
          <div className="text-muted">ไม่มีข้อมูล</div>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>รหัสศึกษา</th>
                <th>คลาสที่{type === 'teacher' ? 'สอน' : type === 'student' ? 'เรียน' : 'ดูแล'}</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.fullName}</td>
                  <td>{user.username}</td>
                  <td>
                    <Button variant="info" size="sm" onClick={() => handleViewClasses(user)}>
                      {user.classCount} คลาส
                    </Button>
                  </td>
                  <td>
                    <Button variant="warning" size="sm" className="me-2" onClick={() => handleEdit(user)}>📝 แก้ไข</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(user)}>🗑️ ลบ</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <div className="container">
      <h4 className="mb-4">📋 จัดการรายชื่อ</h4>

      {loading && <Spinner animation="border" variant="primary" />}
      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && (
        <>
          {renderUserTable(admins, 'admin')}
          {renderUserTable(teachers, 'teacher')}
          {renderUserTable(students, 'student')}
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