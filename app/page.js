"use client";

import { useRef, useState } from "react";

const cardStyle = {
  padding: 16,
  border: "1px solid #d7dde5",
  borderRadius: 8,
  marginBottom: 16,
  background: "#fff",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const inputStyle = {
  width: "100%",
  padding: 12,
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #a9b2bd",
  boxSizing: "border-box",
};

const taskSections = [
  {
    key: "critical",
    title: "即刻要處理",
    empty: "暫時未見高危急件。",
    accent: "#c2410c",
    background: "#fff7ed",
  },
  {
    key: "waiting",
    title: "等緊人覆 / 卡住",
    empty: "暫時未見等待項目。",
    accent: "#0369a1",
    background: "#f0f9ff",
  },
  {
    key: "follow_up",
    title: "要主動跟進",
    empty: "暫時未見要追嘅人。",
    accent: "#4d7c0f",
    background: "#f7fee7",
  },
  {
    key: "low_priority",
    title: "有空先做",
    empty: "暫時冇低優先事項。",
    accent: "#6b7280",
    background: "#f9fafb",
  },
];

function clean(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "unclear") return "未清楚";
  return text;
}

function listFrom(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function taskTitle(item) {
  return clean(item.title) || clean(item.next_action) || clean(item.message_hint) || "未命名任務";
}

function taskMeta(sectionKey, item) {
  if (sectionKey === "critical") {
    return [
      ["負責 / 等緊", item.owner_or_waiting_for],
      ["限期 / 跟進", item.deadline_or_follow_up],
      ["風險", item.risk],
    ];
  }

  if (sectionKey === "waiting") {
    return [
      ["等緊邊個", item.waiting_for],
      ["現況", item.last_known_status],
      ["風險", item.risk],
      ["下次追", item.next_follow_up],
    ];
  }

  if (sectionKey === "follow_up") {
    return [
      ["追邊個", item.who_to_follow_up],
      ["幾時", item.when],
      ["點樣講", item.message_hint],
    ];
  }

  return [["原因", item.reason]];
}

function nextAction(sectionKey, item) {
  if (sectionKey === "waiting") return clean(item.next_follow_up);
  if (sectionKey === "follow_up") return clean(item.message_hint);
  return clean(item.next_action);
}

function TaskSection({ config, items }) {
  const visibleItems = listFrom(items);

  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={{ ...sectionTitleStyle, color: config.accent }}>
        {config.title} <span style={{ color: "#6b7280" }}>({visibleItems.length})</span>
      </h3>

      {visibleItems.length === 0 ? (
        <p style={{ margin: 0, color: "#6b7280" }}>{config.empty}</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleItems.map((item, index) => {
            const action = nextAction(config.key, item);
            const meta = taskMeta(config.key, item).filter((row) => clean(row[1]));

            return (
              <article
                key={config.key + "-" + index}
                style={{
                  border: "1px solid #e5e7eb",
                  borderLeft: "5px solid " + config.accent,
                  borderRadius: 8,
                  padding: 14,
                  background: config.background,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <input
                    type="checkbox"
                    aria-label="完成任務"
                    style={{ marginTop: 4, width: 18, height: 18 }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: 17 }}>{taskTitle(item)}</h4>

                    {meta.length > 0 && (
                      <dl style={{ display: "grid", gap: 6, margin: 0, color: "#374151" }}>
                        {meta.map(([label, value]) => (
                          <div key={label}>
                            <dt style={{ display: "inline", fontWeight: 700, marginRight: 6 }}>
                              {label}:
                            </dt>
                            <dd style={{ display: "inline", margin: 0 }}>{clean(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {action && (
                      <p
                        style={{
                          margin: "10px 0 0",
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.78)",
                          borderRadius: 8,
                          color: "#111827",
                        }}
                      >
                        <strong>下一步：</strong>
                        {action}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BossUpdate({ update }) {
  if (!update) return null;

  const groups = [
    ["今日焦點", update.today_focus],
    ["卡住項目", update.blocked_items],
    ["要決定", update.decisions_needed],
  ];

  return (
    <section style={{ ...cardStyle, background: "#f8fafc" }}>
      <h3 style={sectionTitleStyle}>俾老闆 / 自己嘅短 update</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {groups.map(([label, values]) => (
          <div key={label}>
            <strong>{label}：</strong>
            {listFrom(values).length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 22 }}>
                {listFrom(values).map((value, index) => (
                  <li key={label + index}>{clean(value)}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: "#6b7280" }}>暫時冇</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Risks({ risks }) {
  const items = listFrom(risks);
  if (items.length === 0) return null;

  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>頭三個風險</h3>
      <ol style={{ margin: 0, paddingLeft: 22 }}>
        {items.map((risk, index) => (
          <li key={index} style={{ marginBottom: 10 }}>
            <strong>{clean(risk.title) || "未命名風險"}</strong>
            {clean(risk.why_it_matters) && (
              <div style={{ color: "#4b5563", marginTop: 4 }}>{clean(risk.why_it_matters)}</div>
            )}
            {clean(risk.next_action) && (
              <div style={{ marginTop: 4 }}>
                <strong>要做：</strong>
                {clean(risk.next_action)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultView({ result }) {
  const analysis = result.analysis || {};

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 12 }}>拆好嘅任務</h2>

      {analysis.summary && (
        <section
          style={{
            ...cardStyle,
            background: "#111827",
            color: "#fff",
            borderColor: "#111827",
          }}
        >
          <h3 style={{ ...sectionTitleStyle, color: "#fff" }}>一句總結</h3>
          <p style={{ margin: 0, fontSize: 18 }}>{analysis.summary}</p>
        </section>
      )}

      {result.transcript && (
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>語音轉錄</h3>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.transcript}</p>
        </section>
      )}

      {analysis.image_notes && (
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>圖片 / 手寫內容</h3>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{analysis.image_notes}</p>
        </section>
      )}

      <section style={cardStyle}>
        {taskSections.map((config) => (
          <TaskSection key={config.key} config={config} items={analysis[config.key]} />
        ))}
      </section>

      <Risks risks={analysis.top_3_risks} />
      <BossUpdate update={analysis.boss_update} />

      {listFrom(analysis.raw_extracted_items).length > 0 && (
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>原始抽到嘅事項</h3>
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            {listFrom(analysis.raw_extracted_items).map((item, index) => (
              <li key={index}>{clean(item)}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  function getBestAudioMimeType() {
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];

    for (const type of options) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  }

  async function startRecording() {
    try {
      setResult(null);
      setRecordedBlob(null);
      setRecordedUrl("");
      setStatus("正在開咪高峰...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("呢個 browser 唔支援錄音。請用 Chrome / Safari。");
      }

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
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });

        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecording(false);
        setStatus("錄音完成。可以再加圖片，然後 Analyze。");

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setRecording(true);
      setStatus("錄音中。講完撳「停止錄音」。");
    } catch (err) {
      setStatus("錄音失敗：" + err.message);
      setRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }

  function handleImagesChange(event) {
    const files = Array.from(event.target.files || []);
    setImageFiles(files);
  }

  function handleAudioUpload(event) {
    const file = event.target.files?.[0] || null;
    setAudioFile(file);

    if (file) {
      setRecordedBlob(null);
      setRecordedUrl("");
      setStatus("已選擇音訊檔：" + file.name);
    }
  }

  async function analyzeEverything() {
    try {
      setLoading(true);
      setResult(null);
      setStatus("正在拆任務...");

      const formData = new FormData();
      formData.append("notes", notes);

      if (recordedBlob) {
        const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
        formData.append("audio", recordedBlob, "recording." + extension);
      } else if (audioFile) {
        formData.append("audio", audioFile, audioFile.name);
      }

      for (const image of imageFiles) {
        formData.append("images", image, image.name);
      }

      if (!notes.trim() && !recordedBlob && !audioFile && imageFiles.length === 0) {
        setStatus("請先錄音、上傳圖片，或者輸入文字。");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/analyze-capture", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || JSON.stringify(data));
      }

      setResult(data);
      setStatus("已拆好任務。");
    } catch (err) {
      setStatus("分析失敗：" + err.message);
    }

    setLoading(false);
  }

  function clearAll() {
    setNotes("");
    setAudioFile(null);
    setImageFiles([]);
    setRecordedBlob(null);
    setRecordedUrl("");
    setResult(null);
    setStatus("");
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 900,
        margin: "0 auto",
        color: "#111827",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>AI Secretary Capture</h1>
      <p style={{ marginTop: 0, color: "#4b5563" }}>
        講低、影低、或者打低要處理嘅嘢，系統會幫你拆成任務。
      </p>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>1. 錄音 / 上傳音訊</h2>

        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={loading}
          style={{
            width: "100%",
            padding: "18px 20px",
            fontSize: 20,
            borderRadius: 8,
            border: "1px solid #1f2937",
            background: recording ? "#fee2e2" : "#dbeafe",
            marginBottom: 12,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {recording ? "停止錄音" : "開始錄音"}
        </button>

        <label style={{ display: "block", marginBottom: 12 }}>
          或者上傳音訊檔：
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            disabled={loading || recording}
            style={{ display: "block", marginTop: 8 }}
          />
        </label>

        {recordedUrl && (
          <audio controls src={recordedUrl} style={{ width: "100%", marginTop: 8 }} />
        )}

        {audioFile && <p style={{ color: "#555" }}>已選擇音訊：{audioFile.name}</p>}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>2. 圖片 / 手寫 notes / 白板</h2>

        <input type="file" accept="image/*" multiple onChange={handleImagesChange} disabled={loading} />

        {imageFiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>已選擇圖片：</strong>
            <ul>
              {imageFiles.map((file, index) => (
                <li key={file.name + "-" + index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>3. 補充文字</h2>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例如：石 10號出貨；大志未覆；Alex invoice 明天追；客戶星期五前要確認..."
          style={{ ...inputStyle, height: 160 }}
        />
      </section>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={analyzeEverything}
          disabled={loading || recording}
          style={{
            flex: 1,
            padding: "16px 20px",
            fontSize: 18,
            borderRadius: 8,
            border: "1px solid #1f2937",
            background: "#2563eb",
            color: "#fff",
            cursor: loading || recording ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "拆緊任務..." : "拆成任務"}
        </button>

        <button
          onClick={clearAll}
          disabled={loading || recording}
          style={{
            padding: "16px 20px",
            fontSize: 18,
            borderRadius: 8,
            border: "1px solid #9ca3af",
            background: "#fff",
            cursor: loading || recording ? "not-allowed" : "pointer",
          }}
        >
          清空
        </button>
      </div>

      <p style={{ minHeight: 24, color: "#4b5563", whiteSpace: "pre-wrap" }}>{status}</p>

      {result && <ResultView result={result} />}
    </main>
  );
}
