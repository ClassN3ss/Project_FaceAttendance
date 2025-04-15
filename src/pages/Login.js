import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import "../styles/login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (user) {
    if (user.role === "student") return <Navigate to="/student-dashboard" replace />;
    if (user.role === "teacher") return <Navigate to="/teacher-dashboard" replace />;
    if (user.role === "admin") return <Navigate to="/admin-dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/auth/login", {
        username,
        password,
      });

      const { token, user } = res.data;
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(user));
      login(user, token);

      alert("✅ Login Successful!");

      if (user.role === "student") {
        navigate(user.faceScanned ? "/student-dashboard" : "/save-face");
      } else if (user.role === "teacher") {
        navigate("/teacher-dashboard");
      } else if (user.role === "admin") {
        navigate("/admin-dashboard");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "❌ Login failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <h2 className="text-center mb-3">Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            className="form-control mb-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="form-control mb-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-100" disabled={loading}>
            {loading ? "🔄 Signing in..." : "🔐 Sign In"}
          </button>
        </form>
        
        <div className="text-center mt-3">
          <a href="/register">Student? Register here</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
