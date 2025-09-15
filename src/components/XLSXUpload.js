import React, { useState } from 'react';
import API from '../services/api';

export default function XLSXUpload() {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert('กรุณาเลือกไฟล์ก่อน');

    const formData = new FormData();
    formData.append('csv', file); // ✅ ใช้ key 'file'

    try {
      const res = await API.post('/upload/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${sessionStorage.getItem("token")}`, // ✅ เผื่อ backend ต้องการ token
        }
      });
      alert('✅ อัปโหลดสำเร็จ: ' + res.data.message);
    } catch (err) {
      console.error(err);
      alert('❌ XLSX Upload Failed');
    }
  };

  return (
    <div className="my-3">
      <label>Upload Excel (xlsx): </label>
      <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files[0])} className="form-control my-2" />
      <button className="btn btn-success" onClick={handleUpload}>Upload XLSX</button>
    </div>
  );
}
