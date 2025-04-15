import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import "../styles/navbar.css";

const hiddenPaths = ["/login", "/register", "/new-register"];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  if (hiddenPaths.includes(location.pathname)) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleMenu = () => {
    const navbar = document.getElementById("navbarNav");
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navbar);
    if (navbar.classList.contains("show")) {
      bsCollapse.hide();
      setMenuOpen(false);
    } else {
      bsCollapse.show();
      setMenuOpen(true);
    }
  };

  const closeMenu = () => {
    const navbar = document.getElementById("navbarNav");
    if (navbar && navbar.classList.contains("show")) {
      new bootstrap.Collapse(navbar).hide();
      setMenuOpen(false);
    }
  };

  const renderNavLinks = () => {
    if (!user) return null;

    switch (user.role) {
      case "student":
        return (
          <>
            <Link className="nav-link" to="/student-dashboard" onClick={closeMenu}>Dashboard</Link>
            <Link className="nav-link" to="/attendance-history" onClick={closeMenu}>History</Link>
          </>
        );
      case "teacher":
        return (
          <>
            <Link className="nav-link" to="/teacher-dashboard" onClick={closeMenu}>Dashboard</Link>
            <Link className="nav-link" to="/class-historylist" onClick={closeMenu}>History</Link>
          </>
        );
      case "admin":
        return (
          <>
            <Link className="nav-link" to="/admin-dashboard" onClick={closeMenu}>Dashboard</Link>
            <Link className="nav-link" to="/manage-list" onClick={closeMenu}>Manage List</Link>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-custom px-3">
      <div className="container-fluid">
        <span className="navbar-brand">🎓 Face Attendance</span>
        <button
          className={`navbar-toggler ${menuOpen ? "active" : ""}`}
          type="button"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={toggleMenu}
        >
          {menuOpen ? "✖" : "☰"}
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          {user && (
            <>
              <div className="navbar-nav me-auto">{renderNavLinks()}</div>

              <div className="d-flex align-items-center gap-2 position-relative" ref={dropdownRef}>
                <div className="d-none d-md-block text-end">
                  <div className="fw-semibold">{user.fullName}</div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>{user.role}</div>
                </div>

                <div
                  className="profile-icon"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  👤
                </div>

                {dropdownOpen && (
                  <div className="profile-dropdown">
                    {user.role === "student" && <div className="dropdown-id">{user.studentId}</div>}
                    <div className="dropdown-name">{user.fullName}</div>
                    <div className="dropdown-email">{user.email}</div>
                    <div className="dropdown-role">{user.role}</div>
                    <hr />
                    <button className="btn btn-sm logout-btn" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
