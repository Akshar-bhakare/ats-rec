import { useState, useEffect } from 'react';

/**
 * A simple localStorage‑backed state helper.
 * @param {string} key Unique key per entity (e.g., "companies").
 */
const usePersistentRows = (key) => {
  const [rows, setRows] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(rows));
  }, [key, rows]);

  return [rows, setRows];
};

export default usePersistentRows;