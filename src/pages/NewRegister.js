import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/newregister.css";

const NewRegister = () => {
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const trimmedId = studentId.trim();
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();

  const isValidId = /^\d{13}$/.test(trimmedId);
  const isValidName = /^(นาย|นางสาว|นาง)[^\s]+ [^\s]+$/.test(trimmedName);
  const isValidEmail = new RegExp(`^s${trimmedId}@email\\.kmutnb\\.ac\\.th$`).test(trimmedEmail);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValidId) {
      setError("❗ รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก");
      return;
    }

    if (!isValidName) {
      setError("❗ ชื่อต้องขึ้นต้นด้วย นาย, นางสาว หรือ นาง และห้ามมีเว้นวรรคเกิน");
      return;
    }

    if (!isValidEmail) {
      setError(`❗ Email ต้องเป็น s${trimmedId}@email.kmutnb.ac.th เท่านั้น`);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/auth/new-register", {
        studentId,
        fullName,
        email,
      });
      setGenerated(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || "❌ สมัครไม่สำเร็จ";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generated) return;
    const text = `Username: ${generated.username}\nPassword: ${generated.password}`;
    navigator.clipboard.writeText(text);
    alert("📋 คัดลอกสำเร็จ!");
  };

  return (
    <div className="newregister-bg">
      <div className="newregister-card">
        <h3 className="text-center mb-4">📋 ลงทะเบียนใหม่</h3>

        {generated ? (
          <div>
            <p><strong>✅ ลงทะเบียนสำเร็จ!</strong></p>
            <p><strong>Username</strong></p>
            <input className="form-control mb-2" readOnly value={generated.username} />
            <p><strong>Password</strong></p>
            <input className="form-control mb-2" readOnly value={generated.password} />
            <button className="btn btn-outline-secondary w-100" onClick={handleCopy}>
              📋 คัดลอก
            </button>
            <button className="btn btn-primary w-100 mt-2" onClick={() => navigate("/login")}>
              🔐 ไปหน้า Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="form-label">🎓 Student ID</label>
            <input
              type="text"
              className={`form-control mb-2 ${studentId && (isValidId ? "input-valid" : "input-invalid")}`}
              placeholder="เช่น 6505012345678"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              maxLength={13}
              disabled={loading}
              required
            />
            <div className="newregister-note">* ต้องเป็นตัวเลข 13 หลัก</div>

            <label className="form-label mt-3">👤 ชื่อ-นามสกุล</label>
            <input
              type="text"
              className={`form-control mb-2 ${fullName && (isValidName ? "input-valid" : "input-invalid")}`}
              placeholder="เช่น นายสมชาย ใจดี"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              required
            />
            <div className="newregister-note">
              * ต้องขึ้นต้นด้วย <strong>นาย, นางสาว, นาง</strong> และไม่มีเว้นวรรคหลังคำนำหน้า
            </div>

            <label className="form-label mt-3">📧 Email นักศึกษา</label>
            <input
              type="email"
              className={`form-control mb-2 ${email && (isValidEmail ? "input-valid" : "input-invalid")}`}
              placeholder="เช่น s6505012345678@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <div className="newregister-note">
              * รูปแบบต้องตรงกับ <code className="newregister-code">s6x040626xxxxx@email.kmutnb.ac.th</code>
            </div>

            {error && <div className="text-danger mt-3 mb-2">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary w-100 mt-3"
              disabled={loading}
            >
              {loading ? "⏳ กำลังบันทึก..." : "✅ บันทึกข้อมูล"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default NewRegister;
