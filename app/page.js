"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "ai-secretary-tasks-v1";

const CATEGORIES = [
  {
    key: "critical",
    label: "Critical",
    helper: "今日要處理，唔處理會出事",
    color: "#b91c1c",
    bg: "#fff1f2",
  },
  {
    key: "waiting",
    label: "Waiting",
    helper: "等緊人覆、等資料、等確認",
    color: "#0369a1",
    bg: "#eff6ff",
  },
  {
    key: "follow_up",
    label: "Follow-up",
    helper: "要主動追人或提醒",
    color: "#4d7c0f",
    bg: "#f7fee7",
  },
  {
    key: "low_priority",
    label: "Someday / Low priority",
    helper: "遲啲先做，有空再處理",
    color: "#6b7280",
    bg: "#f9fafb",
  },
];

const CATEGORY_KEYS = CATEGORIES.map((category) => category.key);

const cardStyle = {
  padding: 16,
  border: "1px solid #d7dde5",
  borderRadius: 8,
  background: "#fff",
};

const buttonStyle = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #1f2937",
  cursor: "pointer",
  fontSize: 16,
};

function safeText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "unclear") return "";
  return text;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function prepareStoredTasks(tasks) {
  return tasks.map((task, index) => ({
    ...task,
    category: CATEGORY_KEYS.includes(task.category) ? task.category : "low_priority",
    order: Number.isFinite(task.order) ? task.order : index,
    status: task.status || "open",
  }));
}

function loadTasks() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? prepareStoredTasks(parsed) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function itemTitle(item) {
  return (
    safeText(item.title) ||
    safeText(item.next_action) ||
    safeText(item.message_hint) ||
    safeText(item.next_follow_up) ||
    "未命名任務"
  );
}

function normalizeTask(category, item, order) {
  const nextAction =
    safeText(item.next_action) ||
    safeText(item.next_follow_up) ||
    safeText(item.message_hint) ||
    safeText(item.reason);

  const due =
    safeText(item.deadline_or_follow_up) ||
    safeText(item.when) ||
    safeText(item.next_follow_up);

  const person =
    safeText(item.owner_or_waiting_for) ||
    safeText(item.waiting_for) ||
    safeText(item.who_to_follow_up);

  return {
    id: `${Date.now()}-${category}-${Math.random().toString(16).slice(2)}`,
    category,
    title: itemTitle(item),
    nextAction,
    due,
    person,
    reason: safeText(item.risk) || safeText(item.why_it_matters) || safeText(item.reason),
    status: "open",
    order,
    createdAt: new Date().toISOString(),
  };
}

function tasksFromAnalysis(analysis) {
  const tasks = [];

  for (const category of CATEGORIES) {
    const source = category.key === "low_priority" ? analysis.low_priority : analysis[category.key];
    for (const item of Array.isArray(source) ? source : []) {
      tasks.push(normalizeTask(category.key, item, tasks.length));
    }
  }

  return tasks;
}

function getInitialView() {
  if (typeof window === "undefined") return "capture";
  if (window.location.hash === "#tasks") return "tasks";
  if (window.location.hash === "#records") return "records";
  return "capture";
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function displayDate(key) {
  if (!key) return "";
  const [year, month, day] = key.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
  return [...blanks, ...days];
}

function TaskCard({
  task,
  index,
  columnLength,
  dragOverTaskId,
  onDone,
  onDelete,
  onMoveCategory,
  onMoveStep,
  onDragStart,
  onDragEnd,
  onDropOnTask,
  onDragOverTask,
}) {
  const category = CATEGORIES.find((item) => item.key === task.category) || CATEGORIES[3];

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOverTask(event, task.id)}
      onDrop={(event) => onDropOnTask(event, task.category, task.id)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        border: "1px solid #d7dde5",
        borderLeft: `5px solid ${category.color}`,
        borderRadius: 8,
        padding: 10,
        background: "#fff",
        color: "#111827",
        boxShadow: dragOverTaskId === task.id ? "0 0 0 2px #111827 inset" : "none",
      }}
    >
      <input
        type="checkbox"
        aria-label={`完成 ${task.title}`}
        onChange={() => onDone(task.id)}
        style={{ width: 22, height: 22 }}
      />
      <strong style={{ flex: "1 1 260px", minWidth: 0, overflowWrap: "anywhere", fontSize: 16 }}>
        {task.title}
      </strong>
      <select
        aria-label="改分類"
        value={task.category}
        onChange={(event) => onMoveCategory(task.id, event.target.value)}
        style={{
          width: 190,
          maxWidth: "100%",
          minHeight: 36,
          border: "1px solid #9ca3af",
          borderRadius: 8,
          background: "#fff",
          color: "#111827",
          padding: "0 8px",
          fontSize: 14,
          marginLeft: "auto",
        }}
      >
        {CATEGORIES.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => onMoveStep(task.id, -1)}
        disabled={index === 0}
        style={{ ...buttonStyle, minWidth: 38, padding: 6, background: "#fff" }}
        aria-label="上移"
      >
        ↑
      </button>
      <button
        onClick={() => onMoveStep(task.id, 1)}
        disabled={index === columnLength - 1}
        style={{ ...buttonStyle, minWidth: 38, padding: 6, background: "#fff" }}
        aria-label="下移"
      >
        ↓
      </button>
      <button onClick={() => onDelete(task.id)} style={{ ...buttonStyle, padding: "7px 10px", background: "#fff" }}>
        刪除
      </button>
    </article>
  );
}

function TaskColumn({
  category,
  tasks,
  dragOverCategory,
  dragOverTaskId,
  onDone,
  onDelete,
  onMoveCategory,
  onMoveStep,
  onDragStart,
  onDragEnd,
  onDropOnTask,
  onDropOnColumn,
  onDragOverTask,
  onDragOverColumn,
}) {
  return (
    <section
      onDragOver={(event) => onDragOverColumn(event, category.key)}
      onDrop={(event) => onDropOnColumn(event, category.key)}
      style={{
        ...cardStyle,
        background: dragOverCategory === category.key ? "#f8fafc" : "#fff",
        boxShadow: dragOverCategory === category.key ? `0 0 0 2px ${category.color} inset` : "none",
        minHeight: 220,
      }}
    >
      <h3 style={{ margin: "0 0 4px", color: category.color }}>{category.label}</h3>
      <p style={{ margin: "0 0 12px", color: "#6b7280" }}>{category.helper}</p>
      <div style={{ display: "grid", gap: 10 }}>
        {tasks.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca3af" }}>暫時冇。</p>
        ) : (
          tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              columnLength={tasks.length}
              dragOverTaskId={dragOverTaskId}
              onDone={onDone}
              onDelete={onDelete}
              onMoveCategory={onMoveCategory}
              onMoveStep={onMoveStep}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropOnTask={onDropOnTask}
              onDragOverTask={onDragOverTask}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Navigation({ view, setView, openCount, completedCount }) {
  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        onClick={() => setView("capture")}
        style={{
          ...buttonStyle,
          background: view === "capture" ? "#111827" : "#fff",
          color: view === "capture" ? "#fff" : "#111827",
        }}
      >
        輸入任務
      </button>
      <button
        onClick={() => setView("tasks")}
        style={{
          ...buttonStyle,
          background: view === "tasks" ? "#111827" : "#fff",
          color: view === "tasks" ? "#fff" : "#111827",
        }}
      >
        Task list ({openCount})
      </button>
      <button
        onClick={() => setView("records")}
        style={{
          ...buttonStyle,
          background: view === "records" ? "#111827" : "#fff",
          color: view === "records" ? "#fff" : "#111827",
        }}
      >
        紀錄 ({completedCount})
      </button>
    </nav>
  );
}

function RecordsView({ completedTasks, monthDate, setMonthDate, selectedDate, setSelectedDate }) {
  const completedByDate = completedTasks.reduce((groups, task) => {
    const key = task.completedAt ? task.completedAt.slice(0, 10) : "";
    if (!key) return groups;
    return { ...groups, [key]: [...(groups[key] || []), task] };
  }, {});
  const monthDays = buildMonthDays(monthDate);
  const selectedTasks = completedByDate[selectedDate] || [];
  const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;

  function changeMonth(offset) {
    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1));
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>完成紀錄</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => changeMonth(-1)} style={{ ...buttonStyle, background: "#fff" }}>
            上月
          </button>
          <button onClick={() => changeMonth(1)} style={{ ...buttonStyle, background: "#fff" }}>
            下月
          </button>
        </div>
      </div>

      <h3 style={{ marginBottom: 8 }}>{monthLabel}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
          <strong key={label} style={{ textAlign: "center", color: "#6b7280" }}>
            {label}
          </strong>
        ))}
        {monthDays.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} />;
          const key = dateKey(day);
          const count = completedByDate[key]?.length || 0;
          const selected = key === selectedDate;
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              style={{
                minHeight: 72,
                border: selected ? "2px solid #111827" : "1px solid #d7dde5",
                borderRadius: 8,
                background: count ? "#dcfce7" : "#fff",
                color: "#111827",
                textAlign: "left",
                padding: 8,
                cursor: "pointer",
              }}
            >
              <strong>{day.getDate()}</strong>
              <span style={{ display: "block", marginTop: 8, color: "#166534" }}>
                {count ? `${count} 件` : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>{selectedDate ? displayDate(selectedDate) : "揀一日睇紀錄"}</h3>
        {selectedTasks.length === 0 ? (
          <p style={{ color: "#6b7280" }}>呢日暫時冇完成紀錄。</p>
        ) : (
          <ul style={{ display: "grid", gap: 8, paddingLeft: 20 }}>
            {selectedTasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [view, setViewState] = useState("capture");
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [dragOverCategory, setDragOverCategory] = useState("");
  const [dragOverTaskId, setDragOverTaskId] = useState("");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    setTasks(loadTasks());
    setViewState(getInitialView());

    function syncHash() {
      setViewState(getInitialView());
    }

    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function setView(nextView) {
    setViewState(nextView);
    if (typeof window !== "undefined") {
      const hash = nextView === "tasks" ? "#tasks" : nextView === "records" ? "#records" : "#input";
      window.history.pushState(null, "", hash);
    }
  }

  function persist(nextTasks) {
    const orderedTasks = nextTasks.map((task, index) => ({ ...task, order: index }));
    setTasks(orderedTasks);
    saveTasks(orderedTasks);
  }

  function getBestAudioMimeType() {
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
    return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function startRecording() {
    try {
      setStatus("正在開咪...");
      setRecordedBlob(null);
      setRecordedUrl("");
      setAudioFile(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getBestAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecording(false);
        setStatus("錄音完成。先撳「轉成文字」，確認文字啱唔啱。");

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setRecording(true);
      setStatus("錄音中。講完撳停止。");
    } catch (err) {
      setRecording(false);
      setStatus("錄音失敗：" + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) mediaRecorderRef.current.stop();
  }

  function handleAudioUpload(event) {
    const file = event.target.files?.[0] || null;
    setAudioFile(file);
    setRecordedBlob(null);
    setRecordedUrl("");
    if (file) setStatus("已選擇音訊：" + file.name);
  }

  async function transcribeAudio() {
    const audio = recordedBlob || audioFile;

    if (!audio) {
      setStatus("請先錄音或者上傳音訊。");
      return;
    }

    try {
      setBusy(true);
      setStatus("正在轉文字...");

      const formData = new FormData();
      if (recordedBlob) {
        const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
        formData.append("audio", recordedBlob, "recording." + extension);
      } else {
        formData.append("audio", audioFile, audioFile.name);
      }

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || "Transcription failed");

      setTranscript(data.transcript || "");
      setStatus("已轉成文字。你可以先改，之後先分類。");
    } catch (err) {
      setStatus("轉文字失敗：" + err.message);
    }

    setBusy(false);
  }

  async function classifyAndSave() {
    const combinedText = [transcript, notes].filter((text) => text.trim()).join("\n\n補充：\n");

    if (!combinedText.trim()) {
      setStatus("請先輸入文字，或者先將語音轉成文字。");
      return;
    }

    try {
      setBusy(true);
      setStatus("正在分類並儲存...");

      const formData = new FormData();
      formData.append("notes", combinedText);

      const res = await fetch("/api/analyze-capture", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || "Classification failed");

      const newTasks = tasksFromAnalysis(data.analysis || {});
      if (newTasks.length === 0) {
        setStatus("AI 未拆到任務。你可以補多少少背景再試。");
      } else {
        persist([...newTasks, ...tasks]);
        setStatus(`已分類並儲存 ${newTasks.length} 個 task。`);
        setNotes("");
        setTranscript("");
        setAudioFile(null);
        setRecordedBlob(null);
        setRecordedUrl("");
        setView("tasks");
      }
    } catch (err) {
      setStatus("分類失敗：" + err.message);
    }

    setBusy(false);
  }

  function markDone(id) {
    persist(
      tasks.map((task) =>
        task.id === id ? { ...task, status: "done", completedAt: new Date().toISOString() } : task
      )
    );
  }

  function deleteTask(id) {
    persist(tasks.filter((task) => task.id !== id));
  }

  function clearCompleted() {
    persist(tasks.filter((task) => task.status !== "done"));
  }

  function moveTask(taskId, targetCategory, beforeTaskId = "") {
    const movingTask = tasks.find((task) => task.id === taskId);
    if (!movingTask) return;

    const rest = tasks.filter((task) => task.id !== taskId);
    const nextTask = { ...movingTask, category: targetCategory };
    const lastTargetIndex = rest.reduce(
      (latest, task, index) => (task.category === targetCategory ? index : latest),
      -1
    );
    const targetIndex = beforeTaskId
      ? rest.findIndex((task) => task.id === beforeTaskId)
      : lastTargetIndex + 1;

    if (targetIndex < 0) {
      persist([...rest, nextTask]);
      return;
    }

    persist([...rest.slice(0, targetIndex), nextTask, ...rest.slice(targetIndex)]);
  }

  function moveCategory(taskId, category) {
    moveTask(taskId, category);
  }

  function moveStep(taskId, direction) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const sameColumn = sortTasks(tasks.filter((item) => item.category === task.category && item.status !== "done"));
    const index = sameColumn.findIndex((item) => item.id === taskId);
    const target = sameColumn[index + direction];
    if (!target) return;

    const nextTasks = [...tasks];
    const taskIndex = nextTasks.findIndex((item) => item.id === taskId);
    const targetIndex = nextTasks.findIndex((item) => item.id === target.id);
    const [removed] = nextTasks.splice(taskIndex, 1);
    nextTasks.splice(targetIndex, 0, removed);
    persist(nextTasks);
  }

  function handleDragStart(event, taskId) {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function resetDragState() {
    setDraggedTaskId("");
    setDragOverCategory("");
    setDragOverTaskId("");
  }

  function handleDragOverColumn(event, category) {
    event.preventDefault();
    setDragOverCategory(category);
  }

  function handleDragOverTask(event, taskId) {
    event.preventDefault();
    setDragOverTaskId(taskId);
  }

  function handleDropOnColumn(event, category) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    if (taskId) moveTask(taskId, category);
    resetDragState();
  }

  function handleDropOnTask(event, category, beforeTaskId) {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    if (taskId && taskId !== beforeTaskId) moveTask(taskId, category, beforeTaskId);
    resetDragState();
  }

  const openTasks = useMemo(
    () => sortTasks(tasks.filter((task) => task.status !== "done")),
    [tasks]
  );
  const completedTasks = useMemo(
    () =>
      sortTasks(tasks.filter((task) => task.status === "done")).sort(
        (a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0)
      ),
    [tasks]
  );
  const todayTasks = openTasks.filter(
    (task) => task.category === "critical" || task.category === "follow_up"
  );

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1120,
        margin: "0 auto",
        color: "#111827",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>AI Secretary</h1>
          <p style={{ margin: "6px 0 0", color: "#4b5563" }}>
            講低一件事，先轉文字，再分成 Critical / Waiting / Follow-up / Someday。
          </p>
        </div>
        <Navigation
          view={view}
          setView={setView}
          openCount={openTasks.length}
          completedCount={completedTasks.length}
        />
      </header>

      {view === "capture" ? (
        <section style={{ ...cardStyle, maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0 }}>輸入任務</h2>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={busy}
              style={{
                ...buttonStyle,
                background: recording ? "#fee2e2" : "#dbeafe",
                fontSize: 18,
              }}
            >
              {recording ? "停止錄音" : "開始錄音"}
            </button>

            <label>
              或者上傳音訊：
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                disabled={busy || recording}
                style={{ display: "block", marginTop: 8 }}
              />
            </label>

            {recordedUrl && <audio controls src={recordedUrl} style={{ width: "100%" }} />}

            <button
              onClick={transcribeAudio}
              disabled={busy || recording || (!recordedBlob && !audioFile)}
              style={{ ...buttonStyle, background: "#f8fafc" }}
            >
              轉成文字
            </button>

            <label>
              語音轉文字 / 你要分類嘅內容：
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="語音轉文字會出喺呢度。你可以先改錯字，再分類。"
                style={{
                  display: "block",
                  marginTop: 8,
                  width: "100%",
                  minHeight: 180,
                  padding: 12,
                  border: "1px solid #a9b2bd",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  fontSize: 16,
                }}
              />
            </label>

            <label>
              補充文字：
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="例如：石 10號出貨，大志未覆；客戶星期五前要確認 invoice。"
                style={{
                  display: "block",
                  marginTop: 8,
                  width: "100%",
                  minHeight: 90,
                  padding: 12,
                  border: "1px solid #a9b2bd",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  fontSize: 16,
                }}
              />
            </label>

            <button
              onClick={classifyAndSave}
              disabled={busy || recording}
              style={{ ...buttonStyle, background: "#2563eb", color: "#fff", fontSize: 18 }}
            >
              分類並儲存成 task list
            </button>

            <p style={{ minHeight: 24, margin: 0, color: "#4b5563", whiteSpace: "pre-wrap" }}>
              {status}
            </p>
          </div>
        </section>
      ) : view === "records" ? (
        <RecordsView
          completedTasks={completedTasks}
          monthDate={monthDate}
          setMonthDate={setMonthDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      ) : (
        <>
          <section style={{ ...cardStyle, background: "#111827", color: "#fff", marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>今日要處理咩</h2>
            {todayTasks.length === 0 ? (
              <p style={{ marginBottom: 0, color: "#d1d5db" }}>暫時冇 Critical / Follow-up。</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {todayTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    columnLength={todayTasks.length}
                    dragOverTaskId={dragOverTaskId}
                    onDone={markDone}
                    onDelete={deleteTask}
                    onMoveCategory={moveCategory}
                    onMoveStep={moveStep}
                    onDragStart={handleDragStart}
                    onDragEnd={resetDragState}
                    onDropOnTask={handleDropOnTask}
                    onDragOverTask={handleDragOverTask}
                  />
                ))}
              </div>
            )}
          </section>

          <section style={{ marginBottom: 18 }}>
            <h2>Task list</h2>

            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {CATEGORIES.map((category) => (
                <TaskColumn
                  key={category.key}
                  category={category}
                  tasks={openTasks.filter((task) => task.category === category.key)}
                  dragOverCategory={dragOverCategory}
                  dragOverTaskId={dragOverTaskId}
                  onDone={markDone}
                  onDelete={deleteTask}
                  onMoveCategory={moveCategory}
                  onMoveStep={moveStep}
                  onDragStart={handleDragStart}
                  onDragEnd={resetDragState}
                  onDropOnTask={handleDropOnTask}
                  onDropOnColumn={handleDropOnColumn}
                  onDragOverTask={handleDragOverTask}
                  onDragOverColumn={handleDragOverColumn}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
