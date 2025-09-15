import React, { useState } from 'react';
import API from '../services/api';

export default function CSVUploader() {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return alert('กรุณาเลือกไฟล์');

    const formData = new FormData();
    formData.append('csv', file);

    try {
      const res = await API.post('/classes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('✅ Upload สำเร็จ: ' + res.data.message);
    } catch (err) {
      alert('❌ Upload ล้มเหลว');
      console.error(err);
    }
  };

  return (
    <div className="mb-3">
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button className="btn btn-success ms-2" onClick={handleUpload}>Upload CSV</button>
    </div>
  );
}
