"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [liveText, setLiveText] = useState("");
  const [result, setResult] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const streamRef = useRef(null);
  const textRef = useRef("");

  function appendTranscript(transcript) {
    const clean = (transcript || "").trim();
    if (!clean) return;

    const next = textRef.current ? `${textRef.current}\n${clean}` : clean;
    textRef.current = next;
    setText(next);
  }

  function waitForIceGatheringComplete(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      function checkState() {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      }

      pc.addEventListener("icegatheringstatechange", checkState);

      // Fallback: don't wait forever
      setTimeout(resolve, 3000);
    });
  }

  function stopRealtime(shouldAnalyze = false, silent = false) {
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
    setConnecting(false);

    if (!silent) {
      setStatus("已停止 Realtime。");
    }

    if (shouldAnalyze) {
      setTimeout(() => {
        analyzeText(textRef.current);
      }, 500);
    }
  }

  async function startRealtime() {
    try {
      setConnecting(true);
      setStatus("正在開咪高峰...");
      setResult("");
      setLiveText("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("呢個 browser 唔支援咪高峰。請用 Chrome / Safari，並確保網址係 https。");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      streamRef.current = stream;

      setStatus("咪高峰已開，正在建立 Realtime 連線...");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        setStatus(`WebRTC 狀態：${pc.connectionState}`);

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setConnected(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setStatus("已連接。你可以開始講嘢。停一停，文字會自動出現。");
      };

      dc.onclose = () => {
        setConnected(false);
        setConnecting(false);
      };

      dc.onerror = () => {
        setStatus("Data channel 發生錯誤。請睇 Vercel logs 或重新整理再試。");
      };

      dc.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);

          console.log("Realtime event:", event);

          if (event.type === "conversation.item.input_audio_transcription.delta") {
            setLiveText((prev) => prev + (event.delta || ""));
          }

          if (event.type === "conversation.item.input_audio_transcription.completed") {
            appendTranscript(event.transcript || "");
            setLiveText("");
          }

          if (event.type === "conversation.item.input_audio_transcription.failed") {
            setStatus("聽寫失敗：" + (event.error?.message || "Unknown transcription error"));
          }

          if (event.type === "error") {
            setStatus("Realtime error: " + (event.error?.message || JSON.stringify(event.error)));
          }
        } catch (err) {
          console.error("Data channel message parse error:", err, message.data);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setStatus("正在等待 ICE candidates...");
      await waitForIceGatheringComplete(pc);

      setStatus("正在向 OpenAI 建立 Realtime session...");

      const sdpResponse = await fetch("/api/realtime-session", {
        method: "POST",
        body: pc.localDescription.sdp,
        headers: {
          "Content-Type": "application/sdp"
        }
      });

      const responseText = await sdpResponse.text();

      if (!sdpResponse.ok) {
        let readableError = responseText;

        try {
          const parsed = JSON.parse(responseText);
          readableError = parsed.error || JSON.stringify(parsed, null, 2);
        } catch (_) {}

        throw new Error(readableError);
      }

      const answer = {
        type: "answer",
        sdp: responseText
      };

      await pc.setRemoteDescription(answer);

      setConnected(true);
      setConnecting(false);
      setStatus("Realtime 已啟動。開始講你要記低嘅嘢。");
    } catch (err) {
      stopRealtime(false, true);
      setStatus("連接失敗：" + err.message);
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
        onClick={connected || connecting ? () => stopRealtime(false) : startRealtime}
        disabled={loading}
        style={{
          width: "100%",
          padding: "18px 20px",
          fontSize: 20,
          borderRadius: 12,
          border: "1px solid #333",
          background: connected || connecting ? "#ffdddd" : "#e8f0ff",
          marginBottom: 12
        }}
      >
        {connected
          ? "停止 Realtime 語音"
          : connecting
          ? "連接中... 撳呢度取消"
          : "開始 Realtime 語音"}
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

      <p style={{ minHeight: 24, color: "#555", whiteSpace: "pre-wrap" }}>
        {status}
      </p>

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
          disabled={loading || connected || connecting}
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
