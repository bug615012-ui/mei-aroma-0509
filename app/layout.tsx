import "./globals.css"; // 這一行絕對不能少！

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <title>MEI 植感芳療 | 預約系統</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
