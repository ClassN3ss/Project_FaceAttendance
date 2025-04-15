import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import API from '../services/api';

export default function EditUserModal({ show, onHide, user, onUpdated }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setRole(user.role || 'student');
    }
  }, [user]);

  const handleSave = async () => {
    try {
      await API.put(`/users/${user._id}`, {
        fullName,
        username,
        email,
        role
      });
      alert('✅ บันทึกเรียบร้อย');
      onUpdated();
      onHide();
    } catch (err) {
      console.error('❌ แก้ไขไม่สำเร็จ:', err);
      alert('เกิดข้อผิดพลาด');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>📝 แก้ไขข้อมูลผู้ใช้</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>ชื่อ - สกุล</Form.Label>
            <Form.Control
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>รหัสผู้ใช้ / Username</Form.Label>
            <Form.Control
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>อีเมล</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>บทบาท</Form.Label>
            <Form.Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">นักศึกษา</option>
              <option value="teacher">อาจารย์</option>
              <option value="admin">ผู้ดูแล</option>
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          ยกเลิก
        </Button>
        <Button variant="primary" onClick={handleSave}>
          💾 บันทึก
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
