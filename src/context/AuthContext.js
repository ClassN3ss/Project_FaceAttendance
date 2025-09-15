import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("user"); // ⬅ เปลี่ยนจาก localStorage เป็น sessionStorage
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (userData, token) => {
    sessionStorage.setItem("user", JSON.stringify(userData)); 
    sessionStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem("user"); 
    sessionStorage.removeItem("token"); 
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
