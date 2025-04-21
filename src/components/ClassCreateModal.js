import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import API, { getTeacherEmailByName } from '../services/api';

export default function ClassCreateModal({ onCreated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [preview, setPreview] = useState({ courseCode: '', courseName: '', teacherName: '', section: '' });
  const [studentsPreview, setStudentsPreview] = useState([]);
  const [filter, setFilter] = useState('');
  const [valid, setValid] = useState(false);

  const cleanName = (raw) => raw
    .replace(/ผู้สอน/g, '')
    .trim();


  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setValid(false);
    setStudentsPreview([]);
    setPreview({ courseCode: '', courseName: '', teacherName: '', section: '' });
    setEmail('');
    setEmailLocked(false);

    if (!selectedFile?.name.endsWith('.xlsx')) {
      alert('กรุณาเลือกเฉพาะไฟล์ .xlsx');
      return;
    }

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const courseRow = rows.find(r => r?.[0]?.includes('วิชา'));
      const teacherRow = rows.find(r => r?.[5]?.includes('ผู้สอน'));

      if (!courseRow || !teacherRow) {
        alert('ไม่พบข้อมูลชื่อวิชา หรือ ผู้สอนในไฟล์');
        return;
      }

      const courseParts = courseRow[0].split(/\s+/);
      const courseCode = courseParts[1] || '000000';
      const courseName = courseParts.slice(2).join(' ') || 'ไม่พบชื่อวิชา';
      const teacherName = cleanName(teacherRow[5]);

      const students = [];
      for (let i = 9; i < rows.length; i++) {
        const row = rows[i];
        const studentId = row[1];
        const fullName = row[2];
        const sectionCell = row[3];
        if (studentId && fullName) {
          students.push({
            studentId,
            fullName,
            section: sectionCell || '1'
          });
        }
      }

      if (students.length === 0) {
        alert('ไม่พบนักศึกษาในไฟล์');
        return;
      }

      setPreview({ courseCode, courseName, teacherName, section: students[0]?.section || '1' });
      setStudentsPreview(students);
      setValid(true);

      const emailFromSystem = await getTeacherEmailByName(teacherName);
      if (emailFromSystem && emailFromSystem.trim()) {
        setEmail(emailFromSystem.trim());
        setEmailLocked(true);
      }
    } catch (err) {
      console.error('Error reading file:', err);
      alert('ไม่สามารถอ่านไฟล์ได้');
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value.toLowerCase();
    const emailRegex = /^[a-z0-9@.]*$/;
    if (emailRegex.test(value)) {
      setEmail(value);
    }
  };

  const handleCreate = async () => {
    if (!file || !valid || !email) return alert('กรุณาแนบไฟล์ และกรอกอีเมลอาจารย์');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email.trim());
    formData.append('section', preview.section);

    try {
      await API.post('/classes/create', formData);
      alert('สร้างคลาสสำเร็จ');
      setModalOpen(false);
      setFile(null);
      setEmail('');
      setEmailLocked(false);
      setValid(false);
      setPreview({ courseCode: '', courseName: '', teacherName: '', section: '' });
      setStudentsPreview([]);
      onCreated();
    } catch (err) {
      console.error('Error creating class', err);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const filteredStudents = studentsPreview.filter(s =>
    s.studentId.includes(filter) || s.fullName.includes(filter)
  );

  return (
    <>
      <button onClick={() => setModalOpen(true)} className="btn btn-primary mb-3">
        + สร้างคลาสด้วยไฟล์ .xlsx
      </button>

      {modalOpen && (
        <div className="card p-3">
          <input
            type="file"
            accept=".xlsx"
            className="form-control mb-2"
            onChange={handleFileSelect}
          />

          <input
            type="email"
            placeholder="อีเมลอาจารย์ (เฉพาะ a-z, 0-9, @, .)"
            className="form-control mb-2"
            value={email}
            onChange={handleEmailChange}
            disabled={emailLocked}
          />

          {preview.courseCode && (
            <div className="alert alert-secondary">
              <strong>รหัสวิชา:</strong> {preview.courseCode}<br />
              <strong>ชื่อวิชา:</strong> {preview.courseName}<br />
              <strong>อาจารย์ (จากไฟล์):</strong> {preview.teacherName}
            </div>
          )}

          {studentsPreview.length > 0 && (
            <>
              <input
                type="text"
                className="form-control mb-2"
                placeholder="ค้นหานักศึกษา..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />

              <div className="alert alert-info" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <strong>รายชื่อนักศึกษา ({filteredStudents.length} คน)</strong>
                <ul className="mb-0 small">
                  {filteredStudents.map((s, i) => (
                    <li key={i}>
                      {s.studentId} - {s.fullName} (ตอน {s.section})
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <button
            className="btn btn-success"
            disabled={!file || !valid || !email}
            onClick={handleCreate}
          >
            สร้างคลาส
          </button>
        </div>
      )}
    </>
  );
}
