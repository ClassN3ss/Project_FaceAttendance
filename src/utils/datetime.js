export const formatThaiDatetime = (utcString) => {
  if (!utcString) return "-";
  return new Date(utcString).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
};

export const formatThaiTime = (utcString) => {
  if (!utcString) return "-";
  return new Date(utcString).toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
};

export const formatThaiDate = (utcString) => {
  if (!utcString) return "-";
  return new Date(utcString).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
  });
};
