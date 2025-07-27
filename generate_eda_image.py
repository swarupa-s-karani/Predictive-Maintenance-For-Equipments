# generate_eda_image.py
import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import matplotlib.patches as mpatches

def generate_eda_image():
    conn = sqlite3.connect("hospital_equipment_system.db")

    # Load data
    equipment = pd.read_sql_query("SELECT * FROM equipment", conn)
    predictions = pd.read_sql_query("SELECT * FROM failure_predictions", conn)
    personnel = pd.read_sql_query("SELECT * FROM personnel", conn)
    priority = pd.read_sql_query("SELECT * FROM maintenance_prediction_results", conn)

    # Fill missing values
    predictions["needs_maintenance_10_days"] = predictions["needs_maintenance_10_days"].fillna(0)
    predictions["failure_probability"] = predictions["failure_probability"].fillna(0)

    # === Updated high-risk equipment logic ===
    high_risk_priority = priority[
        (priority["predicted_to_fail"] == 1) |
        (priority["preventive"] == "High") |
        (priority["corrective"] == "High") |
        (priority["replacement"] == "High")
    ]
    high_risk_ids = high_risk_priority["equipment_id"].unique()
    high_risk_count = len(high_risk_ids)

    # Other key metrics
    total_equip = len(equipment)
    avg_failure_prob = predictions["failure_probability"].mean()
    tech_count = personnel[personnel["role"] == "Technician"].shape[0]

    # Set style
    plt.style.use('default')
    sns.set_palette("Set2")
    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.size'] = 10

    # === Dashboard Layout ===
    fig = plt.figure(figsize=(20, 12))
    fig.patch.set_facecolor('#f8fafc')
    gs = fig.add_gridspec(3, 6, height_ratios=[0.8, 1.5, 1.2],
                          width_ratios=[1, 1, 1, 1, 1, 1],
                          hspace=0.35, wspace=0.25, left=0.05,
                          right=0.95, top=0.92, bottom=0.08)
    

    # === ROW 1: KPI Cards ===
    def draw_metric(ax, value, label, color):
        ax.axis('off')
        rect = mpatches.Rectangle((0.1, 0.2), 0.8, 0.6, facecolor=color, alpha=0.1,
                                edgecolor=color, linewidth=3, transform=ax.transAxes)
        ax.add_patch(rect)
        
        # ↓ Shifted down slightly to create space above the number
        ax.text(0.5, 0.58, str(value), transform=ax.transAxes,
                ha='center', va='center', fontsize=32, fontweight='bold', color=color)

        ax.text(0.5, 0.30, label, transform=ax.transAxes,
                ha='center', va='center', fontsize=14, fontweight='bold', color='#1f2937')

    # === ROW 2 ===
    # Pie: Equipment Type
    ax1 = fig.add_subplot(gs[1, 0:2])
    type_counts = equipment["type"].value_counts()
    wedges, texts, autotexts = ax1.pie(type_counts, labels=None, autopct='%1.1f%%',
                                       startangle=90, colors=sns.color_palette("Set3")[:len(type_counts)],
                                       pctdistance=0.85, textprops={'fontsize': 11, 'fontweight': 'bold'})
    for autotext in autotexts:
        autotext.set_color('black')
    ax1.set_title("Equipment Type Distribution", fontsize=16, fontweight='bold', color='#1f2937')
    ax1.legend(wedges, type_counts.index, title="Types", loc="center right", bbox_to_anchor=(0, 0.5), fontsize=10, frameon=False)

    # Bar: Equipment by Criticality
    ax2 = fig.add_subplot(gs[1, 2:4])
    crit_levels = ["High", "Medium", "Low"]
    crit_colors = ["#ef4444", "#f59e0b", "#10b981"]
    crit_vals = [equipment[equipment["criticality"] == c].shape[0] for c in crit_levels]
    bars = ax2.bar(crit_levels, crit_vals, color=crit_colors, alpha=0.8, width=0.6)
    ax2.set_title("Equipment by Criticality Level", fontsize=16, fontweight='bold', color='#1f2937')
    ax2.set_xlabel("Criticality", fontweight='bold')
    ax2.set_ylabel("Count", fontweight='bold')
    ax2.grid(axis='y', alpha=0.3)
    for bar in bars:
        ax2.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.3, f'{int(bar.get_height())}',
                 ha='center', va='bottom', fontweight='bold', fontsize=12)

    # Bar: 10-Day Maintenance Forecast
    ax3 = fig.add_subplot(gs[1, 4:6])
    maint_counts = predictions["needs_maintenance_10_days"].value_counts().sort_index()
    data = [maint_counts.get(0, 0), maint_counts.get(1, 0)]
    bars = ax3.bar(["No Maintenance", "Needs Maintenance"], data, color=["#10b981", "#ef4444"], alpha=0.8, width=0.5)
    ax3.set_title("10-Day Maintenance Forecast", fontsize=16, fontweight='bold', color='#1f2937')
    ax3.set_ylabel("Count", fontweight='bold')
    ax3.grid(axis='y', alpha=0.3)
    for bar in bars:
        ax3.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5, f'{int(bar.get_height())}',
                 ha='center', va='bottom', fontweight='bold', fontsize=12)

    # === ROW 3 ===
    # Horizontal Bar: Equipment by Location
    ax4 = fig.add_subplot(gs[2, 0:3])
    loc_counts = equipment["location"].value_counts().head(6)
    bars = ax4.barh(range(len(loc_counts)), loc_counts.values, color=plt.cm.viridis(np.linspace(0.2, 0.8, len(loc_counts))))
    ax4.set_yticks(range(len(loc_counts)))
    ax4.set_yticklabels(loc_counts.index, fontsize=11)
    ax4.set_title("Top Equipment Locations", fontsize=16, fontweight='bold', color='#1f2937')
    ax4.set_xlabel("Count", fontweight='bold')
    ax4.grid(axis='x', alpha=0.3)
    for i, bar in enumerate(bars):
        ax4.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2, f'{int(bar.get_width())}',
                 ha='left', va='center', fontweight='bold', fontsize=11)

    # Vertical Bar: Personnel by Department
    ax5 = fig.add_subplot(gs[2, 3:6])
    dept_counts = personnel["department"].value_counts()
    bars = ax5.bar(range(len(dept_counts)), dept_counts.values, color=plt.cm.Set3(np.linspace(0, 1, len(dept_counts))), alpha=0.8)
    ax5.set_xticks(range(len(dept_counts)))
    ax5.set_xticklabels(dept_counts.index, rotation=30, ha='right', fontsize=10)
    ax5.set_title("Personnel by Department", fontsize=16, fontweight='bold', color='#1f2937')
    ax5.set_ylabel("Count", fontweight='bold')
    ax5.grid(axis='y', alpha=0.3)
    for bar in bars:
        ax5.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.1, f'{int(bar.get_height())}',
                 ha='center', va='bottom', fontweight='bold', fontsize=10)

    # Style adjustments
    for ax in [ax1, ax2, ax3, ax4, ax5]:
        ax.set_facecolor('#fefefe')
        for spine in ax.spines.values():
            spine.set_color('#e5e7eb')
            spine.set_linewidth(0.5)

    # Save chart
    path = "charts/eda_overall.png"
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='#f8fafc')
    plt.close()
    conn.close()
    return path
