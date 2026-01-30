"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface RatingChartProps {
  data: { 
      date: string; 
      rating: number; 
      gameIndex: number;
      userRating?: number; // Comparison rating
      opponent?: string;
      result?: "W" | "L";
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{data.displayDate}</p>
        
        <div className="flex items-center gap-2 mb-1">
             <div className="h-2 w-2 rounded-full bg-green-400" />
             <span className="font-bold text-white">{Math.round(data.rating)}</span>
             {data.result && (
                 <span className={`text-xs font-bold ${data.result === "W" ? "text-green-400" : "text-red-400"}`}>
                     {data.result}
                 </span>
             )}
        </div>
        
        {data.opponent && (
            <div className="mb-2 text-xs text-white/70">
                vs <span className="text-white">{data.opponent}</span>
            </div>
        )}

        {data.userRating !== undefined && (
             <div className="mt-2 border-t border-white/10 pt-2 flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-purple-400" />
                 <span className="text-xs text-white/70">You:</span>
                 <span className="font-bold text-white">{Math.round(data.userRating)}</span>
             </div>
        )}
      </div>
    );
  }
  return null;
};

export function RatingChart({ data }: RatingChartProps) {
  const chartData = useMemo(() => {
    // We want to show the progression.
    // If we have no data, return empty.
    if (!data || data.length === 0) return [];

    return data.map((d) => ({
      ...d,
      displayDate: new Date(d.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [data]);

  if (chartData.length < 2) {
    return (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/50">
            Not enough data for chart
        </div>
    );
  }

  // Calculate domain for Y-axis to make the chart look dynamic
  // Include userRating in min/max calculation if present
  const allRatings = chartData.flatMap(d => d.userRating !== undefined ? [d.rating, d.userRating] : [d.rating]);
  const minRating = Math.min(...allRatings);
  const maxRating = Math.max(...allRatings);
  const padding = (maxRating - minRating) * 0.2 || 50; // Increased padding to 20% to avoid clipping

  return (
    <div className="h-64 w-full rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur">
      <h3 className="mb-4 text-xs uppercase tracking-[0.3em] text-white/60 sm:text-sm sm:tracking-[0.4em]">
        Rating History
      </h3>
      <div className="h-[calc(100%-2rem)] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
                dataKey="gameIndex" 
                hide 
            />
            <YAxis
              domain={[Math.floor(minRating - padding), Math.ceil(maxRating + padding)]}
              hide
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={1500} stroke="#ffffff20" strokeDasharray="3 3" />
            
            {/* Comparison Line (You) */}
             <Line
              type="monotone"
              dataKey="userRating"
              stroke="#a855f7" // Purple
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: "#fff", stroke: "#a855f7", strokeWidth: 2 }}
              connectNulls
            />

            {/* Main Line (Profile Player) */}
            <Line
              type="monotone"
              dataKey="rating"
              stroke="#4ade80" // Green
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#fff", stroke: "#4ade80", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
