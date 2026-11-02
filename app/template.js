// Har bir sahifa o'tishida qayta mount bo'ladi, shuning uchun kirish animatsiyasi har safar ishlaydi
export default function Template({ children }) {
  return <div className="page-enter">{children}</div>;
}
