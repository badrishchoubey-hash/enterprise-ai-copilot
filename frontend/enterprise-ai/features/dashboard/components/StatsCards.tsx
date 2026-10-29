import {
  ArrowDownRight,
  ArrowUpRight,
  Database,
  FileCheck2,
  Layers3,
  Users,
} from "lucide-react";

const stats = [
  {
    label: "Total documents",
    value: "248",
    change: "+12.5%",
    description: "vs. last month",
    icon: FileCheck2,
    tone: "bg-[#eeedff] text-[#5146e5]",
  },
  {
    label: "Knowledge chunks",
    value: "18,429",
    change: "+8.2%",
    description: "vs. last month",
    icon: Layers3,
    tone: "bg-[#e8f8f1] text-[#1c9b68]",
  },
  {
    label: "Active users",
    value: "1,284",
    change: "+18.7%",
    description: "vs. last month",
    icon: Users,
    tone: "bg-[#fff3e4] text-[#ee8b24]",
  },
  {
    label: "Storage used",
    value: "68.4 GB",
    change: "68%",
    description: "of 100 GB limit",
    icon: Database,
    tone: "bg-[#e9f3ff] text-[#3979cb]",
  },
];

export default function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(
        ({ label, value, change, description, icon: Icon, tone }, index) => (
          <div
            key={label}
            className="rounded-2xl border border-[#e8eaf1] bg-white p-5 shadow-[0_2px_10px_rgba(30,40,70,.02)]"
          >
            <div className="flex items-start justify-between">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}
              >
                <Icon size={19} />
              </div>

              <span
                className={`flex items-center gap-0.5 text-[11px] font-bold ${
                  index < 3 ? "text-[#19a36b]" : "text-[#64748b]"
                }`}
              >
                {index < 3 ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}

                {change}
              </span>
            </div>

            <p className="mt-5 text-[12px] font-medium text-[#7c8798]">
              {label}
            </p>

            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-[25px] font-bold tracking-tight text-[#1f2a3a]">
                {value}
              </p>

              <span className="text-[10px] text-[#a0a8b5]">{description}</span>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
