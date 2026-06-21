
import React from 'react';
import { LogEntry } from '../types';

interface LogViewProps {
  logs: LogEntry[];
}

const LogView: React.FC<LogViewProps> = ({ logs }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-[2.5rem] p-6 text-[10px] font-mono text-gray-400 shadow-2xl min-h-[500px] border border-slate-800">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-blue-400 flex items-center justify-center border border-slate-700 rounded-lg">
            <i className="fas fa-terminal text-xs"></i>
          </div>
          <div>
            <h3 className="text-white font-black uppercase tracking-widest text-[10px]">System Terminal</h3>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Pokker Boot Core v1.0</p>
          </div>
        </div>
        <span className="bg-slate-800 px-2 py-1 rounded text-white font-bold">{logs.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        {logs.length === 0 ? (
          <p className="text-slate-700 italic px-2">System initialisiert... Warte auf Ereignisse.</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`flex gap-3 leading-relaxed p-2 rounded-lg ${log.level === 'error' ? 'bg-red-500/10 text-red-400' : log.level === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/30 text-slate-300'}`}>
              <span className="opacity-40 whitespace-nowrap font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className="font-medium tracking-tight">{log.message}</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800 text-center">
        <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.4em]">Engine programmed by</p>
        <p className="text-[10px] text-white font-black uppercase mt-1">Tobias Ganster</p>
      </div>
    </div>
  );
};

export default LogView;
