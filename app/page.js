"use client";

import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");

  async function handleSubmit() {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial",
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <h1>AI Secretary</h1>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="講低你今日嘅 task..."
        style={{
          width: "100%",
          height: 200,
          padding: 10,
          fontSize: 16,
        }}
      />

      <button
        onClick={handleSubmit}
        style={{
          marginTop: 20,
          padding: "12px 20px",
          fontSize: 16,
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
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}
