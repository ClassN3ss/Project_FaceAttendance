import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "../styles/admin.css";

const PAGE_SIZE = 10;

export default function StudentRequest() {
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  const fetchRequests = async () => {
    try {
      const res = await API.get("/enrollments/messages");
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setRequests(items);
      const tp = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
      setPage((p) => Math.min(p, tp));
    } catch (err) {
      console.error("❌ โหลด log ไม่สำเร็จ:", err);
    }
  };

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(
    () => requests.slice(start, start + PAGE_SIZE),
    [requests, start]
  );
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));

  const selectedCountOnPage = pageItems.filter(r => selected.has(r._id)).length;

  useEffect(() => { fetchRequests(); }, []);
  useEffect(() => { setSelected(new Set()); }, [page]);

  const handleApprove = async (id) => {
    try {
      await API.put(`/enrollments/approve/${id}`, { status: "approved" });
      await fetchRequests();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error("❌ ดำเนินการไม่สำเร็จ:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      await API.delete(`/enrollments/${id}`);
      await fetchRequests();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error("❌ ปฏิเสธไม่สำเร็จ:", err);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allOnPageSelected =
    pageItems.length > 0 && pageItems.every((r) => selected.has(r._id));

  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageItems.forEach((r) => next.delete(r._id));
      } else {
        pageItems.forEach((r) => next.add(r._id));
      }
      return next;
    });
  };

  const handleApproveSelected = async () => {
    try {
      const idsOnPage = pageItems
        .filter((r) => selected.has(r._id))
        .map((r) => r._id);
      if (idsOnPage.length === 0) return;
      await Promise.all(
        idsOnPage.map((id) =>
          API.put(`/enrollments/approve/${id}`, { status: "approved" })
        )
      );
      setSelected(new Set());
      await fetchRequests();
    } catch (err) {
      console.error("❌ ยืนยันที่เลือก (หน้านี้) ไม่สำเร็จ:", err);
    }
  };

  return (
    <section className="container">
      <h4 className="text-center mt-3 mb-2">คำร้องขอเข้าเรียน</h4>
        <table className="table table-bordered table-sm">
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: "center" }}>
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
              </th>
              <th style={{ width: 80 }}>ลำดับ</th>
              <th>ชื่อ</th>
              <th>วิชา</th>
              <th style={{ width: 100 }}>ตอน</th>
              <th style={{ width: 140 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted">
                  ไม่มีคำร้องค้างอยู่
                </td>
              </tr>
            ) : (
              pageItems.map((req, idx) => (
                <tr key={req._id}>
                  <td style={{ textAlign: "center" }}>
                    <input  type="checkbox" checked={selected.has(req._id)} onChange={() => toggleSelect(req._id)} />
                  </td>
                  <td>{start + idx + 1}</td>
                  <td>{req.student?.fullName}</td>
                  <td>{req.classId?.courseName}</td>
                  <td>{req.classId?.section}</td>
                  <td>
                    <button onClick={() => handleApprove(req._id)} className="btn btn-primary btn-sm" title="อนุมัติ" >
                      ✅
                    </button>
                    <br /><br />
                    <button onClick={() => handleReject(req._id)} className="btn btn-outline-danger btn-sm ms-1" title="ปฏิเสธ" >
                      ❌
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="d-flex justify-content-end mt-3">
          <button className="btn btn-primary btn-sm" onClick={handleApproveSelected} disabled={pageItems.every((r) => !selected.has(r._id))}>
            ยืนยันที่เลือก {selectedCountOnPage > 0 && `(${selectedCountOnPage})`}
          </button>
        </div>
      

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4 mb-5">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            หน้าก่อนหน้า
          </button>

          <span className="page-indicator">
            หน้า {page} / {totalPages}
          </span>

          <button
            className="btn btn-outline-primary btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            หน้าถัดไป
          </button>
        </div>
      )}

    </section>
  );
}
