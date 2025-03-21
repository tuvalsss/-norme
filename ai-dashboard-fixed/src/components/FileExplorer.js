import React, { useEffect, useState } from "react";

/**
 * רכיב עץ קבצים שמציג את כל הקבצים בפרויקט ומאפשר פתיחה בעורך חיצוני
 */
const FileExplorer = ({ activeProject }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});

  // טען את מבנה הקבצים כאשר הפרויקט הפעיל משתנה
  useEffect(() => {
    if (activeProject) {
      fetchFiles();
    } else {
      setFiles([]);
    }
  }, [activeProject]);

  // קבל את מבנה הקבצים מהשרת
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/active-project/files");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "שגיאה בטעינת קבצים");
      }

      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      console.error("שגיאה בטעינת מבנה קבצים:", err);
      setError("לא ניתן לטעון את מבנה הקבצים. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  // פתח קובץ ב-VS Code
  const handleOpenFile = async (filePath) => {
    try {
      const response = await fetch("http://localhost:5001/open-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "שגיאה בפתיחת קובץ");
      }
    } catch (err) {
      console.error("שגיאה בפתיחת קובץ:", err);
      alert(`שגיאה בפתיחת קובץ: ${err.message}`);
    }
  };

  // פונקציה לקבלת אייקון עבור סוג קובץ
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    const icons = {
      js: '📜',
      jsx: '⚛️',
      ts: '🔷',
      tsx: '🔶',
      json: '📋',
      html: '🌐',
      css: '🎨',
      scss: '💅',
      md: '📝',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      gif: '🖼️',
      svg: '🔲',
      pdf: '📑',
      zip: '📦',
      default: '📄'
    };
    
    return icons[extension] || icons.default;
  };

  // הפעל/בטל פתיחת תיקייה
  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // רנדור רקורסיבי של עץ קבצים
  const renderFileTree = (items, level = 0) => {
    return items
      .sort((a, b) => {
        // תיקיות קודם, אח"כ קבצים (לפי א"ב)
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => {
        const paddingLeft = `${level * 1.2 + 0.5}rem`;

        if (item.type === 'directory') {
          const isExpanded = expandedFolders[item.path] || false;
          
          return (
            <React.Fragment key={item.path}>
              <div
                className="flex items-center py-1 hover:bg-gray-800 cursor-pointer"
                style={{ paddingLeft }}
                onClick={() => toggleFolder(item.path)}
              >
                <span className="mr-1">{isExpanded ? '📂' : '📁'}</span>
                <span>{item.name}</span>
              </div>
              
              {isExpanded && item.children && (
                <div className="directory-children">
                  {renderFileTree(item.children, level + 1)}
                </div>
              )}
            </React.Fragment>
          );
        } else {
          return (
            <div
              key={item.path}
              className="flex items-center py-1 hover:bg-gray-800 cursor-pointer"
              style={{ paddingLeft }}
              onDoubleClick={() => handleOpenFile(item.path)}
            >
              <span className="mr-1">{getFileIcon(item.name)}</span>
              <span>{item.name}</span>
            </div>
          );
        }
      });
  };

  // כאשר אין פרויקט פעיל
  if (!activeProject) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl relative">
        <h2 className="text-2xl font-bold text-gray-400 mb-3">📂 סייר קבצים</h2>
        <p className="text-yellow-400">יש לבחור פרויקט כדי לצפות בקבצים.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl relative">
      <h2 className="text-2xl font-bold text-gray-400 mb-3">📂 סייר קבצים</h2>
      
      <p className="text-gray-400 text-sm mb-3">
        <small>לחץ פעמיים על קובץ כדי לפתוח אותו ב-VS Code</small>
      </p>

      {loading && <p className="text-gray-400">טוען מבנה קבצים...</p>}
      
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && files.length === 0 && (
        <p className="text-yellow-400">
          הפרויקט ריק או שאין גישה לקבצים.
        </p>
      )}

      {!loading && !error && files.length > 0 && (
        <div className="file-tree text-gray-300 overflow-auto max-h-96 rounded-md bg-black p-2">
          {renderFileTree(files)}
        </div>
      )}
      
      <div className="mt-4 bg-gray-800 p-2 rounded-md text-sm">
        <p className="text-gray-400">
          שם הפרויקט: <span className="text-white">{activeProject.name}</span>
        </p>
        <p className="text-gray-400 truncate text-xs">
          נתיב: <span className="text-gray-300">{activeProject.path}</span>
        </p>
      </div>
    </div>
  );
};

export default FileExplorer; 