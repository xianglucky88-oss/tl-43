import React from "react";
import {
  Cog,
  Zap,
  ArrowLeftRight,
  Layers,
  CircleDot,
  Disc,
  Play,
  Pause,
  Trash2,
  Link,
  Unlink,
  RotateCcw,
  Wrench,
  Download,
  Save,
} from "lucide-react";
import { useFactoryStore, PART_TEMPLATES } from "@/store/factoryStore";
import { PartType } from "@/types/factory";
import { cn } from "@/lib/utils";

const PART_ICONS: Record<PartType, React.ReactNode> = {
  motor: <Zap className="w-6 h-6" />,
  gear: <Cog className="w-6 h-6" />,
  connectingRod: <ArrowLeftRight className="w-6 h-6" />,
  piston: <Layers className="w-6 h-6" />,
  conveyorBelt: <Wrench className="w-6 h-6" />,
  bearing: <CircleDot className="w-6 h-6" />,
  flywheel: <Disc className="w-6 h-6" />,
};

export const Toolbar: React.FC = () => {
  const {
    placingPartType,
    setPlacingPartType,
    simulation,
    startSimulation,
    stopSimulation,
    connectionMode,
    cancelConnection,
    clearAll,
    setTimeScale,
  } = useFactoryStore();

  return (
    <div className="absolute top-4 left-4 right-4 flex items-center gap-2 pointer-events-none">
      <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md rounded-xl p-2 border border-slate-700 shadow-2xl pointer-events-auto">
        <div className="px-3 py-1.5 text-sm font-bold text-slate-200 border-r border-slate-700 mr-1">
          🔧 零件库
        </div>
        {PART_TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => setPlacingPartType(placingPartType === template.type ? null : template.type)}
            title={`${template.name}: ${template.description}`}
            className={cn(
              "relative flex flex-col items-center justify-center w-14 h-14 rounded-lg transition-all duration-200 group",
              placingPartType === template.type
                ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 scale-105"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            )}
          >
            {PART_ICONS[template.type as PartType]}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-slate-950 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {template.name}
            </span>
          </button>
        ))}

        <div className="w-px h-12 bg-slate-700 mx-1" />

        <button
          onClick={() => {
            if (connectionMode.active) cancelConnection();
          }}
          title={connectionMode.active ? "取消连接模式" : "连接模式"}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-14 rounded-lg transition-all duration-200",
            connectionMode.active
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
          )}
        >
          <Link className="w-6 h-6" />
        </button>

        <button
          onClick={clearAll}
          title="清空所有"
          className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-300 transition-all duration-200"
        >
          <Trash2 className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md rounded-xl p-2 border border-slate-700 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-1 px-2 border-r border-slate-700">
          {[0.25, 0.5, 1, 2].map((scale) => (
            <button
              key={scale}
              onClick={() => setTimeScale(scale)}
              className={cn(
                "px-2 py-1 rounded text-sm font-medium transition-all",
                simulation.timeScale === scale
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              )}
            >
              {scale}x
            </button>
          ))}
        </div>

        <button
          onClick={simulation.running ? stopSimulation : startSimulation}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg",
            simulation.running
              ? "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 shadow-red-500/30"
              : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-emerald-500/30"
          )}
        >
          {simulation.running ? (
            <>
              <Pause className="w-5 h-5" />
              停止
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              启动
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export const PropertyPanel: React.FC = () => {
  const {
    parts,
    selectedPartId,
    updatePartConfig,
    removePart,
    toggleMotor,
    updatePartPosition,
    updatePartRotation,
  } = useFactoryStore();

  const selectedPart = parts.find((p) => p.id === selectedPartId);

  if (!selectedPart) {
    return (
      <div className="absolute top-24 right-4 w-72 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl p-4 pointer-events-auto">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700">
          <Wrench className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-100">属性面板</h3>
        </div>
        <p className="text-slate-400 text-sm text-center py-8">
          选择一个零件查看属性
          <br />
          <span className="text-slate-500 text-xs mt-2 block">
            点击零件可选中，
            <br />
            在放置模式下点击地面添加零件
          </span>
        </p>
      </div>
    );
  }

  const template = PART_TEMPLATES.find((t) => t.type === selectedPart.type);
  const config = selectedPart.config as Record<string, unknown>;

  return (
    <div className="absolute top-24 right-4 w-80 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl pointer-events-auto overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-850 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
              {PART_ICONS[selectedPart.type]}
            </div>
            <div>
              <h3 className="font-bold text-slate-100">{template?.name}</h3>
              <p className="text-xs text-slate-400">ID: {selectedPart.id.slice(-8)}</p>
            </div>
          </div>
          <button
            onClick={() => removePart(selectedPart.id)}
            className="w-9 h-9 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-red-100 flex items-center justify-center transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">位置</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-slate-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={selectedPart.position[axis].toFixed(2)}
                  onChange={(e) =>
                    updatePartPosition(selectedPart.id, {
                      ...selectedPart.position,
                      [axis]: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">旋转(度)</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-slate-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="5"
                  value={((selectedPart.rotation[axis] * 180) / Math.PI).toFixed(0)}
                  onChange={(e) =>
                    updatePartRotation(selectedPart.id, {
                      ...selectedPart.rotation,
                      [axis]: (parseFloat(e.target.value) || 0) * (Math.PI / 180),
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>

        {selectedPart.type === "motor" && (
          <div className="space-y-3 p-3 bg-indigo-950/30 rounded-lg border border-indigo-900/50">
            <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider block">电机控制</label>
            <button
              onClick={() => toggleMotor(selectedPart.id)}
              className={cn(
                "w-full py-2 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
                (selectedPart.config as { running: boolean }).running
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-200"
              )}
            >
              {(selectedPart.config as { running: boolean }).running ? "✓ 运行中" : "● 已停止"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">最大扭矩</label>
                <input
                  type="number"
                  min="1"
                  value={config.maxTorque as number}
                  onChange={(e) =>
                    updatePartConfig(selectedPart.id, {
                      maxTorque: parseFloat(e.target.value) || 50,
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">转速(RPM)</label>
                <input
                  type="number"
                  min="10"
                  step="100"
                  value={config.maxRPM as number}
                  onChange={(e) =>
                    updatePartConfig(selectedPart.id, {
                      maxRPM: parseFloat(e.target.value) || 3000,
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {selectedPart.type === "gear" && (
          <div className="space-y-3 p-3 bg-blue-950/30 rounded-lg border border-blue-900/50">
            <label className="text-xs font-semibold text-blue-300 uppercase tracking-wider block">齿轮参数</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-400">齿数</label>
                <input
                  type="number"
                  min="6"
                  max="100"
                  value={config.teeth as number}
                  onChange={(e) =>
                    updatePartConfig(selectedPart.id, {
                      teeth: parseInt(e.target.value) || 20,
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">半径</label>
                <input
                  type="number"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={config.radius as number}
                  onChange={(e) =>
                    updatePartConfig(selectedPart.id, {
                      radius: parseFloat(e.target.value) || 0.4,
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">厚度</label>
                <input
                  type="number"
                  min="0.02"
                  max="1"
                  step="0.02"
                  value={config.thickness as number}
                  onChange={(e) =>
                    updatePartConfig(selectedPart.id, {
                      thickness: parseFloat(e.target.value) || 0.08,
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 p-3 bg-gradient-to-b from-slate-800/50 to-slate-800/20 rounded-lg border border-slate-700/50">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">物理状态</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">转速:</span>
              <span className="text-cyan-400 font-mono">
                {((selectedPart.physics.angularVelocity * 60) / (Math.PI * 2)).toFixed(1)} RPM
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">扭矩:</span>
              <span className="text-amber-400 font-mono">{selectedPart.physics.torque.toFixed(2)} N·m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">温度:</span>
              <span
                className={cn(
                  "font-mono",
                  selectedPart.physics.temperature > 100
                    ? "text-red-400"
                    : selectedPart.physics.temperature > 70
                      ? "text-orange-400"
                      : "text-emerald-400"
                )}
              >
                {selectedPart.physics.temperature.toFixed(1)}°C
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">效率:</span>
              <span className="text-violet-400 font-mono">
                {(selectedPart.physics.efficiency * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          {selectedPart.physics.stalled && (
            <div className="mt-2 px-2 py-1.5 bg-red-950/50 rounded border border-red-800 text-red-300 text-xs text-center font-semibold animate-pulse">
              ⚠️ 堵转中
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const StatusMonitor: React.FC = () => {
  const { simulation, parts, clearWarnings, connections } = useFactoryStore();

  const avgRPM =
    parts.length > 0
      ? parts.reduce(
          (sum, p) =>
            sum + Math.abs((p.physics.angularVelocity * 60) / (Math.PI * 2)),
          0
        ) / parts.length
      : 0;

  const maxTemp =
    parts.length > 0
      ? Math.max(...parts.map((p) => p.physics.temperature))
      : 25;

  const stalledCount = parts.filter((p) => p.physics.stalled).length;

  return (
    <div className="absolute bottom-4 left-4 right-4 flex items-start gap-4 pointer-events-none">
      <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md rounded-xl p-4 border border-slate-700 shadow-2xl pointer-events-auto">
        <div className="text-center px-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            系统能量
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {simulation.totalEnergy.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">kJ</div>
        </div>

        <div className="w-px h-14 bg-slate-700" />

        <div className="text-center px-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            系统效率
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono mt-1",
              simulation.systemEfficiency > 0.8
                ? "text-emerald-400"
                : simulation.systemEfficiency > 0.5
                  ? "text-amber-400"
                  : "text-red-400"
            )}
          >
            {(simulation.systemEfficiency * 100).toFixed(0)}%
          </div>
          <div
            className="w-20 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden mx-auto"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                simulation.systemEfficiency > 0.8
                  ? "bg-emerald-500"
                  : simulation.systemEfficiency > 0.5
                    ? "bg-amber-500"
                    : "bg-red-500"
              )}
              style={{ width: `${simulation.systemEfficiency * 100}%` }}
            />
          </div>
        </div>

        <div className="w-px h-14 bg-slate-700" />

        <div className="text-center px-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            平均转速
          </div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {avgRPM.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-500">RPM</div>
        </div>

        <div className="w-px h-14 bg-slate-700" />

        <div className="text-center px-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            最高温度
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono mt-1",
              maxTemp > 120
                ? "text-red-500 animate-pulse"
                : maxTemp > 80
                  ? "text-orange-400"
                  : "text-emerald-400"
            )}
          >
            {maxTemp.toFixed(0)}°
          </div>
          <div className="text-[10px] text-slate-500">Celsius</div>
        </div>

        <div className="w-px h-14 bg-slate-700" />

        <div className="text-center px-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            零件/连接
          </div>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
            {parts.length}
            <span className="text-slate-500 text-lg">/{connections.length}</span>
          </div>
          <div className="text-[10px] text-slate-500">
            堵转:{" "}
            <span className={stalledCount > 0 ? "text-red-400" : "text-slate-500"}>
              {stalledCount}
            </span>
          </div>
        </div>

        <div className="w-px h-14 bg-slate-700" />

        <div className="text-center px-3">
          <div
            className={cn(
              "w-4 h-4 rounded-full mx-auto mb-1",
              simulation.running
                ? "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"
                : "bg-slate-600"
            )}
          />
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            {simulation.running ? "运行中" : "已停止"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            #{simulation.stepCount}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md">
        {simulation.warnings.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-amber-800/50 shadow-2xl overflow-hidden pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-950/50 to-transparent border-b border-amber-800/30">
              <span className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                系统警告 ({simulation.warnings.length})
              </span>
              <button
                onClick={clearWarnings}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-700 transition-colors"
              >
                清除
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto divide-y divide-slate-800">
              {simulation.warnings.slice(-5).reverse().map((warn) => (
                <div
                  key={warn.id}
                  className={cn(
                    "px-4 py-1.5 text-xs flex items-center gap-2",
                    warn.severity === "critical"
                      ? "bg-red-950/30"
                      : warn.severity === "high"
                        ? "bg-orange-950/20"
                        : ""
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      warn.severity === "critical"
                        ? "bg-red-500 animate-pulse"
                        : warn.severity === "high"
                          ? "bg-orange-500"
                          : warn.severity === "medium"
                            ? "bg-amber-500"
                            : "bg-yellow-400"
                    )}
                  />
                  <span
                    className={cn(
                      "font-mono truncate",
                      warn.severity === "critical"
                        ? "text-red-300"
                        : warn.severity === "high"
                          ? "text-orange-300"
                          : "text-amber-200"
                    )}
                  >
                    {warn.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const HelpPanel: React.FC = () => {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="absolute top-24 left-4 pointer-events-auto max-w-xs">
      <button
        onClick={() => setOpen(!open)}
        className="mb-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-lg"
      >
        {open ? "📖 收起帮助" : "📖 使用帮助"}
      </button>
      {open && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl p-4 text-sm space-y-3">
          <div>
            <h4 className="font-bold text-indigo-300 mb-1 flex items-center gap-1">
              <Cog className="w-4 h-4" /> 操作说明
            </h4>
            <ul className="text-slate-400 text-xs space-y-1.5 ml-2">
              <li>• <span className="text-slate-200">左键</span> 点击零件选中</li>
              <li>• <span className="text-slate-200">选择零件</span> 后点击地面放置</li>
              <li>• <span className="text-slate-200">连接模式</span> 点击端口连接零件</li>
              <li>• <span className="text-slate-200">滚轮</span> 缩放视角</li>
              <li>• <span className="text-slate-200">右键拖动</span> 旋转视角</li>
              <li>• <span className="text-slate-200">中键拖动</span> 平移视角</li>
            </ul>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <h4 className="font-bold text-emerald-300 mb-1 flex items-center gap-1">
              <Zap className="w-4 h-4" /> 调试技巧
            </h4>
            <ul className="text-slate-400 text-xs space-y-1.5 ml-2">
              <li>• 齿轮齿数比决定减速/加速比</li>
              <li>• 小齿轮驱动大齿轮 = 减速增扭</li>
              <li>• 负载过大可能导致电机堵转</li>
              <li>• 飞轮可储存能量平滑运行</li>
              <li>• 轴承可减少摩擦损耗</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
