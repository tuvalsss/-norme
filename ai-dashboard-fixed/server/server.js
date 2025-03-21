const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const AGENTS = ["dev_agent", "qa_agent", "doc_agent", "summary_agent"];
const SCRIPTS_PATH = path.join(__dirname, "../agents/");
const LOGS_PATH = path.join(__dirname, "../public/logs/");

app.post("/run-agent", (req, res) => {
  const { agent } = req.body;
  const scriptPath = path.join(SCRIPTS_PATH, `${agent}.bat`);
  exec(`start "" "${scriptPath}"`, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    res.json({ message: `${agent} הופעל!` });
  });
});

app.post("/stop-agent", (req, res) => {
  const { agent } = req.body;
  exec(`taskkill /F /FI "WINDOWTITLE eq ${agent}*"`, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    res.json({ message: `${agent} כובה.` });
  });
});

app.post("/build-project", (req, res) => {
  const script = path.join(SCRIPTS_PATH, "build_project.bat");
  exec(`"${script}"`, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    res.json({ message: "פרויקט נבנה!", output: stdout });
  });
});

app.get("/logs/live/:agent", (req, res) => {
  const file = path.join(LOGS_PATH, `README_${req.params.agent}.md`);
  if (!fs.existsSync(file)) return res.status(404).send("לא נמצא");
  res.send(fs.readFileSync(file, "utf8"));
});

app.get("/agent-status", (req, res) => {
  exec("tasklist", (err, stdout) => {
    const status = {};
    AGENTS.forEach(agent => {
      status[agent] = stdout.toLowerCase().includes(agent.toLowerCase());
    });
    res.json(status);
  });
});

app.listen(5000, () => console.log("שרת רץ על פורט 5000"));
