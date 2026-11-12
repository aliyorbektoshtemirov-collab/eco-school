import { Route, Routes } from 'react-router-dom';
import AnnouncementBar from './components/AnnouncementBar';
import TabBar from './components/TabBar';
import Home from './pages/Home';
import Challenges from './pages/Challenges';
import Marathon from './pages/Marathon';
import Recycling from './pages/Recycling';
import RecyclingAdmin from './pages/RecyclingAdmin';
import Impact from './pages/Impact';
import Leaderboard from './pages/Leaderboard';
import ClassLeaderboard from './pages/ClassLeaderboard';
import Research from './pages/Research';
import CalendarPage from './pages/CalendarPage';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Setup from './pages/Setup';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <AnnouncementBar />

      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/marafon" element={<Marathon />} />
      <Route path="/recycling" element={<Recycling />} />
      <Route path="/recycling-admin" element={<RecyclingAdmin />} />
      <Route path="/impact" element={<Impact />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/class-leaderboard" element={<ClassLeaderboard />} />
      <Route path="/research" element={<Research />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="*" element={<NotFound />} />
      </Routes>

      <TabBar />
    </>
  );
}
