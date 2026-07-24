export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-[#050505] text-white flex flex-col items-center justify-center relative overflow-hidden w-full">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse duration-7000 delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Centered Content Container */}
      <div className="w-full max-w-lg px-6 relative z-10">
        {children}
      </div>
    </div>
  );
}
