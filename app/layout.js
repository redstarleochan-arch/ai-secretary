export const metadata = {
  title: "AI Secretary",
  description: "Voice-first AI task secretary",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-HK">
      <body>{children}</body>
    </html>
  );
}
