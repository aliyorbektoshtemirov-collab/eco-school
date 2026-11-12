import Mentors from '../components/Mentors';
import { useAuth } from '../lib/auth';

/** Pastki menyudagi «Mentorlar» sahifasi. */
export default function MentorsPage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[#f3f5ef]">
      <div className="sticky top-0 z-30 border-b border-[#e2e8dd] bg-white">
        <div className="mx-auto max-w-xl px-4 py-4">
          <h1 className="text-[18px] font-bold text-[#1f2b22]">Mentorlar</h1>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-4">
        <Mentors isOwner={user?.role === 'owner'} showTitle={false} />
      </div>
    </main>
  );
}
