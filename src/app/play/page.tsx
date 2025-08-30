// import PlaySurface from "@/components/features/play/PlaySurface";

// export default function PlayPage() {
//   return (
//     <main className="h-screen flex flex-col bg-zinc-50">
//       {/* Header: ~10% of viewport height */}
//       <div className="h-[5vh] border-b bg-white flex items-center px-4">
//         <h1 className="text-xl font-semibold">Opencraft</h1>
//       </div>

//       {/* Body: remaining 90% */}
//       <PlaySurface />
//     </main>
//   );
// }

import PlayShell from "@/components/features/play/PlayShell";

export default function PlayPage() {
  return <PlayShell />;
}
