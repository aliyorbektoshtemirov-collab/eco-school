import { Link, useParams } from 'react-router-dom';
import SubmissionFeedback from '../components/SubmissionFeedback';
export default function FeedbackPage() {
  const { kind, id } = useParams();
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-28">
    <Link to="/profile" className="text-sm text-[#2f5d3a]">← Profil</Link>
    <SubmissionFeedback kind={kind} id={id} />
  </main>;
}
