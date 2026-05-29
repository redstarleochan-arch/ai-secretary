"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [liveText, setLiveText] = useState("");
  const [result, setResult] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const streamRef = useRef(null);
  const textRef = useRef("");

  function appendTranscript(transcript) {
    const clean = transcript.trim();
    if (!clean) return;

    const next = textRef.current
      ? `${textRef.current}\n${clean}`
      : clean;

    textRef.current = next;
    setText(next);
  }

  async function startRealtime() {
    try {
      setStatus("正在連接 OpenAI Realtime...");
      setResult("");
      setLiveText("");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("已連接。你可以開始講嘢。停一停，文字會自動出現。");
      };

      dc.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);

          if (event.type === "conversation.item.input_audio_transcription.delta") {
            setLiveText((prev) => prev + event.delta);
          }

          if (event.type === "conversation.item.input_audio_transcription.completed") {
            appendTranscript(event.transcript || "");
            setLiveText("");
          }

          if (event.type === "error") {
            setStatus("Realtime error: " + (event.error?.message || "Unknown error"));
          }
        } catch (err) {
          console.error("Data channel message parse error:", err);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("/api/realtime-session", {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "application/sdp"
        }
      });

      if (!sdpResponse.ok) {
        const errText = await sdpResponse.text();
        throw new Error(errText);
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text()
      };

      await pc.setRemoteDescription(answer);

      setConnected(true);
      setStatus("Realtime 已啟動。開始講你要記低嘅嘢。");
    } catch (err) {
      setStatus("連接失敗：" + err.message);
      stopRealtime(false);
    }
  }

  function stopRealtime(shouldAnalyze = false) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setConnected(false);
    setStatus("已停止 Realtime。");

    if (shouldAnalyze) {
      setTimeout(() => {
        analyzeText(textRef.current);
      }, 500);
    }
  }

  async function analyzeText(inputText = text) {
    if (!inputText.trim()) {
      setStatus("未有文字可以分析。請先講嘢，等 transcript 出現。");
      return;
    }

    setLoading(true);
    setStatus("正在分析任務...");

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: inputText })
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      setStatus("完成");
    } catch (err) {
      setStatus("分析失敗：" + err.message);
    }

    setLoading(false);
  }

  function clearAll() {
    textRef.current = "";
    setText("");
    setLiveText("");
    setResult("");
    setStatus("");
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial",
        maxWidth: 780,
        margin: "0 auto"
      }}
    >
      <h1>AI Secretary</h1>

      <button
        onClick={connected ? () => stopRealtime(false) : startRealtime}
        disabled={loading}
        style={{
          width: "100%",
          padding: "18px 20px",
          fontSize: 20,
          borderRadius: 12,
          border: "1px solid #333",
          background: connected ? "#ffdddd" : "#e8f0ff",
          marginBottom: 12
        }}
      >
        {connected ? "停止 Realtime 語音" : "開始 Realtime 語音"}
      </button>

      <button
        onClick={() => stopRealtime(true)}
        disabled={loading || !connected}
        style={{
          width: "100%",
          padding: "14px 20px",
          fontSize: 16,
          borderRadius: 10,
          border: "1px solid #333",
          marginBottom: 12
        }}
      >
        停止並分析任務
      </button>

      <p style={{ minHeight: 24, color: "#555" }}>{status}</p>

      {liveText && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
            background: "#fff8d6",
            border: "1px solid #e0c76a"
          }}
        >
          <strong>即時聽寫中：</strong>
          <div>{liveText}</div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          textRef.current = e.target.value;
          setText(e.target.value);
        }}
        placeholder="Realtime transcript 會出喺呢度；你亦可以手動修改..."
        style={{
          width: "100%",
          height: 220,
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #999"
        }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
        <button
          onClick={() => analyzeText()}
          disabled={loading}
          style={{
            padding: "12px 20px",
            fontSize: 16,
            borderRadius: 8
          }}
        >
          Analyze Tasks
        </button>

        <button
          onClick={clearAll}
          disabled={loading || connected}
          style={{
            padding: "12px 20px",
            fontSize: 16,
            borderRadius: 8
          }}
        >
          Clear
        </button>
      </div>

      {result && (
        <pre
          style={{
            marginTop: 30,
            background: "#111",
            color: "#0f0",
            padding: 20,
            borderRadius: 10,
            overflow: "auto",
            whiteSpace: "pre-wrap"
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}
