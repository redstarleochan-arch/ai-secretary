"use client";

import { useRef, useState } from "react";

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
    const options = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
    ];

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
        setStatus("錄音完成。你可以再加圖片，然後 Analyze。");

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
      setStatus("正在分析...");

      const formData = new FormData();

      formData.append("notes", notes);

      if (recordedBlob) {
        const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
        formData.append("audio", recordedBlob, `recording.${extension}`);
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
      setStatus("完成。");
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
        fontFamily: "Arial",
        maxWidth: 820,
        margin: "0 auto",
      }}
    >
      <h1>AI Secretary Capture</h1>

      <section
        style={{
          padding: 16,
          border: "1px solid #ccc",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>1. 錄音 / 上傳音訊</h2>

        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={loading}
          style={{
            width: "100%",
            padding: "18px 20px",
            fontSize: 20,
            borderRadius: 12,
            border: "1px solid #333",
            background: recording ? "#ffdddd" : "#e8f0ff",
            marginBottom: 12,
          }}
        >
          {recording ? "停止錄音" : "開始錄音"}
        </button>

        <div style={{ marginBottom: 12 }}>
          <label>
            或者上傳音訊檔：
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              disabled={loading || recording}
              style={{ display: "block", marginTop: 8 }}
            />
          </label>
        </div>

        {recordedUrl && (
          <audio
            controls
            src={recordedUrl}
            style={{ width: "100%", marginTop: 8 }}
          />
        )}

        {audioFile && (
          <p style={{ color: "#555" }}>
            已選擇音訊：{audioFile.name}
          </p>
        )}
      </section>

      <section
        style={{
          padding: 16,
          border: "1px solid #ccc",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>2. 圖片 / 手寫 notes / 白板</h2>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImagesChange}
          disabled={loading}
        />

        {imageFiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>已選擇圖片：</strong>
            <ul>
              {imageFiles.map((file, index) => (
                <li key={`${file.name}-${index}`}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section
        style={{
          padding: 16,
          border: "1px solid #ccc",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>3. 補充文字</h2>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例如：老闆今日問過 invoice；Alex 未覆；如果星期五前唔處理會出事..."
          style={{
            width: "100%",
            height: 160,
            padding: 12,
            fontSize: 16,
            borderRadius: 8,
            border: "1px solid #999",
          }}
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
            borderRadius: 10,
            border: "1px solid #333",
            background: "#e8f0ff",
          }}
        >
          {loading ? "分析中..." : "Analyze Everything"}
        </button>

        <button
          onClick={clearAll}
          disabled={loading || recording}
          style={{
            padding: "16px 20px",
            fontSize: 18,
            borderRadius: 10,
            border: "1px solid #333",
          }}
        >
          Clear
        </button>
      </div>

      <p style={{ minHeight: 24, color: "#555", whiteSpace: "pre-wrap" }}>
        {status}
      </p>

      {result && (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 12,
          }}
        >
          <h2>結果</h2>

          {result.transcript && (
            <>
              <h3>語音轉錄</h3>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: 12,
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.transcript}
              </pre>
            </>
          )}

          <h3>任務分析</h3>
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 20,
              borderRadius: 10,
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(result.analysis, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
