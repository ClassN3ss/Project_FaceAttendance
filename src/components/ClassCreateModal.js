import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import API, { getTeacherEmailByName } from '../services/api';

export default function ClassCreateModal({ onCreated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [preview, setPreview] = useState({ courseCode: '', courseName: '', teacherName: '', section: '' });
  const [studentsPreview, setStudentsPreview] = useState([]);
  const [filter, setFilter] = useState('');
  const [valid, setValid] = useState(false);

  const cleanName = (raw) => raw.replace(/ผู้สอน/g, '').trim();
  const cleanFullName = (name) => name.replace(/[-]+/g, ' ').replace(/\s+/g, ' ').trim();

  const validateImportFile = (rows) => {
    const errors = [];
    const studentMap = new Map();
    const seen = new Set();
    const students = [];

    const isSectionInvalid = (section) => {
      if (section === '0') return true;
      if (section.startsWith('0')) return true;
      if (/[\/\-\+]/.test(section)) return true;
      return false;
    };

    const headerRow = rows[6];
    if (!headerRow || !headerRow[1]?.toString().includes('เลข') || !headerRow[2]?.toString().includes('ชื่อ')) {
      errors.push('❌ ไม่พบคอลัมน์หัวตาราง "เลข" หรือ "ชื่อ - สกุล"');
    }

    const courseRow = rows.find(r => r?.[0]?.includes('วิชา'));
    const teacherRow = rows.find(r => r?.[5]?.includes('ผู้สอน'));
    if (!courseRow || !teacherRow) {
      errors.push('❌ ไม่พบข้อมูลชื่อวิชา หรือ ผู้สอน');
      return { errors };
    }

    const courseParts = courseRow[0].split(/\s+/);
    const courseCode = courseParts[1];
    const fullCourseName = courseParts.slice(2).join(' ');
    const sectionMatch = fullCourseName.match(/ตอน\s*(\d+)/);
    const section = sectionMatch ? sectionMatch[1] : null;

    if (!courseCode || !fullCourseName) {
      errors.push('❌ ไม่พบรหัสวิชา หรือ ชื่อวิชา');
    }

    if (!sectionMatch) {
      if (/ตอน/.test(fullCourseName)) {
        errors.push('❌ พบคำว่า "ตอน" แต่ไม่มีเลขกำกับ');
      }
    } else if (isSectionInvalid(section)) {
      errors.push(`❌ ตอนเรียนไม่ถูกต้อง: ${section}`);
    }

    const teacherName = cleanName(teacherRow[5]);

    for (let i = 8; i < rows.length; i++) {
      const row = rows[i];
      const studentId = String(row[1] || '').trim();
      const fullName = cleanFullName(String(row[2] || ''));

      if (!studentId && !fullName) {
        const hasMore = rows.slice(i + 1).some(r => r[1]?.toString().trim() || r[2]?.toString().trim());
        if (hasMore) {
          errors.push(`❌ ข้ามแถวที่ ${i + 1}`);
          break;
        }
        break;
      }

      if (!studentId || !fullName) {
        errors.push(`❌ ข้อมูลไม่ครบในแถว ${i + 1}`);
        continue;
      }

      if (!/^\d{2}-\d{6}-\d{4}-\d$/.test(studentId)) {
        errors.push(`❌ เลขประจำตัวไม่ถูกต้อง (${studentId}) ที่แถว ${i + 1}`);
      }

      if (!/(นาย|นางสาว|นาง)/.test(fullName)) {
        errors.push(`❌ ไม่มีคำนำหน้าในชื่อที่แถว ${i + 1}`);
      }

      if (!/\s/.test(fullName)) {
        errors.push(`❌ ไม่มีนามสกุลในชื่อที่แถว ${i + 1}`);
      }

      if (studentMap.has(studentId) && studentMap.get(studentId) !== fullName) {
        errors.push(`❌ รหัส ${studentId} ชื่อไม่ตรงกัน (${studentMap.get(studentId)} → ${fullName})`);
      }

      studentMap.set(studentId, fullName);
      if (!seen.has(studentId)) {
        seen.add(studentId);
        students.push({ studentId, fullName, section });
      }
    }

    // ✅ ตรวจ "ชื่อซ้ำแต่รหัสต่างกัน"
    const nameToIds = new Map();
    for (const [studentId, fullName] of studentMap.entries()) {
      if (!nameToIds.has(fullName)) nameToIds.set(fullName, new Set());
      nameToIds.get(fullName).add(studentId);
    }
    for (const [fullName, ids] of nameToIds.entries()) {
      if (ids.size > 1) {
        errors.push(`❌ ชื่อ "${fullName}" ซ้ำในหลายรหัสนักศึกษา (${[...ids].join(', ')})`);
      }
    }

    return {
      errors,
      result: {
        courseCode,
        courseName: fullCourseName.replace(/ตอน\s*\d+/, '').trim(),
        teacherName,
        section: section || '1',
        students,
      },
    };
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setValid(false);
    setStudentsPreview([]);
    setPreview({ courseCode: '', courseName: '', teacherName: '', section: '' });
    setEmail('');
    setEmailLocked(false);

    if (!selectedFile?.name.endsWith('.xlsx')) {
      alert('❌ กรุณาเลือกเฉพาะไฟล์ .xlsx');
      return;
    }

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const { errors, result } = validateImportFile(rows);
      if (errors.length) {
        alert(errors.join('\n'));
        return;
      }

      setPreview({
        courseCode: result.courseCode,
        courseName: result.courseName,
        teacherName: result.teacherName,
        section: result.section,
      });
      setStudentsPreview(result.students);
      setValid(true);

      const emailFromSystem = await getTeacherEmailByName(result.teacherName);
      if (emailFromSystem && emailFromSystem.trim()) {
        setEmail(emailFromSystem.trim());
        setEmailLocked(true);
      }
    } catch (err) {
      console.error('❌ Error reading file:', err);
      alert('❌ ไม่สามารถอ่านไฟล์ได้');
    }

    setFileInputKey(Date.now()); // 👈 reset input key
  };

  const handleEmailChange = (e) => {
    const value = e.target.value.toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@(gmail\.com|email\.kmutnb\.ac\.th)$/;
    const hasThai = /[ก-๙]/.test(value);
    const hasSpace = /\s/.test(value);

    if (hasThai || hasSpace) {
      setEmail(value);
      setValid(false);
      return;
    }

    setEmail(value);
    setValid(file && emailRegex.test(value));
  };

  const handleCreate = async () => {
    if (!file || !valid || !email) return alert('❌ กรุณาแนบไฟล์ และกรอกอีเมลอาจารย์');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email.trim());

    try {
      await API.post('/classes/create', formData);
      alert('✅ สร้างคลาสสำเร็จ');
      setModalOpen(false);
      setFile(null);
      setEmail('');
      setEmailLocked(false);
      setValid(false);
      setPreview({ courseCode: '', courseName: '', teacherName: '', section: '' });
      setStudentsPreview([]);
      onCreated();
    } catch (err) {
      console.error('❌ Error creating class', err);
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
            key={fileInputKey}
            type="file"
            accept=".xlsx"
            className="form-control mb-2"
            onChange={handleFileSelect}
          />
          <input
            type="email"
            placeholder="อีเมลอาจารย์ (gmail หรือ email.kmutnb.ac.th เท่านั้น)"
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
                placeholder="🔍 ค้นหานักศึกษา..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <div className="alert alert-info" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <strong>👨‍🎓 รายชื่อนักศึกษา ({filteredStudents.length} คน)</strong>
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
            ✅ สร้างคลาส
          </button>
        </div>
      )}
    </>
  );
}
