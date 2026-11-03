import "./globals.css";

export const metadata = {
  title: "Backfill — No-show recovery for clinics",
  description: "Texts your short-notice waitlist the moment a patient cancels, and refills the chair.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
