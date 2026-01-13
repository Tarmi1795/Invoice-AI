
import React, { useEffect, useState } from 'react';
import { DollarSign, Activity, Calendar, Zap, RefreshCw, BarChart3, TrendingUp } from 'lucide-react';
import { fetchUsageLogs } from '../services/supabaseClient';
import { UsageLog } from '../types';

const CostTracker: React.FC = () => {
    const [logs, setLogs] = useState<UsageLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState<number>(30); // Days

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchUsageLogs(period);
        setLogs(data);
        setLoading(false);
    };

    const totalCost = logs.reduce((acc, log) => acc + (log.cost || 0), 0);
    const totalRequests = logs.length;
    const totalInputTokens = logs.reduce((acc, log) => acc + (log.input_tokens || 0), 0);
    const totalOutputTokens = logs.reduce((acc, log) => acc + (log.output_tokens || 0), 0);
    const avgCost = totalRequests > 0 ? totalCost / totalRequests : 0;

    // Chart Data Preparation (Simple Bar calc)
    const chartData = logs.reduce((acc: any, log) => {
        const date = new Date(log.created_at || Date.now()).toLocaleDateString();
        if (!acc[date]) acc[date] = 0;
        acc[date] += log.cost || 0;
        return acc;
    }, {});
    
    const chartKeys = Object.keys(chartData).sort(); // dates
    const maxChartValue = Math.max(...Object.values(chartData) as number[], 0.001); // avoid div by zero

    return (
        <div className="p-8 max-w-7xl mx-auto animate-fadeIn text-zinc-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-orange-500" />
                        API Cost Analysis
                    </h1>
                    <p className="text-zinc-400 text-sm mt-2">Track real-time usage and costs of Gemini AI models.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                                period === d ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            {d === 90 ? 'All Time' : `Last ${d} Days`}
                        </button>
                    ))}
                    <button onClick={loadData} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign className="w-16 h-16 text-green-500" /></div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Estimated Cost</p>
                    <h3 className="text-3xl font-bold text-white">${totalCost.toFixed(5)}</h3>
                    <p className="text-xs text-zinc-500 mt-2">≈ {(totalCost * 100).toFixed(2)} cents</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Zap className="w-16 h-16 text-yellow-500" /></div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Requests</p>
                    <h3 className="text-3xl font-bold text-white">{totalRequests}</h3>
                    <p className="text-xs text-zinc-500 mt-2">Avg: ${avgCost.toFixed(5)} / req</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><BarChart3 className="w-16 h-16 text-blue-500" /></div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Tokens Processed</p>
                    <h3 className="text-2xl font-bold text-white">{(totalInputTokens + totalOutputTokens).toLocaleString()}</h3>
                    <div className="flex gap-2 mt-2 text-[10px] text-zinc-400">
                        <span className="text-blue-400">IN: {(totalInputTokens/1000).toFixed(1)}k</span>
                        <span className="text-purple-400">OUT: {(totalOutputTokens/1000).toFixed(1)}k</span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-400">Cost Efficient</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Using <span className="text-white font-mono">Flash</span> model. <br/>
                        Switching to <span className="text-zinc-400 font-mono">Pro</span> would cost approx <span className="text-red-400 font-bold">${(totalCost * 40).toFixed(2)}</span>.
                    </p>
                </div>
            </div>

            {/* Daily Cost Chart (CSS Bar Chart) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                <h4 className="text-sm font-bold text-zinc-300 mb-6 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" /> Daily Cost Trend
                </h4>
                <div className="h-40 flex items-end gap-2 overflow-x-auto pb-2">
                    {chartKeys.length === 0 ? (
                        <div className="w-full text-center text-zinc-600 text-sm">No data available for this period</div>
                    ) : (
                        chartKeys.map((date) => {
                            const val = chartData[date] as number;
                            const heightPercent = (val / maxChartValue) * 100;
                            return (
                                <div key={date} className="group relative flex-1 min-w-[30px] flex flex-col items-center gap-2">
                                    <div 
                                        className="w-full bg-orange-600/50 hover:bg-orange-500 rounded-t-sm transition-all relative"
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 border border-zinc-700">
                                            ${val.toFixed(5)}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 rotate-0 truncate w-full text-center">{date.split('/')[1]}</span>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Recent Logs Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 font-bold text-zinc-400 text-sm">Recent Activity Log</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-950 text-zinc-500 font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Module</th>
                                <th className="px-6 py-4">Model</th>
                                <th className="px-6 py-4 text-right">Input Tokens</th>
                                <th className="px-6 py-4 text-right">Output Tokens</th>
                                <th className="px-6 py-4 text-right text-green-500">Cost ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No logs found.</td></tr>
                            ) : (
                                logs.slice(0, 50).map((log, i) => (
                                    <tr key={log.id || i} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                                            {new Date(log.created_at || '').toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs font-bold uppercase border border-zinc-700">
                                                {log.module}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500 font-mono text-xs">{log.model}</td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-400">{log.input_tokens.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-400">{log.output_tokens.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-green-400 font-bold">${log.cost.toFixed(6)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CostTracker;
