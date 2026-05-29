"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    try {
      setStatus("準備錄音...");
      setResult("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setLoading(true);
        setStatus("正在轉文字...");

        const audioBlob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });

        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.webm");

        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        const transcribeData = await transcribeRes.json();

        if (!transcribeData.success) {
          setStatus("語音轉文字失敗：" + transcribeData.error);
          setLoading(false);
          return;
        }

        const transcript = transcribeData.transcript;
        setText(transcript);
        setStatus("已轉文字，正在分析任務...");

        await analyzeText(transcript);

        setLoading(false);
        setStatus("完成");
      };

      mediaRecorder.start();
      setRecording(true);
      setStatus("錄音中，講低你要記嘅嘢...");
    } catch (err) {
      setStatus("無法開始錄音：" + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();

      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());

      setRecording(false);
      setStatus("錄音已停止");
    }
  }

  async function analyzeText(inputText = text) {
    if (!inputText.trim()) {
      setStatus("請先輸入或錄音");
      return;
    }

    setLoading(true);
    setStatus("正在分析任務...");

    const res = await fetch("/api/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: inputText }),
    });

    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
    setLoading(false);
    setStatus("完成");
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <h1>AI Secretary</h1>

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
          marginBottom: 15,
        }}
      >
        {recording ? "停止錄音" : "開始語音輸入"}
      </button>

      <p
        style={{
          minHeight: 24,
          color: "#555",
        }}
      >
        {status}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="你可以錄音，或者直接打字..."
        style={{
          width: "100%",
          height: 180,
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #999",
        }}
      />

      <button
        onClick={() => analyzeText()}
        disabled={loading}
        style={{
          marginTop: 15,
          padding: "12px 20px",
          fontSize: 16,
          borderRadius: 8,
        }}
      >
        Analyze Tasks
      </button>

      {result && (
        <pre
          style={{
            marginTop: 30,
            background: "#111",
            color: "#0f0",
            padding: 20,
            borderRadius: 10,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}
