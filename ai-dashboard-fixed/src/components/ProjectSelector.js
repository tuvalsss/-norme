import React, { useEffect, useState } from "react";

/**
 * רכיב לבחירת פרויקט פעיל מרשימת פרויקטים
 */
const ProjectSelector = ({ setActiveProject }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  // טען רשימת פרויקטים כשהרכיב נטען
  useEffect(() => {
    fetchProjects();
    fetchActiveProject();

    // רענן את הרשימה כל 30 שניות
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  // קבל רשימת פרויקטים מהשרת
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/projects");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "שגיאה בטעינת רשימת פרויקטים");
      }

      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error("שגיאה בטעינת רשימת פרויקטים:", err);
      setError("לא ניתן לטעון את רשימת הפרויקטים. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  // קבל פרויקט פעיל מהשרת
  const fetchActiveProject = async () => {
    try {
      const response = await fetch("http://localhost:5001/active-project");
      const data = await response.json();

      if (data.success && data.project) {
        setSelectedProject(data.project.name);
        setActiveProject(data.project);
      }
    } catch (err) {
      console.error("שגיאה בטעינת פרויקט פעיל:", err);
    }
  };

  // בחר פרויקט פעיל
  const handleSelectProject = async (projectName) => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/select-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectName }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "שגיאה בבחירת פרויקט");
      }

      setSelectedProject(projectName);
      setActiveProject(data.project);

      // הצג הודעת הצלחה
      alert(`פרויקט "${projectName}" נבחר בהצלחה`);
    } catch (err) {
      console.error("שגיאה בבחירת פרויקט:", err);
      alert(`שגיאה בבחירת פרויקט: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl mb-6 relative">
      <h2 className="text-2xl font-bold text-gray-400 mb-3">📁 בחירת פרויקט</h2>

      {loading && <p className="text-gray-400">טוען פרויקטים...</p>}
      
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <p className="text-yellow-400">
          לא נמצאו פרויקטים. נא להוסיף פרויקט לתיקיית projects.
        </p>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {projects.map((project) => (
            <div
              key={project.name}
              className={`p-3 rounded-md cursor-pointer transition-all ${
                selectedProject === project.name
                  ? "bg-cyan-800 border-2 border-cyan-600"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
              onClick={() => handleSelectProject(project.name)}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-2">📁</span>
                <div className="flex flex-col">
                  <span className="font-medium">{project.name}</span>
                  <span className="text-xs text-gray-400 truncate">
                    {project.path}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProject && (
        <div className="mt-4 bg-gray-800 p-3 rounded-md border-r-4 border-cyan-500">
          <p className="text-white">
            🔧 פרויקט פעיל: <strong>{selectedProject}</strong>
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector; 