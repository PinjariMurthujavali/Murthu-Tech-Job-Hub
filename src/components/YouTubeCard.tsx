export default function YouTubeCard() {
  return (
    <a
      href="https://www.youtube.com/@Syntaxsolver-u5m"
      target="_blank"
      rel="noreferrer"
      className="glass mx-auto my-8 flex max-w-3xl items-center gap-4 p-5"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-2xl">▶</span>
      <span className="flex-1">
        <span className="block text-lg font-bold grad-text">Syntax Solver YouTube Channel</span>
        <span className="block text-sm text-slate-300">Tech and coding videos. Subscribe cheyyandi, support cheyyandi 💙</span>
      </span>
      <span className="grad-btn px-4 py-2 text-sm">Subscribe</span>
    </a>
  );
}