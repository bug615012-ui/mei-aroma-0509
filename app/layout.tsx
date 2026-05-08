import "./globals.css"; // 這一行是載入設計感的關鍵！

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
