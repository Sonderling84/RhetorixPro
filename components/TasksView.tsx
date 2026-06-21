import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: string;
  title: string;
  description: string;
  xp: number;
  completed: boolean;
  route: string;
  icon: string;
  color: string;
}

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Erste Rede halten', description: 'Nutze das Politische Rede Studio für eine 2-minütige Rede.', xp: 500, completed: false, route: '/political-speech', icon: 'fa-microphone-lines', color: 'text-orange-500' },
  { id: '2', title: 'E-Mail Studio nutzen', description: 'Schreibe eine professionelle E-Mail mit KI-Unterstützung.', xp: 300, completed: false, route: '/email-studio', icon: 'fa-envelope-open-text', color: 'text-purple-500' },
  { id: '3', title: 'Selbstreflexion', description: 'Nimm deine erste Erkenntnis im "Über Mich" Studio auf.', xp: 500, completed: false, route: '/about-me', icon: 'fa-user-astronaut', color: 'text-rose-500' },
  { id: '4', title: 'Tagebuch schreiben', description: 'Erfasse deine Gedanken im KI Tagebuch.', xp: 200, completed: false, route: '/diary', icon: 'fa-feather-pointed', color: 'text-rose-500' },
  { id: '5', title: 'Text optimieren', description: 'Veredle einen Text mit dem KI Optimierer.', xp: 150, completed: false, route: '/optimizer', icon: 'fa-wand-magic-sparkles', color: 'text-amber-500' },
  { id: '6', title: 'Buch-Kapitel planen', description: 'Erstelle den ersten Entwurf für ein Buchkapitel im KI Autor Studio.', xp: 750, completed: false, route: '/author', icon: 'fa-book-open', color: 'text-blue-500' },
  { id: '7', title: 'Business Check', description: 'Lasse deine Geschäftsidee tiefgehend analysieren und berechnen.', xp: 1000, completed: false, route: '/business-pitch', icon: 'fa-chart-line', color: 'text-emerald-500' },
];

const TasksView: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('rhetorix_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  useEffect(() => {
    localStorage.setItem('rhetorix_tasks', JSON.stringify(tasks));
  }, [tasks]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <header className="text-center space-y-2">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4">
          <i className="fas fa-list-check text-2xl"></i>
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">Aufgaben</h1>
        <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-widest">Erfülle Missionen & sammle XP</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => navigate(task.route)}
            className={`group relative overflow-hidden bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all text-left flex items-center gap-6 ${task.completed ? 'opacity-60' : ''}`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner bg-gray-50 dark:bg-gray-800 ${task.color} group-hover:scale-110 transition-transform`}>
              <i className={`fas ${task.icon} text-xl`}></i>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight italic">{task.title}</h3>
                {task.completed && <i className="fas fa-circle-check text-emerald-500 text-xs"></i>}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-0.5 leading-tight">{task.description}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">+{task.xp} XP</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TasksView;
