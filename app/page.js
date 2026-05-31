"use client";

import { useEffect, useRef, useState } from "react";

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

function loadTasks() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
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

function normalizeTask(category, item) {
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
    createdAt: new Date().toISOString(),
  };
}

function tasksFromAnalysis(analysis) {
  const tasks = [];

  for (const category of CATEGORIES) {
    const source = category.key === "low_priority" ? analysis.low_priority : analysis[category.key];
    for (const item of Array.isArray(source) ? source : []) {
      tasks.push(normalizeTask(category.key, item));
    }
  }

  return tasks;
}

function TaskCard({ task, onDone, onDelete }) {
  const category = CATEGORIES.find((item) => item.key === task.category) || CATEGORIES[3];

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderLeft: `5px solid ${category.color}`,
        borderRadius: 8,
        padding: 12,
        background: category.bg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <strong style={{ color: category.color }}>{category.label}</strong>
          <h4 style={{ margin: "6px 0", fontSize: 17 }}>{task.title}</h4>
          {task.nextAction && (
            <p style={{ margin: "6px 0" }}>
              <strong>下一步：</strong>
              {task.nextAction}
            </p>
          )}
          {task.person && (
            <p style={{ margin: "6px 0", color: "#4b5563" }}>
              <strong>相關人：</strong>
              {task.person}
            </p>
          )}
          {task.due && (
            <p style={{ margin: "6px 0", color: "#4b5563" }}>
              <strong>時間：</strong>
              {task.due}
            </p>
          )}
          {task.reason && (
            <p style={{ margin: "6px 0", color: "#4b5563" }}>
              <strong>原因：</strong>
              {task.reason}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {task.status !== "done" && (
            <button onClick={() => onDone(task.id)} style={{ ...buttonStyle, background: "#dcfce7" }}>
              完成
            </button>
          )}
          <button onClick={() => onDelete(task.id)} style={{ ...buttonStyle, background: "#fff" }}>
            刪除
          </button>
        </div>
      </div>
    </article>
  );
}

function TaskColumn({ category, tasks, onDone, onDelete }) {
  return (
    <section style={cardStyle}>
      <h3 style={{ margin: "0 0 4px", color: category.color }}>{category.label}</h3>
      <p style={{ margin: "0 0 12px", color: "#6b7280" }}>{category.helper}</p>
      <div style={{ display: "grid", gap: 10 }}>
        {tasks.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca3af" }}>暫時冇。</p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDone={onDone} onDelete={onDelete} />
          ))
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  function persist(nextTasks) {
    setTasks(nextTasks);
    saveTasks(nextTasks);
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
      }
    } catch (err) {
      setStatus("分類失敗：" + err.message);
    }

    setBusy(false);
  }

  function markDone(id) {
    persist(tasks.map((task) => (task.id === id ? { ...task, status: "done" } : task)));
  }

  function deleteTask(id) {
    persist(tasks.filter((task) => task.id !== id));
  }

  function clearCompleted() {
    persist(tasks.filter((task) => task.status !== "done"));
  }

  const openTasks = tasks.filter((task) => task.status !== "done");
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
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>AI Secretary</h1>
        <p style={{ margin: "6px 0 0", color: "#4b5563" }}>
          講低一件事，先轉文字，再分成 Critical / Waiting / Follow-up / Someday。
        </p>
      </header>

      <section style={{ ...cardStyle, background: "#111827", color: "#fff", marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>今日要處理咩</h2>
        {todayTasks.length === 0 ? (
          <p style={{ marginBottom: 0, color: "#d1d5db" }}>暫時冇 Critical / Follow-up。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} onDone={markDone} onDelete={deleteTask} />
            ))}
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>新增 update</h2>

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
                minHeight: 150,
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

      <section style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Task list</h2>
          <button onClick={clearCompleted} style={{ ...buttonStyle, background: "#fff" }}>
            清走已完成
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          {CATEGORIES.map((category) => (
            <TaskColumn
              key={category.key}
              category={category}
              tasks={openTasks.filter((task) => task.category === category.key)}
              onDone={markDone}
              onDelete={deleteTask}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
