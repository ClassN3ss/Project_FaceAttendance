import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/register.css";

const Register = () => {
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // แก้ pattern สำหรับรูปแบบใหม่ เช่น 64-040626-3635-8
  const studentIdPattern = /^\d{2}-\d{6}-\d{4}-\d{1}$/;
  const fullNamePattern = /^(นาย|นางสาว|นาง)[^\s]+ [^\s]+$/;

  const isStudentIdValid = studentIdPattern.test(studentId.trim());
  const isFullNameValid = fullNamePattern.test(fullName.trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!isStudentIdValid) {
      setError("! รหัสนักศึกษาต้องอยู่ในรูปแบบ xx-xxxxxx-xxxx-x");
      setLoading(false);
      return;
    }

    if (!isFullNameValid) {
      setError("! ชื่อต้องขึ้นต้นด้วย นาย, นางสาว หรือ นาง และต้องมีชื่อ + นามสกุล ไม่มีเว้นวรรคเกิน");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post("https://backendfaceattendance-production.up.railway.app/auth/register", {
        studentId,
        fullName,
      });
      setGeneratedCredentials(res.data);
    } catch (error) {
      const msg = error.response?.data?.message || "ลงทะเบียนไม่สำเร็จ";

      if (msg.includes("ไม่พบชื่อและรหัส")) {
        const confirm = window.confirm("! ไม่พบชื่อและรหัสของคุณในระบบ ต้องการลงทะเบียนใหม่หรือไม่?");
        if (confirm) {
          navigate("/new-register", { state: { studentId, fullName } });
        }
        return;
      }

      if (msg.includes("ข้อมูลบางส่วนไม่ตรง")) {
        setError("! ข้อมูลบางส่วนไม่ตรงกับระบบ กรุณาตรวจสอบให้ครบถ้วน");
        return;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCredentials) return;
    const username = generatedCredentials.username.replaceAll("-", "");
    const password = generatedCredentials.password.replaceAll("-", "");
    const text = `Username: ${username}\nPassword: ${password}`;
    navigator.clipboard.writeText(text);
    alert("คัดลอกสำเร็จ!");
  };

  return (
    <div className="register-bg">
      <div className="register-card">
        <h2 className="text-center mb-4">ลงทะเบียนนักศึกษา</h2>

        <form onSubmit={handleRegister}>
          <label className="form-label">Student ID</label>
          <input
            type="text"
            placeholder="เช่น 64-040626-3635-8"
            className={`form-control mb-2 ${
              studentId ? (isStudentIdValid ? "input-valid" : "input-invalid") : ""
            }`}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            maxLength={17}
            required
            disabled={loading}
          />
          <div className="register-note">* รูปแบบ: 6x-0406xx-xxxx-x</div>

          <label className="form-label mt-3 text-green">Full Name</label>
          <input
            type="text"
            placeholder="เช่น นายสมชาย ใจดี"
            className={`form-control mb-2 ${
              fullName ? (isFullNameValid ? "input-valid" : "input-invalid") : ""
            }`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={loading}
          />
          <div className="register-note">
            * ต้องขึ้นต้นด้วย <strong>นาย, นางสาว, นาง</strong> และไม่มีเว้นวรรคเกินหรือท้ายชื่อ
          </div>

          {error && <div className="text-danger mt-3 mb-2">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary w-100 mt-3"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        {generatedCredentials && (
          <div className="register-credentials-card mt-4 p-3">
            <p><strong>Username</strong></p>
            <input
              type="text"
              className="form-control mb-2"
              readOnly
              value={generatedCredentials.username.replaceAll("-", "")}
            />
            <p><strong>Password</strong></p>
            <input
              type="text"
              className="form-control mb-2"
              readOnly
              value={generatedCredentials.password.replaceAll("-", "")}
            />
            <button
              className="btn btn-copy w-100"
              onClick={handleCopy}
            >
              คัดลอก
            </button>
            <button
              className="btn btn-success w-100 mt-2"
              onClick={() => navigate("/login")}
            >
              ไปหน้า Login
            </button>
          </div>
        )}

        <div className="text-center mt-4">
          <a href="/login">Already have account? Login</a>
        </div>
      </div>
    </div>
  );
};

export default Register;
