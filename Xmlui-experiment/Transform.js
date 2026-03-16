window.isValidEmail = function (email) {
  return typeof email === "string" &&
         email.trim() !== "" &&
         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper: format today's date + optional days offset
window.formatToday = function (plusDays = 0) {
  const date = new Date();
  if (plusDays !== 0) {
    date.setDate(date.getDate() + plusDays);
  }
  return date.toISOString().slice(0, 10);
};

// Date range helpers
window.today = function () {
  return new Date().toISOString().slice(0, 10);
};

window.startOfWeek = function () {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
};

window.endOfWeek = function () {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 6);
  return d.toISOString().slice(0, 10);
};

window.startOfMonth = function () {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

window.endOfMonth = function () {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

window.startOfQuarter = function () {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
};

window.endOfQuarter = function () {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
};

window.startOfYear = function () {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
};

window.endOfYear = function () {
  return new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
};

// Helper: calculate line item totals (debit/credit)
window.lineItemTotals = function (items) {

  
  let debit = 0, credit = 0;
  if (!Array.isArray(items)) {
    
    return { debit, credit };
  }

  for (const item of items) {
    debit += Number(item?.debit) || 0;
    credit += Number(item?.credit) || 0;
  }
  
  return { debit, credit };
};

